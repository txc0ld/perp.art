// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ForeverLibraryFactory} from "../src/ForeverLibraryFactory.sol";

/**
 * Deploy the ForeverLibraryFactory.
 *
 * Usage (testnet example):
 *   forge script script/DeployFactory.s.sol \
 *     --rpc-url base_sepolia --account deployer --broadcast --verify
 *
 * The broadcaster becomes the transaction sender; the factory has no owner.
 */
contract DeployFactory is Script {
    function run() external returns (ForeverLibraryFactory factory) {
        vm.startBroadcast();
        factory = new ForeverLibraryFactory();
        vm.stopBroadcast();

        console2.log("ForeverLibraryFactory deployed at:", address(factory));
    }
}
