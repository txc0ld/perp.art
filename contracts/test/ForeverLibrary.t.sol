// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ForeverLibrary} from "../src/ForeverLibrary.sol";
import {IForeverLibrary} from "../src/interfaces/IForeverLibrary.sol";

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
}
