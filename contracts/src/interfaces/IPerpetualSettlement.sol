// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*//////////////////////////////////////////////////////////////////////////
    PERPETUAL - UNAUDITED REFERENCE SCAFFOLD - DO NOT DEPLOY WITH VALUE
    ---------------------------------------------------------------------
    Settlement-layer interface for the Perpetual permanence-first NFT
    marketplace. Reference scaffold for review and audit preparation only.
//////////////////////////////////////////////////////////////////////////*/

/// @title IPerpetualSettlement
/// @notice Seaport-compatible settlement interface for the Settlement layer
///         (PRD §6, §8). Orders are signed messages (gasless listings) that
///         are settled onchain only when filled (PRD §8.1). Settlement is
///         non-custodial: assets and funds flow peer-to-peer and the contract
///         only orchestrates the transfer and takes the protocol fee
///         (PRD §12 "No custody").
///
/// @dev    ROYALTY-ENFORCEMENT GUARANTEE (PRD §8.2, §12) - THE PRODUCT'S
///         DIFFERENTIATOR:
///
///         `fulfillOrder` MUST honor the token's onchain ERC-2981 royalty.
///         The royalty receiver and amount are computed from the token's own
///         {IERC2981-royaltyInfo} at fill time and paid out as part of the
///         atomic settlement. An order whose consideration does not honor the
///         computed royalty MUST be rejected (revert). This is a hard
///         protocol-level guarantee, not a UI suggestion - royalties cannot
///         be bypassed (PRD §3.1.3, §8.2, §12 royalty bypass resistance).
///
///         REPLAY PROTECTION (PRD §8.1, §12): each offerer has a `counter`
///         (nonce). Bumping the counter invalidates every outstanding order
///         signed under the old counter (bulk cancel). Individual orders are
///         tracked by their EIP-712 order hash and may be cancelled directly.
interface IPerpetualSettlement {
    /*//////////////////////////////////////////////////////////////////////
                                    TYPES
    //////////////////////////////////////////////////////////////////////*/

    /// @notice Item categories carried in offers and considerations.
    /// @dev    Mirrors Seaport's ItemType for tooling/aggregator compatibility
    ///         (PRD §8.1). NATIVE = ETH, ERC20 = fungible, ERC721/ERC1155 = NFTs.
    enum ItemType {
        NATIVE,  // 0 - ETH.
        ERC20,   // 1 - fungible token.
        ERC721,  // 2 - single NFT.
        ERC1155  // 3 - semi-fungible NFT.
    }

    /// @notice Order kind. Restricted orders permit a zone/validator hook;
    ///         Perpetual uses this to bind the listing-eligibility gate
    ///         (PRD §9.6) and royalty enforcement.
    enum OrderType {
        FULL_OPEN,        // 0 - anyone may fill, no partial fills.
        PARTIAL_OPEN,     // 1 - anyone may fill, partial fills allowed.
        FULL_RESTRICTED,  // 2 - zone-validated, no partial fills.
        PARTIAL_RESTRICTED // 3 - zone-validated, partial fills allowed.
    }

    /// @notice What the offerer is giving (e.g. the NFT being listed).
    struct OfferItem {
        ItemType itemType;
        address token;
        uint256 identifierOrCriteria; // token id, or criteria root for trait/collection offers.
        uint256 startAmount;
        uint256 endAmount;            // == startAmount for fixed price; differs for Dutch (fast-follow, PRD §15).
    }

    /// @notice What the offerer must receive, including each recipient.
    /// @dev    Protocol fee and ERC-2981 royalty are expressed as
    ///         consideration items so settlement is a single atomic transfer
    ///         set (PRD §8.2, §8.4).
    struct ConsiderationItem {
        ItemType itemType;
        address token;
        uint256 identifierOrCriteria;
        uint256 startAmount;
        uint256 endAmount;
        address payable recipient; // seller, royalty receiver, or fee recipient.
    }

    /// @notice The full signed order (EIP-712). Compatible in spirit with the
    ///         Seaport OrderComponents layout (PRD §8.1).
    struct OrderComponents {
        address offerer;
        address zone;                    // validator for restricted orders (eligibility gate, PRD §9.6).
        OfferItem[] offer;
        ConsiderationItem[] consideration;
        OrderType orderType;
        uint256 startTime;
        uint256 endTime;
        bytes32 zoneHash;
        uint256 salt;                    // randomness for unique order hashes.
        bytes32 conductKey;             // optional transfer-conduit / approval channel key.
        uint256 counter;                // offerer nonce for replay protection (PRD §12).
    }

    /// @notice A signed order ready to fulfill.
    struct Order {
        OrderComponents parameters;
        bytes signature; // EIP-712 signature over the order hash.
    }

    /// @notice Lifecycle status of an order, keyed by its EIP-712 hash.
    struct OrderStatus {
        bool isValidated; // signature has been verified at least once.
        bool isCancelled; // explicitly cancelled.
        uint120 numerator;   // filled fraction numerator (partial fills).
        uint120 denominator; // filled fraction denominator.
    }

    /*//////////////////////////////////////////////////////////////////////
                                    EVENTS
    //////////////////////////////////////////////////////////////////////*/

    /// @notice Emitted on a successful fill (PRD §9.3 indexable settlement events).
    /// @param orderHash       EIP-712 hash of the fulfilled order.
    /// @param offerer         the order's offerer (seller).
    /// @param fulfiller       the account that filled the order.
    /// @param protocolFee     protocol fee paid (PRD §8.4).
    /// @param royaltyAmount   ERC-2981 royalty paid (PRD §8.2).
    /// @param royaltyReceiver receiver of the enforced royalty.
    event OrderFulfilled(
        bytes32 indexed orderHash,
        address indexed offerer,
        address indexed fulfiller,
        uint256 protocolFee,
        uint256 royaltyAmount,
        address royaltyReceiver
    );

    /// @notice Emitted when an order is cancelled by its offerer.
    event OrderCancelled(bytes32 indexed orderHash, address indexed offerer);

    /// @notice Emitted when an offerer bumps their counter (bulk cancel).
    event CounterIncremented(uint256 newCounter, address indexed offerer);

    /*//////////////////////////////////////////////////////////////////////
                                FULFILLMENT
    //////////////////////////////////////////////////////////////////////*/

    /// @notice Fulfill a signed order, settling the trade atomically onchain.
    /// @dev    MUST enforce, in this order:
    ///           1. order not expired / not yet active / not cancelled / not
    ///              already filled, and counter matches the offerer's current
    ///              counter (replay protection, PRD §12);
    ///           2. EIP-712 signature is valid for `offerer`;
    ///           3. for restricted orders, the zone validates listing
    ///              eligibility (PRD §9.6);
    ///           4. the ERC-2981 royalty computed from the traded token's
    ///              `royaltyInfo` is present in the consideration to the
    ///              correct receiver. IF NOT, REVERT (PRD §8.2 - royalties
    ///              cannot be bypassed);
    ///           5. transfer offer -> fulfiller and consideration
    ///              (seller proceeds + royalty + protocol fee) peer-to-peer.
    ///         Non-custodial: the contract never holds assets between steps
    ///         (PRD §12). Reentrancy-guarded.
    /// @param order the signed order to fulfill.
    /// @return fulfilled true on successful settlement.
    function fulfillOrder(Order calldata order) external payable returns (bool fulfilled);

    /*//////////////////////////////////////////////////////////////////////
                                CANCELLATION
    //////////////////////////////////////////////////////////////////////*/

    /// @notice Cancel specific orders by their components. Only the offerer of
    ///         each order may cancel it (PRD §8.1 gasless cancellation).
    /// @param orders the order components to cancel.
    /// @return cancelled true if all supplied orders were cancelled.
    function cancel(OrderComponents[] calldata orders) external returns (bool cancelled);

    /// @notice Bump the caller's counter, invalidating all of their
    ///         outstanding orders at once (PRD §12 replay protection).
    /// @return newCounter the caller's new counter value.
    function incrementCounter() external returns (uint256 newCounter);

    /*//////////////////////////////////////////////////////////////////////
                                    VIEWS
    //////////////////////////////////////////////////////////////////////*/

    /// @notice Status of an order by its EIP-712 hash.
    function getOrderStatus(bytes32 orderHash) external view returns (OrderStatus memory status);

    /// @notice The EIP-712 hash for a set of order components.
    function getOrderHash(OrderComponents calldata order) external view returns (bytes32 orderHash);

    /// @notice The caller-or-specified offerer's current counter.
    function getCounter(address offerer) external view returns (uint256 counter);

    /// @notice The current protocol fee in basis points (PRD §8.4, 200-250 bps).
    function protocolFeeBps() external view returns (uint96 feeBps);
}
