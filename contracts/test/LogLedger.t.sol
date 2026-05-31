// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LogLedger} from "../src/LogLedger.sol";

contract LogLedgerTest is Test {
    LogLedger internal ledger;
    address internal author = address(0xA11CE);
    address internal stranger = address(0xBEEF);
    bytes32 internal constant FILE_ID = keccak256("file-1");

    event FileOpened(bytes32 indexed fileId, address indexed author);
    event FileChunk(bytes32 indexed fileId, uint32 indexed chunkIndex, bytes data);
    event FileSealed(bytes32 indexed fileId, bytes32 root, uint256 size, uint32 chunks, uint8 codec);

    function setUp() public {
        ledger = new LogLedger();
    }

    function test_OpenUploadSealHappyPath() public {
        vm.prank(author);
        ledger.open(FILE_ID);

        vm.prank(author);
        ledger.upload(FILE_ID, 0, hex"deadbeef");
        vm.prank(author);
        ledger.upload(FILE_ID, 1, hex"cafe");

        vm.prank(author);
        ledger.seal(FILE_ID, keccak256("root"), 6, 2, 1);

        (bytes32 root, uint256 size, uint32 chunks,, uint8 codec, bool sealed_, address a) = ledger.files(FILE_ID);
        assertEq(root, keccak256("root"));
        assertEq(size, 6);
        assertEq(chunks, 2);
        assertEq(codec, 1);
        assertTrue(sealed_);
        assertEq(a, author);
        assertTrue(ledger.isSealed(FILE_ID));
    }

    function test_OpenRecordsDeployBlock() public {
        vm.roll(1234);
        vm.prank(author);
        ledger.open(FILE_ID);
        (,,, uint32 deployBlock,,,) = ledger.files(FILE_ID);
        assertEq(deployBlock, 1234);
    }

    function test_OpenEmitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit FileOpened(FILE_ID, author);
        vm.prank(author);
        ledger.open(FILE_ID);
    }

    function test_UploadEmitsChunk() public {
        vm.prank(author);
        ledger.open(FILE_ID);
        vm.expectEmit(true, true, false, true);
        emit FileChunk(FILE_ID, 7, hex"1234");
        vm.prank(author);
        ledger.upload(FILE_ID, 7, hex"1234");
    }

    function test_CannotReopen() public {
        vm.prank(author);
        ledger.open(FILE_ID);
        vm.prank(author);
        vm.expectRevert(LogLedger.AlreadySealed.selector);
        ledger.open(FILE_ID);
    }

    function test_OnlyAuthorUploads() public {
        vm.prank(author);
        ledger.open(FILE_ID);
        vm.prank(stranger);
        vm.expectRevert(LogLedger.NotAuthor.selector);
        ledger.upload(FILE_ID, 0, hex"00");
    }

    function test_OnlyAuthorSeals() public {
        vm.prank(author);
        ledger.open(FILE_ID);
        vm.prank(stranger);
        vm.expectRevert(LogLedger.NotAuthor.selector);
        ledger.seal(FILE_ID, keccak256("r"), 1, 1, 0);
    }

    function test_CannotUploadAfterSeal() public {
        vm.prank(author);
        ledger.open(FILE_ID);
        vm.prank(author);
        ledger.seal(FILE_ID, keccak256("r"), 0, 0, 0);
        vm.prank(author);
        vm.expectRevert(LogLedger.AlreadySealed.selector);
        ledger.upload(FILE_ID, 0, hex"00");
    }

    function test_CannotSealTwice() public {
        vm.prank(author);
        ledger.open(FILE_ID);
        vm.prank(author);
        ledger.seal(FILE_ID, keccak256("r"), 0, 0, 0);
        vm.prank(author);
        vm.expectRevert(LogLedger.AlreadySealed.selector);
        ledger.seal(FILE_ID, keccak256("r2"), 0, 0, 0);
    }
}
