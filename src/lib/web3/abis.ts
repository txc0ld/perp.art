/** Minimal ABIs for the on-chain interactions the app performs. */

export const FOREVER_LIBRARY_ABI = [
  {
    type: "function",
    name: "mint",
    stateMutability: "payable",
    inputs: [
      { name: "to", type: "address" },
      { name: "artistName", type: "string" },
      { name: "title", type: "string" },
      { name: "mediaType", type: "string" },
      { name: "royaltyBps", type: "uint96" },
      { name: "metadataHash", type: "bytes32" },
      { name: "proofData", type: "bytes" },
      { name: "hostingFeeBps_", type: "uint16" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "configureShard",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "index", type: "uint256" },
      { name: "backend", type: "uint8" },
      { name: "uri", type: "string" },
      { name: "contentHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "shard0Configured",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "hostingFeeBps",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "uint16" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "shardURI",
    stateMutability: "view",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "string" }],
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
  {
    type: "function", name: "ownerOf", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function", name: "isLocked", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function", name: "selectedShardIndex", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function", name: "shardCount", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function", name: "shardBackend", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }, { name: "index", type: "uint256" }],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function", name: "shardContentHash", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }, { name: "index", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function", name: "getMintData", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{
      name: "", type: "tuple",
      components: [
        { name: "creator", type: "address" },
        { name: "timestamp", type: "uint64" },
        { name: "blockNumber", type: "uint64" },
        { name: "artistName", type: "string" },
        { name: "title", type: "string" },
        { name: "mediaType", type: "string" },
        { name: "royaltyBps", type: "uint96" },
        { name: "metadataHash", type: "bytes32" },
      ],
    }],
  },
  {
    type: "function", name: "royaltyInfo", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }, { name: "salePrice", type: "uint256" }],
    outputs: [{ name: "receiver", type: "address" }, { name: "amount", type: "uint256" }],
  },
  {
    type: "event", name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
] as const;

/** LogLedger: cheap on-chain media storage via event logs (Plan 1 contract). */
export const LOG_LEDGER_ABI = [
  {
    type: "function",
    name: "open",
    stateMutability: "nonpayable",
    inputs: [{ name: "fileId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "upload",
    stateMutability: "nonpayable",
    inputs: [
      { name: "fileId", type: "bytes32" },
      { name: "chunkIndex", type: "uint32" },
      { name: "data", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "seal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "fileId", type: "bytes32" },
      { name: "root", type: "bytes32" },
      { name: "size", type: "uint256" },
      { name: "chunks", type: "uint32" },
      { name: "codec", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "files",
    stateMutability: "view",
    inputs: [{ name: "fileId", type: "bytes32" }],
    outputs: [
      { name: "root", type: "bytes32" },
      { name: "size", type: "uint256" },
      { name: "chunks", type: "uint32" },
      { name: "deployBlock", type: "uint32" },
      { name: "codec", type: "uint8" },
      { name: "finalized", type: "bool" },
      { name: "author", type: "address" },
    ],
  },
  {
    type: "function",
    name: "isSealed",
    stateMutability: "view",
    inputs: [{ name: "fileId", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    name: "FileOpened",
    inputs: [
      { name: "fileId", type: "bytes32", indexed: true },
      { name: "author", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "FileChunk",
    inputs: [
      { name: "fileId", type: "bytes32", indexed: true },
      { name: "chunkIndex", type: "uint32", indexed: true },
      { name: "data", type: "bytes", indexed: false },
    ],
  },
  {
    type: "event",
    name: "FileSealed",
    inputs: [
      { name: "fileId", type: "bytes32", indexed: true },
      { name: "root", type: "bytes32", indexed: false },
      { name: "size", type: "uint256", indexed: false },
      { name: "chunks", type: "uint32", indexed: false },
      { name: "codec", type: "uint8", indexed: false },
    ],
  },
] as const;

/** ForeverLibrary ShardBackend enum (must match the Solidity ordering). */
export const SHARD_BACKEND = {
  onchain: 0,
  ipfs: 1,
  arweave: 2,
  irys: 3,
  cdn: 4,
  log: 5,
} as const;
