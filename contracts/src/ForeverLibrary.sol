// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*//////////////////////////////////////////////////////////////////////////
    PERPETUAL - UNAUDITED REFERENCE SCAFFOLD - DO NOT DEPLOY WITH VALUE
    ---------------------------------------------------------------------
    Reference implementation SKETCH of the Forever Library token contract for
    the Perpetual permanence-first NFT marketplace.

    This file is a faithful, well-documented expression of the PRD §7 contract
    architecture. It is NOT audited and MUST NOT be deployed to hold value
    before a full security audit (PRD §12). Deep storage-encoding and ethfs
    interop details are stubbed with `// ...` and clearly marked.
//////////////////////////////////////////////////////////////////////////*/

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IForeverLibrary} from "./interfaces/IForeverLibrary.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {SSTORE2} from "solady/utils/SSTORE2.sol";

/// @title ForeverLibrary
/// @notice Asset & Provenance layer (PRD §6, §7): an ERC-721 + ERC-2981 token
///         contract with URI sharding. Each token keeps parallel, immutable
///         copies of its artwork across multiple storage backends, anchored by
///         a MANDATORY onchain proof shard (Shard 0, ethfs) that survives as
///         long as Ethereum (PRD §7.2).
/// @dev    Sovereign artists may deploy their own instance of this contract
///         (PRD §7.5); the marketplace federates over instances identically.
contract ForeverLibrary is
    ERC721,
    ERC2981,
    Ownable,
    ReentrancyGuard,
    IForeverLibrary
{
    /*//////////////////////////////////////////////////////////////////////
                                    ERRORS
    //////////////////////////////////////////////////////////////////////*/

    error NotTokenCreator();
    error TokenDoesNotExist();
    error ShardsAreLocked();
    error EditWindowClosed();
    error ShardIndexOutOfRange();
    error Shard0MustBeOnchain();
    error Shard0AlreadyConfigured();
    error MandatoryProofMissing();
    error InvalidRoyalty();
    error EmptyContentHash();
    error EmptyProof();
    error ProofTooLarge();
    error HostingFeeTooHigh();
    error InsufficientStorageFee();
    error UnexpectedPayment();
    error StorageFeeTransferFailed();

    /*//////////////////////////////////////////////////////////////////////
                                    TYPES
    //////////////////////////////////////////////////////////////////////*/

    /// @dev Per-shard onchain record (PRD §7.2, §7.3).
    struct Shard {
        ShardBackend backend;
        bytes32 contentHash; // keccak256 of shard content for verification (PRD §9.4).
        string uri;          // resolvable locator (data URI / CID / Arweave tx / Irys id).
        // For the mandatory onchain shard (Shard 0) `uri` is empty: the raw
        // low-res bytes live in an SSTORE2 data contract and the resolvable
        // `data:` URI is rebuilt on demand in `_stateDataUri`.
    }

    /// @dev Max bytes for the on-chain STATE proof. Kept under the EIP-170
    ///      contract-size limit (24,576) that bounds a single SSTORE2 write.
    uint256 public constant MAX_PROOF_BYTES = 24_000;

    /*//////////////////////////////////////////////////////////////////////
                                    STORAGE
    //////////////////////////////////////////////////////////////////////*/

    /// @dev Duration after mint during which shards may still be added/edited,
    ///      after which they become immutable (PRD §7.3 edit windows).
    uint64 public immutable editWindow;

    /// @dev Monotonic token id counter (ids start at 1).
    uint256 private _nextTokenId = 1;

    /// @dev tokenId => immutable provenance record (PRD §7.4).
    mapping(uint256 => MintData) private _mintData;

    /// @dev tokenId => ordered shards. Index 0 is always the mandatory onchain
    ///      proof shard once configured (PRD §7.2).
    mapping(uint256 => Shard[]) private _shards;

    /// @dev tokenId => SSTORE2 pointer holding Shard 0's raw on-chain bytes.
    mapping(uint256 => address) private _statePointer;

    /// @dev tokenId => whether the mandatory onchain proof (Shard 0) exists.
    mapping(uint256 => bool) private _shard0Configured;

    /// @dev tokenId => shard index to display externally (PRD §7.3).
    mapping(uint256 => uint256) private _selectedShardIndex;

    /// @dev tokenId => whether shards are permanently locked (PRD §7.3).
    mapping(uint256 => bool) private _locked;

    /// @dev tokenId => block.timestamp deadline for edits.
    mapping(uint256 => uint64) private _editDeadline;

    /*//////////////////////////////////////////////////////////////////////
                            HOSTING / STORAGE FEE
    //////////////////////////////////////////////////////////////////////*/

    /// @dev Largest per-sale hosting fee the contract will record: 1.50%.
    uint16 public constant MAX_HOSTING_FEE_BPS = 150;

    /// @dev tokenId => Perpetual hosting fee in bps charged on every sale.
    ///      0 means the artist pre-paid storage at mint (fee-exempt); a positive
    ///      value means Perpetual fronts storage and earns this on each sale.
    mapping(uint256 => uint16) private _hostingFeeBps;

    /// @dev Flat storage fee (wei) an artist pays at mint when self-funding
    ///      storage (hosting fee == 0). Owner-settable; 0 = free.
    uint256 public storageFeeWei;

    /// @dev Recipient of artist-paid storage fees (defaults to the owner).
    address payable public treasury;

    event HostingConfigured(uint256 indexed tokenId, uint16 hostingFeeBps, uint256 storagePaidWei);
    event StorageFeeUpdated(uint256 newFeeWei);
    event TreasuryUpdated(address newTreasury);

    /*//////////////////////////////////////////////////////////////////////
                                CONSTRUCTOR
    //////////////////////////////////////////////////////////////////////*/

    /// @param name_       collection name.
    /// @param symbol_     collection symbol.
    /// @param owner_      contract owner (the sovereign artist or the operator).
    /// @param editWindow_ seconds after mint during which shards may be edited.
    constructor(
        string memory name_,
        string memory symbol_,
        address owner_,
        uint64 editWindow_
    ) ERC721(name_, symbol_) Ownable(owner_) {
        editWindow = editWindow_;
        treasury = payable(owner_);
    }

    /*//////////////////////////////////////////////////////////////////////
                                    ADMIN
    //////////////////////////////////////////////////////////////////////*/

    /// @notice Set the flat storage fee (wei) artists pay when self-funding.
    function setStorageFeeWei(uint256 newFeeWei) external onlyOwner {
        storageFeeWei = newFeeWei;
        emit StorageFeeUpdated(newFeeWei);
    }

    /// @notice Set the recipient of artist-paid storage fees.
    function setTreasury(address payable newTreasury) external onlyOwner {
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    /*//////////////////////////////////////////////////////////////////////
                                MODIFIERS
    //////////////////////////////////////////////////////////////////////*/

    modifier onlyCreator(uint256 tokenId) {
        _requireMinted(tokenId);
        if (_mintData[tokenId].creator != _msgSender()) revert NotTokenCreator();
        _;
    }

    /// @dev Enforces immutability: reverts if locked or if the edit window has
    ///      closed (PRD §7.3 locking + edit windows).
    modifier whileEditable(uint256 tokenId) {
        if (_locked[tokenId]) revert ShardsAreLocked();
        if (block.timestamp > _editDeadline[tokenId]) revert EditWindowClosed();
        _;
    }

    /*//////////////////////////////////////////////////////////////////////
                                    MINT
    //////////////////////////////////////////////////////////////////////*/

    /// @notice Mint a new token, writing its immutable provenance record and
    ///         (atomically) its mandatory onchain proof shard (PRD §7.4, §7.2).
    /// @dev    Shard 0 is always written via SSTORE2 (on-chain bytes); empty or
    ///         oversized `proofData` reverts. Sets ERC-2981 royalty from `royaltyBps`.
    /// @param to              recipient / creator of the token.
    /// @param artistName      human-readable artist name (provenance).
    /// @param title           work title (provenance).
    /// @param mediaType       MIME type of the media (provenance).
    /// @param royaltyBps      creator royalty in basis points (ERC-2981).
    /// @param metadataHash    keccak256 of canonical metadata (verification).
    /// @param proofData       raw low-res canonical bytes for the on-chain STATE
    ///        proof shard (Shard 0); stored via SSTORE2, hashed on-chain. Must be
    ///        1..MAX_PROOF_BYTES bytes.
    /// @param hostingFeeBps_  0 == artist pre-pays storage (must send >=
    ///        storageFeeWei, token is fee-exempt on resale); >0 (<= MAX) ==
    ///        Perpetual hosts storage and earns this fee on every future sale.
    /// @return tokenId        the newly minted token id.
    function mint(
        address to,
        string calldata artistName,
        string calldata title,
        string calldata mediaType,
        uint96 royaltyBps,
        bytes32 metadataHash,
        bytes calldata proofData,
        uint16 hostingFeeBps_
    ) external payable nonReentrant returns (uint256 tokenId) {
        if (royaltyBps > _feeDenominator()) revert InvalidRoyalty(); // <= 100%.
        if (metadataHash == bytes32(0)) revert EmptyContentHash();
        if (proofData.length == 0) revert EmptyProof();
        if (proofData.length > MAX_PROOF_BYTES) revert ProofTooLarge();
        if (hostingFeeBps_ > MAX_HOSTING_FEE_BPS) revert HostingFeeTooHigh();

        // Hosting model. fee == 0: the artist self-funds permanent storage by
        // paying the flat storage fee now, and the token carries no resale fee.
        // fee > 0: Perpetual fronts storage for free and is paid this fee on
        // every sale (enforced in PerpetualSettlement), so no upfront payment.
        if (hostingFeeBps_ == 0) {
            if (msg.value < storageFeeWei) revert InsufficientStorageFee();
        } else if (msg.value != 0) {
            revert UnexpectedPayment();
        }

        tokenId = _nextTokenId++;
        _hostingFeeBps[tokenId] = hostingFeeBps_;

        // Immutable provenance record (PRD §7.4). Written before mint so it is
        // available the instant the Transfer event fires for indexers.
        _mintData[tokenId] = MintData({
            creator: to,
            timestamp: uint64(block.timestamp),
            blockNumber: uint64(block.number),
            artistName: artistName,
            title: title,
            mediaType: mediaType,
            royaltyBps: royaltyBps,
            metadataHash: metadataHash
        });

        // Per-token ERC-2981 royalty; enforced at settlement (PRD §8.2).
        _setTokenRoyalty(tokenId, to, royaltyBps);

        // Open the edit window (PRD §7.3).
        _editDeadline[tokenId] = uint64(block.timestamp) + editWindow;

        // MANDATORY on-chain STATE proof shard (Shard 0). The low-res canonical
        // bytes are written to SSTORE2 (bytes-as-bytecode) so they live in
        // consensus-guaranteed contract state; the content hash is computed
        // on-chain (trustless). This is the permanence backstop and the sole
        // listing-eligibility precondition (PRD §7.2, §7.3, §9.6).
        _statePointer[tokenId] = SSTORE2.write(proofData);
        _configureShard(
            tokenId,
            0,
            ShardBackend.Onchain,
            "", // Shard 0 URI is derived on-chain in shardURI() from SSTORE2.
            keccak256(proofData)
        );

        _safeMint(to, tokenId);

        emit TokenMinted(
            tokenId,
            to,
            metadataHash,
            royaltyBps,
            uint64(block.timestamp),
            uint64(block.number)
        );
        emit HostingConfigured(tokenId, hostingFeeBps_, msg.value);

        // Forward any artist-paid storage fee to the treasury (interactions last).
        if (msg.value > 0) {
            (bool ok, ) = treasury.call{value: msg.value}("");
            if (!ok) revert StorageFeeTransferFailed();
        }
    }

    /*//////////////////////////////////////////////////////////////////////
                            SHARD CONFIGURATION
    //////////////////////////////////////////////////////////////////////*/

    /// @notice Add or (within the edit window) replace a shard for a token
    ///         (PRD §7.2, §7.3). Records the content hash onchain for
    ///         independent verification (PRD §9.4).
    /// @dev    Index 0 is reserved for the mandatory onchain proof and is set
    ///         only at mint; attempting to reconfigure it here reverts. New
    ///         shards must be appended at the current `shardCount`.
    /// @param tokenId     token to configure.
    /// @param index       shard index (must equal current shardCount to append).
    /// @param backend     storage backend (PRD §7.2).
    /// @param uri         resolvable locator.
    /// @param contentHash keccak256 of shard content.
    function configureShard(
        uint256 tokenId,
        uint256 index,
        ShardBackend backend,
        string calldata uri,
        bytes32 contentHash
    ) external onlyCreator(tokenId) whileEditable(tokenId) nonReentrant {
        // Shard 0 (onchain proof) is immutable post-mint to keep the
        // permanence backstop tamper-evident (PRD §7.3, §18).
        if (index == 0) revert Shard0AlreadyConfigured();
        if (index > _shards[tokenId].length) revert ShardIndexOutOfRange();
        if (contentHash == bytes32(0)) revert EmptyContentHash();

        _configureShard(tokenId, index, backend, uri, contentHash);
    }

    /// @dev Internal shard writer. Appends when `index == length`, replaces
    ///      when `index < length` (only reachable for index > 0 via the
    ///      external path while editable). Enforces the Shard 0 == Onchain
    ///      invariant (PRD §7.3).
    function _configureShard(
        uint256 tokenId,
        uint256 index,
        ShardBackend backend,
        string memory uri,
        bytes32 contentHash
    ) internal {
        if (index == 0 && backend != ShardBackend.Onchain) {
            revert Shard0MustBeOnchain();
        }

        Shard memory shard = Shard({
            backend: backend,
            contentHash: contentHash,
            uri: uri
        });

        Shard[] storage shards = _shards[tokenId];
        if (index == shards.length) {
            shards.push(shard);
        } else {
            shards[index] = shard;
        }

        if (index == 0) {
            _shard0Configured[tokenId] = true;
            // Default the displayed shard to the proof; the creator may later
            // select a higher-resolution shard (PRD §7.3).
            _selectedShardIndex[tokenId] = 0;
        }

        // ethfs persistence (writing raw bytes to the FileStore for onchain
        // shards) and any chunk-pointer bookkeeping happens here in a full
        // implementation:
        // ...

        emit ShardConfigured(tokenId, index, backend, contentHash);
    }

    /// @notice Select which shard external platforms display (PRD §7.3).
    /// @dev    The selection is purely a display preference; Shard 0 always
    ///         remains the fallback regardless of selection.
    function setSelectedShardIndex(uint256 tokenId, uint256 index)
        external
        onlyCreator(tokenId)
        whileEditable(tokenId)
    {
        if (index >= _shards[tokenId].length) revert ShardIndexOutOfRange();
        _selectedShardIndex[tokenId] = index;
    }

    /// @notice Permanently lock a token's shards for guaranteed immutability
    ///         (PRD §7.3 locking, §10.4 trust signal).
    /// @dev    Requires the mandatory onchain proof to exist first, so a locked
    ///         token is always permanence-complete. Irreversible.
    function lockShards(uint256 tokenId)
        external
        onlyCreator(tokenId)
    {
        if (!_shard0Configured[tokenId]) revert MandatoryProofMissing();
        if (_locked[tokenId]) revert ShardsAreLocked();
        _locked[tokenId] = true;
        emit ShardsLocked(tokenId);
    }

    /*//////////////////////////////////////////////////////////////////////
                        IForeverLibrary VIEWS
    //////////////////////////////////////////////////////////////////////*/

    /// @notice Per-token Perpetual hosting fee in bps, read at settlement.
    function hostingFeeBps(uint256 tokenId) external view returns (uint16) {
        return _hostingFeeBps[tokenId];
    }

    /// @inheritdoc IForeverLibrary
    function shard0Configured(uint256 tokenId) external view returns (bool) {
        return _shard0Configured[tokenId];
    }

    /// @inheritdoc IForeverLibrary
    function selectedShardIndex(uint256 tokenId) external view returns (uint256) {
        return _selectedShardIndex[tokenId];
    }

    /// @inheritdoc IForeverLibrary
    function isLocked(uint256 tokenId) external view returns (bool) {
        return _locked[tokenId];
    }

    /// @inheritdoc IForeverLibrary
    function shardCount(uint256 tokenId) external view returns (uint256) {
        return _shards[tokenId].length;
    }

    /// @inheritdoc IForeverLibrary
    function shardURI(uint256 tokenId, uint256 index) external view returns (string memory) {
        if (index >= _shards[tokenId].length) revert ShardIndexOutOfRange();
        if (index == 0) return _stateDataUri(tokenId);
        return _shards[tokenId][index].uri;
    }

    /// @inheritdoc IForeverLibrary
    function shardBackend(uint256 tokenId, uint256 index) external view returns (ShardBackend) {
        if (index >= _shards[tokenId].length) revert ShardIndexOutOfRange();
        return _shards[tokenId][index].backend;
    }

    /// @inheritdoc IForeverLibrary
    function shardContentHash(uint256 tokenId, uint256 index) external view returns (bytes32) {
        if (index >= _shards[tokenId].length) revert ShardIndexOutOfRange();
        return _shards[tokenId][index].contentHash;
    }

    /// @inheritdoc IForeverLibrary
    function getMintData(uint256 tokenId) external view returns (MintData memory) {
        _requireMinted(tokenId);
        return _mintData[tokenId];
    }

    /*//////////////////////////////////////////////////////////////////////
                                TOKEN URI
    //////////////////////////////////////////////////////////////////////*/

    /// @notice Token URI resolves to the selected shard's locator (PRD §7.3).
    /// @dev    External platforms (our indexer, OpenSea) read this. The onchain
    ///         proof (Shard 0) is always available as the fallback resolution
    ///         path (PRD §5.1, §18) even if the selected shard's backend is down.
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireMinted(tokenId);
        uint256 idx = _selectedShardIndex[tokenId];
        Shard[] storage shards = _shards[tokenId];
        if (idx >= shards.length) idx = 0;
        if (idx == 0) return _stateDataUri(tokenId);
        return shards[idx].uri;
    }

    /*//////////////////////////////////////////////////////////////////////
                                    ERC-165
    //////////////////////////////////////////////////////////////////////*/

    /// @notice ERC-165 interface detection across ERC-721 + ERC-2981 + the
    ///         Forever Library surface.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC2981)
        returns (bool)
    {
        return
            interfaceId == type(IForeverLibrary).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    /*//////////////////////////////////////////////////////////////////////
                                INTERNAL
    //////////////////////////////////////////////////////////////////////*/

    /// @dev Build Shard 0's on-chain data URI from the SSTORE2-stored bytes and
    ///      the token's recorded media type. Zero external dependencies.
    function _stateDataUri(uint256 tokenId) internal view returns (string memory) {
        bytes memory data = SSTORE2.read(_statePointer[tokenId]);
        return string.concat(
            "data:",
            _mintData[tokenId].mediaType,
            ";base64,",
            Base64.encode(data)
        );
    }

    /// @dev Reverts if `tokenId` has not been minted.
    function _requireMinted(uint256 tokenId) internal view {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
    }
}
