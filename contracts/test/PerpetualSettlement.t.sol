// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PerpetualSettlement} from "../src/PerpetualSettlement.sol";
import {ForeverLibrary} from "../src/ForeverLibrary.sol";

contract PerpetualSettlementTest is Test {
    PerpetualSettlement internal exchange;
    ForeverLibrary internal fl;

    uint256 internal constant SELLER_PK = 0xA11CE;
    address internal seller;            // lists + signs
    address internal creator = address(0xC0FFEE); // royalty receiver
    address internal buyer = address(0xB0B);
    address internal owner = address(0x0FFE);
    address payable internal feeRecipient = payable(address(0xFEE));

    uint256 internal tokenId;
    uint256 internal constant PRICE = 1 ether;
    uint96 internal constant ROYALTY_BPS = 750; // 7.5%

    function setUp() public {
        seller = vm.addr(SELLER_PK);
        fl = new ForeverLibrary("Perpetual", "PERP", owner, 7 days);
        exchange = new PerpetualSettlement(owner, feeRecipient);

        // Creator mints (royalty receiver = creator), then sells the piece to
        // the seller so royalty receiver != seller (clean balance assertions).
        vm.prank(creator);
        tokenId = fl.mint(
            creator, "Creator", "Work", "image/png",
            ROYALTY_BPS, keccak256("m"), bytes("proof"), 0
        );
        vm.prank(creator);
        fl.transferFrom(creator, seller, tokenId);

        vm.prank(seller);
        fl.setApprovalForAll(address(exchange), true);
    }

    function _order() internal view returns (PerpetualSettlement.Order memory) {
        return PerpetualSettlement.Order({
            seller: seller,
            nft: address(fl),
            tokenId: tokenId,
            paymentToken: address(0),
            price: PRICE,
            startTime: 0,
            endTime: block.timestamp + 1 days,
            counter: 0,
            salt: 1,
            minSellerProceeds: 0
        });
    }

    function _sign(PerpetualSettlement.Order memory order, uint256 pk)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = exchange.hashOrder(order);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    /// Happy path: NFT moves to buyer; ETH splits into royalty + fee + proceeds.
    function test_FulfillSplitsRoyaltyFeeAndProceeds() public {
        PerpetualSettlement.Order memory order = _order();
        bytes memory sig = _sign(order, SELLER_PK);

        vm.deal(buyer, 10 ether);
        vm.prank(buyer);
        exchange.fulfillOrder{value: PRICE}(order, sig);

        uint256 royalty = (PRICE * ROYALTY_BPS) / 10_000;     // 0.075
        uint256 fee = (PRICE * exchange.protocolFeeBps()) / 10_000; // 0.0225
        uint256 proceeds = PRICE - royalty - fee;

        assertEq(fl.ownerOf(tokenId), buyer, "buyer owns NFT");
        assertEq(creator.balance, royalty, "royalty to creator");
        assertEq(feeRecipient.balance, fee, "protocol fee");
        assertEq(seller.balance, proceeds, "seller proceeds");
        assertEq(buyer.balance, 10 ether - PRICE, "buyer paid price");
        assertTrue(exchange.filled(exchange.hashOrder(order)));
    }

    /// A Perpetual-hosted token charges the 1.5% hosting fee on top of the
    /// protocol fee, both to the treasury, reducing seller proceeds accordingly.
    function test_HostingFeeChargedOnSale() public {
        vm.prank(creator);
        uint256 hostedId = fl.mint(
            creator, "Creator", "Hosted", "image/png",
            ROYALTY_BPS, keccak256("m2"), bytes("proof2"), 150
        );
        vm.prank(creator);
        fl.transferFrom(creator, seller, hostedId);

        PerpetualSettlement.Order memory order = PerpetualSettlement.Order({
            seller: seller, nft: address(fl), tokenId: hostedId,
            paymentToken: address(0), price: PRICE, startTime: 0,
            endTime: block.timestamp + 1 days, counter: 0, salt: 2,
            minSellerProceeds: 0
        });
        bytes memory sig = _sign(order, SELLER_PK);

        vm.deal(buyer, 10 ether);
        vm.prank(buyer);
        exchange.fulfillOrder{value: PRICE}(order, sig);

        uint256 royalty = (PRICE * ROYALTY_BPS) / 10_000;
        uint256 fee = (PRICE * exchange.protocolFeeBps()) / 10_000;
        uint256 hosting = (PRICE * 150) / 10_000;
        assertEq(feeRecipient.balance, fee + hosting, "protocol + hosting fee to treasury");
        assertEq(seller.balance, PRICE - royalty - fee - hosting, "seller proceeds net of hosting");
        assertEq(creator.balance, royalty, "royalty unaffected");
    }

    function test_RevertOnBadSignature() public {
        PerpetualSettlement.Order memory order = _order();
        bytes memory sig = _sign(order, 0xBADBAD); // wrong key
        vm.deal(buyer, 10 ether);
        vm.prank(buyer);
        vm.expectRevert(PerpetualSettlement.BadSignature.selector);
        exchange.fulfillOrder{value: PRICE}(order, sig);
    }

    function test_RevertOnWrongPayment() public {
        PerpetualSettlement.Order memory order = _order();
        bytes memory sig = _sign(order, SELLER_PK);
        vm.deal(buyer, 10 ether);
        vm.prank(buyer);
        vm.expectRevert(PerpetualSettlement.WrongPayment.selector);
        exchange.fulfillOrder{value: 0.5 ether}(order, sig);
    }

    function test_RevertOnExpired() public {
        PerpetualSettlement.Order memory order = _order();
        bytes memory sig = _sign(order, SELLER_PK);
        vm.warp(order.endTime + 1);
        vm.deal(buyer, 10 ether);
        vm.prank(buyer);
        vm.expectRevert(PerpetualSettlement.OrderExpired.selector);
        exchange.fulfillOrder{value: PRICE}(order, sig);
    }

    function test_RevertOnDoubleFill() public {
        PerpetualSettlement.Order memory order = _order();
        bytes memory sig = _sign(order, SELLER_PK);
        vm.deal(buyer, 10 ether);
        vm.prank(buyer);
        exchange.fulfillOrder{value: PRICE}(order, sig);
        vm.prank(buyer);
        vm.expectRevert(PerpetualSettlement.OrderAlreadyFilled.selector);
        exchange.fulfillOrder{value: PRICE}(order, sig);
    }

    function test_CancelBlocksFill() public {
        PerpetualSettlement.Order memory order = _order();
        bytes memory sig = _sign(order, SELLER_PK);
        PerpetualSettlement.Order[] memory toCancel = new PerpetualSettlement.Order[](1);
        toCancel[0] = order;
        vm.prank(seller);
        exchange.cancel(toCancel);

        vm.deal(buyer, 10 ether);
        vm.prank(buyer);
        vm.expectRevert(PerpetualSettlement.OrderCancelledError.selector);
        exchange.fulfillOrder{value: PRICE}(order, sig);
    }

    function test_IncrementCounterInvalidatesOldOrders() public {
        PerpetualSettlement.Order memory order = _order();
        bytes memory sig = _sign(order, SELLER_PK);
        vm.prank(seller);
        exchange.incrementCounter();

        vm.deal(buyer, 10 ether);
        vm.prank(buyer);
        vm.expectRevert(PerpetualSettlement.WrongCounter.selector);
        exchange.fulfillOrder{value: PRICE}(order, sig);
    }

    function test_OnlySellerCancels() public {
        PerpetualSettlement.Order memory order = _order();
        PerpetualSettlement.Order[] memory toCancel = new PerpetualSettlement.Order[](1);
        toCancel[0] = order;
        vm.prank(buyer);
        vm.expectRevert(PerpetualSettlement.NotSeller.selector);
        exchange.cancel(toCancel);
    }

    function test_FeeBandEnforced() public {
        vm.prank(owner);
        vm.expectRevert(PerpetualSettlement.FeeOutOfRange.selector);
        exchange.setProtocolFeeBps(300); // > 2.5%
    }

    /*//////////////////////////////////////////////////////////////////////
                        MONEY-SAFETY (AUDIT FIXES)
    //////////////////////////////////////////////////////////////////////*/

    /// A hostile NFT that reports royalty == price is clamped to MAX_ROYALTY_BPS
    /// (10%). The sale still succeeds and the seller receives the remainder.
    function test_HostileRoyaltyClampedTo10Percent() public {
        HostileRoyaltyNFT evil = new HostileRoyaltyNFT(creator);
        evil.mintTo(seller, 1);
        vm.prank(seller);
        evil.setApprovalForAll(address(exchange), true);

        PerpetualSettlement.Order memory order = PerpetualSettlement.Order({
            seller: seller, nft: address(evil), tokenId: 1,
            paymentToken: address(0), price: PRICE, startTime: 0,
            endTime: block.timestamp + 1 days, counter: 0, salt: 99,
            minSellerProceeds: 0
        });
        bytes memory sig = _sign(order, SELLER_PK);

        vm.deal(buyer, 10 ether);
        vm.prank(buyer);
        exchange.fulfillOrder{value: PRICE}(order, sig);

        uint256 royalty = (PRICE * exchange.MAX_ROYALTY_BPS()) / 10_000; // 10%
        uint256 fee = (PRICE * exchange.protocolFeeBps()) / 10_000;
        assertEq(evil.ownerOf(1), buyer, "buyer owns NFT");
        assertEq(creator.balance, royalty, "royalty clamped to 10%");
        assertEq(seller.balance, PRICE - royalty - fee, "seller gets remainder");
    }

    /// A hostile NFT reporting an absurd hostingFeeBps is clamped to
    /// MAX_HOSTING_FEE_BPS (1.5%) so it cannot brick the sale or over-charge.
    /// Without the clamp, fee+royalty+hosting would exceed price and revert.
    function test_HostileHostingFeeClampedToMax() public {
        HostileHostingFeeNFT evil = new HostileHostingFeeNFT(creator);
        evil.mintTo(seller, 1);
        vm.prank(seller);
        evil.setApprovalForAll(address(exchange), true);

        PerpetualSettlement.Order memory order = PerpetualSettlement.Order({
            seller: seller, nft: address(evil), tokenId: 1,
            paymentToken: address(0), price: PRICE, startTime: 0,
            endTime: block.timestamp + 1 days, counter: 0, salt: 123,
            minSellerProceeds: 0
        });
        bytes memory sig = _sign(order, SELLER_PK);

        vm.deal(buyer, 10 ether);
        vm.prank(buyer);
        exchange.fulfillOrder{value: PRICE}(order, sig); // must NOT revert

        uint256 royalty = (PRICE * exchange.MAX_ROYALTY_BPS()) / 10_000; // evil reports price; clamped to 10%
        uint256 fee = (PRICE * exchange.protocolFeeBps()) / 10_000;
        uint256 hosting = (PRICE * exchange.MAX_HOSTING_FEE_BPS()) / 10_000; // clamped to 1.5%
        assertEq(evil.ownerOf(1), buyer, "buyer owns NFT");
        assertEq(feeRecipient.balance, fee + hosting, "hosting clamped + protocol fee");
        assertEq(seller.balance, PRICE - royalty - fee - hosting, "seller gets remainder");
    }

    /// price == 0 reverts (ZeroPrice).
    function test_ZeroPriceReverts() public {
        PerpetualSettlement.Order memory order = _order();
        order.price = 0;
        bytes memory sig = _sign(order, SELLER_PK);
        vm.prank(buyer);
        vm.expectRevert(PerpetualSettlement.ZeroPrice.selector);
        exchange.fulfillOrder{value: 0}(order, sig);
    }

    /// A reverting fee recipient does NOT brick the fill: proceeds escrow and
    /// are withdrawable. Verifies _pay's escrow fallback + withdraw().
    function test_RevertingFeeRecipientEscrowsAndWithdraws() public {
        RevertingRecipient badFee = new RevertingRecipient();
        vm.prank(owner);
        exchange.setFeeRecipient(payable(address(badFee)));

        PerpetualSettlement.Order memory order = _order();
        bytes memory sig = _sign(order, SELLER_PK);

        vm.deal(buyer, 10 ether);
        vm.prank(buyer);
        exchange.fulfillOrder{value: PRICE}(order, sig); // must NOT revert

        uint256 royalty = (PRICE * ROYALTY_BPS) / 10_000;
        uint256 fee = (PRICE * exchange.protocolFeeBps()) / 10_000;
        uint256 proceeds = PRICE - royalty - fee;

        // NFT moved; seller + royalty paid normally; fee escrowed.
        assertEq(fl.ownerOf(tokenId), buyer, "buyer owns NFT");
        assertEq(seller.balance, proceeds, "seller proceeds paid");
        assertEq(creator.balance, royalty, "royalty paid");
        assertEq(exchange.withdrawable(address(badFee)), fee, "fee escrowed");

        // Once the recipient can accept ETH, withdraw() pays it out and zeroes.
        badFee.setAccept(true);
        uint256 before = address(badFee).balance;
        vm.prank(address(badFee));
        exchange.withdraw();
        assertEq(address(badFee).balance - before, fee, "escrow withdrawn");
        assertEq(exchange.withdrawable(address(badFee)), 0, "escrow zeroed");
    }

    /// A reverting royalty receiver does NOT brick the fill either: the NFT
    /// transfers, the seller is paid normally, and the royalty is escrowed to
    /// the receiver for later pull. (Push-payment DoS mitigation, seller-side.)
    function test_RevertingRoyaltyReceiverEscrows() public {
        RevertingRecipient badRoyalty = new RevertingRecipient();
        HostileRoyaltyNFT nft = new HostileRoyaltyNFT(address(badRoyalty));
        nft.mintTo(seller, 1);
        vm.prank(seller);
        nft.setApprovalForAll(address(exchange), true);

        PerpetualSettlement.Order memory order = PerpetualSettlement.Order({
            seller: seller, nft: address(nft), tokenId: 1,
            paymentToken: address(0), price: PRICE, startTime: 0,
            endTime: block.timestamp + 1 days, counter: 0, salt: 7,
            minSellerProceeds: 0
        });
        bytes memory sig = _sign(order, SELLER_PK);

        vm.deal(buyer, 10 ether);
        vm.prank(buyer);
        exchange.fulfillOrder{value: PRICE}(order, sig); // must NOT revert

        uint256 royalty = (PRICE * exchange.MAX_ROYALTY_BPS()) / 10_000; // clamped
        uint256 fee = (PRICE * exchange.protocolFeeBps()) / 10_000;
        assertEq(nft.ownerOf(1), buyer, "buyer owns NFT");
        assertEq(seller.balance, PRICE - royalty - fee, "seller paid");
        assertEq(exchange.withdrawable(address(badRoyalty)), royalty, "royalty escrowed");
    }

    /*//////////////////////////////////////////////////////////////////////
                    SELLER-SIGNED minSellerProceeds FLOOR
    //////////////////////////////////////////////////////////////////////*/

    /// A fill where sellerProceeds >= minSellerProceeds succeeds. The seller
    /// signs a floor equal to price minus the fees they expect at signing.
    function test_FulfillSucceedsAtProceedsFloor() public {
        uint256 royalty = (PRICE * ROYALTY_BPS) / 10_000;
        uint256 fee = (PRICE * exchange.protocolFeeBps()) / 10_000;
        uint256 expectedProceeds = PRICE - royalty - fee;

        PerpetualSettlement.Order memory order = _order();
        order.minSellerProceeds = expectedProceeds; // exactly the floor; must pass.
        bytes memory sig = _sign(order, SELLER_PK);

        vm.deal(buyer, 10 ether);
        vm.prank(buyer);
        exchange.fulfillOrder{value: PRICE}(order, sig);

        assertEq(fl.ownerOf(tokenId), buyer, "buyer owns NFT");
        assertEq(seller.balance, expectedProceeds, "seller got at least the floor");
    }

    /// If the protocol fee is raised between signing and fill so that actual
    /// proceeds drop below the signed floor, the fill reverts SellerProceedsTooLow.
    function test_FulfillRevertsWhenProceedsBelowFloor() public {
        // Seller signs assuming the current (2.25%) fee.
        uint256 royalty = (PRICE * ROYALTY_BPS) / 10_000;
        uint256 feeAtSign = (PRICE * exchange.protocolFeeBps()) / 10_000;
        uint256 floor = PRICE - royalty - feeAtSign;

        PerpetualSettlement.Order memory order = _order();
        order.minSellerProceeds = floor;
        bytes memory sig = _sign(order, SELLER_PK);

        // Protocol bumps the fee to the max (2.50%) before the buyer fills:
        // proceeds now fall below the signed floor.
        uint96 maxFee = exchange.MAX_FEE_BPS();
        vm.prank(owner);
        exchange.setProtocolFeeBps(maxFee);

        vm.deal(buyer, 10 ether);
        vm.prank(buyer);
        vm.expectRevert(PerpetualSettlement.SellerProceedsTooLow.selector);
        exchange.fulfillOrder{value: PRICE}(order, sig);
    }

    /*//////////////////////////////////////////////////////////////////////
                            withdrawTo ESCAPE HATCH
    //////////////////////////////////////////////////////////////////////*/

    /// Escrow accrues to a recipient that can't receive a push; the recipient's
    /// controller redirects it to another address via withdrawTo.
    function test_WithdrawToRedirectsOwnEscrow() public {
        RevertingRecipient badFee = new RevertingRecipient();
        vm.prank(owner);
        exchange.setFeeRecipient(payable(address(badFee)));

        PerpetualSettlement.Order memory order = _order();
        bytes memory sig = _sign(order, SELLER_PK);
        vm.deal(buyer, 10 ether);
        vm.prank(buyer);
        exchange.fulfillOrder{value: PRICE}(order, sig);

        uint256 fee = (PRICE * exchange.protocolFeeBps()) / 10_000;
        assertEq(exchange.withdrawable(address(badFee)), fee, "fee escrowed");

        address payable other = payable(address(0xD00D));
        uint256 before = other.balance;
        vm.prank(address(badFee));
        exchange.withdrawTo(other);

        assertEq(other.balance - before, fee, "escrow moved to other address");
        assertEq(exchange.withdrawable(address(badFee)), 0, "escrow zeroed");
    }

    /// withdrawTo reverts NothingToWithdraw when the caller has no escrow.
    function test_WithdrawToRevertsWhenEmpty() public {
        vm.prank(buyer);
        vm.expectRevert(PerpetualSettlement.NothingToWithdraw.selector);
        exchange.withdrawTo(payable(address(0xD00D)));
    }
}

/// @dev ERC-721 that reports a royalty equal to the full sale price (hostile).
contract HostileRoyaltyNFT {
    mapping(uint256 => address) private _owners;
    mapping(address => mapping(address => bool)) private _approvals;
    address public royaltyReceiver;

    constructor(address receiver_) {
        royaltyReceiver = receiver_;
    }

    function mintTo(address to, uint256 id) external {
        _owners[id] = to;
    }

    function ownerOf(uint256 id) external view returns (address) {
        return _owners[id];
    }

    function setApprovalForAll(address op, bool ok) external {
        _approvals[msg.sender][op] = ok;
    }

    function isApprovedForAll(address o, address op) external view returns (bool) {
        return _approvals[o][op];
    }

    function safeTransferFrom(address from, address to, uint256 id) external {
        require(_owners[id] == from, "not owner");
        require(_approvals[from][msg.sender] || msg.sender == from, "not approved");
        _owners[id] = to;
    }

    /// Reports royalty == salePrice (would drain the buyer if not clamped).
    function royaltyInfo(uint256, uint256 salePrice) external view returns (address, uint256) {
        return (royaltyReceiver, salePrice);
    }

    function supportsInterface(bytes4) external pure returns (bool) {
        return true;
    }
}

/// @dev ERC-721 reporting an absurd hostingFeeBps (and royalty == price). Both
///      must be clamped at settlement, else fee+royalty+hosting > price reverts.
contract HostileHostingFeeNFT {
    mapping(uint256 => address) private _owners;
    mapping(address => mapping(address => bool)) private _approvals;
    address public royaltyReceiver;

    constructor(address receiver_) {
        royaltyReceiver = receiver_;
    }

    function mintTo(address to, uint256 id) external {
        _owners[id] = to;
    }

    function ownerOf(uint256 id) external view returns (address) {
        return _owners[id];
    }

    function setApprovalForAll(address op, bool ok) external {
        _approvals[msg.sender][op] = ok;
    }

    function isApprovedForAll(address o, address op) external view returns (bool) {
        return _approvals[o][op];
    }

    function safeTransferFrom(address from, address to, uint256 id) external {
        require(_owners[id] == from, "not owner");
        require(_approvals[from][msg.sender] || msg.sender == from, "not approved");
        _owners[id] = to;
    }

    /// Reports a hosting fee of 60,000 bps (600%) — absurd; must be clamped.
    function hostingFeeBps(uint256) external pure returns (uint16) {
        return 60_000;
    }

    /// Reports royalty == salePrice (also clamped to 10% at settlement).
    function royaltyInfo(uint256, uint256 salePrice) external view returns (address, uint256) {
        return (royaltyReceiver, salePrice);
    }

    function supportsInterface(bytes4) external pure returns (bool) {
        return true;
    }
}

/// @dev Recipient that reverts on ETH receipt until `accept` is toggled on.
contract RevertingRecipient {
    bool public accept;

    function setAccept(bool a) external {
        accept = a;
    }

    receive() external payable {
        require(accept, "reject");
    }
}
