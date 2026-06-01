# Collections/Editions — Phase 1: Contracts

> Foundry TDD. Foundation for the feature. Ends with an operator-run deploy (keystore).

**Goal:** `ForeverLibrary.mintEdition` (shared-storage editions + edition fields) + a `ForeverLibraryFactory` (deploy + enumerate collections), tested, deployed to Base Sepolia + Eth Sepolia.

## Tasks
1. **`mintEdition` + edition fields on `ForeverLibrary`** (`contracts/src/ForeverLibrary.sol`):
   - Refactor: extract the per-token write of the current `mint` into an internal `_mintOne(to, artistName, title, mediaType, royaltyBps, metadataHash, statePtr, editionSize, editionIndex)` that: `tokenId = _nextTokenId++`, writes `_mintData`, royalty, edit window, `_statePointer[tokenId] = statePtr`, `_configureShard(tokenId,0,Onchain,"",keccak256-already-hashed contentHash)`, `_editionSize[tokenId]=editionSize`, `_editionIndex[tokenId]=index`, `_hostingFeeBps`, `_safeMint`, `emit TokenMinted` + `emit HostingConfigured`.
   - `mint(...)` keeps its external signature; internally: validate, `SSTORE2.write(proofData)` → ptr, charge/forward storage fee ONCE, then `_mintOne(..., editionSize=1, index=1)`.
   - `mintEdition(to, artistName, title, mediaType, royaltyBps, metadataHash, bytes proofData, uint16 hostingFeeBps_, uint32 editionSize)` external payable nonReentrant: same validations as mint; `require(editionSize >= 1 && editionSize <= MAX_EDITION_SIZE)` (new error `InvalidEditionSize`, `MAX_EDITION_SIZE = 100`); ONE `SSTORE2.write(proofData)` → ptr; charge/forward the storage fee ONCE (same rule as mint); loop `i in 0..editionSize-1` calling `_mintOne(..., ptr, editionSize, i+1)`; return the first tokenId.
   - Storage: `mapping(uint256 => uint32) private _editionSize; mapping(uint256 => uint32) private _editionIndex;` + views `editionSize(tokenId)`/`editionIndex(tokenId)` (default size 1, index 1 for legacy tokens — return 1 when 0).
   - All N edition tokens share the same `statePtr` (so `shardURI(id,0)` returns the SAME data URI) and the same content hash. hosting/storage fee handled once for the whole edition.
   - **Tests** (`contracts/test/ForeverLibrary.t.sol`, extend): `test_MintEditionSharesStateAndIndexes` (size 3 → 3 tokens, each `ownerOf`==to, each `shardURI(id,0)` byte-identical, each `shardContentHash`==keccak(proofData), editionIndex 1/2/3, editionSize 3, shard0Configured each); `test_MintEditionChargesFeeOnce` (set storageFeeWei, mintEdition size 3 with value=fee once succeeds; treasury balance increases by exactly one fee); `test_MintEditionSizeBounds` (0 reverts InvalidEditionSize, 101 reverts); `test_SingleMintIsEditionOfOne` (mint → editionSize(id)==1, editionIndex(id)==1). Keep existing tests green (update if `mint` refactor changed internals).
2. **`ForeverLibraryFactory`** (`contracts/src/ForeverLibraryFactory.sol`, new):
   - `import {ForeverLibrary} from "./ForeverLibrary.sol";`
   - `address[] public collections;` `mapping(address => bool) public isCollection;`
   - `event CollectionCreated(address indexed collection, address indexed owner, string name, string symbol);`
   - `function createCollection(string calldata name, string calldata symbol, uint64 editWindow) external returns (address col)` → `ForeverLibrary fl = new ForeverLibrary(name, symbol, msg.sender, editWindow); col = address(fl); collections.push(col); isCollection[col] = true; emit CollectionCreated(col, msg.sender, name, symbol);`
   - Views: `collectionsCount() returns (uint256)`, `collectionAt(uint256) returns (address)`.
   - **Tests** (`contracts/test/ForeverLibraryFactory.t.sol`, new): `test_CreateCollectionDeploysOwnedFL` (createCollection as alice → returns a contract; `ForeverLibrary(col).owner()==alice`; name/symbol correct; isCollection true; count 1); `test_EmitsCollectionCreated` (expectEmit); `test_MintIntoCreatedCollection` (alice creates, then mints into `col` → token owned, shard0 configured); `test_MultipleCollectionsEnumerable` (two createCollection → count 2, collectionAt 0/1 distinct).
3. **Deploy scripts:** `contracts/script/DeployFactory.s.sol` (`new ForeverLibraryFactory()`, log address). (FL redeploy uses the existing `DeployForeverLibrary.s.sol`.)
4. **Full test gate:** `forge test` — all suites pass (ForeverLibrary, Factory, Settlement, LogLedger).
5. **OPERATOR DEPLOY (keystore):** load env, then:
   `forge script script/DeployForeverLibrary.s.sol --rpc-url base_sepolia --account deployer --broadcast --verify` (+ sepolia) — new canonical FL.
   `forge script script/DeployFactory.s.sol --rpc-url base_sepolia --account deployer --broadcast --verify` (+ sepolia) — factory.
   Record 4 addresses (FL ×2 supersede current; Factory ×2 new). Update `.env.local` (`NEXT_PUBLIC_FOREVER_LIBRARY_*` + new `NEXT_PUBLIC_FACTORY_BASE_SEPOLIA`/`_SEPOLIA`).

## Constraints / notes
- ES/Solidity 0.8.24, via_ir on. Reuse SSTORE2/Base64. Don't break the deployed PerpetualSettlement/LogLedger (unaffected).
- `_mintOne` must keep the exact Shard-0 + provenance behavior the read-layer/indexer rely on.
- The factory deploying `new ForeverLibrary(...)` increases factory bytecode size (FL is large) — confirm it compiles under the size limit with via_ir; if the factory exceeds the 24KB limit, note it (may need the factory to deploy via a minimal proxy/clones — but try the direct `new` first; FL + factory wrapper should fit since the factory itself is tiny and the FL bytecode is its own contract).
