// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ForeverLibrary} from "../src/ForeverLibrary.sol";
import {IForeverLibrary} from "../src/interfaces/IForeverLibrary.sol";
import {Base64} from "solady/utils/Base64.sol";

contract ForeverLibraryTest is Test {
    ForeverLibrary internal fl;
    address internal owner = address(0xA11CE);
    uint64 internal constant EDIT_WINDOW = 7 days;

    event HostingConfigured(uint256 indexed tokenId, uint16 hostingFeeBps, uint256 storagePaidWei);

    function setUp() public {
        fl = new ForeverLibrary("Perpetual", "PERP", owner, EDIT_WINDOW);
    }

    /// HostingConfigured reports the actual storage fee paid (artist-paid mint).
    function test_HostingConfiguredReportsStoragePaid() public {
        vm.prank(owner);
        fl.setStorageFeeWei(0.001 ether);
        vm.deal(address(this), 1 ether);
        vm.expectEmit(true, false, false, true);
        emit HostingConfigured(1, 0, 0.001 ether); // fresh contract → first token id is 1
        fl.mint{value: 0.001 ether}(
            address(this), "A", "Paid", "image/png", 500,
            keccak256("m"), bytes("proof"), 0
        );
    }

    /// Accept safeMint into this test contract (ERC-721 receiver).
    function onERC721Received(address, address, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return 0x150b7a02; // IERC721Receiver.onERC721Received.selector
    }

    /// Minting writes provenance, the mandatory onchain proof (Shard 0), and royalty.
    function test_MintConfiguresMandatoryOnchainProof() public {
        uint256 id = fl.mint(
            address(this),
            "Claude Wren",
            "Strata No. 1",
            "image/svg+xml",
            750, // 7.5%
            keccak256("metadata"),
            bytes("proof-bytes"),
            0 // artist-paid (fee-exempt)
        );

        assertEq(fl.ownerOf(id), address(this));
        assertTrue(fl.shard0Configured(id), "shard0 must be configured at mint");
        assertEq(fl.shardCount(id), 1);
        assertEq(uint8(fl.shardBackend(id, 0)), uint8(IForeverLibrary.ShardBackend.Onchain));
        // Content hash is computed on-chain from the bytes (trustless).
        assertEq(fl.shardContentHash(id, 0), keccak256(bytes("proof-bytes")));

        // Shard 0 resolves to an on-chain data URI built from the SSTORE2 bytes.
        string memory uri = fl.shardURI(id, 0);
        assertEq(_startsWith(uri, "data:image/svg+xml;base64,"), true, "shard0 is an on-chain data URI");

        IForeverLibrary.MintData memory d = fl.getMintData(id);
        assertEq(d.creator, address(this));
        assertEq(d.title, "Strata No. 1");
        assertEq(d.royaltyBps, 750);

        (address receiver, uint256 amount) = fl.royaltyInfo(id, 1 ether);
        assertEq(receiver, address(this));
        assertEq(amount, (1 ether * 750) / 10_000);
    }

    /// @dev True if `str` begins with `prefix`.
    function _startsWith(string memory str, string memory prefix) internal pure returns (bool) {
        bytes memory s = bytes(str);
        bytes memory p = bytes(prefix);
        if (s.length < p.length) return false;
        for (uint256 i = 0; i < p.length; i++) {
            if (s[i] != p[i]) return false;
        }
        return true;
    }

    /// Redundant shards can be appended within the edit window.
    function test_AppendRedundantShard() public {
        uint256 id = _mint();
        fl.configureShard(id, 1, IForeverLibrary.ShardBackend.IPFS, "ipfs://cid", keccak256("ipfs"));
        assertEq(fl.shardCount(id), 2);
        assertEq(fl.shardURI(id, 1), "ipfs://cid");
        assertEq(uint8(fl.shardBackend(id, 1)), uint8(IForeverLibrary.ShardBackend.IPFS));
    }

    /// Shard 0 (the onchain proof) can never be reconfigured.
    function test_CannotReconfigureShard0() public {
        uint256 id = _mint();
        vm.expectRevert(ForeverLibrary.Shard0AlreadyConfigured.selector);
        fl.configureShard(id, 0, IForeverLibrary.ShardBackend.Onchain, "x", keccak256("x"));
    }

    /// Locking makes shards permanently immutable.
    function test_LockFreezesShards() public {
        uint256 id = _mint();
        fl.lockShards(id);
        assertTrue(fl.isLocked(id));
        vm.expectRevert(ForeverLibrary.ShardsAreLocked.selector);
        fl.configureShard(id, 1, IForeverLibrary.ShardBackend.IPFS, "ipfs://cid", keccak256("ipfs"));
    }

    /// Edits are rejected after the edit window closes.
    function test_EditWindowCloses() public {
        uint256 id = _mint();
        vm.warp(block.timestamp + EDIT_WINDOW + 1);
        vm.expectRevert(ForeverLibrary.EditWindowClosed.selector);
        fl.configureShard(id, 1, IForeverLibrary.ShardBackend.IPFS, "ipfs://cid", keccak256("ipfs"));
    }

    /// Only the creator may configure shards.
    function test_OnlyCreatorConfigures() public {
        uint256 id = _mint();
        vm.prank(address(0xBEEF));
        vm.expectRevert(ForeverLibrary.NotTokenCreator.selector);
        fl.configureShard(id, 1, IForeverLibrary.ShardBackend.IPFS, "ipfs://cid", keccak256("ipfs"));
    }

    /// Perpetual-hosted mint records the per-token hosting fee and takes no payment.
    function test_HostedMintRecordsFee() public {
        uint256 id = fl.mint(
            address(this), "Artist", "Hosted", "image/png", 500,
            keccak256("m"), bytes("proof"), 150
        );
        assertEq(fl.hostingFeeBps(id), 150);
    }

    /// Hosting fee above the cap is rejected.
    function test_HostingFeeTooHighReverts() public {
        vm.expectRevert(ForeverLibrary.HostingFeeTooHigh.selector);
        fl.mint(
            address(this), "Artist", "X", "image/png", 500,
            keccak256("m"), bytes("proof"), 151
        );
    }

    /// Artist-paid mint must cover the storage fee, which forwards to the treasury.
    function test_ArtistPaidRequiresStorageFee() public {
        vm.prank(owner);
        fl.setStorageFeeWei(0.001 ether);
        vm.deal(address(this), 1 ether);
        // too little reverts
        vm.expectRevert(ForeverLibrary.InsufficientStorageFee.selector);
        fl.mint(
            address(this), "Artist", "Y", "image/png", 500,
            keccak256("m"), bytes("proof"), 0
        );
        // exact amount succeeds and is fee-exempt
        uint256 id = fl.mint{value: 0.001 ether}(
            address(this), "Artist", "Y", "image/png", 500,
            keccak256("m"), bytes("proof"), 0
        );
        assertEq(fl.hostingFeeBps(id), 0);
    }

    /// A hosted (fee>0) mint must not carry payment.
    function test_HostedMintRejectsPayment() public {
        vm.expectRevert(ForeverLibrary.UnexpectedPayment.selector);
        fl.mint{value: 1 wei}(
            address(this), "Artist", "Z", "image/png", 500,
            keccak256("m"), bytes("proof"), 150
        );
    }

    /// Proof bytes above the SSTORE2 cap are rejected.
    function test_ProofTooLargeReverts() public {
        bytes memory big = new bytes(24_001);
        vm.expectRevert(ForeverLibrary.ProofTooLarge.selector);
        fl.mint(address(this), "A", "Big", "image/png", 500, keccak256("m"), big, 0);
    }

    /// Empty proof bytes are rejected (Shard 0 must carry real bytes).
    function test_EmptyProofReverts() public {
        vm.expectRevert(ForeverLibrary.EmptyProof.selector);
        fl.mint(address(this), "A", "Empty", "image/png", 500, keccak256("m"), bytes(""), 0);
    }

    /// A high-res Log shard attaches as an ordinary appended shard.
    function test_AppendLogShard() public {
        uint256 id = _mint();
        fl.configureShard(
            id, 1, IForeverLibrary.ShardBackend.Log,
            "log://0x0000000000000000000000000000000000000abc/0xfeed",
            keccak256("merkle-root")
        );
        assertEq(fl.shardCount(id), 2);
        assertEq(uint8(fl.shardBackend(id, 1)), uint8(IForeverLibrary.ShardBackend.Log));
        assertEq(fl.shardURI(id, 1), "log://0x0000000000000000000000000000000000000abc/0xfeed");
    }

    function _mint() internal returns (uint256) {
        return fl.mint(
            address(this),
            "Artist",
            "Work",
            "image/png",
            500,
            keccak256("m"),
            bytes("proof-bytes"),
            0
        );
    }

    /*//////////////////////////////////////////////////////////////////////
                            EDITION TESTS
    //////////////////////////////////////////////////////////////////////*/

    /// mintEdition of size 3 yields 3 contiguous tokens: identical shard0 URI,
    /// identical content hash, correct editionSize/editionIndex on each.
    function test_MintEditionSharesStateAndIndexes() public {
        bytes memory proof = bytes("edition-proof-bytes");
        uint32 sz = 3;
        uint256 first = fl.mintEdition(
            address(this),
            "Edition Artist",
            "Edition Work",
            "image/png",
            500,
            keccak256("metadata"),
            proof,
            0,   // artist-paid
            sz
        );

        string memory uri0 = fl.shardURI(first, 0);
        bytes32 ch = fl.shardContentHash(first, 0);

        for (uint256 i = 0; i < sz; i++) {
            uint256 id = first + i;
            assertEq(fl.ownerOf(id), address(this), "owner");
            assertTrue(fl.shard0Configured(id), "shard0 configured");
            assertEq(fl.shardCount(id), 1, "shard count");
            assertEq(
                uint8(fl.shardBackend(id, 0)),
                uint8(IForeverLibrary.ShardBackend.Onchain),
                "shard0 backend"
            );
            // All edition tokens must share the same content hash and data URI.
            assertEq(fl.shardContentHash(id, 0), keccak256(proof), "content hash");
            assertEq(fl.shardContentHash(id, 0), ch, "shared content hash");
            assertEq(
                keccak256(bytes(fl.shardURI(id, 0))),
                keccak256(bytes(uri0)),
                "byte-identical shard0 URI"
            );
            // editionSize is 3 for all; editionIndex is 1-based.
            assertEq(fl.editionSize(id), sz, "editionSize");
            assertEq(fl.editionIndex(id), uint32(i + 1), "editionIndex");
        }
    }

    /// Storage fee is charged ONCE for the whole edition, not per token.
    function test_MintEditionChargesFeeOnce() public {
        vm.prank(owner);
        fl.setStorageFeeWei(0.01 ether);

        vm.deal(address(this), 1 ether);
        uint256 treasuryBefore = address(fl.treasury()).balance;

        fl.mintEdition{value: 0.01 ether}(
            address(this),
            "Artist",
            "Work",
            "image/png",
            500,
            keccak256("m"),
            bytes("proof"),
            0,
            5  // edition of 5
        );

        uint256 treasuryAfter = address(fl.treasury()).balance;
        assertEq(treasuryAfter - treasuryBefore, 0.01 ether, "fee charged once");
    }

    /// editionSize 0 and 101 must revert with InvalidEditionSize.
    function test_MintEditionSizeBounds() public {
        vm.expectRevert(ForeverLibrary.InvalidEditionSize.selector);
        fl.mintEdition(
            address(this), "A", "B", "image/png", 500, keccak256("m"), bytes("proof"), 0, 0
        );

        vm.expectRevert(ForeverLibrary.InvalidEditionSize.selector);
        fl.mintEdition(
            address(this), "A", "B", "image/png", 500, keccak256("m"), bytes("proof"), 0, 101
        );
    }

    /// A regular mint has editionSize==1 and editionIndex==1.
    function test_SingleMintIsEditionOfOne() public {
        uint256 id = _mint();
        assertEq(fl.editionSize(id), 1, "editionSize defaults to 1");
        assertEq(fl.editionIndex(id), 1, "editionIndex defaults to 1");
    }

    /*//////////////////////////////////////////////////////////////////////
                        OPENSEA METADATA TESTS
    //////////////////////////////////////////////////////////////////////*/

    /// tokenURI returns a base64 JSON document containing name/description/image.
    function test_TokenURIReturnsJSONMetadata() public {
        uint256 id = fl.mint(
            address(this), "Claude Wren", "Strata No. 1", "image/svg+xml",
            750, keccak256("metadata"), bytes("proof-bytes"), 0
        );

        string memory uri = fl.tokenURI(id);
        string memory prefix = "data:application/json;base64,";
        assertTrue(_startsWith(uri, prefix), "json data uri prefix");

        string memory json = string(Base64.decode(_slice(uri, bytes(prefix).length)));
        assertTrue(_contains(json, '"name":"Strata No. 1 #1"'), "name = title #id");
        assertTrue(_contains(json, "Claude Wren"), "artist in description/attributes");
        // image is the on-chain STATE data uri (Shard 0 fallback).
        assertTrue(_contains(json, '"image":"data:image/svg+xml;base64,'), "image field");
        assertTrue(_contains(json, '"attributes":['), "attributes array");
        assertTrue(_contains(json, '"trait_type":"Media type"'), "media type trait");
    }

    /// Edition tokens carry an "X of N" Edition attribute in their metadata.
    function test_TokenURIEditionAttribute() public {
        uint256 first = fl.mintEdition(
            address(this), "Artist", "Series", "image/png",
            500, keccak256("m"), bytes("proof"), 0, 3
        );
        string memory prefix = "data:application/json;base64,";
        string memory json =
            string(Base64.decode(_slice(fl.tokenURI(first + 1), bytes(prefix).length)));
        assertTrue(_contains(json, '"trait_type":"Edition","value":"2 of 3"'), "edition attr");
    }

    /// contractURI returns base64 JSON with royalties + fee_recipient.
    function test_ContractURIShape() public view {
        string memory uri = fl.contractURI();
        string memory prefix = "data:application/json;base64,";
        assertTrue(_startsWith(uri, prefix), "json data uri prefix");

        string memory json = string(Base64.decode(_slice(uri, bytes(prefix).length)));
        assertTrue(_contains(json, '"name":"Perpetual"'), "collection name");
        assertTrue(_contains(json, '"seller_fee_basis_points":'), "royalty bps");
        assertTrue(_contains(json, '"fee_recipient":"'), "fee recipient");
    }

    /// Titles/artist names with quotes are JSON-escaped (no broken JSON).
    function test_TokenURIEscapesSpecialChars() public {
        uint256 id = fl.mint(
            address(this), 'Ar"tist', 'Ti"tle', "image/png",
            500, keccak256("m"), bytes("proof"), 0
        );
        string memory prefix = "data:application/json;base64,";
        string memory json =
            string(Base64.decode(_slice(fl.tokenURI(id), bytes(prefix).length)));
        // The raw double-quote must be escaped as \" inside the JSON string.
        assertTrue(_contains(json, 'Ti\\"tle'), "title escaped");
        assertTrue(_contains(json, 'Ar\\"tist'), "artist escaped");
    }

    /*//////////////////////////////////////////////////////////////////////
                    JSON-INJECTION REGRESSION (AUDIT FIXES)
    //////////////////////////////////////////////////////////////////////*/

    /// A malicious mediaType (containing JSON/data-URI-breaking bytes) is
    /// rejected at mint, so the on-chain data: URI can never be poisoned.
    function test_MintRejectsMaliciousMediaType() public {
        // Quote would break out of the data: URI and the JSON string.
        vm.expectRevert(ForeverLibrary.InvalidMediaType.selector);
        fl.mint(
            address(this), "A", "B", 'image/png","x":"y',
            500, keccak256("m"), bytes("proof"), 0
        );
    }

    /// An empty mediaType is rejected at mint.
    function test_MintRejectsEmptyMediaType() public {
        vm.expectRevert(ForeverLibrary.InvalidMediaType.selector);
        fl.mint(
            address(this), "A", "B", "",
            500, keccak256("m"), bytes("proof"), 0
        );
    }

    /// mintEdition also validates the mediaType.
    function test_MintEditionRejectsMaliciousMediaType() public {
        vm.expectRevert(ForeverLibrary.InvalidMediaType.selector);
        fl.mintEdition(
            address(this), "A", "B", "image/png ", // space is outside charset
            500, keccak256("m"), bytes("proof"), 0, 2
        );
    }

    /// A common valid MIME with all allowed charset members is accepted.
    function test_MintAcceptsValidMediaType() public {
        uint256 id = fl.mint(
            address(this), "A", "B", "image/svg+xml",
            500, keccak256("m"), bytes("proof"), 0
        );
        assertEq(fl.ownerOf(id), address(this));
    }

    /// A malicious shard `uri` containing a double-quote is JSON-escaped in
    /// tokenURI output: the decoded JSON keeps it as a \"-escaped string with
    /// no injected top-level key, and still parses as a single image value.
    function test_TokenURIEscapesMaliciousShardURI() public {
        uint256 id = _mint();
        // Attacker-controlled shard uri trying to inject a new JSON key.
        string memory evil = 'ipfs://x","injected":"pwned';
        fl.configureShard(id, 1, IForeverLibrary.ShardBackend.IPFS, evil, keccak256("e"));
        fl.setSelectedShardIndex(id, 1);

        string memory prefix = "data:application/json;base64,";
        string memory json =
            string(Base64.decode(_slice(fl.tokenURI(id), bytes(prefix).length)));

        // The raw quote is backslash-escaped inside the image string.
        assertTrue(_contains(json, 'ipfs://x\\",\\"injected\\":\\"pwned'), "uri escaped");
        // No unescaped injected top-level key broke out of the image value.
        assertTrue(!_contains(json, '","injected":"pwned"'), "no injected key");
        // The image field is present and well-formed.
        assertTrue(_contains(json, '"image":"ipfs://x\\"'), "image field intact");
    }

    /*//////////////////////////////////////////////////////////////////////
                STORAGE-FEE REFUND / ROYALTY / METADATA (AUDIT FIXES)
    //////////////////////////////////////////////////////////////////////*/

    /// Overpaying the storage fee on a single mint forwards exactly the fee to
    /// the treasury and refunds the excess to the payer.
    function test_MintRefundsStorageOverpay() public {
        vm.prank(owner);
        fl.setStorageFeeWei(0.01 ether);
        vm.deal(address(this), 1 ether);

        uint256 treasuryBefore = address(fl.treasury()).balance;
        uint256 payerBefore = address(this).balance;

        // HostingConfigured must report the actual fee charged, not msg.value.
        vm.expectEmit(true, false, false, true);
        emit HostingConfigured(1, 0, 0.01 ether);
        fl.mint{value: 0.05 ether}(
            address(this), "A", "Overpay", "image/png", 500,
            keccak256("m"), bytes("proof"), 0
        );

        assertEq(address(fl.treasury()).balance - treasuryBefore, 0.01 ether, "treasury got exact fee");
        // Payer spent only the fee; the 0.04 overpayment was refunded.
        assertEq(payerBefore - address(this).balance, 0.01 ether, "payer refunded overpay");
    }

    /// Overpaying on an edition forwards exactly the (once-charged) fee and
    /// refunds the rest.
    function test_MintEditionRefundsStorageOverpay() public {
        vm.prank(owner);
        fl.setStorageFeeWei(0.01 ether);
        vm.deal(address(this), 1 ether);

        uint256 treasuryBefore = address(fl.treasury()).balance;
        uint256 payerBefore = address(this).balance;

        fl.mintEdition{value: 0.07 ether}(
            address(this), "A", "Work", "image/png", 500,
            keccak256("m"), bytes("proof"), 0, 5
        );

        assertEq(address(fl.treasury()).balance - treasuryBefore, 0.01 ether, "fee once, exact");
        assertEq(payerBefore - address(this).balance, 0.01 ether, "edition overpay refunded");
    }

    /// Paying exactly the fee leaves nothing to refund (no spurious transfer).
    function test_MintExactFeeNoRefund() public {
        vm.prank(owner);
        fl.setStorageFeeWei(0.01 ether);
        vm.deal(address(this), 1 ether);
        uint256 payerBefore = address(this).balance;
        fl.mint{value: 0.01 ether}(
            address(this), "A", "Exact", "image/png", 500,
            keccak256("m"), bytes("proof"), 0
        );
        assertEq(payerBefore - address(this).balance, 0.01 ether, "no over-refund");
    }

    /// Royalty above the 10% mint cap reverts (matches the settlement clamp).
    function test_MintRejectsRoyaltyAboveCap() public {
        assertEq(fl.MAX_ROYALTY_BPS(), 1000);
        vm.expectRevert(ForeverLibrary.RoyaltyTooHigh.selector);
        fl.mint(
            address(this), "A", "B", "image/png", 1001, // > 10%
            keccak256("m"), bytes("proof"), 0
        );
    }

    /// Royalty exactly at the 10% cap is accepted.
    function test_MintAcceptsRoyaltyAtCap() public {
        uint256 id = fl.mint(
            address(this), "A", "B", "image/png", 1000, // exactly 10%
            keccak256("m"), bytes("proof"), 0
        );
        (, uint256 amount) = fl.royaltyInfo(id, 1 ether);
        assertEq(amount, (1 ether * 1000) / 10_000);
    }

    /// mintEdition also enforces the royalty cap.
    function test_MintEditionRejectsRoyaltyAboveCap() public {
        vm.expectRevert(ForeverLibrary.RoyaltyTooHigh.selector);
        fl.mintEdition(
            address(this), "A", "B", "image/png", 1001,
            keccak256("m"), bytes("proof"), 0, 2
        );
    }

    /// An over-long title is rejected at mint (DoS bound on metadata views).
    function test_MintRejectsTooLongTitle() public {
        string memory longTitle = string(new bytes(129)); // > MAX_TITLE_BYTES (128)
        vm.expectRevert(ForeverLibrary.MetadataTooLong.selector);
        fl.mint(
            address(this), "A", longTitle, "image/png", 500,
            keccak256("m"), bytes("proof"), 0
        );
    }

    /// An over-long artistName is rejected at mint.
    function test_MintRejectsTooLongArtistName() public {
        string memory longName = string(new bytes(65)); // > MAX_ARTIST_NAME_BYTES (64)
        vm.expectRevert(ForeverLibrary.MetadataTooLong.selector);
        fl.mint(
            address(this), longName, "B", "image/png", 500,
            keccak256("m"), bytes("proof"), 0
        );
    }

    /// An over-long mediaType is rejected at mint (length bound, distinct from
    /// the charset check).
    function test_MintRejectsTooLongMediaType() public {
        // 65 valid-charset bytes ('a' repeated) > MAX_MEDIA_TYPE_BYTES (64).
        bytes memory mt = new bytes(65);
        for (uint256 i = 0; i < mt.length; i++) mt[i] = "a";
        vm.expectRevert(ForeverLibrary.MetadataTooLong.selector);
        fl.mint(
            address(this), "A", "B", string(mt), 500,
            keccak256("m"), bytes("proof"), 0
        );
    }

    /// Metadata exactly at the caps is accepted.
    function test_MintAcceptsMetadataAtCaps() public {
        string memory title = string(new bytes(128));
        string memory artist = string(new bytes(64));
        bytes memory mt = new bytes(64);
        for (uint256 i = 0; i < mt.length; i++) mt[i] = "a";
        uint256 id = fl.mint(
            address(this), artist, title, string(mt), 500,
            keccak256("m"), bytes("proof"), 0
        );
        assertEq(fl.ownerOf(id), address(this));
    }

    /// mintEdition also bounds metadata length.
    function test_MintEditionRejectsTooLongTitle() public {
        string memory longTitle = string(new bytes(129));
        vm.expectRevert(ForeverLibrary.MetadataTooLong.selector);
        fl.mintEdition(
            address(this), "A", longTitle, "image/png", 500,
            keccak256("m"), bytes("proof"), 0, 2
        );
    }

    /// Accept refunds so the refund path can be exercised by this test contract.
    receive() external payable {}

    function _slice(string memory str, uint256 start) internal pure returns (string memory) {
        bytes memory s = bytes(str);
        bytes memory out = new bytes(s.length - start);
        for (uint256 i = start; i < s.length; i++) {
            out[i - start] = s[i];
        }
        return string(out);
    }

    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length == 0 || h.length < n.length) return false;
        for (uint256 i = 0; i <= h.length - n.length; i++) {
            bool ok = true;
            for (uint256 j = 0; j < n.length; j++) {
                if (h[i + j] != n[j]) { ok = false; break; }
            }
            if (ok) return true;
        }
        return false;
    }
}
