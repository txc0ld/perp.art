// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LogLedger} from "../src/LogLedger.sol";

contract LogLedgerTest is Test {
    LogLedger internal ledger;
    address internal author = address(0xA11CE);
    address internal stranger = address(0xBEEF);

    bytes32 internal constant CONTENT_HASH = keccak256("content-1");
    uint32 internal constant VERSION = 1;

    event FileOpened(bytes32 indexed fileId, address indexed author);
    event FileChunk(bytes32 indexed fileId, uint32 indexed chunkIndex, bytes data);
    event FileSealed(bytes32 indexed fileId, bytes32 root, uint256 size, uint32 chunks, uint8 codec);

    function setUp() public {
        ledger = new LogLedger();
    }

    function _expectedId(address who, bytes32 contentHash, uint32 version) internal pure returns (bytes32) {
        return keccak256(abi.encode(who, contentHash, version));
    }

    function test_OpenDerivesFileIdAndSetsAuthor() public {
        bytes32 expected = _expectedId(author, CONTENT_HASH, VERSION);
        vm.prank(author);
        bytes32 fileId = ledger.open(CONTENT_HASH, VERSION);
        assertEq(fileId, expected, "fileId derived from caller+content+version");

        (,,,,,,, address a) = ledger.files(fileId);
        assertEq(a, author, "author bound to caller");
    }

    /// Anti-squat: a different caller opening identical content derives a
    /// different fileId, so a fileId can't be front-run/claimed by a non-author.
    function test_DifferentCallerDerivesDifferentFileId() public {
        vm.prank(author);
        bytes32 idA = ledger.open(CONTENT_HASH, VERSION);
        vm.prank(stranger);
        bytes32 idB = ledger.open(CONTENT_HASH, VERSION);
        assertTrue(idA != idB, "distinct callers => distinct fileIds");
        assertEq(idA, _expectedId(author, CONTENT_HASH, VERSION));
        assertEq(idB, _expectedId(stranger, CONTENT_HASH, VERSION));
    }

    function test_OpenUploadSealHappyPath() public {
        vm.prank(author);
        bytes32 fileId = ledger.open(CONTENT_HASH, VERSION);

        vm.prank(author);
        ledger.upload(fileId, 0, hex"deadbeef");
        vm.prank(author);
        ledger.upload(fileId, 1, hex"cafe");
        assertEq(ledger.nextChunk(fileId), 2, "nextChunk tracks uploads");

        vm.prank(author);
        ledger.seal(fileId, keccak256("root"), 6, 2, 1);

        (bytes32 root, uint256 size, uint32 chunks,,, uint8 codec, bool sealed_, address a) = ledger.files(fileId);
        assertEq(root, keccak256("root"));
        assertEq(size, 6);
        assertEq(chunks, 2);
        assertEq(codec, 1);
        assertTrue(sealed_);
        assertEq(a, author);
        assertTrue(ledger.isSealed(fileId));
    }

    function test_OpenRecordsDeployBlock() public {
        vm.roll(1234);
        vm.prank(author);
        bytes32 fileId = ledger.open(CONTENT_HASH, VERSION);
        (,, , uint32 deployBlock,,,,) = ledger.files(fileId);
        assertEq(deployBlock, 1234);
    }

    function test_OpenEmitsEvent() public {
        bytes32 expected = _expectedId(author, CONTENT_HASH, VERSION);
        vm.expectEmit(true, true, false, false);
        emit FileOpened(expected, author);
        vm.prank(author);
        ledger.open(CONTENT_HASH, VERSION);
    }

    function test_UploadEmitsChunk() public {
        vm.prank(author);
        bytes32 fileId = ledger.open(CONTENT_HASH, VERSION);
        vm.expectEmit(true, true, false, true);
        emit FileChunk(fileId, 0, hex"1234");
        vm.prank(author);
        ledger.upload(fileId, 0, hex"1234");
    }

    function test_CannotReopen() public {
        vm.prank(author);
        bytes32 fileId = ledger.open(CONTENT_HASH, VERSION);
        vm.prank(author);
        vm.expectRevert(LogLedger.AlreadyOpened.selector);
        ledger.open(CONTENT_HASH, VERSION);
        fileId; // silence unused
    }

    function test_UploadBeforeOpenReverts() public {
        bytes32 fileId = _expectedId(author, CONTENT_HASH, VERSION);
        vm.prank(author);
        vm.expectRevert(LogLedger.NotOpened.selector);
        ledger.upload(fileId, 0, hex"00");
    }

    function test_OnlyAuthorUploads() public {
        vm.prank(author);
        bytes32 fileId = ledger.open(CONTENT_HASH, VERSION);
        vm.prank(stranger);
        vm.expectRevert(LogLedger.NotAuthor.selector);
        ledger.upload(fileId, 0, hex"00");
    }

    function test_OnlyAuthorSeals() public {
        vm.prank(author);
        bytes32 fileId = ledger.open(CONTENT_HASH, VERSION);
        vm.prank(stranger);
        vm.expectRevert(LogLedger.NotAuthor.selector);
        ledger.seal(fileId, keccak256("r"), 1, 1, 0);
    }

    /// Out-of-order (skipping an index) reverts ChunkOutOfOrder.
    function test_OutOfOrderChunkReverts() public {
        vm.prank(author);
        bytes32 fileId = ledger.open(CONTENT_HASH, VERSION);
        vm.prank(author);
        vm.expectRevert(LogLedger.ChunkOutOfOrder.selector);
        ledger.upload(fileId, 1, hex"00"); // expected 0
    }

    /// Duplicate index (re-uploading an already-consumed index) reverts.
    function test_DuplicateChunkReverts() public {
        vm.prank(author);
        bytes32 fileId = ledger.open(CONTENT_HASH, VERSION);
        vm.prank(author);
        ledger.upload(fileId, 0, hex"00");
        vm.prank(author);
        vm.expectRevert(LogLedger.ChunkOutOfOrder.selector);
        ledger.upload(fileId, 0, hex"01"); // 0 already consumed; expected 1
    }

    /// Sealing with a `chunks` that disagrees with what was uploaded reverts.
    function test_SealWrongChunkCountReverts() public {
        vm.prank(author);
        bytes32 fileId = ledger.open(CONTENT_HASH, VERSION);
        vm.prank(author);
        ledger.upload(fileId, 0, hex"00");
        vm.prank(author);
        vm.expectRevert(LogLedger.ChunkCountMismatch.selector);
        ledger.seal(fileId, keccak256("r"), 1, 5, 0); // uploaded 1, asserts 5
    }

    function test_CannotUploadAfterSeal() public {
        vm.prank(author);
        bytes32 fileId = ledger.open(CONTENT_HASH, VERSION);
        vm.prank(author);
        ledger.seal(fileId, keccak256("r"), 0, 0, 0);
        vm.prank(author);
        vm.expectRevert(LogLedger.AlreadySealed.selector);
        ledger.upload(fileId, 0, hex"00");
    }

    function test_CannotSealTwice() public {
        vm.prank(author);
        bytes32 fileId = ledger.open(CONTENT_HASH, VERSION);
        vm.prank(author);
        ledger.seal(fileId, keccak256("r"), 0, 0, 0);
        vm.prank(author);
        vm.expectRevert(LogLedger.AlreadySealed.selector);
        ledger.seal(fileId, keccak256("r2"), 0, 0, 0);
    }

    /// Re-sealing identical content (same author/content/version) yields the
    /// same fileId; opening it again after the first seal reverts AlreadyOpened,
    /// so the original sealed file is reused rather than overwritten.
    function test_ResealedIdenticalContentReusesFileId() public {
        vm.prank(author);
        bytes32 fileId = ledger.open(CONTENT_HASH, VERSION);
        vm.prank(author);
        ledger.upload(fileId, 0, hex"deadbeef");
        vm.prank(author);
        ledger.seal(fileId, keccak256("root"), 4, 1, 0);

        // Re-deriving the same fileId and trying to re-open it fails: it is the
        // same un-squattable id and already finalized.
        bytes32 again = _expectedId(author, CONTENT_HASH, VERSION);
        assertEq(again, fileId, "same content => same fileId");
        vm.prank(author);
        vm.expectRevert(LogLedger.AlreadyOpened.selector);
        ledger.open(CONTENT_HASH, VERSION);
        assertTrue(ledger.isSealed(fileId));
    }
}
