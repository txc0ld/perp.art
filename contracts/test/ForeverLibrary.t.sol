// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ForeverLibrary} from "../src/ForeverLibrary.sol";
import {IForeverLibrary} from "../src/interfaces/IForeverLibrary.sol";

contract ForeverLibraryTest is Test {
    ForeverLibrary internal fl;
    address internal owner = address(0xA11CE);
    uint64 internal constant EDIT_WINDOW = 7 days;

    function setUp() public {
        fl = new ForeverLibrary("Perpetual", "PERP", owner, EDIT_WINDOW);
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
            "ethfs://proof",
            keccak256("proof-bytes")
        );

        assertEq(fl.ownerOf(id), address(this));
        assertTrue(fl.shard0Configured(id), "shard0 must be configured at mint");
        assertEq(fl.shardCount(id), 1);
        assertEq(uint8(fl.shardBackend(id, 0)), uint8(IForeverLibrary.ShardBackend.Onchain));
        assertEq(fl.shardContentHash(id, 0), keccak256("proof-bytes"));

        IForeverLibrary.MintData memory d = fl.getMintData(id);
        assertEq(d.creator, address(this));
        assertEq(d.title, "Strata No. 1");
        assertEq(d.royaltyBps, 750);

        // ERC-2981 royalty is set to the creator at the minted bps.
        (address receiver, uint256 amount) = fl.royaltyInfo(id, 1 ether);
        assertEq(receiver, address(this));
        assertEq(amount, (1 ether * 750) / 10_000);
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

    function _mint() internal returns (uint256) {
        return fl.mint(
            address(this),
            "Artist",
            "Work",
            "image/png",
            500,
            keccak256("m"),
            "ethfs://p",
            keccak256("p")
        );
    }
}
