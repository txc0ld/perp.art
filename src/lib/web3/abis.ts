/** Minimal ABIs for the on-chain interactions the app performs. */

export const FOREVER_LIBRARY_ABI = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "artistName", type: "string" },
      { name: "title", type: "string" },
      { name: "mediaType", type: "string" },
      { name: "royaltyBps", type: "uint96" },
      { name: "metadataHash", type: "bytes32" },
      { name: "proofURI", type: "string" },
      { name: "proofContentHash", type: "bytes32" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "shard0Configured",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    name: "TokenMinted",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "metadataHash", type: "bytes32", indexed: false },
      { name: "royaltyBps", type: "uint96", indexed: false },
      { name: "timestamp", type: "uint64", indexed: false },
      { name: "blockNumber", type: "uint64", indexed: false },
    ],
  },
] as const;
