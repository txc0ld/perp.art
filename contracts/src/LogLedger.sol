// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title LogLedger
/// @notice Cheap, verifiable on-chain media storage via event logs. Media bytes
///         live in event data; only the Merkle root + size live in state.
/// @dev    Standalone & reusable: Forever Library tokens reference a file by
///         (ledgerAddress, fileId) through a Log shard. Availability of historic
///         logs is NOT protocol-guaranteed (EIP-4444); a token using this MUST
///         also carry an on-chain STATE proof shard.
contract LogLedger {
    struct File {
        bytes32 root;        // Merkle root over ordered chunk hashes.
        uint256 size;        // total byte length of the (post-compression) file.
        uint32  chunks;      // number of chunks.
        uint32  deployBlock; // block of first activity (indexer lower bound).
        uint8   codec;       // 0 raw, 1 gzip, 2 brotli, 3 RLE.
        bool    finalized;   // once true, no further mutation (the "sealed" flag;
                             // `sealed` is a reserved Solidity keyword).
        address author;      // who may upload/seal this fileId.
    }

    mapping(bytes32 => File) public files; // fileId => File

    event FileOpened(bytes32 indexed fileId, address indexed author);
    event FileChunk(bytes32 indexed fileId, uint32 indexed chunkIndex, bytes data);
    event FileSealed(bytes32 indexed fileId, bytes32 root, uint256 size, uint32 chunks, uint8 codec);

    error NotAuthor();
    error AlreadyOpened();
    error AlreadySealed();
    error NotOpened();

    /// @notice Claim authorship of a caller-chosen unique fileId.
    /// @dev    Recommended fileId = keccak256(abi.encode(collection, contentHash, version)).
    // AUDIT: roadmap — bind fileId to author (derive/verify fileId from the
    // author + content) so a fileId cannot be front-run/claimed by a non-author.
    function open(bytes32 fileId) external {
        File storage f = files[fileId];
        if (f.author != address(0)) revert AlreadyOpened(); // fileId already claimed.
        f.author = msg.sender;
        f.deployBlock = uint32(block.number);
        emit FileOpened(fileId, msg.sender);
    }

    /// @notice Emit one chunk of media. Logs only (~8 gas/byte of data).
    function upload(bytes32 fileId, uint32 chunkIndex, bytes calldata data) external {
        File storage f = files[fileId];
        if (f.author == address(0)) revert NotOpened();
        if (f.author != msg.sender) revert NotAuthor();
        if (f.finalized) revert AlreadySealed();
        emit FileChunk(fileId, chunkIndex, data);
    }

    /// @notice Finalize: write the verification commitment to state.
    // AUDIT: roadmap — root is author-asserted; add on-chain root/chunk
    // validation (verify the Merkle root against the emitted chunk hashes)
    // rather than trusting the sealer's claimed root/size/chunks.
    function seal(
        bytes32 fileId,
        bytes32 root,
        uint256 size,
        uint32 chunks,
        uint8 codec
    ) external {
        File storage f = files[fileId];
        if (f.author == address(0)) revert NotOpened();
        if (f.author != msg.sender) revert NotAuthor();
        if (f.finalized) revert AlreadySealed();
        f.root = root;
        f.size = size;
        f.chunks = chunks;
        f.codec = codec;
        f.finalized = true;
        emit FileSealed(fileId, root, size, chunks, codec);
    }

    function isSealed(bytes32 fileId) external view returns (bool) {
        return files[fileId].finalized;
    }
}
