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
        bytes32 root;        // Merkle root over ordered chunk hashes (author-asserted; see note).
        uint256 size;        // total byte length of the (post-compression) file.
        uint32  chunks;      // number of chunks (asserted at seal == nextChunk).
        uint32  deployBlock; // block of first activity (indexer lower bound).
        uint32  nextChunk;   // next expected chunkIndex; enforces ordered/contiguous uploads.
        uint8   codec;       // 0 raw, 1 gzip, 2 brotli, 3 RLE.
        bool    finalized;   // once true, no further mutation (the "sealed" flag;
                             // `sealed` is a reserved Solidity keyword).
        address author;      // who may upload/seal this fileId; bound to the fileId derivation.
    }

    mapping(bytes32 => File) public files; // fileId => File

    event FileOpened(bytes32 indexed fileId, address indexed author);
    event FileChunk(bytes32 indexed fileId, uint32 indexed chunkIndex, bytes data);
    event FileSealed(bytes32 indexed fileId, bytes32 root, uint256 size, uint32 chunks, uint8 codec);

    error NotAuthor();
    error AlreadyOpened();
    error AlreadySealed();
    error NotOpened();
    error ChunkOutOfOrder();
    error ChunkCountMismatch();

    /// @notice Open a file. The fileId is DERIVED from the caller, so it is
    ///         un-squattable: an attacker calling `open` with the same content
    ///         derives a different fileId (their own address is mixed in).
    /// @dev    fileId = keccak256(abi.encode(msg.sender, contentHash, version)).
    ///         The resolver verifies the sealed `root` off-chain via multi-RPC
    ///         agreement; the on-chain STATE proof shard is the consensus
    ///         backstop. We intentionally do NOT do on-chain Merkle verification
    ///         (gas-prohibitive); author-binding + ordered chunks below are the
    ///         on-chain integrity guarantees.
    /// @return fileId the derived, author-bound file identifier.
    function open(bytes32 contentHash, uint32 version) external returns (bytes32 fileId) {
        fileId = keccak256(abi.encode(msg.sender, contentHash, version));
        File storage f = files[fileId];
        if (f.author != address(0)) revert AlreadyOpened(); // already opened by this author.
        f.author = msg.sender;
        f.deployBlock = uint32(block.number);
        emit FileOpened(fileId, msg.sender);
    }

    /// @notice Emit one chunk of media. Logs only (~8 gas/byte of data).
    /// @dev    Chunks MUST be uploaded in order and contiguously: chunkIndex
    ///         must equal the per-file `nextChunk`, which then increments. This
    ///         kills sparse/duplicate chunk corruption.
    function upload(bytes32 fileId, uint32 chunkIndex, bytes calldata data) external {
        File storage f = files[fileId];
        if (f.author == address(0)) revert NotOpened();
        if (f.author != msg.sender) revert NotAuthor();
        if (f.finalized) revert AlreadySealed();
        if (chunkIndex != f.nextChunk) revert ChunkOutOfOrder();
        f.nextChunk = chunkIndex + 1;
        emit FileChunk(fileId, chunkIndex, data);
    }

    /// @notice Finalize: write the verification commitment to state.
    /// @dev    The asserted `chunks` MUST equal the number actually uploaded
    ///         (`nextChunk`), so the sealed count can't disagree with the log
    ///         stream. `root`/`size`/`codec` stay author-provided; the resolver
    ///         verifies the root off-chain (multi-RPC agreement) and the STATE
    ///         shard is the consensus backstop — on-chain Merkle verification is
    ///         deliberately avoided as gas-prohibitive.
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
        if (chunks != f.nextChunk) revert ChunkCountMismatch();
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

    /// @notice The next expected chunkIndex for `fileId` (0 if unopened).
    function nextChunk(bytes32 fileId) external view returns (uint32) {
        return files[fileId].nextChunk;
    }
}
