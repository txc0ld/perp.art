import { keccak256, encodeAbiParameters, type Hex } from "viem";

/**
 * Deterministic LogLedger fileId for a token's artwork.
 *
 * Bound to the artwork CONTENT (not a tokenId), so the relayer can publish the
 * high-res copy independently of mint ordering: `keccak256(abi.encode(
 * collection, contentHash, version))`. `version` lets an artist publish a
 * corrected/replacement file without overwriting the original immutable fileId.
 *
 * @param collection  the ForeverLibrary (NFT) contract address for the chain.
 * @param contentHash keccak256 of the full artwork bytes (the anchor).
 * @param version     starts at 0; bump for a republished copy.
 */
export function computeFileId(collection: Hex, contentHash: Hex, version = 0): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: "address" }, { type: "bytes32" }, { type: "uint32" }],
      [collection, contentHash, version],
    ),
  );
}
