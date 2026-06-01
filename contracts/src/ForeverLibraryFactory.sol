// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*//////////////////////////////////////////////////////////////////////////
    PERPETUAL - UNAUDITED REFERENCE SCAFFOLD - DO NOT DEPLOY WITH VALUE
    ---------------------------------------------------------------------
    Factory that deploys sovereign ForeverLibrary collections for
    artists on the Perpetual marketplace (PRD §7.5).
//////////////////////////////////////////////////////////////////////////*/

import {ForeverLibrary} from "./ForeverLibrary.sol";

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

    /*//////////////////////////////////////////////////////////////////////
                                    STORAGE
    //////////////////////////////////////////////////////////////////////*/

    /// @dev Ordered list of all deployed ForeverLibrary addresses.
    address[] public collections;

    /// @dev Quick membership test (deployed by this factory).
    mapping(address => bool) public isCollection;

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
        ForeverLibrary fl = new ForeverLibrary(name, symbol, msg.sender, editWindow_);
        col = address(fl);
        collections.push(col);
        isCollection[col] = true;
        emit CollectionCreated(col, msg.sender, name, symbol);
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
}
