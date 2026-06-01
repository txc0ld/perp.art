// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*//////////////////////////////////////////////////////////////////////////
    PERPETUAL - UNAUDITED - DO NOT DEPLOY WITH VALUE BEFORE AUDIT
    ---------------------------------------------------------------------
    Settlement layer (PRD §6, §8). A non-custodial, EIP-712 signed-order
    exchange. v1 implements the FIXED-PRICE listing case in native ETH with
    HARD, protocol-level ERC-2981 royalty enforcement (PRD §8.2): the royalty
    is computed from the token's own royaltyInfo at fill time and PAID out of
    the sale before the seller is paid, so it can never be bypassed.

    The broader Seaport-compatible barter/criteria/cross-chain surface lives in
    interfaces/IPerpetualSettlement.sol as the design target; this concrete
    contract implements the fixed-price subset end to end and tested. ERC-20
    payment tokens, NFT-for-NFT barter, and offers (bids) are follow-ups.

    Still unaudited. Compiling + tests are not a substitute for an audit (§12).
//////////////////////////////////////////////////////////////////////////*/

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {IERC2981} from "@openzeppelin/contracts/interfaces/IERC2981.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @notice Minimal view to read a Forever Library token's per-token Perpetual
///         hosting fee. Non-Perpetual NFTs simply don't implement it (fee 0).
interface IPerpetualHostingFee {
    function hostingFeeBps(uint256 tokenId) external view returns (uint16);
}

/// @title PerpetualSettlement
/// @notice Non-custodial fixed-price exchange with enforced ERC-2981 royalties.
contract PerpetualSettlement is EIP712, Ownable, ReentrancyGuard {
    using ECDSA for bytes32;

    /*//////////////////////////////////////////////////////////////////////
                                    TYPES
    //////////////////////////////////////////////////////////////////////*/

    /// @notice A gasless fixed-price listing. The seller signs it off-chain
    ///         (EIP-712); a buyer fills it on-chain by sending `price` (PRD §8.1).
    struct Order {
        address seller;       // listing owner; must own + approve the NFT.
        address nft;          // ERC-721 contract.
        uint256 tokenId;
        address paymentToken; // address(0) == native ETH (only ETH in v1).
        uint256 price;        // total price in wei.
        uint256 startTime;    // unix seconds; fill rejected before this.
        uint256 endTime;      // unix seconds; 0 == no expiry.
        uint256 counter;      // must equal the seller's current counter.
        uint256 salt;         // uniqueness for the order hash.
    }

    /*//////////////////////////////////////////////////////////////////////
                                    ERRORS
    //////////////////////////////////////////////////////////////////////*/

    error OrderExpired();
    error OrderNotYetActive();
    error OrderCancelledError();
    error OrderAlreadyFilled();
    error BadSignature();
    error WrongCounter();
    error NotSeller();
    error FeeOutOfRange();
    error UnsupportedPaymentToken();
    error WrongPayment();
    error RoyaltyExceedsPrice();
    error ZeroPrice();

    /*//////////////////////////////////////////////////////////////////////
                                    EVENTS
    //////////////////////////////////////////////////////////////////////*/

    event OrderFulfilled(
        bytes32 indexed orderHash,
        address indexed seller,
        address indexed buyer,
        address nft,
        uint256 tokenId,
        uint256 price,
        uint256 royaltyAmount,
        address royaltyReceiver,
        uint256 protocolFee,
        uint256 hostingFee
    );
    event OrderCancelled(bytes32 indexed orderHash, address indexed seller);
    event CounterIncremented(uint256 newCounter, address indexed seller);
    event ProtocolFeeUpdated(uint96 newFeeBps);
    event FeeRecipientUpdated(address newRecipient);
    event PaymentEscrowed(address indexed recipient, uint256 amount);

    /*//////////////////////////////////////////////////////////////////////
                                CONSTANTS / STORAGE
    //////////////////////////////////////////////////////////////////////*/

    uint96 internal constant BPS_DENOMINATOR = 10_000;
    uint96 public constant MIN_FEE_BPS = 200; // 2.00% (PRD §8.4)
    uint96 public constant MAX_FEE_BPS = 250; // 2.50%

    /// @dev Hard cap on the ERC-2981 royalty honored at settlement: 10%. A
    ///      hostile NFT can report an arbitrary royaltyInfo; clamping (not
    ///      reverting) means it can neither drain the buyer nor brick its own
    ///      market by reporting an absurd royalty.
    uint96 public constant MAX_ROYALTY_BPS = 1000; // 10%

    /// @dev Hard cap on the Perpetual hosting fee honored at settlement: 1.50%,
    ///      mirroring ForeverLibrary.MAX_HOSTING_FEE_BPS. The fee is read live
    ///      from the NFT via `hostingFeeBps()`; a hostile or buggy NFT could
    ///      report an absurd value and brick every sale (RoyaltyExceedsPrice).
    ///      Clamping (not reverting) keeps sales settling regardless.
    uint96 public constant MAX_HOSTING_FEE_BPS = 150; // 1.50%

    bytes32 public constant ORDER_TYPEHASH = keccak256(
        "Order(address seller,address nft,uint256 tokenId,address paymentToken,uint256 price,uint256 startTime,uint256 endTime,uint256 counter,uint256 salt)"
    );

    uint96 private _protocolFeeBps = 225; // 2.25% default
    address payable public feeRecipient;

    mapping(address => uint256) private _counters; // seller => counter
    mapping(bytes32 => bool) public filled;        // orderHash => filled
    mapping(bytes32 => bool) public cancelled;     // orderHash => cancelled

    /// @notice Pull-payment escrow: amounts owed to recipients whose push
    ///         payment reverted during a fill. Claim via `withdraw()`.
    mapping(address => uint256) public withdrawable;

    /*//////////////////////////////////////////////////////////////////////
                                CONSTRUCTOR
    //////////////////////////////////////////////////////////////////////*/

    constructor(address owner_, address payable feeRecipient_)
        EIP712("PerpetualSettlement", "1")
        Ownable(owner_)
    {
        feeRecipient = feeRecipient_;
    }

    /*//////////////////////////////////////////////////////////////////////
                                    ADMIN
    //////////////////////////////////////////////////////////////////////*/

    function setProtocolFeeBps(uint96 newFeeBps) external onlyOwner {
        if (newFeeBps < MIN_FEE_BPS || newFeeBps > MAX_FEE_BPS) revert FeeOutOfRange();
        _protocolFeeBps = newFeeBps;
        emit ProtocolFeeUpdated(newFeeBps);
    }

    function setFeeRecipient(address payable newRecipient) external onlyOwner {
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(newRecipient);
    }

    /*//////////////////////////////////////////////////////////////////////
                                FULFILLMENT
    //////////////////////////////////////////////////////////////////////*/

    /// @notice Fill a signed fixed-price listing. Send exactly `order.price`.
    /// @dev    Checks-effects-interactions + nonReentrant. Royalty is computed
    ///         from the token's ERC-2981 royaltyInfo and PAID out of the sale,
    ///         so it cannot be bypassed (PRD §8.2). Distribution: royalty ->
    ///         receiver, protocol fee -> feeRecipient, remainder -> seller.
    function fulfillOrder(Order calldata order, bytes calldata signature)
        external
        payable
        nonReentrant
        returns (bytes32 orderHash)
    {
        // (1) Validity window + replay protection.
        if (order.startTime > block.timestamp) revert OrderNotYetActive();
        if (order.endTime != 0 && block.timestamp > order.endTime) revert OrderExpired();
        if (order.counter != _counters[order.seller]) revert WrongCounter();
        if (order.paymentToken != address(0)) revert UnsupportedPaymentToken();
        if (order.price == 0) revert ZeroPrice();
        if (msg.value != order.price) revert WrongPayment();

        orderHash = hashOrder(order);
        if (cancelled[orderHash]) revert OrderCancelledError();
        if (filled[orderHash]) revert OrderAlreadyFilled();

        // (2) Signature: the seller must have signed this exact order.
        if (orderHash.recover(signature) != order.seller) revert BadSignature();

        // (3) Mandatory ERC-2981 royalty (PRD §8.2) + protocol fee (PRD §8.4).
        (address royaltyReceiver, uint256 royaltyAmount) =
            _royaltyInfo(order.nft, order.tokenId, order.price);
        // Clamp the royalty to MAX_ROYALTY_BPS (10%). A hostile NFT can report
        // an arbitrary royalty; clamping (rather than reverting) prevents it
        // from draining the buyer while still letting the sale settle.
        uint256 royaltyCap = (order.price * MAX_ROYALTY_BPS) / BPS_DENOMINATOR;
        if (royaltyAmount > royaltyCap) royaltyAmount = royaltyCap;
        // AUDIT: roadmap — sign minSellerProceeds / a fee+royalty bound into the
        // EIP-712 Order struct so the seller authorizes their net proceeds and
        // is protected from fee/royalty changes between signing and fill.
        uint256 protocolFee = (order.price * _protocolFeeBps) / BPS_DENOMINATOR;
        // Perpetual hosting fee: only set on Perpetual-hosted tokens (PRD §7),
        // read from the NFT itself so it follows the token to any marketplace.
        // Clamp to MAX_HOSTING_FEE_BPS (mirrors the royalty clamp above): a
        // hostile/buggy NFT reporting a huge hostingFeeBps must not be able to
        // brick the sale (RoyaltyExceedsPrice) or over-charge.
        uint256 hostingFeeBpsClamped = _hostingFeeBps(order.nft, order.tokenId);
        if (hostingFeeBpsClamped > MAX_HOSTING_FEE_BPS) hostingFeeBpsClamped = MAX_HOSTING_FEE_BPS;
        uint256 hostingFee = (order.price * hostingFeeBpsClamped) / BPS_DENOMINATOR;
        if (royaltyAmount + protocolFee + hostingFee > order.price) revert RoyaltyExceedsPrice();
        uint256 sellerProceeds = order.price - royaltyAmount - protocolFee - hostingFee;

        // (4) Effects before interactions.
        filled[orderHash] = true;

        // (5) Non-custodial transfers. NFT seller -> buyer (needs approval),
        //     then split the ETH. Royalty is paid before the seller, so it is
        //     impossible to receive proceeds without the royalty being honored.
        IERC721(order.nft).safeTransferFrom(order.seller, msg.sender, order.tokenId);
        if (royaltyAmount > 0 && royaltyReceiver != address(0)) {
            _pay(payable(royaltyReceiver), royaltyAmount);
        }
        // Protocol fee and hosting fee both accrue to the Perpetual treasury.
        if (protocolFee + hostingFee > 0) _pay(feeRecipient, protocolFee + hostingFee);
        _pay(payable(order.seller), sellerProceeds);

        emit OrderFulfilled(
            orderHash,
            order.seller,
            msg.sender,
            order.nft,
            order.tokenId,
            order.price,
            royaltyAmount,
            royaltyReceiver,
            protocolFee,
            hostingFee
        );
    }

    /*//////////////////////////////////////////////////////////////////////
                                CANCELLATION
    //////////////////////////////////////////////////////////////////////*/

    /// @notice Cancel specific orders. Only the seller may cancel their own.
    function cancel(Order[] calldata orders) external {
        for (uint256 i = 0; i < orders.length; i++) {
            if (orders[i].seller != _msgSender()) revert NotSeller();
            bytes32 h = hashOrder(orders[i]);
            cancelled[h] = true;
            emit OrderCancelled(h, orders[i].seller);
        }
    }

    /// @notice Invalidate ALL outstanding orders signed under the current
    ///         counter (bulk cancel / replay protection, PRD §12).
    function incrementCounter() external returns (uint256 newCounter) {
        newCounter = ++_counters[_msgSender()];
        emit CounterIncremented(newCounter, _msgSender());
    }

    /*//////////////////////////////////////////////////////////////////////
                                    VIEWS
    //////////////////////////////////////////////////////////////////////*/

    function protocolFeeBps() external view returns (uint96) {
        return _protocolFeeBps;
    }

    function getCounter(address seller) external view returns (uint256) {
        return _counters[seller];
    }

    /// @notice The EIP-712 digest a seller signs to authorize `order`.
    function hashOrder(Order calldata order) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    ORDER_TYPEHASH,
                    order.seller,
                    order.nft,
                    order.tokenId,
                    order.paymentToken,
                    order.price,
                    order.startTime,
                    order.endTime,
                    order.counter,
                    order.salt
                )
            )
        );
    }

    /*//////////////////////////////////////////////////////////////////////
                                    INTERNAL
    //////////////////////////////////////////////////////////////////////*/

    /// @dev Read the token's Perpetual hosting fee; tokens that don't implement
    ///      the interface (any non-Perpetual NFT) carry no hosting fee.
    function _hostingFeeBps(address nft, uint256 tokenId) internal view returns (uint256) {
        try IPerpetualHostingFee(nft).hostingFeeBps(tokenId) returns (uint16 b) {
            return uint256(b);
        } catch {
            return 0;
        }
    }

    /// @dev Query ERC-2981 royalty; tokens without it carry no royalty.
    function _royaltyInfo(address nft, uint256 tokenId, uint256 price)
        internal
        view
        returns (address receiver, uint256 amount)
    {
        try IERC2981(nft).royaltyInfo(tokenId, price) returns (address r, uint256 a) {
            return (r, a);
        } catch {
            return (address(0), 0);
        }
    }

    /// @dev Push-with-escrow-fallback payment. A reverting recipient (seller,
    ///      royalty receiver, or fee recipient) must NOT brick the fill, else a
    ///      hostile party could grief every sale (push-payment DoS). On a failed
    ///      `.call` the amount is credited to `withdrawable` for the recipient
    ///      to pull later via `withdraw()`. CEI is preserved: `filled` is set
    ///      before any `_pay`, and `withdrawable` is a pure credit.
    function _pay(address payable to, uint256 amount) internal {
        if (amount == 0) return;
        (bool ok, ) = to.call{value: amount}("");
        if (!ok) {
            withdrawable[to] += amount;
            emit PaymentEscrowed(to, amount);
        }
    }

    /// @notice Withdraw funds escrowed for `msg.sender` because a push payment
    ///         to them previously failed during a fill (pull-payment pattern).
    function withdraw() external nonReentrant {
        uint256 amt = withdrawable[msg.sender];
        withdrawable[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amt}("");
        require(ok);
    }
}
