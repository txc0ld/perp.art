import { describe, it, expect } from "vitest";
import { keccak256, concat, type Hex } from "viem";
import { leafHash, merkleRoot } from "./merkle";

const b = (s: string) => new TextEncoder().encode(s);
const pair = (l: Hex, r: Hex): Hex => keccak256(concat([l, r]));

describe("leafHash", () => {
  it("is keccak256 of the chunk bytes", () => {
    expect(leafHash(b("hello"))).toBe(keccak256(b("hello")));
  });
});

describe("merkleRoot", () => {
  it("single leaf: root == that leaf's hash", () => {
    const c0 = b("only");
    expect(merkleRoot([c0])).toBe(leafHash(c0));
  });

  it("two leaves: root == pair(h0, h1)", () => {
    const c = [b("a"), b("b")];
    const [h0, h1] = c.map(leafHash);
    expect(merkleRoot(c)).toBe(pair(h0, h1));
  });

  it("three leaves: odd node promoted unchanged", () => {
    const c = [b("a"), b("b"), b("c")];
    const [h0, h1, h2] = c.map(leafHash);
    // level1: [pair(h0,h1), h2(promoted)] -> root = pair(pair(h0,h1), h2)
    expect(merkleRoot(c)).toBe(pair(pair(h0, h1), h2));
  });

  it("four leaves: balanced", () => {
    const c = [b("a"), b("b"), b("c"), b("d")];
    const [h0, h1, h2, h3] = c.map(leafHash);
    expect(merkleRoot(c)).toBe(pair(pair(h0, h1), pair(h2, h3)));
  });

  it("five leaves: promotion at multiple levels", () => {
    const c = [b("a"), b("b"), b("c"), b("d"), b("e")];
    const [h0, h1, h2, h3, h4] = c.map(leafHash);
    // L1: [p(h0,h1), p(h2,h3), h4]
    // L2: [p(p01,p23), h4]
    // root: p(p(p01,p23), h4)
    const p01 = pair(h0, h1);
    const p23 = pair(h2, h3);
    expect(merkleRoot(c)).toBe(pair(pair(p01, p23), h4));
  });

  it("is order-sensitive", () => {
    const r1 = merkleRoot([b("a"), b("b")]);
    const r2 = merkleRoot([b("b"), b("a")]);
    expect(r1).not.toBe(r2);
  });

  it("throws on empty input", () => {
    expect(() => merkleRoot([])).toThrow();
  });
});
