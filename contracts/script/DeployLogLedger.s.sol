// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {LogLedger} from "../src/LogLedger.sol";

/**
 * Deploy the standalone LogLedger contract.
 *
 * Usage:
 *   forge script script/DeployLogLedger.s.sol \
 *     --rpc-url base_sepolia --account deployer --broadcast --verify
 *
 * No constructor args; LogLedger is permissionless (per-fileId author gating).
 */
contract DeployLogLedger is Script {
    function run() external returns (LogLedger ledger) {
        vm.startBroadcast();
        ledger = new LogLedger();
        vm.stopBroadcast();
        console2.log("LogLedger deployed at:", address(ledger));
    }
}
