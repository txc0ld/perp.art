/**
 * On-chain test for the re-emission tool (Plan 5) against Base Sepolia.
 * Re-emits the sealed fixture under a fresh version (fetching authentic bytes
 * from the live resolver), confirms the re-emitted root equals the original,
 * and proves the resolver's version-fallback recovers it when the primary
 * fileId is unavailable.
 * Gated: RUN_LOGLEDGER_E2E=1 npm test -- reemit.integration
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { keccak256, type Hex } from "viem";

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

describe.runIf(RUN)("re-emission tool (on-chain Base Sepolia)", () => {
  it("re-emits the fixture under a fresh version and the resolver recovers it", async () => {
    const { reEmitLogShard, loadAndVerifyLogShard } = await import("./resolve");
    const { getContracts } = await import("@/lib/web3/contracts");

    const ledger = getContracts(84532).logLedger as Hex;
    const original = new TextEncoder().encode("perpetual-logledger-e2e-v1-".repeat(1200)).subarray(0, 30_000);
    const contentHash = keccak256(original);

    // Authentic bytes are still served by the live resolver for version 0.
    const sourceUrl = `https://tryperpetual.art/api/shard/log/${ledger}/0xc87ef5c3cc8a9cbc50ac85ce2b3db521076c666b970ff07526471ef0d87bae2e?chainId=84532`;

    const reemit = await reEmitLogShard({ chainId: 84532, contentHash, sourceUrl });
    expect(reemit.ok, reemit.error).toBe(true);
    expect(reemit.matchesOriginal, "re-emitted root equals the original").toBe(true);
    expect(reemit.version).toBeGreaterThanOrEqual(1);

    // Resolver version-fallback: a bogus/pruned primary + contentHash recovers
    // the artwork from the re-emitted version.
    const bogus = "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex;
    const shard = await loadAndVerifyLogShard({ ledger, fileId: bogus, chainId: 84532, contentHash });
    expect(Array.from(shard.bytes)).toEqual(Array.from(original));
  }, 300_000);
});
