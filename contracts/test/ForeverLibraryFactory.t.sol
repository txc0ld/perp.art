// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, Vm} from "forge-std/Test.sol";
import {ForeverLibraryFactory} from "../src/ForeverLibraryFactory.sol";
import {ForeverLibrary} from "../src/ForeverLibrary.sol";
import {IForeverLibrary} from "../src/interfaces/IForeverLibrary.sol";

contract ForeverLibraryFactoryTest is Test {
    ForeverLibraryFactory internal factory;

    address internal alice = address(0xA11CE);
    address internal bob   = address(0xB0B);
    uint64 internal constant EDIT_WINDOW = 7 days;

    function setUp() public {
        factory = new ForeverLibraryFactory();
    }

    /// Accept safeMint into this test contract (ERC-721 receiver).
    function onERC721Received(address, address, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return 0x150b7a02;
    }

    /// createCollection deploys a ForeverLibrary owned by the caller with the
    /// correct name and symbol; isCollection returns true; count is 1.
    function test_CreateCollectionDeploysOwnedFL() public {
        vm.prank(alice);
        address col = factory.createCollection("Alice Art", "ALART", EDIT_WINDOW);

        assertTrue(col != address(0), "returned non-zero address");
        assertTrue(factory.isCollection(col), "isCollection");
        assertEq(factory.collectionsCount(), 1, "count");

        ForeverLibrary fl = ForeverLibrary(col);
        assertEq(fl.owner(), alice, "owner is caller");
        assertEq(fl.name(), "Alice Art", "name");
        assertEq(fl.symbol(), "ALART", "symbol");
    }

    /// createCollection emits CollectionCreated with the correct fields.
    function test_EmitsCollectionCreated() public {
        vm.prank(alice);
        // We can't predict the address without actually calling; capture it first
        // via a dry-run then check event. Use vm.recordLogs approach instead.
        vm.recordLogs();
        address col = factory.createCollection("Alice Art", "ALART", EDIT_WINDOW);

        // Verify the emitted event manually via logs.
        Vm.Log[] memory logs = vm.getRecordedLogs();
        // CollectionCreated(address indexed collection, address indexed owner, string name, string symbol)
        // topic[0] = keccak256("CollectionCreated(address,address,string,string)")
        bytes32 sig = keccak256("CollectionCreated(address,address,string,string)");
        bool found;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == sig) {
                found = true;
                address emittedCol = address(uint160(uint256(logs[i].topics[1])));
                address emittedOwner = address(uint160(uint256(logs[i].topics[2])));
                assertEq(emittedCol, col, "event collection");
                assertEq(emittedOwner, alice, "event owner");
            }
        }
        assertTrue(found, "CollectionCreated event emitted");
    }

    /// The owner of a created collection can mint into it.
    function test_MintIntoCreatedCollection() public {
        vm.prank(alice);
        address col = factory.createCollection("Alice Art", "ALART", EDIT_WINDOW);

        ForeverLibrary fl = ForeverLibrary(col);

        // alice mints (she is the collection owner; anyone can mint since mint
        // is unrestricted — but alice is acting as the artist here).
        vm.prank(alice);
        uint256 tokenId = fl.mint(
            alice,
            "Alice",
            "First Work",
            "image/png",
            500,
            keccak256("metadata"),
            bytes("proof-bytes"),
            150 // hosted
        );

        assertEq(fl.ownerOf(tokenId), alice, "token owner");
        assertTrue(fl.shard0Configured(tokenId), "shard0 configured");
        assertEq(fl.shardCount(tokenId), 1, "shard count");
        assertEq(
            uint8(fl.shardBackend(tokenId, 0)),
            uint8(IForeverLibrary.ShardBackend.Onchain),
            "onchain shard"
        );
    }

    /// Multiple createCollection calls yield distinct contracts and correct
    /// enumeration via collectionAt.
    function test_MultipleCollectionsEnumerable() public {
        vm.prank(alice);
        address col0 = factory.createCollection("Alice Art", "ALART", EDIT_WINDOW);

        vm.prank(bob);
        address col1 = factory.createCollection("Bob Studio", "BOB", EDIT_WINDOW);

        assertEq(factory.collectionsCount(), 2, "count 2");
        assertEq(factory.collectionAt(0), col0, "collectionAt(0)");
        assertEq(factory.collectionAt(1), col1, "collectionAt(1)");
        assertTrue(col0 != col1, "distinct addresses");
        assertTrue(factory.isCollection(col0), "isCollection col0");
        assertTrue(factory.isCollection(col1), "isCollection col1");
    }
}
