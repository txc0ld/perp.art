// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*//////////////////////////////////////////////////////////////////////////
    PERPETUAL - UNAUDITED REFERENCE SCAFFOLD - DO NOT DEPLOY WITH VALUE
    ---------------------------------------------------------------------
    PerpetualDrop: a dedicated batch-mint ERC-721 for large PFP / generative
    "folder-permanence" collections on Perpetual.

    Permanence model (see docs/superpowers/specs/2026-06-01-bulk-pfp-drops-design.md):
    one IPFS + Arweave folder holds the art and the per-token metadata JSON;
    the contract anchors the whole ordered asset set with ONE on-chain
    `provenanceHash`, plus a `baseURI` (placeholder pre-reveal). This is an
    explicit folder-permanence tier, distinct from the 5-shard per-token
    guarantee of ForeverLibrary 1-of-1s / editions.
//////////////////////////////////////////////////////////////////////////*/

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC2981} from "@openzeppelin/contracts/token/common/ERC2981.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC2309} from "@openzeppelin/contracts/interfaces/IERC2309.sol";
import {Checkpoints} from "@openzeppelin/contracts/utils/structs/Checkpoints.sol";
import {Base64} from "solady/utils/Base64.sol";
import {LibString} from "solady/utils/LibString.sol";

/// @title PerpetualDrop
/// @notice ERC-721 + ERC-2981 collection that batch-mints large supplies with
///         a single ERC-2309 `ConsecutiveTransfer` range event per chunk.
/// @dev    BATCH-MINT MECHANISM. OpenZeppelin's `ERC721Consecutive` restricts
///         `_mintConsecutive` to the constructor (it reverts once
///         `address(this).code.length > 0`). The drop flow requires chunked
///         minting AFTER deploy (deploy → commitProvenance → mintBatch chunks →
///         reveal). So this contract reimplements the same ERC-2309 anchor
///         pattern OZ uses (a `Checkpoints.Trace160` of range -> owner), but
///         callable post-construction by the owner. `ownerOf`/`balanceOf`/
///         `tokenURI` all resolve correctly, and each chunk emits one
///         `ConsecutiveTransfer(fromId, toId, address(0), to)` event, which is
///         exactly what OpenSea and other indexers ingest for ERC-2309 ranges.
contract PerpetualDrop is ERC721, ERC2981, Ownable, IERC2309 {
    using Checkpoints for Checkpoints.Trace160;
    using LibString for uint256;

    /*//////////////////////////////////////////////////////////////////////
                                    ERRORS
    //////////////////////////////////////////////////////////////////////*/

    error ProvenanceAlreadyCommitted();
    error EmptyProvenance();
    error AlreadyRevealed();
    error MaxSupplyExceeded();
    error ZeroQuantity();
    error InvalidReceiver();
    error TokenDoesNotExist();
    error BatchTooLarge();
    error ProvenanceNotCommitted();
    error MaxSupplyTooLarge();

    /*//////////////////////////////////////////////////////////////////////
                                    EVENTS
    //////////////////////////////////////////////////////////////////////*/

    event ProvenanceCommitted(bytes32 provenanceHash);
    event BatchMinted(address indexed to, uint256 fromTokenId, uint256 toTokenId);
    event Revealed(string baseURI);

    /*//////////////////////////////////////////////////////////////////////
                                    STORAGE
    //////////////////////////////////////////////////////////////////////*/

    /// @notice Maximum number of tokens that can ever be minted.
    uint256 public immutable maxSupply;

    /// @notice Per-call cap on `mintBatch` quantity. Bounds the ERC-2309
    ///         `ConsecutiveTransfer` range so indexers (OpenSea et al.) reliably
    ///         ingest the batch; very large ranges are dropped by some indexers.
    uint256 public constant MAX_BATCH = 5000;

    /// @notice On-chain anchor over the ordered per-asset hash manifest
    ///         (the off-chain manifest is published alongside, verifiable
    ///         post-reveal). Set once, immutable after.
    bytes32 public provenanceHash;

    /// @notice Whether the real metadata has been revealed (one-way).
    bool public revealed;

    /// @dev Current base URI (placeholder until `reveal`). tokenURI = baseURI + id.
    string private _baseTokenURI;

    /// @dev Total tokens minted so far (token ids run 1..maxSupply).
    uint256 private _totalMinted;

    /// @dev ERC-2309 ownership anchors: range-end tokenId -> owner. Mirrors
    ///      OpenZeppelin's ERC721Consecutive sequential-ownership structure so
    ///      `ownerOf` resolves un-transferred batch tokens from the anchors.
    Checkpoints.Trace160 private _sequentialOwnership;

    /*//////////////////////////////////////////////////////////////////////
                                CONSTRUCTOR
    //////////////////////////////////////////////////////////////////////*/

    /// @param name_               collection name.
    /// @param symbol_             collection symbol.
    /// @param owner_              collection owner / creator (royalty recipient).
    /// @param royaltyBps          default ERC-2981 royalty in basis points.
    /// @param maxSupply_          hard cap on total tokens.
    /// @param placeholderBaseURI_ pre-reveal base URI (tokenURI = baseURI + id).
    constructor(
        string memory name_,
        string memory symbol_,
        address owner_,
        uint96 royaltyBps,
        uint256 maxSupply_,
        string memory placeholderBaseURI_
    ) ERC721(name_, symbol_) Ownable(owner_) {
        // Bound maxSupply to uint96 so token ids fit the ERC-2309 anchor's
        // uint96 key (see `_sequentialOwnership` pushes) without truncation.
        if (maxSupply_ > type(uint96).max) revert MaxSupplyTooLarge();
        maxSupply = maxSupply_;
        _baseTokenURI = placeholderBaseURI_;
        _setDefaultRoyalty(owner_, royaltyBps);
    }

    /*//////////////////////////////////////////////////////////////////////
                                PROVENANCE
    //////////////////////////////////////////////////////////////////////*/

    /// @notice Commit the provenance hash. Settable exactly ONCE.
    function commitProvenance(bytes32 hash) external onlyOwner {
        if (provenanceHash != bytes32(0)) revert ProvenanceAlreadyCommitted();
        if (hash == bytes32(0)) revert EmptyProvenance();
        provenanceHash = hash;
        emit ProvenanceCommitted(hash);
    }

    /*//////////////////////////////////////////////////////////////////////
                                BATCH MINT
    //////////////////////////////////////////////////////////////////////*/

    /// @notice Batch-mint `quantity` sequential tokens to `to`, emitting one
    ///         ERC-2309 `ConsecutiveTransfer` range event. Callable repeatedly
    ///         (chunks) until `maxSupply` is reached. Owner-only.
    /// @dev    Token ids are 1-based and contiguous. Does NOT invoke
    ///         `onERC721Received` (batch mint; matches ERC721Consecutive
    ///         semantics). `balanceOf` is updated via `_increaseBalance` and
    ///         `ownerOf` reads the sequential-ownership anchors until a token is
    ///         first transferred (at which point `_update` writes `_owners`).
    function mintBatch(address to, uint256 quantity) external onlyOwner {
        if (quantity == 0) revert ZeroQuantity();
        if (quantity > MAX_BATCH) revert BatchTooLarge();
        if (to == address(0)) revert InvalidReceiver();
        uint256 minted = _totalMinted;
        if (minted + quantity > maxSupply) revert MaxSupplyExceeded();

        uint256 fromId = minted + 1;
        uint256 toId = minted + quantity;

        // Anchor ownership of the whole range to `to` at the range-end id.
        _sequentialOwnership.push(uint96(toId), uint160(to));
        _increaseBalance(to, uint128(quantity));
        _totalMinted = toId;

        emit ConsecutiveTransfer(fromId, toId, address(0), to);
        emit BatchMinted(to, fromId, toId);
    }

    /*//////////////////////////////////////////////////////////////////////
                                    REVEAL
    //////////////////////////////////////////////////////////////////////*/

    /// @notice Reveal the real metadata folder. One-way: reverts if already
    ///         revealed. After this, `baseURI` is frozen.
    function reveal(string calldata realBaseURI) external onlyOwner {
        // Enforce the deploy -> commit -> mint -> reveal ordering: provenance
        // must be anchored before the real metadata can be revealed.
        if (provenanceHash == bytes32(0)) revert ProvenanceNotCommitted();
        if (revealed) revert AlreadyRevealed();
        revealed = true;
        _baseTokenURI = realBaseURI;
        emit Revealed(realBaseURI);
    }

    /*//////////////////////////////////////////////////////////////////////
                                    VIEWS
    //////////////////////////////////////////////////////////////////////*/

    /// @notice Total tokens minted so far.
    function totalMinted() external view returns (uint256) {
        return _totalMinted;
    }

    /// @notice Current base URI (placeholder pre-reveal, real folder post-reveal).
    function baseURI() external view returns (string memory) {
        return _baseTokenURI;
    }

    /// @notice Per-token metadata URI: `baseURI + tokenId`. The folder serves
    ///         OpenSea-style JSON ({name, description, image, attributes}).
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        return string.concat(_baseTokenURI, tokenId.toString());
    }

    /// @notice OpenSea collection-level metadata as an on-chain JSON data URI.
    function contractURI() external view returns (string memory) {
        (, uint256 royaltyAmount) = royaltyInfo(0, 10_000);
        string memory json = string.concat(
            '{"name":"', LibString.escapeJSON(name()),
            '","description":"A Perpetual folder-permanence collection (IPFS + Arweave folder anchored by an on-chain provenance hash).',
            '","image":"', _baseTokenURI,
            '","seller_fee_basis_points":', LibString.toString(royaltyAmount),
            ',"fee_recipient":"', LibString.toHexStringChecksummed(owner()),
            '"}'
        );
        return string.concat(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        );
    }

    /*//////////////////////////////////////////////////////////////////////
                            ERC-2309 OWNERSHIP RESOLUTION
    //////////////////////////////////////////////////////////////////////*/

    /// @dev Resolve ownership of batch-minted tokens from the sequential
    ///      anchors when the core `_owners` slot is still empty (token never
    ///      transferred). Mirrors OpenZeppelin's ERC721Consecutive._ownerOf.
    ///
    ///      NO BURN ENTRYPOINT: this manual ERC-2309 anchor scheme has no burn
    ///      bitmap. A burn would clear the core `_owners` slot but `lowerLookup`
    ///      would still resolve the burned id back to its batch owner, silently
    ///      "un-burning" it. Burns MUST NEVER be added here without first porting
    ///      OpenZeppelin's `ERC721Consecutive._sequentialBurn` bitmap.
    function _ownerOf(uint256 tokenId) internal view virtual override returns (address) {
        address coreOwner = super._ownerOf(tokenId);
        if (coreOwner != address(0) || tokenId == 0 || tokenId > _totalMinted) {
            return coreOwner;
        }
        return address(_sequentialOwnership.lowerLookup(uint96(tokenId)));
    }

    /*//////////////////////////////////////////////////////////////////////
                                    ERC-165
    //////////////////////////////////////////////////////////////////////*/

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
