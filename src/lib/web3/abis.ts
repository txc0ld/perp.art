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
    name: "mintEdition",
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
      { name: "editionSize", type: "uint32" },
    ],
    outputs: [{ name: "firstTokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "storageFeeWei",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "editionSize",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "uint32" }],
  },
  {
    type: "function",
    name: "editionIndex",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "uint32" }],
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
  {
    type: "function", name: "isApprovedForAll", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "operator", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function", name: "setApprovalForAll", stateMutability: "nonpayable",
    inputs: [{ name: "operator", type: "address" }, { name: "approved", type: "bool" }],
    outputs: [],
  },
  // Needed for the collection picker: enumerate owner + ERC721 name of sovereign collections.
  {
    type: "function", name: "owner", stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function", name: "name", stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  // OpenSea collection-level metadata (on-chain data: URI).
  {
    type: "function", name: "contractURI", stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

/**
 * PerpetualDrop — dedicated batch-mint ERC-721 for large PFP / generative
 * "folder-permanence" drops (see PerpetualDrop.sol). One on-chain
 * `provenanceHash` anchors the ordered asset set; a `baseURI` (placeholder
 * pre-reveal) resolves per-token JSON metadata as `baseURI + tokenId`.
 */
export const PERPETUAL_DROP_ABI = [
  {
    type: "function", name: "mintBatch", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "quantity", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function", name: "commitProvenance", stateMutability: "nonpayable",
    inputs: [{ name: "hash", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function", name: "reveal", stateMutability: "nonpayable",
    inputs: [{ name: "realBaseURI", type: "string" }],
    outputs: [],
  },
  {
    type: "function", name: "tokenURI", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function", name: "contractURI", stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function", name: "provenanceHash", stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function", name: "revealed", stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function", name: "maxSupply", stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function", name: "totalMinted", stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function", name: "baseURI", stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function", name: "owner", stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function", name: "name", stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function", name: "symbol", stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function", name: "ownerOf", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function", name: "balanceOf", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function", name: "royaltyInfo", stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }, { name: "salePrice", type: "uint256" }],
    outputs: [{ name: "receiver", type: "address" }, { name: "amount", type: "uint256" }],
  },
  {
    type: "function", name: "MAX_BATCH", stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event", name: "ProvenanceCommitted",
    inputs: [{ name: "provenanceHash", type: "bytes32", indexed: false }],
  },
  {
    type: "event", name: "BatchMinted",
    inputs: [
      { name: "to", type: "address", indexed: true },
      { name: "fromTokenId", type: "uint256", indexed: false },
      { name: "toTokenId", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event", name: "Revealed",
    inputs: [{ name: "baseURI", type: "string", indexed: false }],
  },
  {
    type: "event", name: "ConsecutiveTransfer",
    inputs: [
      { name: "fromTokenId", type: "uint256", indexed: true },
      { name: "toTokenId", type: "uint256", indexed: false },
      { name: "fromAddress", type: "address", indexed: true },
      { name: "toAddress", type: "address", indexed: true },
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

/**
 * PerpetualSettlement: EIP-712 fixed-price order book.
 * Order tuple field order MUST match the contract exactly:
 *   seller, nft, tokenId, paymentToken, price, startTime, endTime, counter, salt
 */
export const SETTLEMENT_ABI = [
  {
    type: "function",
    name: "fulfillOrder",
    stateMutability: "payable",
    inputs: [
      {
        name: "order",
        type: "tuple",
        components: [
          { name: "seller", type: "address" },
          { name: "nft", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "paymentToken", type: "address" },
          { name: "price", type: "uint256" },
          { name: "startTime", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "counter", type: "uint256" },
          { name: "salt", type: "uint256" },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "hashOrder",
    stateMutability: "view",
    inputs: [
      {
        name: "order",
        type: "tuple",
        components: [
          { name: "seller", type: "address" },
          { name: "nft", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "paymentToken", type: "address" },
          { name: "price", type: "uint256" },
          { name: "startTime", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "counter", type: "uint256" },
          { name: "salt", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "getCounter",
    stateMutability: "view",
    inputs: [{ name: "seller", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "protocolFeeBps",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint96" }],
  },
  {
    type: "event",
    name: "OrderFulfilled",
    inputs: [
      { name: "orderHash", type: "bytes32", indexed: true },
      { name: "seller", type: "address", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "nft", type: "address", indexed: false },
      { name: "tokenId", type: "uint256", indexed: false },
      { name: "price", type: "uint256", indexed: false },
      { name: "royaltyAmount", type: "uint256", indexed: false },
      { name: "royaltyReceiver", type: "address", indexed: false },
      { name: "protocolFee", type: "uint256", indexed: false },
      { name: "hostingFee", type: "uint256", indexed: false },
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

/** ForeverLibraryFactory — deploys + enumerates sovereign collection contracts. */
export const FACTORY_ABI = [
  {
    type: "function",
    name: "createCollection",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "editWindow", type: "uint64" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "collectionsCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "collectionAt",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "isCollection",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    name: "CollectionCreated",
    inputs: [
      { name: "collection", type: "address", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "symbol", type: "string", indexed: false },
    ],
  },
  // ── PerpetualDrop registry (batch-mint PFP / generative drops) ──
  {
    type: "function",
    name: "createDrop",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "royaltyBps", type: "uint96" },
      { name: "maxSupply", type: "uint256" },
      { name: "placeholderBaseURI", type: "string" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "dropsCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "dropAt",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "drops",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "isDrop",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    name: "DropCreated",
    inputs: [
      { name: "drop", type: "address", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "name", type: "string", indexed: false },
      { name: "symbol", type: "string", indexed: false },
      { name: "maxSupply", type: "uint256", indexed: false },
    ],
  },
] as const;
