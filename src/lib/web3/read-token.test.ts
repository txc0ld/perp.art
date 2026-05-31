import { describe, it, expect } from "vitest";
import { mapMintToToken, type RawTokenReads } from "./read-token";

const RAW: RawTokenReads = {
  chainId: 84532,
  tokenId: BigInt(5),
  owner: "0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38",
  mint: {
    creator: "0x1804c8AB1F12E6bbf3894d4083f33e07309d1f38",
    timestamp: BigInt(1748000000),
    blockNumber: BigInt(42220000),
    artistName: "Claude Wren",
    title: "Strata No. 1",
    mediaType: "image/svg+xml",
    royaltyBps: BigInt(750),
    metadataHash: "0xabc",
  },
  locked: true,
  selectedShardIndex: BigInt(1),
  hostingFeeBps: 0,
  shards: [
    { index: 0, backend: 0, uri: "data:image/svg+xml;base64,AAAA", contentHash: "0xstate" },
    { index: 1, backend: 5, uri: "log://0xLED/0xFID", contentHash: "0xroot" },
    { index: 2, backend: 1, uri: "ipfs://CID", contentHash: "0xc" },
  ],
  provenance: [
    { kind: "minted", timestamp: "2026-05-01T00:00:00.000Z", blockNumber: 42220000 },
  ],
};

describe("mapMintToToken", () => {
  it("maps real on-chain fields", () => {
    const t = mapMintToToken(RAW);
    expect(t.tokenId).toBe(5);
    expect(t.id).toBe("84532-5");
    expect(t.title).toBe("Strata No. 1");
    expect(t.owner).toBe(RAW.owner);
    expect(t.royalty.bps).toBe(750);
    expect(t.chain).toBe("base"); // 84532 → base
    expect(t.permanence.locked).toBe(true);
    expect(t.permanence.selectedShardIndex).toBe(1);
    expect(t.provenance[0].kind).toBe("minted");
  });

  it("marks only the STATE shard guaranteed and flags it onchain proof", () => {
    const t = mapMintToToken(RAW);
    const state = t.permanence.shards.find((s) => s.index === 0)!;
    const log = t.permanence.shards.find((s) => s.index === 1)!;
    expect(state.backend).toBe("onchain");
    expect(state.guaranteed).toBe(true);
    expect(state.mandatory).toBe(true);
    expect(log.backend).toBe("log");
    expect(log.guaranteed).toBe(false);
    expect(t.permanence.onchainProofConfigured).toBe(true);
  });

  it("resolves shard source URLs (log → resolver, ipfs → gateway)", () => {
    const t = mapMintToToken(RAW);
    const log = t.permanence.shards.find((s) => s.index === 1)!;
    const ipfs = t.permanence.shards.find((s) => s.index === 2)!;
    expect(log.sourceUrl).toContain("/api/shard/log/0xLED/0xFID");
    expect(ipfs.sourceUrl).toContain("/CID");
  });

  it("listable when STATE configured (no fake listing/traits)", () => {
    const t = mapMintToToken(RAW);
    expect(t.listable).toBe(true);
    expect(t.listing).toBeUndefined();
    expect(t.traits).toEqual([]);
    expect(t.offers).toEqual([]);
  });
});
