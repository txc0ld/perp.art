import { describe, it, expect } from "vitest";
import { resolveShardUrl } from "./resolve-url";

const LEDGER = "0x24D3c508A375911eBBF4e2dF7e9587A56d1132e8";
const FILE = "0xfeedface";

describe("resolveShardUrl", () => {
  it("maps log:// to the resolver route", () => {
    expect(resolveShardUrl(`log://${LEDGER}/${FILE}`)).toBe(`/api/shard/log/${LEDGER}/${FILE}`);
  });

  it("forwards mime + chainId + contentHash as query params", () => {
    const url = resolveShardUrl(`log://${LEDGER}/${FILE}`, { mime: "image/png", chainId: 84532, contentHash: "0xabc" });
    expect(url).toContain(`/api/shard/log/${LEDGER}/${FILE}?`);
    expect(url).toContain("mime=image%2Fpng");
    expect(url).toContain("chainId=84532");
    expect(url).toContain("contentHash=0xabc");
  });

  it("maps ipfs:// to the gateway", () => {
    const url = resolveShardUrl("ipfs://bafyCID");
    expect(url.endsWith("/bafyCID")).toBe(true);
    expect(url.startsWith("http")).toBe(true);
  });

  it("maps ar:// and irys:// to gateways", () => {
    expect(resolveShardUrl("ar://TXID").endsWith("/TXID")).toBe(true);
    expect(resolveShardUrl("irys://RID").endsWith("/RID")).toBe(true);
  });

  it("passes through http(s) and data URIs unchanged", () => {
    expect(resolveShardUrl("https://x.test/a.png")).toBe("https://x.test/a.png");
    expect(resolveShardUrl("data:image/svg+xml;base64,AAAA")).toBe("data:image/svg+xml;base64,AAAA");
  });

  it("handles empty input", () => {
    expect(resolveShardUrl("")).toBe("");
  });
});
