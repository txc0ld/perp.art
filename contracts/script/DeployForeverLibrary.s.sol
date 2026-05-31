// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {ForeverLibrary} from "../src/ForeverLibrary.sol";

/**
 * Deploy the shared Forever Library token contract.
 *
 * Usage (testnet example):
 *   forge script script/DeployForeverLibrary.s.sol \
 *     --rpc-url base_sepolia --account deployer --broadcast --verify
 *
 * Env:
 *   FL_NAME, FL_SYMBOL    optional overrides (defaults: Perpetual / PERP)
 *   FL_EDIT_WINDOW        optional edit window seconds (default 7 days)
 *   the broadcaster becomes the contract owner.
 */
contract DeployForeverLibrary is Script {
    function run() external returns (ForeverLibrary fl) {
        string memory name = vm.envOr("FL_NAME", string("Perpetual"));
        string memory symbol = vm.envOr("FL_SYMBOL", string("PERP"));
        uint64 editWindow = uint64(vm.envOr("FL_EDIT_WINDOW", uint256(7 days)));

        vm.startBroadcast();
        fl = new ForeverLibrary(name, symbol, msg.sender, editWindow);
        vm.stopBroadcast();

        console2.log("ForeverLibrary deployed at:", address(fl));
        console2.log("owner:", msg.sender);
    }
}
