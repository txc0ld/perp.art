/**
 * On-chain test for the resolver reconstruction (loadAndVerifyLogShard) against
 * the fixture the relayer integration test sealed on Base Sepolia.
 * Gated: RUN_LOGLEDGER_E2E=1 npm test -- resolve.integration
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { keccak256, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Populate env BEFORE importing modules that read process.env at load time
// (contracts.ts REGISTRY, serverEnv). Static imports hoist above this IIFE; the
// dynamic import() below runs after, so the registry sees the addresses.
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

describe.runIf(RUN)("resolver reconstruction (on-chain Base Sepolia)", () => {
  it("reconstructs + verifies the sealed fixture", async () => {
    const { loadAndVerifyLogShard, computeFileId } = await import("./resolve").then(async (resolve) => ({
      loadAndVerifyLogShard: resolve.loadAndVerifyLogShard,
      computeFileId: (await import("./index")).computeFileId,
    }));
    const { getContracts } = await import("@/lib/web3/contracts");

    const ledger = getContracts(84532).logLedger as Hex;
    expect(ledger, "LogLedger configured").toBeDefined();

    // fileId is author-bound: the relayer wallet is the on-chain msg.sender.
    const pkRaw = process.env.LOGLEDGER_RELAYER_PK as string;
    const pk = (pkRaw.startsWith("0x") ? pkRaw : `0x${pkRaw}`) as Hex;
    const author = privateKeyToAccount(pk).address;

    // Exact fixture from relayer.integration.test.ts.
    const buf = new TextEncoder().encode("perpetual-logledger-e2e-v1-".repeat(1200));
    const original = buf.subarray(0, 30_000);
    const contentHash = keccak256(original);
    const fileId = computeFileId(author, contentHash, 0);

    const shard = await loadAndVerifyLogShard({ ledger, fileId, chainId: 84532 });
    expect(Array.from(shard.bytes)).toEqual(Array.from(original));
    expect(shard.root.toLowerCase()).toMatch(/^0x[0-9a-f]{64}$/);
  }, 120_000);
});
