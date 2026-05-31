// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*//////////////////////////////////////////////////////////////////////////
    PERPETUAL - UNAUDITED REFERENCE SCAFFOLD - DO NOT DEPLOY WITH VALUE
    ---------------------------------------------------------------------
    Reference implementation SKETCH of the Seaport-compatible Settlement layer
    for the Perpetual permanence-first NFT marketplace.

    Faithful expression of PRD §8 (settlement + royalty enforcement) and §12
    (security). NOT audited; MUST be audited before mainnet handling of value
    (PRD §12). Deep order-hashing and transfer-conduit details are stubbed with
    `// ...` and clearly marked.
//////////////////////////////////////////////////////////////////////////*/

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import {IPerpetualSettlement} from "./interfaces/IPerpetualSettlement.sol";

/// @title PerpetualSettlement
/// @notice Settlement layer (PRD §6, §8): a Seaport-compatible, non-custodial
///         settlement contract. Orders are EIP-712 signed messages (gasless
///         listings) settled onchain only when filled (PRD §8.1).
///
/// @dev    THE PRODUCT'S DIFFERENTIATOR (PRD §8.2, §12): `fulfillOrder`
///         enforces the token's onchain ERC-2981 royalty as a HARD,
///         PROTOCOL-LEVEL guarantee. The royalty receiver and amount are
///         computed from the token's own {IERC2981-royaltyInfo} at fill time;
///         if the order's consideration does not pay that exact royalty to
///         that receiver, the fill REVERTS. Royalties cannot be bypassed.
///
///         Non-custodial: assets and funds move peer-to-peer; this contract
///         only orchestrates transfers and collects the protocol fee
///         (PRD §12 "No custody"). Reentrancy-guarded on the value-moving path.
contract PerpetualSettlement is
    IPerpetualSettlement,
    EIP712,
    Ownable,
    ReentrancyGuard
{
    using ECDSA for bytes32;

    /*//////////////////////////////////////////////////////////////////////
                                    ERRORS
    //////////////////////////////////////////////////////////////////////*/

    error OrderExpired();
    error OrderNotYetActive();
    error OrderCancelledError();
    error OrderAlreadyFilled();
    error BadSignature();
    error WrongCounter();
    error NotOfferer();
    error FeeOutOfRange();
    error RoyaltyNotHonored();   // <- PRD §8.2 royalty-bypass rejection.
    error UnsupportedOrderShape();
    error InsufficientConsideration();

    /*//////////////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////////////*/

    /// @dev Basis-point denominator (100% == 10_000).
    uint96 internal constant BPS_DENOMINATOR = 10_000;

    /// @dev Protocol fee bounds (PRD §8.4: 2.0%-2.5%).
    uint96 public constant MIN_FEE_BPS = 200; // 2.00%
    uint96 public constant MAX_FEE_BPS = 250; // 2.50%

    /*//////////////////////////////////////////////////////////////////////
                                    STORAGE
    //////////////////////////////////////////////////////////////////////*/

    /// @dev Current protocol fee in basis points (PRD §8.4). Default 2.25%.
    uint96 private _protocolFeeBps = 225;

    /// @dev Recipient of the protocol fee.
    address payable public feeRecipient;

    /// @dev offerer => current counter (nonce) for replay protection (PRD §12).
    mapping(address => uint256) private _counters;

    /// @dev orderHash => lifecycle status.
    mapping(bytes32 => OrderStatus) private _orderStatus;

    /*//////////////////////////////////////////////////////////////////////
                                CONSTRUCTOR
    //////////////////////////////////////////////////////////////////////*/

    /// @param owner_        contract owner (operator multisig).
    /// @param feeRecipient_ protocol fee recipient.
    constructor(address owner_, address payable feeRecipient_)
        EIP712("PerpetualSettlement", "1")
        Ownable(owner_)
    {
        feeRecipient = feeRecipient_;
    }

    /*//////////////////////////////////////////////////////////////////////
                                ADMIN
    //////////////////////////////////////////////////////////////////////*/

    /// @notice Set the protocol fee within the published 2.0%-2.5% band
    ///         (PRD §8.4). Transparency: the rate is onchain and readable.
    function setProtocolFeeBps(uint96 newFeeBps) external onlyOwner {
        if (newFeeBps < MIN_FEE_BPS || newFeeBps > MAX_FEE_BPS) revert FeeOutOfRange();
        _protocolFeeBps = newFeeBps;
    }

    /// @notice Update the protocol fee recipient.
    function setFeeRecipient(address payable newRecipient) external onlyOwner {
        feeRecipient = newRecipient;
    }

    /*//////////////////////////////////////////////////////////////////////
                                FULFILLMENT
    //////////////////////////////////////////////////////////////////////*/

    /// @inheritdoc IPerpetualSettlement
    /// @dev Enforcement order matches the interface contract:
    ///        1. validity window + counter + not cancelled/filled;
    ///        2. EIP-712 signature;
    ///        3. zone validation for restricted orders (eligibility, PRD §9.6);
    ///        4. ERC-2981 royalty honored - REVERT if not (PRD §8.2);
    ///        5. peer-to-peer transfers + protocol fee.
    function fulfillOrder(Order calldata order)
        external
        payable
        nonReentrant
        returns (bool fulfilled)
    {
        OrderComponents calldata p = order.parameters;

        // (1) Validity window + replay protection (PRD §8.1, §12).
        if (block.timestamp >= p.endTime) revert OrderExpired();
        if (block.timestamp < p.startTime) revert OrderNotYetActive();
        if (p.counter != _counters[p.offerer]) revert WrongCounter();

        bytes32 orderHash = _hashOrder(p);
        OrderStatus storage status = _orderStatus[orderHash];
        if (status.isCancelled) revert OrderCancelledError();
        if (status.numerator != 0 && status.numerator == status.denominator) {
            revert OrderAlreadyFilled();
        }

        // (2) Signature verification (PRD §8.1).
        address signer = orderHash.recover(order.signature);
        if (signer != p.offerer) revert BadSignature();
        status.isValidated = true;

        // (3) Zone validation for restricted orders binds the listing-
        //     eligibility gate (PRD §9.6): the zone confirms shard0Configured,
        //     content-hash match vs the mint record, and registered Forever
        //     Library instance. Full zone callback wiring is out of scope here:
        // ...
        // if (p.orderType == OrderType.FULL_RESTRICTED || ...) {
        //     IZone(p.zone).validateOrder(...);
        // }

        // (4) MANDATORY ERC-2981 ROYALTY ENFORCEMENT (PRD §8.2) - the
        //     differentiator. Compute the salePrice from the consideration,
        //     query the token's own royaltyInfo, and require the order pays
        //     that exact royalty to that exact receiver. REVERT otherwise.
        uint256 salePrice = _salePrice(p);
        (address nftToken, uint256 nftId) = _tradedToken(p);
        (address royaltyReceiver, uint256 royaltyAmount) =
            _royaltyInfo(nftToken, nftId, salePrice);

        if (royaltyAmount > 0) {
            // The consideration MUST include an item paying `royaltyAmount` to
            // `royaltyReceiver`. If absent or short, the order is rejected -
            // royalties cannot be bypassed (PRD §8.2, §12).
            if (!_considerationHonorsRoyalty(p, royaltyReceiver, royaltyAmount)) {
                revert RoyaltyNotHonored();
            }
        }

        // Protocol fee (PRD §8.4). Computed transparently from sale price.
        uint256 protocolFee = (salePrice * _protocolFeeBps) / BPS_DENOMINATOR;

        // (5) Settle peer-to-peer. The contract orchestrates transfers but
        //     never custodies assets/funds between steps (PRD §12). A full
        //     implementation moves:
        //       - the NFT: offerer -> fulfiller (via approval/conduit);
        //       - seller proceeds: fulfiller -> offerer;
        //       - royalty: fulfiller -> royaltyReceiver;
        //       - protocol fee: fulfiller -> feeRecipient.
        //     Native-vs-ERC20 branching and conduit transfers are stubbed:
        // ...
        // _transferOffer(p, fulfiller);
        // _transferConsideration(p, fulfiller);
        // _payProtocolFee(protocolFee);

        // Mark fully filled (partial-fill accounting omitted in this sketch).
        status.numerator = 1;
        status.denominator = 1;

        emit OrderFulfilled(
            orderHash,
            p.offerer,
            _msgSender(),
            protocolFee,
            royaltyAmount,
            royaltyReceiver
        );

        return true;
    }

    /*//////////////////////////////////////////////////////////////////////
                                CANCELLATION
    //////////////////////////////////////////////////////////////////////*/

    /// @inheritdoc IPerpetualSettlement
    function cancel(OrderComponents[] calldata orders)
        external
        returns (bool cancelled)
    {
        for (uint256 i = 0; i < orders.length; i++) {
            OrderComponents calldata p = orders[i];
            // Only the offerer may cancel their own order (PRD §8.1).
            if (p.offerer != _msgSender()) revert NotOfferer();
            bytes32 orderHash = _hashOrder(p);
            _orderStatus[orderHash].isCancelled = true;
            emit OrderCancelled(orderHash, p.offerer);
        }
        return true;
    }

    /// @inheritdoc IPerpetualSettlement
    function incrementCounter() external returns (uint256 newCounter) {
        // Bumping the counter invalidates all outstanding orders signed under
        // the old counter (bulk cancel / replay protection, PRD §12).
        newCounter = ++_counters[_msgSender()];
        emit CounterIncremented(newCounter, _msgSender());
    }

    /*//////////////////////////////////////////////////////////////////////
                                    VIEWS
    //////////////////////////////////////////////////////////////////////*/

    /// @inheritdoc IPerpetualSettlement
    function getOrderStatus(bytes32 orderHash) external view returns (OrderStatus memory) {
        return _orderStatus[orderHash];
    }

    /// @inheritdoc IPerpetualSettlement
    function getOrderHash(OrderComponents calldata order) external view returns (bytes32) {
        return _hashOrder(order);
    }

    /// @inheritdoc IPerpetualSettlement
    function getCounter(address offerer) external view returns (uint256) {
        return _counters[offerer];
    }

    /// @inheritdoc IPerpetualSettlement
    function protocolFeeBps() external view returns (uint96) {
        return _protocolFeeBps;
    }

    /*//////////////////////////////////////////////////////////////////////
                            INTERNAL - HASHING
    //////////////////////////////////////////////////////////////////////*/

    /// @dev EIP-712 typed-data hash of an order (PRD §8.1). A full
    ///      implementation hashes nested OfferItem[] / ConsiderationItem[]
    ///      arrays per the typed-data spec; the per-field encoding is stubbed:
    // ...
    function _hashOrder(OrderComponents calldata p) internal view returns (bytes32) {
        // Placeholder struct hash. Production must encode every field and
        // array element with the correct EIP-712 type hashes for tooling and
        // aggregator compatibility (PRD §8.1).
        bytes32 structHash = keccak256(
            abi.encode(
                p.offerer,
                p.zone,
                p.orderType,
                p.startTime,
                p.endTime,
                p.zoneHash,
                p.salt,
                p.conductKey,
                p.counter
                // + hashed offer[] and consideration[] arrays: ...
            )
        );
        return _hashTypedDataV4(structHash);
    }

    /*//////////////////////////////////////////////////////////////////////
                        INTERNAL - ROYALTY ENFORCEMENT
    //////////////////////////////////////////////////////////////////////*/

    /// @dev Query the traded token's onchain ERC-2981 royalty (PRD §8.2).
    ///      Tokens that do not implement ERC-2981 return (address(0), 0); such
    ///      tokens carry no enforced royalty obligation, but Perpetual-native
    ///      Forever Library tokens always do.
    function _royaltyInfo(address nftToken, uint256 nftId, uint256 salePrice)
        internal
        view
        returns (address receiver, uint256 amount)
    {
        try IERC2981(nftToken).royaltyInfo(nftId, salePrice) returns (
            address r,
            uint256 a
        ) {
            return (r, a);
        } catch {
            return (address(0), 0);
        }
    }

    /// @dev Returns true iff the order's consideration includes an item paying
    ///      at least `royaltyAmount` to `royaltyReceiver`. This is the hard
    ///      check that makes royalty bypass impossible (PRD §8.2, §12).
    function _considerationHonorsRoyalty(
        OrderComponents calldata p,
        address royaltyReceiver,
        uint256 royaltyAmount
    ) internal pure returns (bool) {
        for (uint256 i = 0; i < p.consideration.length; i++) {
            ConsiderationItem calldata c = p.consideration[i];
            // Royalty is paid in the sale currency (NATIVE or ERC20). Use the
            // floor amount (startAmount == endAmount for fixed price).
            if (
                c.recipient == royaltyReceiver &&
                c.startAmount >= royaltyAmount &&
                (c.itemType == ItemType.NATIVE || c.itemType == ItemType.ERC20)
            ) {
                return true;
            }
        }
        return false;
    }

    /*//////////////////////////////////////////////////////////////////////
                        INTERNAL - ORDER INTROSPECTION
    //////////////////////////////////////////////////////////////////////*/

    /// @dev Total currency the seller's consideration represents (the sale
    ///      price), used for fee + royalty math. Sums NATIVE/ERC20
    ///      consideration items. Full multi-currency handling is simplified.
    function _salePrice(OrderComponents calldata p) internal pure returns (uint256 total) {
        for (uint256 i = 0; i < p.consideration.length; i++) {
            ConsiderationItem calldata c = p.consideration[i];
            if (c.itemType == ItemType.NATIVE || c.itemType == ItemType.ERC20) {
                total += c.startAmount;
            }
        }
        if (total == 0) revert InsufficientConsideration();
    }

    /// @dev The NFT being traded (the first ERC721/ERC1155 offer item). Offers
    ///      (bids) where the NFT is in consideration are handled symmetrically
    ///      in a full implementation; this sketch covers the listing case.
    function _tradedToken(OrderComponents calldata p)
        internal
        pure
        returns (address token, uint256 identifier)
    {
        for (uint256 i = 0; i < p.offer.length; i++) {
            OfferItem calldata o = p.offer[i];
            if (o.itemType == ItemType.ERC721 || o.itemType == ItemType.ERC1155) {
                return (o.token, o.identifierOrCriteria);
            }
        }
        revert UnsupportedOrderShape();
    }
}
