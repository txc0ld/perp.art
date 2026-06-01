// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ForeverLibrary} from "../ForeverLibrary.sol";

/// @title CollectionDeployer
/// @notice External library that holds the ForeverLibrary creation bytecode so
///         the factory itself stays under the EIP-170 24,576-byte limit.
library CollectionDeployer {
    function deploy(
        string calldata name,
        string calldata symbol,
        address owner,
        uint64 editWindow
    ) external returns (address) {
        return address(new ForeverLibrary(name, symbol, owner, editWindow));
    }
}
