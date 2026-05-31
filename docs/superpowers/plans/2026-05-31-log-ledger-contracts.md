# Log Ledger — Plan 1: Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the STATE shard genuinely on-chain (SSTORE2 bytes), add a first-class `Log` shard backend, and ship the standalone `LogLedger` contract — all tested and redeployed to Base Sepolia + Ethereum Sepolia.

**Architecture:** `ForeverLibrary.mint` stops taking a proof URI/hash string and instead takes raw `bytes proofData`, writes it via SSTORE2 (bytes-as-bytecode), hashes it on-chain, and serves Shard 0 as an on-chain `data:` URI. A new `Log` enum value lets high-res copies attach as ordinary appended shards that point at a standalone `LogLedger` (bytes-in-event-logs, Merkle-root-in-state) contract. `PerpetualSettlement` is unchanged.

**Tech Stack:** Solidity 0.8.24, Foundry (forge/cast), OpenZeppelin v5 (`Base64`), Solady (`SSTORE2`), `via_ir = true`.

**Scope boundary:** This plan touches **contracts only** (`.sol`, Foundry tests, deploy scripts) plus recording deployed addresses in `.env.local`. The TS app (ABI in `src/lib/web3/abis.ts`, `useOnchainMint`, `/api/store`) is intentionally **not** modified here — that is Plan 2. The two build systems are independent, so the app keeps compiling against the old ABI until Plan 2 rewires it.

---

## File Structure

- `contracts/package.json` — add `solady` dependency.
- `contracts/foundry.toml` — add `solady/` remapping.
- `contracts/src/interfaces/IForeverLibrary.sol` — add `Log` to `ShardBackend` enum.
- `contracts/src/ForeverLibrary.sol` — SSTORE2 STATE shard: new error/constant/storage, new `mint` signature + body, dynamic Shard-0 `data:` URI.
- `contracts/src/LogLedger.sol` — **new** standalone contract (open/upload/seal; bytes in events, root in state).
- `contracts/script/DeployLogLedger.s.sol` — **new** deploy script.
- `contracts/test/ForeverLibrary.t.sol` — update mint call sites + add SSTORE2/Log tests.
- `contracts/test/PerpetualSettlement.t.sol` — update mint call sites (compile only; behavior unchanged).
- `contracts/test/LogLedger.t.sol` — **new** test suite.
- `.env.local` — record the 4 new addresses (2× FL, 2× LogLedger).

---

## Task 1: Vendor SSTORE2 (Solady) and wire the remapping

**Files:**
- Modify: `contracts/package.json`
- Modify: `contracts/foundry.toml:12-15` (remappings block)

- [ ] **Step 1: Install solady into the contracts package**

Run (from repo root):
```bash
cd contracts && npm install solady@^0.1.0 && cd ..
```
Expected: `solady` appears under `node_modules/solady`.

- [ ] **Step 2: Confirm the SSTORE2 path**

Run:
```bash
ls contracts/node_modules/solady/src/utils/SSTORE2.sol
```
Expected: the path prints (file exists). If the layout differs, adjust the remapping in Step 3 to match the actual `SSTORE2.sol` location.

- [ ] **Step 3: Add the solady remapping**

In `contracts/foundry.toml`, change the `remappings` array to include solady:
```toml
remappings = [
    "@openzeppelin/contracts/=node_modules/@openzeppelin/contracts/",
    "solady/=node_modules/solady/src/",
    "forge-std/=lib/forge-std/src/",
]
```

- [ ] **Step 4: Verify the remapping resolves**

Run:
```bash
cd contracts && forge remappings | grep solady && cd ..
```
Expected: `solady/=node_modules/solady/src/` prints.

- [ ] **Step 5: Commit**

```bash
git add contracts/package.json contracts/package-lock.json contracts/foundry.toml
git commit -m "build(contracts): vendor solady for SSTORE2"
```

---

## Task 2: Add the `Log` shard backend to the enum

**Files:**
- Modify: `contracts/src/interfaces/IForeverLibrary.sol:40-46`

- [ ] **Step 1: Append `Log` to the enum**

Replace the `ShardBackend` enum body so `Log` is the last (new) member — appending keeps every existing ordinal stable:
```solidity
    enum ShardBackend {
        Onchain, // 0 - SSTORE2 on-chain proof shard. MANDATORY. Shard 0.
        IPFS,    // 1 - content-addressed media (high resolution).
        Arweave, // 2 - pay-once permanent storage.
        Irys,    // 3 - additional permanent redundancy (Datachain).
        CDN,     // 4 - extensible centralized/CDN performance shard.
        Log      // 5 - LogLedger event-log storage (cheap high-res; retention-monitored).
    }
```

- [ ] **Step 2: Compile to confirm nothing breaks**

Run:
```bash
cd contracts && forge build && cd ..
```
Expected: build succeeds (warnings about the existing scaffold are fine; no errors).

- [ ] **Step 3: Commit**

```bash
git add contracts/src/interfaces/IForeverLibrary.sol
git commit -m "feat(contracts): add Log shard backend enum value"
```

---

## Task 3: SSTORE2 STATE shard — write a failing test first

**Files:**
- Test: `contracts/test/ForeverLibrary.t.sol`

This task only adds/updates tests and runs them red. Implementation lands in Task 4.

- [ ] **Step 1: Add the SSTORE2 imports + error to the test file header**

At the top of `contracts/test/ForeverLibrary.t.sol`, leave imports as-is (the test references `fl` only). No new imports needed yet.

- [ ] **Step 2: Rewrite the `_mint()` helper for the new signature**

Replace the existing `_mint()` helper (currently passes `"ethfs://p", keccak256("p")`) with one that passes raw `bytes`:
```solidity
    function _mint() internal returns (uint256) {
        return fl.mint(
            address(this),
            "Artist",
            "Work",
            "image/png",
            500,
            keccak256("m"),
            bytes("proof-bytes"),
            0
        );
    }
```

- [ ] **Step 3: Update `test_MintConfiguresMandatoryOnchainProof` to the new signature + SSTORE2 assertions**

Replace that test with:
```solidity
    function test_MintConfiguresMandatoryOnchainProof() public {
        uint256 id = fl.mint(
            address(this),
            "Claude Wren",
            "Strata No. 1",
            "image/svg+xml",
            750, // 7.5%
            keccak256("metadata"),
            bytes("proof-bytes"),
            0 // artist-paid (fee-exempt)
        );

        assertEq(fl.ownerOf(id), address(this));
        assertTrue(fl.shard0Configured(id), "shard0 must be configured at mint");
        assertEq(fl.shardCount(id), 1);
        assertEq(uint8(fl.shardBackend(id, 0)), uint8(IForeverLibrary.ShardBackend.Onchain));
        // Content hash is computed on-chain from the bytes (trustless).
        assertEq(fl.shardContentHash(id, 0), keccak256(bytes("proof-bytes")));

        // Shard 0 resolves to an on-chain data URI built from the SSTORE2 bytes.
        string memory uri = fl.shardURI(id, 0);
        assertEq(_startsWith(uri, "data:image/svg+xml;base64,"), true, "shard0 is an on-chain data URI");

        IForeverLibrary.MintData memory d = fl.getMintData(id);
        assertEq(d.creator, address(this));
        assertEq(d.title, "Strata No. 1");
        assertEq(d.royaltyBps, 750);

        (address receiver, uint256 amount) = fl.royaltyInfo(id, 1 ether);
        assertEq(receiver, address(this));
        assertEq(amount, (1 ether * 750) / 10_000);
    }

    /// @dev True if `str` begins with `prefix`.
    function _startsWith(string memory str, string memory prefix) internal pure returns (bool) {
        bytes memory s = bytes(str);
        bytes memory p = bytes(prefix);
        if (s.length < p.length) return false;
        for (uint256 i = 0; i < p.length; i++) {
            if (s[i] != p[i]) return false;
        }
        return true;
    }
```

- [ ] **Step 4: Update the remaining mint call sites in this file to the new signature**

Replace each call that passes `"ethfs://p", keccak256("p")` (or similar) so the 7th argument is `bytes` and the URI/hash string args are gone:

In `test_HostedMintRecordsFee`:
```solidity
        uint256 id = fl.mint(
            address(this), "Artist", "Hosted", "image/png", 500,
            keccak256("m"), bytes("proof"), 150
        );
```
In `test_HostingFeeTooHighReverts`:
```solidity
        fl.mint(
            address(this), "Artist", "X", "image/png", 500,
            keccak256("m"), bytes("proof"), 151
        );
```
In `test_ArtistPaidRequiresStorageFee` (both calls):
```solidity
        vm.expectRevert(ForeverLibrary.InsufficientStorageFee.selector);
        fl.mint(
            address(this), "Artist", "Y", "image/png", 500,
            keccak256("m"), bytes("proof"), 0
        );
        // exact amount succeeds and is fee-exempt
        uint256 id = fl.mint{value: 0.001 ether}(
            address(this), "Artist", "Y", "image/png", 500,
            keccak256("m"), bytes("proof"), 0
        );
        assertEq(fl.hostingFeeBps(id), 0);
```
In `test_HostedMintRejectsPayment`:
```solidity
        fl.mint{value: 1 wei}(
            address(this), "Artist", "Z", "image/png", 500,
            keccak256("m"), bytes("proof"), 150
        );
```

- [ ] **Step 5: Add a new test for the `ProofTooLarge` guard and an empty-proof guard**

Add these tests:
```solidity
    /// Proof bytes above the SSTORE2 cap are rejected.
    function test_ProofTooLargeReverts() public {
        bytes memory big = new bytes(24_001);
        vm.expectRevert(ForeverLibrary.ProofTooLarge.selector);
        fl.mint(address(this), "A", "Big", "image/png", 500, keccak256("m"), big, 0);
    }

    /// Empty proof bytes are rejected (Shard 0 must carry real bytes).
    function test_EmptyProofReverts() public {
        vm.expectRevert(ForeverLibrary.EmptyProof.selector);
        fl.mint(address(this), "A", "Empty", "image/png", 500, keccak256("m"), bytes(""), 0);
    }
```

- [ ] **Step 6: Add a test that a `Log` shard can be appended**

Add:
```solidity
    /// A high-res Log shard attaches as an ordinary appended shard.
    function test_AppendLogShard() public {
        uint256 id = _mint();
        fl.configureShard(
            id, 1, IForeverLibrary.ShardBackend.Log,
            "log://0x0000000000000000000000000000000000000abc/0xfeed",
            keccak256("merkle-root")
        );
        assertEq(fl.shardCount(id), 2);
        assertEq(uint8(fl.shardBackend(id, 1)), uint8(IForeverLibrary.ShardBackend.Log));
        assertEq(fl.shardURI(id, 1), "log://0x0000000000000000000000000000000000000abc/0xfeed");
    }
```

- [ ] **Step 7: Run the tests to confirm they FAIL to compile / fail**

Run:
```bash
cd contracts && forge test --match-contract ForeverLibraryTest -vv ; cd ..
```
Expected: **compile error** — `ForeverLibrary.mint` still has the old signature and `ProofTooLarge`/`EmptyProof` errors don't exist yet. This is the red state; Task 4 fixes it.

- [ ] **Step 8: Commit the red tests**

```bash
git add contracts/test/ForeverLibrary.t.sol
git commit -m "test(contracts): SSTORE2 state shard + Log shard expectations (red)"
```

---

## Task 4: SSTORE2 STATE shard — implement in `ForeverLibrary`

**Files:**
- Modify: `contracts/src/ForeverLibrary.sol`

- [ ] **Step 1: Add the SSTORE2 + Base64 imports**

After the existing imports (around `ForeverLibrary.sol:21`), add:
```solidity
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {SSTORE2} from "solady/utils/SSTORE2.sol";
```

- [ ] **Step 2: Add the two new errors**

In the ERRORS block (after `error EmptyContentHash();`, ~line 51), add:
```solidity
    error EmptyProof();
    error ProofTooLarge();
```

- [ ] **Step 3: Add the proof-size cap constant and the state-pointer storage**

After the `Shard` struct (around line 70), add the cap constant; and in the STORAGE block (after `_shards`, ~line 88) add the pointer mapping:
```solidity
    /// @dev Max bytes for the on-chain STATE proof. Kept under the EIP-170
    ///      contract-size limit (24,576) that bounds a single SSTORE2 write.
    uint256 public constant MAX_PROOF_BYTES = 24_000;
```
```solidity
    /// @dev tokenId => SSTORE2 pointer holding Shard 0's raw on-chain bytes.
    mapping(uint256 => address) private _statePointer;
```

- [ ] **Step 4: Replace the `mint` signature and proof handling**

Change the `mint` signature (lines 198-208) so the proof args become a single `bytes calldata proofData` (drop `string calldata proofURI` and `bytes32 proofContentHash`):
```solidity
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
```

Replace the early validation block (lines 209-212) so it validates `proofData` instead of `proofContentHash`:
```solidity
        if (royaltyBps > _feeDenominator()) revert InvalidRoyalty(); // <= 100%.
        if (metadataHash == bytes32(0)) revert EmptyContentHash();
        if (proofData.length == 0) revert EmptyProof();
        if (proofData.length > MAX_PROOF_BYTES) revert ProofTooLarge();
        if (hostingFeeBps_ > MAX_HOSTING_FEE_BPS) revert HostingFeeTooHigh();
```

- [ ] **Step 5: Write the SSTORE2 bytes and configure Shard 0 from them**

Replace the Shard-0 configuration block (lines 246-256) with an SSTORE2 write + on-chain hash:
```solidity
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
```

- [ ] **Step 6: Make Shard 0 resolve to an on-chain `data:` URI**

Replace the `shardURI` external function (lines 407-410) so index 0 builds a data URI from SSTORE2, and add the internal helper. Insert the helper just above `_requireMinted` (~line 469):
```solidity
    function shardURI(uint256 tokenId, uint256 index) external view returns (string memory) {
        if (index >= _shards[tokenId].length) revert ShardIndexOutOfRange();
        if (index == 0) return _stateDataURI(tokenId);
        return _shards[tokenId][index].uri;
    }
```
```solidity
    /// @dev Build Shard 0's on-chain data URI from the SSTORE2-stored bytes and
    ///      the token's recorded media type. Zero external dependencies.
    function _stateDataURI(uint256 tokenId) internal view returns (string memory) {
        bytes memory data = SSTORE2.read(_statePointer[tokenId]);
        return string.concat(
            "data:",
            _mintData[tokenId].mediaType,
            ";base64,",
            Base64.encode(data)
        );
    }
```

- [ ] **Step 7: Make `tokenURI` use the same on-chain Shard 0 URI**

Replace the `tokenURI` body (lines 438-446) so the Shard-0 fallback uses `_stateDataURI`:
```solidity
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireMinted(tokenId);
        uint256 idx = _selectedShardIndex[tokenId];
        Shard[] storage shards = _shards[tokenId];
        if (idx >= shards.length) idx = 0;
        if (idx == 0) return _stateDataURI(tokenId);
        return shards[idx].uri;
    }
```

- [ ] **Step 8: Update the `mint` NatSpec**

Replace the `@param proofURI` / `@param proofContentHash` doc lines (192-193) with:
```solidity
    /// @param proofData       raw low-res canonical bytes for the on-chain STATE
    ///        proof shard (Shard 0); stored via SSTORE2, hashed on-chain. Must be
    ///        1..MAX_PROOF_BYTES bytes.
```

- [ ] **Step 9: Run the ForeverLibrary tests — expect GREEN**

Run:
```bash
cd contracts && forge test --match-contract ForeverLibraryTest -vv ; cd ..
```
Expected: all `ForeverLibraryTest` tests PASS (including `test_ProofTooLargeReverts`, `test_EmptyProofReverts`, `test_AppendLogShard`, and the data-URI assertion).

- [ ] **Step 10: Commit**

```bash
git add contracts/src/ForeverLibrary.sol
git commit -m "feat(contracts): SSTORE2 on-chain STATE shard with data-URI resolution"
```

---

## Task 5: Fix `PerpetualSettlement` tests for the new mint signature

**Files:**
- Modify: `contracts/test/PerpetualSettlement.t.sol:30-34, 89-94`

- [ ] **Step 1: Update the `setUp` mint call**

Replace the `setUp` mint (lines 31-34) with the new signature:
```solidity
        vm.prank(creator);
        tokenId = fl.mint(
            creator, "Creator", "Work", "image/png",
            ROYALTY_BPS, keccak256("m"), bytes("proof"), 0
        );
```

- [ ] **Step 2: Update the hosted-token mint in `test_HostingFeeChargedOnSale`**

Replace that mint (lines 91-94) with:
```solidity
        vm.prank(creator);
        uint256 hostedId = fl.mint(
            creator, "Creator", "Hosted", "image/png",
            ROYALTY_BPS, keccak256("m2"), bytes("proof2"), 150
        );
```

- [ ] **Step 3: Run the settlement tests — expect GREEN**

Run:
```bash
cd contracts && forge test --match-contract PerpetualSettlementTest -vv ; cd ..
```
Expected: all `PerpetualSettlementTest` tests PASS (behavior is unchanged; only the mint call shape changed).

- [ ] **Step 4: Commit**

```bash
git add contracts/test/PerpetualSettlement.t.sol
git commit -m "test(contracts): update settlement tests for new mint signature"
```

---

## Task 6: `LogLedger` contract + tests (TDD)

**Files:**
- Test: `contracts/test/LogLedger.t.sol` (new)
- Create: `contracts/src/LogLedger.sol`

- [ ] **Step 1: Write the failing test suite**

Create `contracts/test/LogLedger.t.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {LogLedger} from "../src/LogLedger.sol";

contract LogLedgerTest is Test {
    LogLedger internal ledger;
    address internal author = address(0xA11CE);
    address internal stranger = address(0xBEEF);
    bytes32 internal constant FILE_ID = keccak256("file-1");

    event FileOpened(bytes32 indexed fileId, address indexed author);
    event FileChunk(bytes32 indexed fileId, uint32 indexed chunkIndex, bytes data);
    event FileSealed(bytes32 indexed fileId, bytes32 root, uint256 size, uint32 chunks, uint8 codec);

    function setUp() public {
        ledger = new LogLedger();
    }

    function test_OpenUploadSealHappyPath() public {
        vm.prank(author);
        ledger.open(FILE_ID);

        vm.prank(author);
        ledger.upload(FILE_ID, 0, hex"deadbeef");
        vm.prank(author);
        ledger.upload(FILE_ID, 1, hex"cafe");

        vm.prank(author);
        ledger.seal(FILE_ID, keccak256("root"), 6, 2, 1);

        (bytes32 root, uint256 size, uint32 chunks,, uint8 codec, bool sealed_, address a) = ledger.files(FILE_ID);
        assertEq(root, keccak256("root"));
        assertEq(size, 6);
        assertEq(chunks, 2);
        assertEq(codec, 1);
        assertTrue(sealed_);
        assertEq(a, author);
        assertTrue(ledger.isSealed(FILE_ID));
    }

    function test_OpenRecordsDeployBlock() public {
        vm.roll(1234);
        vm.prank(author);
        ledger.open(FILE_ID);
        (,,, uint32 deployBlock,,,) = ledger.files(FILE_ID);
        assertEq(deployBlock, 1234);
    }

    function test_OpenEmitsEvent() public {
        vm.expectEmit(true, true, false, false);
        emit FileOpened(FILE_ID, author);
        vm.prank(author);
        ledger.open(FILE_ID);
    }

    function test_UploadEmitsChunk() public {
        vm.prank(author);
        ledger.open(FILE_ID);
        vm.expectEmit(true, true, false, true);
        emit FileChunk(FILE_ID, 7, hex"1234");
        vm.prank(author);
        ledger.upload(FILE_ID, 7, hex"1234");
    }

    function test_CannotReopen() public {
        vm.prank(author);
        ledger.open(FILE_ID);
        vm.prank(author);
        vm.expectRevert(LogLedger.AlreadySealed.selector);
        ledger.open(FILE_ID);
    }

    function test_OnlyAuthorUploads() public {
        vm.prank(author);
        ledger.open(FILE_ID);
        vm.prank(stranger);
        vm.expectRevert(LogLedger.NotAuthor.selector);
        ledger.upload(FILE_ID, 0, hex"00");
    }

    function test_OnlyAuthorSeals() public {
        vm.prank(author);
        ledger.open(FILE_ID);
        vm.prank(stranger);
        vm.expectRevert(LogLedger.NotAuthor.selector);
        ledger.seal(FILE_ID, keccak256("r"), 1, 1, 0);
    }

    function test_CannotUploadAfterSeal() public {
        vm.prank(author);
        ledger.open(FILE_ID);
        vm.prank(author);
        ledger.seal(FILE_ID, keccak256("r"), 0, 0, 0);
        vm.prank(author);
        vm.expectRevert(LogLedger.AlreadySealed.selector);
        ledger.upload(FILE_ID, 0, hex"00");
    }

    function test_CannotSealTwice() public {
        vm.prank(author);
        ledger.open(FILE_ID);
        vm.prank(author);
        ledger.seal(FILE_ID, keccak256("r"), 0, 0, 0);
        vm.prank(author);
        vm.expectRevert(LogLedger.AlreadySealed.selector);
        ledger.seal(FILE_ID, keccak256("r2"), 0, 0, 0);
    }
}
```

- [ ] **Step 2: Run the test to confirm it fails (no contract yet)**

Run:
```bash
cd contracts && forge test --match-contract LogLedgerTest -vv ; cd ..
```
Expected: **compile error** — `../src/LogLedger.sol` does not exist.

- [ ] **Step 3: Create the `LogLedger` contract**

Create `contracts/src/LogLedger.sol`:
```solidity
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
        bool    sealed;      // once true, no further mutation.
        address author;      // who may upload/seal this fileId.
    }

    mapping(bytes32 => File) public files; // fileId => File

    event FileOpened(bytes32 indexed fileId, address indexed author);
    event FileChunk(bytes32 indexed fileId, uint32 indexed chunkIndex, bytes data);
    event FileSealed(bytes32 indexed fileId, bytes32 root, uint256 size, uint32 chunks, uint8 codec);

    error NotAuthor();
    error AlreadySealed();
    error NotOpened();

    /// @notice Claim authorship of a caller-chosen unique fileId.
    /// @dev    Recommended fileId = keccak256(abi.encode(collection, contentHash, version)).
    function open(bytes32 fileId) external {
        File storage f = files[fileId];
        if (f.author != address(0)) revert AlreadySealed(); // already opened/used.
        f.author = msg.sender;
        f.deployBlock = uint32(block.number);
        emit FileOpened(fileId, msg.sender);
    }

    /// @notice Emit one chunk of media. Logs only (~8 gas/byte of data).
    function upload(bytes32 fileId, uint32 chunkIndex, bytes calldata data) external {
        File storage f = files[fileId];
        if (f.author != msg.sender) revert NotAuthor();
        if (f.sealed) revert AlreadySealed();
        emit FileChunk(fileId, chunkIndex, data);
    }

    /// @notice Finalize: write the verification commitment to state.
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
        if (f.sealed) revert AlreadySealed();
        f.root = root;
        f.size = size;
        f.chunks = chunks;
        f.codec = codec;
        f.sealed = true;
        emit FileSealed(fileId, root, size, chunks, codec);
    }

    function isSealed(bytes32 fileId) external view returns (bool) {
        return files[fileId].sealed;
    }
}
```

- [ ] **Step 4: Run the test to confirm it PASSES**

Run:
```bash
cd contracts && forge test --match-contract LogLedgerTest -vv ; cd ..
```
Expected: all `LogLedgerTest` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add contracts/src/LogLedger.sol contracts/test/LogLedger.t.sol
git commit -m "feat(contracts): LogLedger event-log storage contract + tests"
```

---

## Task 7: Deploy script for `LogLedger`

**Files:**
- Create: `contracts/script/DeployLogLedger.s.sol`

- [ ] **Step 1: Create the deploy script**

Create `contracts/script/DeployLogLedger.s.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {LogLedger} from "../src/LogLedger.sol";

/**
 * Deploy the standalone LogLedger contract.
 *
 * Usage:
 *   forge script script/DeployLogLedger.s.sol \
 *     --rpc-url base_sepolia --account deployer --broadcast --verify
 *
 * No constructor args; LogLedger is permissionless (per-fileId author gating).
 */
contract DeployLogLedger is Script {
    function run() external returns (LogLedger ledger) {
        vm.startBroadcast();
        ledger = new LogLedger();
        vm.stopBroadcast();
        console2.log("LogLedger deployed at:", address(ledger));
    }
}
```

- [ ] **Step 2: Confirm it compiles**

Run:
```bash
cd contracts && forge build && cd ..
```
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add contracts/script/DeployLogLedger.s.sol
git commit -m "chore(contracts): add LogLedger deploy script"
```

---

## Task 8: Full test gate

**Files:** none (verification only)

- [ ] **Step 1: Run the entire contract test suite**

Run:
```bash
cd contracts && forge test -vv ; cd ..
```
Expected: **all** tests across `ForeverLibraryTest`, `PerpetualSettlementTest`, and `LogLedgerTest` PASS, 0 failed. If any fail, fix before deploying — do not proceed to Task 9 red.

- [ ] **Step 2: Gas/size sanity check on the SSTORE2 path**

Run:
```bash
cd contracts && forge test --match-test test_MintConfiguresMandatoryOnchainProof --gas-report ; cd ..
```
Expected: `mint` succeeds; note the gas (SSTORE2 write dominates ~200 gas/byte — informational only).

---

## Task 9: Deploy + record addresses (OPERATOR-RUN — needs keystore password)

> These steps run in **your** PowerShell terminal in `contracts/` because they need your `deployer` keystore password and your funded wallet. The agent cannot enter the password. Load env first (forge reads the process env, not `.env.local`):
>
> ```powershell
> Get-Content ..\.env.local | ForEach-Object {
>   if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)=(.*)$') {
>     [Environment]::SetEnvironmentVariable($matches[1], $matches[2].Trim(), 'Process')
>   }
> }
> ```

- [ ] **Step 1: Redeploy `ForeverLibrary` (supersedes the current `0x87e8…`)**

```powershell
forge script script/DeployForeverLibrary.s.sol --rpc-url base_sepolia --account deployer --broadcast --verify
forge script script/DeployForeverLibrary.s.sol --rpc-url sepolia       --account deployer --broadcast --verify
```
Record each `ForeverLibrary deployed at:` address.

- [ ] **Step 2: Deploy `LogLedger` on both testnets**

```powershell
forge script script/DeployLogLedger.s.sol --rpc-url base_sepolia --account deployer --broadcast --verify
forge script script/DeployLogLedger.s.sol --rpc-url sepolia       --account deployer --broadcast --verify
```
Record each `LogLedger deployed at:` address.

> `PerpetualSettlement` is **not** redeployed — it's unaffected by shard changes. The Base Sepolia settlement (`0xD2d3B1A12CB01f44AaFcD1eb17d86c3C31fE56b9`) and your Ethereum Sepolia settlement deploy remain valid.

- [ ] **Step 3: Record the 4 new addresses in `.env.local`**

Update these keys (the agent does this once you paste the addresses):
```
NEXT_PUBLIC_FOREVER_LIBRARY_BASE_SEPOLIA=<new FL base>
NEXT_PUBLIC_FOREVER_LIBRARY_SEPOLIA=<new FL sepolia>
NEXT_PUBLIC_LOG_LEDGER_BASE_SEPOLIA=<LogLedger base>
NEXT_PUBLIC_LOG_LEDGER_SEPOLIA=<LogLedger sepolia>
```
(These are data only — they do not affect the build. ABI + app wiring is Plan 2.)

- [ ] **Step 4: Verify on the explorers**

Open each new address on Basescan (Base Sepolia) / Etherscan (Sepolia) and confirm the source is verified. If `--verify` raced the indexer, re-run that one command with `--resume --verify` (no redeploy, no password).

---

## Self-Review (completed during authoring)

- **Spec coverage:** spec §2.1 (enum) → Task 2; §2.2 (SSTORE2 STATE + data URI + 24KB cap + on-chain hash) → Tasks 3-4; §3 (LogLedger) → Task 6; §13 step 1 (deploy/redeploy) → Tasks 7-9. Spec §4-§12 (fileId/relayer, TS module, pipeline, resolver, frontend, gate, re-emission) are explicitly **out of scope for Plan 1** and deferred to Plans 2-5.
- **Placeholder scan:** no TBD/TODO; every code step shows full code; the only `<...>` are deploy-output addresses an operator pastes in Task 9 (genuinely unknown until deploy).
- **Type consistency:** new `mint` signature `(to, artistName, title, mediaType, royaltyBps, metadataHash, bytes proofData, uint16 hostingFeeBps_)` used identically in Tasks 3, 4, 5. Errors `EmptyProof`/`ProofTooLarge` defined in Task 4 Step 2, used in Task 3 tests. `LogLedger` errors (`NotAuthor`/`AlreadySealed`/`NotOpened`) match between Task 6 test and contract. `files(...)` 7-tuple destructuring matches the `File` struct field order.
- **Note:** the spec's "Merkle round-trip fixture in the Solidity test" was dropped — `LogLedger` does not compute Merkle roots on-chain (off-chain concern), so the byte-identical Merkle fixture belongs to the shared TS module's tests in Plan 2. Solidity tests cover contract mechanics only.
