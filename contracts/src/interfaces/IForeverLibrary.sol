// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*//////////////////////////////////////////////////////////////////////////
    PERPETUAL - UNAUDITED REFERENCE SCAFFOLD - DO NOT DEPLOY WITH VALUE
    ---------------------------------------------------------------------
    This interface is part of a reference scaffold for the Perpetual
    permanence-first NFT marketplace. It expresses the
    contract architecture described in the PRD and is intended for review,
    indexer/frontend integration, and audit preparation - NOT production.
//////////////////////////////////////////////////////////////////////////*/

/// @title IForeverLibrary
/// @notice Interface for the Forever Library token contract - the Asset &
///         Provenance layer (PRD §6, §7). A Forever Library token is an
///         ERC-721 with enforced creator royalties (ERC-2981) and a
///         URI-sharding surface that maintains parallel, immutable copies of
///         each artwork across multiple storage backends (PRD §7.2).
/// @dev    The mandatory onchain proof shard (Shard 0, ethfs) is the
///         permanence backstop that survives as long as Ethereum itself
///         (PRD §5.1, §7.2, §18). The frontend, indexer, permanence
///         verification service, and the listing-eligibility gate (PRD §9.6)
///         all read from this surface.
///
///         INVARIANT (PRD §18): every behavior here must hold with zero
///         cooperation from the marketplace operator. All state is onchain
///         and independently readable.
/// @dev Implementers are also ERC-721 + ERC-2981 (royalties); this interface
///      declares only the Perpetual-specific sharding/provenance surface so it
///      composes cleanly alongside the OpenZeppelin base contracts.
interface IForeverLibrary {
    /*//////////////////////////////////////////////////////////////////////
                                    TYPES
    //////////////////////////////////////////////////////////////////////*/

    /// @notice The storage backend a given shard is persisted to (PRD §7.2).
    /// @dev    `Onchain` (ethfs) is the mandatory permanence backstop and is
    ///         always Shard 0. The remaining backends are redundant,
    ///         architecturally distinct copies (PRD §4.3 archival redundancy).
    enum ShardBackend {
        Onchain, // 0 - SSTORE2 on-chain proof shard. MANDATORY. Shard 0.
        IPFS,    // 1 - content-addressed media (high resolution).
        Arweave, // 2 - pay-once permanent storage.
        Irys,    // 3 - additional permanent redundancy (Datachain).
        CDN,     // 4 - extensible centralized/CDN performance shard.
        Log      // 5 - LogLedger event-log storage (cheap high-res; retention-monitored).
    }

    /// @notice Immutable provenance record written at mint (PRD §7.4).
    /// @dev    Emitted via {TokenMinted} and retrievable via {getMintData}.
    ///         `metadataHash` anchors the canonical metadata for independent
    ///         verification (PRD §7.3 content hashing, §9.4 verification).
    struct MintData {
        address creator;     // wallet that minted the token.
        uint64 timestamp;    // block.timestamp at mint.
        uint64 blockNumber;  // block.number at mint.
        string artistName;   // human-readable artist name.
        string title;        // work title.
        string mediaType;    // e.g. "image/png", "video/mp4".
        uint96 royaltyBps;   // creator royalty in basis points (ERC-2981).
        bytes32 metadataHash; // keccak256 of canonical metadata for verification.
    }

    /*//////////////////////////////////////////////////////////////////////
                                    EVENTS
    //////////////////////////////////////////////////////////////////////*/

    /// @notice Emitted once per mint with the immutable provenance record
    ///         (PRD §7.4). Indexers reconstruct provenance from this event
    ///         alone (rebuildability, PRD §9.3).
    /// @param tokenId      the newly minted token id.
    /// @param creator      the minting wallet.
    /// @param metadataHash keccak256 of the canonical metadata.
    /// @param royaltyBps   creator royalty in basis points.
    /// @param timestamp    block timestamp at mint.
    /// @param blockNumber  block number at mint.
    event TokenMinted(
        uint256 indexed tokenId,
        address indexed creator,
        bytes32 metadataHash,
        uint96 royaltyBps,
        uint64 timestamp,
        uint64 blockNumber
    );

    /// @notice Emitted whenever a shard is configured or (within the edit
    ///         window) updated (PRD §7.3). The permanence verification service
    ///         (PRD §9.4) resolves `contentHash` against fetched shard content.
    /// @param tokenId     token the shard belongs to.
    /// @param index       shard index (0 == mandatory onchain proof).
    /// @param backend     storage backend for this shard.
    /// @param contentHash keccak256 of the shard's content.
    event ShardConfigured(
        uint256 indexed tokenId,
        uint256 indexed index,
        ShardBackend backend,
        bytes32 contentHash
    );

    /// @notice Emitted when an artist locks a token's shards, making them
    ///         permanently immutable (PRD §7.3 locking). Surfaced in the UI as
    ///         a trust signal (PRD §10.4).
    event ShardsLocked(uint256 indexed tokenId);

    /*//////////////////////////////////////////////////////////////////////
                        MANDATORY ONCHAIN PROOF GATE
    //////////////////////////////////////////////////////////////////////*/

    /// @notice Whether the mandatory onchain proof shard (Shard 0, ethfs) is
    ///         configured for `tokenId`.
    /// @dev    DIFFERENTIATING INVARIANT (PRD §7.3, §9.6): no token may be
    ///         listed unless this returns true. The listing-eligibility gate
    ///         (PRD §9.6) checks this onchain rather than trusting any
    ///         off-chain flag.
    /// @return configured true once Shard 0 exists.
    function shard0Configured(uint256 tokenId) external view returns (bool configured);

    /// @notice The shard index external platforms (our indexer, OpenSea, etc.)
    ///         should display (PRD §7.3). Selection prefers the highest-
    ///         resolution available shard, but the onchain proof (Shard 0)
    ///         always exists as fallback.
    function selectedShardIndex(uint256 tokenId) external view returns (uint256 index);

    /// @notice Whether `tokenId`'s shards are locked and permanently immutable
    ///         (PRD §7.3 locking, §10.4 trust signal).
    function isLocked(uint256 tokenId) external view returns (bool locked);

    /*//////////////////////////////////////////////////////////////////////
                                SHARD ACCESSORS
    //////////////////////////////////////////////////////////////////////*/

    /// @notice Number of shards configured for `tokenId` (>= 1 once minted,
    ///         since Shard 0 is mandatory).
    function shardCount(uint256 tokenId) external view returns (uint256 count);

    /// @notice The resolvable URI for a given shard (PRD §7.2). For onchain
    ///         shards this may be a data URI; for IPFS/Arweave/Irys it is the
    ///         content-addressed locator.
    function shardURI(uint256 tokenId, uint256 index) external view returns (string memory uri);

    /// @notice The storage backend for a given shard (PRD §7.2).
    function shardBackend(uint256 tokenId, uint256 index) external view returns (ShardBackend backend);

    /// @notice The onchain-recorded content hash for a given shard (PRD §7.3).
    /// @dev    The permanence verification service (PRD §9.4) fetches the shard
    ///         content, hashes it, and compares against this value. A mismatch
    ///         flags the shard as failing.
    function shardContentHash(uint256 tokenId, uint256 index) external view returns (bytes32 contentHash);

    /*//////////////////////////////////////////////////////////////////////
                                PROVENANCE
    //////////////////////////////////////////////////////////////////////*/

    /// @notice The immutable provenance / mint record for `tokenId` (PRD §7.4).
    /// @dev    Used by the listing-eligibility gate (PRD §9.6) to confirm the
    ///         onchain proof content hash matches the mint record, and by the
    ///         frontend provenance panel.
    function getMintData(uint256 tokenId) external view returns (MintData memory data);
}
