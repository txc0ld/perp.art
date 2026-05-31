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
            ROYALTY_BPS, keccak256("m"), "ethfs://p", keccak256("p")
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
            salt: 1
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
}
