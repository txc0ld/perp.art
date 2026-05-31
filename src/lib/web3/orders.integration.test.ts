/**
 * On-chain integration test for the PerpetualSettlement order flow.
 *
 * Gated: RUN_LOGLEDGER_E2E=1 npm test -- orders.integration
 *
 * What this proves:
 *   1. The locally computed EIP-712 digest matches the contract's hashOrder()
 *      (the load-bearing correctness check for ORDER_TYPES field order).
 *   2. setApprovalForAll on the ForeverLibrary succeeds.
 *   3. fulfillOrder (relayer as both seller + buyer — self-transfer allowed)
 *      succeeds on-chain with value == price.
 *
 * Reads secrets/addresses from .env.local directly (vitest does not load it).
 * ES2017: BigInt() constructor only, no BigInt literals.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  http,
  hashTypedData,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// Populate process.env BEFORE importing modules that read env at load time
// (contracts.ts REGISTRY, serverEnv). Dynamic imports below run after.
(function loadEnvLocal() {
  let text: string;
  try {
    text = readFileSync(".env.local", "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    const val = m[2].trim().replace(/^["']|["']$/g, "");
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
})();

const RUN = process.env.RUN_LOGLEDGER_E2E === "1";
const CHAIN_ID = 84532;

describe.runIf(RUN)("PerpetualSettlement order flow (on-chain Base Sepolia)", () => {
  it(
    "local digest == contract hashOrder; fulfillOrder succeeds",
    async () => {
      // -----------------------------------------------------------------
      // Lazy imports so env is populated before serverEnv() / contracts.ts
      // read process.env at module-load time.
      // -----------------------------------------------------------------
      const { getContracts } = await import("./contracts");
      const { SETTLEMENT_ABI, FOREVER_LIBRARY_ABI } = await import("./abis");
      const { ORDER_TYPES, buildOrderDomain } = await import("./orders");
      type OrderStruct = import("./orders").OrderStruct;
      const { readOwnedTokenIds } = await import("./read-token");

      const settlementAddr = getContracts(CHAIN_ID).settlement;
      const flAddr = getContracts(CHAIN_ID).foreverLibrary;

      expect(settlementAddr, "settlement address configured").toBeDefined();
      expect(flAddr, "foreverLibrary address configured").toBeDefined();

      const relayerPk = process.env.LOGLEDGER_RELAYER_PK as Hex | undefined;
      expect(relayerPk, "LOGLEDGER_RELAYER_PK set").toBeDefined();

      const rpc = process.env.RPC_BASE_SEPOLIA;
      const account = privateKeyToAccount(relayerPk!);
      const relayerAddr = account.address;

      const publicClient = createPublicClient({
        chain: baseSepolia,
        transport: http(rpc),
      });
      const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(rpc),
      });

      // -----------------------------------------------------------------
      // Find a token owned by the relayer on Base Sepolia.
      // -----------------------------------------------------------------
      const ownedIds = await readOwnedTokenIds(CHAIN_ID, relayerAddr);
      if (ownedIds.length === 0) {
        // Relayer owns no FL tokens — skip rather than fail.
        expect(
          ownedIds.length,
          "SKIP: relayer owns no ForeverLibrary tokens on Base Sepolia; " +
            "mint one first to run the full order flow",
        ).toBeGreaterThan(0);
        return;
      }

      const tokenId = ownedIds[0];

      // -----------------------------------------------------------------
      // Read on-chain counter for the relayer.
      // -----------------------------------------------------------------
      const counter = (await publicClient.readContract({
        address: settlementAddr!,
        abi: SETTLEMENT_ABI,
        functionName: "getCounter",
        args: [relayerAddr],
      })) as bigint;

      // -----------------------------------------------------------------
      // Build the Order struct.
      // ES2017: BigInt() constructor, no literal syntax.
      // -----------------------------------------------------------------
      const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;
      const order: OrderStruct = {
        seller: relayerAddr,
        nft: flAddr!,
        tokenId,
        paymentToken: ZERO_ADDR,
        price: BigInt(1), // 1 wei — minimal, self-transfer nets back
        startTime: BigInt(0),
        endTime: BigInt(4102444800), // year 2100 — effectively never expires
        counter,
        salt: BigInt(1),
      };

      const domain = buildOrderDomain(CHAIN_ID, settlementAddr!);

      // -----------------------------------------------------------------
      // Step 1: Assert locally computed digest == contract hashOrder().
      // This is the key correctness guard for ORDER_TYPES field ordering.
      // -----------------------------------------------------------------
      const localDigest = hashTypedData({
        domain,
        types: ORDER_TYPES,
        primaryType: "Order",
        message: order,
      });

      const contractDigest = (await publicClient.readContract({
        address: settlementAddr!,
        abi: SETTLEMENT_ABI,
        functionName: "hashOrder",
        args: [order],
      })) as Hex;

      expect(localDigest.toLowerCase()).toBe(contractDigest.toLowerCase());

      // -----------------------------------------------------------------
      // Step 2: setApprovalForAll on FL so settlement can transfer the token.
      // -----------------------------------------------------------------
      const isApproved = (await publicClient.readContract({
        address: flAddr!,
        abi: FOREVER_LIBRARY_ABI,
        functionName: "isApprovedForAll",
        args: [relayerAddr, settlementAddr!],
      })) as boolean;

      if (!isApproved) {
        const approveTxHash = await walletClient.writeContract({
          address: flAddr!,
          abi: FOREVER_LIBRARY_ABI,
          functionName: "setApprovalForAll",
          args: [settlementAddr!, true],
          gas: BigInt(100000),
        });
        const approveReceipt = await publicClient.waitForTransactionReceipt({
          hash: approveTxHash,
        });
        expect(approveReceipt.status).toBe("success");
      }

      // -----------------------------------------------------------------
      // Step 3: Sign the order with the relayer key.
      // -----------------------------------------------------------------
      const signature = await account.signTypedData({
        domain,
        types: ORDER_TYPES,
        primaryType: "Order",
        message: order,
      });

      // -----------------------------------------------------------------
      // Step 4: fulfillOrder — relayer is both seller and buyer.
      // Self-transfer is allowed; fees split back.
      // -----------------------------------------------------------------
      const fulfillTxHash = await walletClient.writeContract({
        address: settlementAddr!,
        abi: SETTLEMENT_ABI,
        functionName: "fulfillOrder",
        args: [order, signature],
        value: order.price,
        gas: BigInt(400000),
      });

      const fulfillReceipt = await publicClient.waitForTransactionReceipt({
        hash: fulfillTxHash,
      });

      expect(fulfillReceipt.status).toBe("success");
    },
    300_000, // 5 minute timeout for on-chain tx confirmation
  );
});
