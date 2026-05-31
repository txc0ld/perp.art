// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {PerpetualSettlement} from "../src/PerpetualSettlement.sol";

/**
 * Deploy the settlement exchange.
 *
 * Usage:
 *   forge script script/DeploySettlement.s.sol \
 *     --rpc-url base_sepolia --account deployer --broadcast --verify
 *
 * Env:
 *   PROTOCOL_FEE_RECIPIENT  fee recipient (defaults to the broadcaster).
 *   the broadcaster becomes the contract owner.
 */
contract DeploySettlement is Script {
    function run() external returns (PerpetualSettlement exchange) {
        address feeRecipient = vm.envOr("PROTOCOL_FEE_RECIPIENT", msg.sender);

        vm.startBroadcast();
        exchange = new PerpetualSettlement(msg.sender, payable(feeRecipient));
        vm.stopBroadcast();

        console2.log("PerpetualSettlement deployed at:", address(exchange));
        console2.log("owner:", msg.sender);
        console2.log("feeRecipient:", feeRecipient);
    }
}
