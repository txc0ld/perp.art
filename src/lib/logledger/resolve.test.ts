import { describe, it, expect } from "vitest";

// Set the registry env BEFORE importing (contracts.ts builds its REGISTRY at
// module load). Static imports are hoisted above this; the dynamic import below
// runs after, so resolve.ts + contracts.ts load with these values.
process.env.NEXT_PUBLIC_LOG_LEDGER_BASE_SEPOLIA = "0x24D3c508A375911eBBF4e2dF7e9587A56d1132e8";
process.env.NEXT_PUBLIC_LOG_LEDGER_SEPOLIA = "0x3981BFaaf2a79B8F798DAf82433B9Cf7Da4d4ffe";

const { chainIdForLedger, sniffMime } = await import("./resolve");

describe("chainIdForLedger", () => {
  it("maps the Base Sepolia ledger", () => {
    expect(chainIdForLedger("0x24D3c508A375911eBBF4e2dF7e9587A56d1132e8")).toBe(84532);
  });
  it("maps the Eth Sepolia ledger (case-insensitive)", () => {
    expect(chainIdForLedger("0x3981bfaaf2a79b8f798daf82433b9cf7da4d4ffe")).toBe(11155111);
  });
  it("returns undefined for an unknown ledger", () => {
    expect(chainIdForLedger("0x000000000000000000000000000000000000dEaD")).toBeUndefined();
  });
});

describe("sniffMime", () => {
  const withMagic = (...head: number[]) => {
    const a = new Uint8Array(16);
    head.forEach((b, i) => (a[i] = b));
    return a;
  };
  it("PNG", () => expect(sniffMime(withMagic(0x89, 0x50, 0x4e, 0x47))).toBe("image/png"));
  it("JPEG", () => expect(sniffMime(withMagic(0xff, 0xd8, 0xff))).toBe("image/jpeg"));
  it("GIF", () => expect(sniffMime(withMagic(0x47, 0x49, 0x46, 0x38))).toBe("image/gif"));
  it("WEBP", () =>
    expect(sniffMime(withMagic(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe("image/webp"));
  it("MP4", () => expect(sniffMime(withMagic(0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70))).toBe("video/mp4"));
  it("SVG", () => expect(sniffMime(new TextEncoder().encode('<svg xmlns="...">'))).toBe("image/svg+xml"));
  it("unknown → octet-stream", () => expect(sniffMime(withMagic(0x01, 0x02, 0x03, 0x04))).toBe("application/octet-stream"));
});
