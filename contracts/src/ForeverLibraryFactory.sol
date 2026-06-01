// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*//////////////////////////////////////////////////////////////////////////
    PERPETUAL - UNAUDITED REFERENCE SCAFFOLD - DO NOT DEPLOY WITH VALUE
    ---------------------------------------------------------------------
    Factory that deploys sovereign ForeverLibrary collections for
    artists on the Perpetual marketplace (PRD §7.5).
//////////////////////////////////////////////////////////////////////////*/

import {CollectionDeployer} from "./libraries/CollectionDeployer.sol";
import {DropDeployer} from "./libraries/DropDeployer.sol";

/// @title ForeverLibraryFactory
/// @notice Deploys and enumerates sovereign ForeverLibrary collections.
///         Each artist (or operator) calls `createCollection` to get their
///         own ERC-721 + ERC-2981 token contract, owned by themselves, while
///         remaining discoverable by the marketplace via this registry.
contract ForeverLibraryFactory {
    /*//////////////////////////////////////////////////////////////////////
                                    EVENTS
    //////////////////////////////////////////////////////////////////////*/

    /// @notice Emitted when a new ForeverLibrary collection is created.
    /// @param collection  the address of the newly deployed ForeverLibrary.
    /// @param owner       msg.sender at creation time (sovereign artist or operator).
    /// @param name        ERC-721 collection name.
    /// @param symbol      ERC-721 collection symbol.
    event CollectionCreated(
        address indexed collection,
        address indexed owner,
        string name,
        string symbol
    );

    /// @notice Emitted when a new PerpetualDrop (batch-mint PFP/generative
    ///         collection) is created.
    /// @param drop      the address of the newly deployed PerpetualDrop.
    /// @param owner     msg.sender at creation time (the creator).
    /// @param name      ERC-721 collection name.
    /// @param symbol    ERC-721 collection symbol.
    /// @param maxSupply hard cap on total tokens for the drop.
    event DropCreated(
        address indexed drop,
        address indexed owner,
        string name,
        string symbol,
        uint256 maxSupply
    );

    /*//////////////////////////////////////////////////////////////////////
                                    STORAGE
    //////////////////////////////////////////////////////////////////////*/

    /// @dev Ordered list of all deployed ForeverLibrary addresses.
    address[] public collections;

    /// @dev Quick membership test (deployed by this factory).
    mapping(address => bool) public isCollection;

    /// @dev Ordered list of all deployed PerpetualDrop addresses.
    address[] public drops;

    /// @dev Quick membership test (drop deployed by this factory).
    mapping(address => bool) public isDrop;

    /*//////////////////////////////////////////////////////////////////////
                                FACTORY FUNCTION
    //////////////////////////////////////////////////////////////////////*/

    /// @notice Deploy a new ForeverLibrary owned by the caller.
    /// @param name        ERC-721 collection name.
    /// @param symbol      ERC-721 collection symbol.
    /// @param editWindow_ Seconds after mint during which shards may be edited.
    /// @return col        Address of the newly deployed ForeverLibrary.
    function createCollection(
        string calldata name,
        string calldata symbol,
        uint64 editWindow_
    ) external returns (address col) {
        col = CollectionDeployer.deploy(name, symbol, msg.sender, editWindow_);
        collections.push(col);
        isCollection[col] = true;
        emit CollectionCreated(col, msg.sender, name, symbol);
    }

    /// @notice Deploy a new PerpetualDrop (batch-mint PFP/generative collection)
    ///         owned by the caller.
    /// @param name               ERC-721 collection name.
    /// @param symbol             ERC-721 collection symbol.
    /// @param royaltyBps         default ERC-2981 royalty in basis points.
    /// @param maxSupply          hard cap on total tokens.
    /// @param placeholderBaseURI pre-reveal base URI (tokenURI = baseURI + id).
    /// @return drop              Address of the newly deployed PerpetualDrop.
    function createDrop(
        string calldata name,
        string calldata symbol,
        uint96 royaltyBps,
        uint256 maxSupply,
        string calldata placeholderBaseURI
    ) external returns (address drop) {
        drop = DropDeployer.deploy(
            name, symbol, msg.sender, royaltyBps, maxSupply, placeholderBaseURI
        );
        drops.push(drop);
        isDrop[drop] = true;
        emit DropCreated(drop, msg.sender, name, symbol, maxSupply);
    }

    /*//////////////////////////////////////////////////////////////////////
                                    VIEWS
    //////////////////////////////////////////////////////////////////////*/

    /// @notice Total number of ForeverLibrary collections created by this factory.
    function collectionsCount() external view returns (uint256) {
        return collections.length;
    }

    /// @notice Address of the collection at position `index` in the registry.
    function collectionAt(uint256 index) external view returns (address) {
        return collections[index];
    }

    /// @notice Total number of PerpetualDrops created by this factory.
    function dropsCount() external view returns (uint256) {
        return drops.length;
    }

    /// @notice Address of the drop at position `index` in the registry.
    function dropAt(uint256 index) external view returns (address) {
        return drops[index];
    }
}
