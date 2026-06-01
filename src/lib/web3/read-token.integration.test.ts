import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

(function loadEnvLocal() {
  let text: string;
  try { text = readFileSync(".env.local", "utf8"); } catch { return; }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
})();

const RUN = process.env.RUN_LOGLEDGER_E2E === "1";

describe.runIf(RUN)("on-chain read layer (Base Sepolia)", () => {
  it("reads a minted token's real shards + owner", async () => {
    const { readOnchainToken, readOwnedTokenIds } = await import("./read-token");
    // Token #1 minted in the full-pipeline test (E2E Title), owned by the relayer/minter.
    const { getContracts } = await import("./contracts");
    const flAddr = getContracts(84532).foreverLibrary!;
    const t = await readOnchainToken(84532, flAddr, BigInt(1));
    expect(t, "token #1 exists").not.toBeNull();
    expect(t!.permanence.onchainProofConfigured).toBe(true);
    expect(t!.permanence.shards.find((s) => s.backend === "onchain")).toBeTruthy();
    const owned = await readOwnedTokenIds(84532, flAddr, t!.owner);
    expect(owned.map(String)).toContain("1");
  }, 180_000);
});
