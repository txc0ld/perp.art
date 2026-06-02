import { keccak256, encodeAbiParameters, type Hex } from "viem";

/**
 * Deterministic LogLedger fileId for a token's artwork.
 *
 * Author-bound (un-squattable): the contract derives the fileId from the CALLER
 * (`msg.sender`, i.e. the relayer wallet), the artwork CONTENT, and a version —
 * `keccak256(abi.encode(author, contentHash, version))`. We MUST compute it
 * identically off-chain so the resolver and re-emission tooling reference the
 * same on-chain file. `version` lets an artist publish a corrected/replacement
 * file without overwriting the original immutable fileId.
 *
 * @param author      the relayer wallet address (the on-chain `msg.sender`).
 * @param contentHash keccak256 of the full artwork bytes (the anchor).
 * @param version     starts at 0; bump for a republished copy.
 */
export function computeFileId(author: Hex, contentHash: Hex, version = 0): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "bytes32" }, { type: "uint32" }],
      [author, contentHash, version],
    ),
  );
}
