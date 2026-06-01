import { describe, it, expect } from "vitest";
import { FACTORY_DEPLOY_BLOCK } from "./indexer";

describe("FACTORY_DEPLOY_BLOCK", () => {
  it("has entries for the two test chains", () => {
    expect(typeof FACTORY_DEPLOY_BLOCK[84532]).toBe("bigint");
    expect(typeof FACTORY_DEPLOY_BLOCK[11155111]).toBe("bigint");
    expect(FACTORY_DEPLOY_BLOCK[84532]).toBe(BigInt(42258356));
    expect(FACTORY_DEPLOY_BLOCK[11155111]).toBe(BigInt(10965404));
  });
});
