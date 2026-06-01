// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, Vm} from "forge-std/Test.sol";
import {PerpetualDrop} from "../src/PerpetualDrop.sol";
import {Base64} from "solady/utils/Base64.sol";

contract PerpetualDropTest is Test {
    PerpetualDrop internal drop;

    address internal owner = address(0xA11CE);
    address internal buyer = address(0xB0B);

    uint96 internal constant ROYALTY_BPS = 500; // 5%
    uint256 internal constant MAX_SUPPLY = 10;
    string internal constant PLACEHOLDER = "ipfs://placeholder/";

    function setUp() public {
        drop = new PerpetualDrop(
            "Perpetual PFP", "PPFP", owner, ROYALTY_BPS, MAX_SUPPLY, PLACEHOLDER
        );
    }

    /*//////////////////////////////////////////////////////////////////////
                                BATCH MINT
    //////////////////////////////////////////////////////////////////////*/

    /// Chunked batch mint up to maxSupply: ownerOf/balanceOf/totalMinted correct.
    function test_BatchMintChunksUpToMaxSupply() public {
        vm.prank(owner);
        drop.mintBatch(owner, 4);
        assertEq(drop.totalMinted(), 4);
        assertEq(drop.balanceOf(owner), 4);

        vm.prank(owner);
        drop.mintBatch(owner, 6); // brings total to maxSupply (10)
        assertEq(drop.totalMinted(), 10);
        assertEq(drop.balanceOf(owner), 10);

        // ownerOf resolves every token id (1-based, contiguous).
        for (uint256 id = 1; id <= MAX_SUPPLY; id++) {
            assertEq(drop.ownerOf(id), owner, "ownerOf");
        }
    }

    /// Minting past maxSupply reverts.
    function test_MintBatchRevertsPastMaxSupply() public {
        vm.prank(owner);
        drop.mintBatch(owner, 10); // exactly maxSupply

        vm.prank(owner);
        vm.expectRevert(PerpetualDrop.MaxSupplyExceeded.selector);
        drop.mintBatch(owner, 1);
    }

    /// A single chunk over maxSupply reverts.
    function test_MintBatchSingleChunkOverMaxReverts() public {
        vm.prank(owner);
        vm.expectRevert(PerpetualDrop.MaxSupplyExceeded.selector);
        drop.mintBatch(owner, MAX_SUPPLY + 1);
    }

    /// mintBatch is owner-only.
    function test_MintBatchOnlyOwner() public {
        vm.prank(buyer);
        vm.expectRevert();
        drop.mintBatch(buyer, 1);
    }

    /// Each chunk emits one ERC-2309 ConsecutiveTransfer range event.
    function test_MintBatchEmitsConsecutiveTransfer() public {
        vm.recordLogs();
        vm.prank(owner);
        drop.mintBatch(owner, 5);

        Vm.Log[] memory logs = vm.getRecordedLogs();
        // ConsecutiveTransfer(uint256 indexed fromTokenId, uint256 toTokenId, address indexed from, address indexed to)
        bytes32 sig = keccak256("ConsecutiveTransfer(uint256,uint256,address,address)");
        bool found;
        for (uint256 i = 0; i < logs.length; i++) {
            if (logs[i].topics[0] == sig) {
                found = true;
                assertEq(uint256(logs[i].topics[1]), 1, "fromTokenId");
                assertEq(address(uint160(uint256(logs[i].topics[3]))), owner, "to");
                // toTokenId is in data (non-indexed).
                uint256 toId = abi.decode(logs[i].data, (uint256));
                assertEq(toId, 5, "toTokenId");
            }
        }
        assertTrue(found, "ConsecutiveTransfer emitted");
    }

    /// Batch-minted tokens transfer correctly (ownership materializes).
    function test_TransferAfterBatchMint() public {
        vm.prank(owner);
        drop.mintBatch(owner, 5);

        vm.prank(owner);
        drop.transferFrom(owner, buyer, 3);

        assertEq(drop.ownerOf(3), buyer, "transferred owner");
        assertEq(drop.ownerOf(2), owner, "neighbor unaffected");
        assertEq(drop.ownerOf(4), owner, "neighbor unaffected");
        assertEq(drop.balanceOf(buyer), 1);
        assertEq(drop.balanceOf(owner), 4);
    }

    /*//////////////////////////////////////////////////////////////////////
                                PROVENANCE
    //////////////////////////////////////////////////////////////////////*/

    /// Provenance commits once; a second commit reverts.
    function test_ProvenanceCommitOnce() public {
        vm.prank(owner);
        drop.commitProvenance(keccak256("manifest"));
        assertEq(drop.provenanceHash(), keccak256("manifest"));

        vm.prank(owner);
        vm.expectRevert(PerpetualDrop.ProvenanceAlreadyCommitted.selector);
        drop.commitProvenance(keccak256("other"));
    }

    /// Empty provenance reverts.
    function test_ProvenanceEmptyReverts() public {
        vm.prank(owner);
        vm.expectRevert(PerpetualDrop.EmptyProvenance.selector);
        drop.commitProvenance(bytes32(0));
    }

    /// commitProvenance is owner-only.
    function test_CommitProvenanceOnlyOwner() public {
        vm.prank(buyer);
        vm.expectRevert();
        drop.commitProvenance(keccak256("x"));
    }

    /*//////////////////////////////////////////////////////////////////////
                                    REVEAL
    //////////////////////////////////////////////////////////////////////*/

    /// tokenURI is baseURI + id (placeholder pre-reveal).
    function test_TokenURIIsBaseURIPlusId() public {
        vm.prank(owner);
        drop.mintBatch(owner, 3);
        assertEq(drop.tokenURI(1), "ipfs://placeholder/1");
        assertEq(drop.tokenURI(3), "ipfs://placeholder/3");
    }

    /// tokenURI of a non-existent token reverts.
    function test_TokenURINonexistentReverts() public {
        vm.expectRevert(PerpetualDrop.TokenDoesNotExist.selector);
        drop.tokenURI(1);
    }

    /// reveal switches the base URI and is one-way (second reveal reverts).
    function test_RevealOneWay() public {
        vm.prank(owner);
        drop.mintBatch(owner, 2);

        vm.prank(owner);
        drop.reveal("ipfs://real/");
        assertTrue(drop.revealed());
        assertEq(drop.tokenURI(1), "ipfs://real/1");

        vm.prank(owner);
        vm.expectRevert(PerpetualDrop.AlreadyRevealed.selector);
        drop.reveal("ipfs://again/");
    }

    /// reveal is owner-only.
    function test_RevealOnlyOwner() public {
        vm.prank(buyer);
        vm.expectRevert();
        drop.reveal("ipfs://real/");
    }

    /*//////////////////////////////////////////////////////////////////////
                            METADATA / ROYALTIES
    //////////////////////////////////////////////////////////////////////*/

    /// contractURI is a base64 JSON data URI with royalty + fee_recipient.
    function test_ContractURIShape() public view {
        string memory uri = drop.contractURI();
        string memory prefix = "data:application/json;base64,";
        assertTrue(_startsWith(uri, prefix), "json data uri prefix");

        string memory json = string(Base64.decode(_slice(uri, bytes(prefix).length)));
        assertTrue(_contains(json, '"name":"Perpetual PFP"'), "name");
        assertTrue(_contains(json, '"seller_fee_basis_points":500'), "royalty bps");
        assertTrue(_contains(json, '"fee_recipient":"'), "fee recipient");
    }

    /// ERC-2981 royaltyInfo returns the default royalty to the owner.
    function test_RoyaltyInfo() public view {
        (address receiver, uint256 amount) = drop.royaltyInfo(1, 1 ether);
        assertEq(receiver, owner, "royalty receiver");
        assertEq(amount, (1 ether * ROYALTY_BPS) / 10_000, "royalty amount");
    }

    /// supportsInterface covers ERC-721 and ERC-2981.
    function test_SupportsInterface() public view {
        assertTrue(drop.supportsInterface(0x80ac58cd), "ERC721");
        assertTrue(drop.supportsInterface(0x2a55205a), "ERC2981");
    }

    /*//////////////////////////////////////////////////////////////////////
                                    HELPERS
    //////////////////////////////////////////////////////////////////////*/

    function _startsWith(string memory str, string memory prefix) internal pure returns (bool) {
        bytes memory s = bytes(str);
        bytes memory p = bytes(prefix);
        if (s.length < p.length) return false;
        for (uint256 i = 0; i < p.length; i++) {
            if (s[i] != p[i]) return false;
        }
        return true;
    }

    function _slice(string memory str, uint256 start) internal pure returns (string memory) {
        bytes memory s = bytes(str);
        bytes memory out = new bytes(s.length - start);
        for (uint256 i = start; i < s.length; i++) {
            out[i - start] = s[i];
        }
        return string(out);
    }

    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length == 0 || h.length < n.length) return false;
        for (uint256 i = 0; i <= h.length - n.length; i++) {
            bool ok = true;
            for (uint256 j = 0; j < n.length; j++) {
                if (h[i + j] != n[j]) { ok = false; break; }
            }
            if (ok) return true;
        }
        return false;
    }
}
