// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ForeverLibraryFactory} from "../src/ForeverLibraryFactory.sol";

/**
 * Deploy the ForeverLibraryFactory.
 *
 * The factory delegates contract creation to two external libraries
 * (CollectionDeployer, DropDeployer) so it stays under the EIP-170
 * 24,576-byte limit. Foundry auto-deploys and links these libraries when
 * running this script. For a manual keystore deploy, deploy each library
 * first and link with `--libraries`:
 *
 *   forge create src/libraries/CollectionDeployer.sol:CollectionDeployer --account deployer ...
 *   forge create src/libraries/DropDeployer.sol:DropDeployer --account deployer ...
 *   forge create src/ForeverLibraryFactory.sol:ForeverLibraryFactory --account deployer \
 *     --libraries src/libraries/CollectionDeployer.sol:CollectionDeployer:<addr> \
 *     --libraries src/libraries/DropDeployer.sol:DropDeployer:<addr>
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
