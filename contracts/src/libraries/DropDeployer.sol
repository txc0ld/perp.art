// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PerpetualDrop} from "../PerpetualDrop.sol";

/// @title DropDeployer
/// @notice External library that holds the PerpetualDrop creation bytecode so
///         the factory itself stays under the EIP-170 24,576-byte limit.
/// @dev    Linked (not inlined) because the function is `external` and the
///         library is non-embeddable; the factory delegates deployment here.
library DropDeployer {
    function deploy(
        string calldata name,
        string calldata symbol,
        address owner,
        uint96 royaltyBps,
        uint256 maxSupply,
        string calldata placeholderBaseURI
    ) external returns (address) {
        return address(
            new PerpetualDrop(name, symbol, owner, royaltyBps, maxSupply, placeholderBaseURI)
        );
    }
}
