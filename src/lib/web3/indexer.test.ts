import { describe, it, expect } from "vitest";
import { mergeForExplore, FACTORY_DEPLOY_BLOCK } from "./indexer";
import type { Token } from "@/lib/types";

// Minimal fake Token — cast to Token to avoid filling every field.
function fakeToken(id: string, extra: Partial<Token> = {}): Token {
  return { id, tokenId: 0, ...extra } as Token;
}

describe("mergeForExplore", () => {
  it("returns empty array when both inputs are empty", () => {
    expect(mergeForExplore([], [])).toEqual([]);
  });

  it("returns live tokens only when mock is empty", () => {
    const live = [fakeToken("live-1", { source: "onchain" })];
    const result = mergeForExplore(live, []);
    expect(result).toEqual(live);
  });

  it("returns mock tokens only when live is empty", () => {
    const mock = [fakeToken("mock-1")];
    const result = mergeForExplore([], mock);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe("mock");
  });

  it("live tokens come before mock tokens", () => {
    const live = [
      fakeToken("live-1", { source: "onchain" }),
      fakeToken("live-2", { source: "onchain" }),
    ];
    const mock = [fakeToken("mock-1"), fakeToken("mock-2")];
    const result = mergeForExplore(live, mock);
    expect(result).toHaveLength(4);
    expect(result[0].id).toBe("live-1");
    expect(result[1].id).toBe("live-2");
    expect(result[2].id).toBe("mock-1");
    expect(result[3].id).toBe("mock-2");
  });

  it("tags mock tokens with source:'mock' when source is missing", () => {
    const mock = [fakeToken("mock-no-source")];
    const result = mergeForExplore([], mock);
    expect(result[0].source).toBe("mock");
  });

  it("preserves source when a mock token already has source set", () => {
    const mock = [fakeToken("mock-already-tagged", { source: "mock" })];
    const result = mergeForExplore([], mock);
    expect(result[0].source).toBe("mock");
  });

  it("does not mutate the original mock token when tagging", () => {
    const original = fakeToken("mock-unmutated");
    mergeForExplore([], [original]);
    // source was undefined before, should remain undefined on the original
    expect(original.source).toBeUndefined();
  });

  it("live tokens retain their onchain source", () => {
    const live = [fakeToken("live-onchain", { source: "onchain" })];
    const result = mergeForExplore(live, []);
    expect(result[0].source).toBe("onchain");
  });
});

describe("FACTORY_DEPLOY_BLOCK", () => {
  it("has entries for the two test chains", () => {
    expect(typeof FACTORY_DEPLOY_BLOCK[84532]).toBe("bigint");
    expect(typeof FACTORY_DEPLOY_BLOCK[11155111]).toBe("bigint");
    expect(FACTORY_DEPLOY_BLOCK[84532]).toBe(BigInt(42258356));
    expect(FACTORY_DEPLOY_BLOCK[11155111]).toBe(BigInt(10965404));
  });
});
