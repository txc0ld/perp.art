/**
 * On-chain end-to-end for collections + editions against Base Sepolia:
 * factory.createCollection → mintEdition(size 3) into it → read the 3 edition
 * tokens back (shared STATE bytes, editionIndex 1..3) → indexCollections finds it.
 * Gated: RUN_LOGLEDGER_E2E=1 npm test -- collections.integration
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  createWalletClient,
  createPublicClient,
  http,
  bytesToHex,
  keccak256,
  decodeEventLog,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

(function loadEnvLocal() {
  let text: string;
  try {
    text = readFileSync(".env.local", "utf8");
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
})();

const RUN = process.env.RUN_LOGLEDGER_E2E === "1";

describe.runIf(RUN)("collections + editions (on-chain Base Sepolia)", () => {
  it(
    "creates a collection, mints an edition of 3, reads them back + indexes the collection",
    async () => {
      const { FOREVER_LIBRARY_ABI, FACTORY_ABI } = await import("./abis");
      const { getContracts } = await import("./contracts");
      const { readOnchainToken } = await import("./read-token");
      const { indexCollections } = await import("./indexer");
      const { buildCoverCardSvg } = await import("@/lib/proof/state-proof");

      const factory = getContracts(84532).factory as Hex;
      expect(factory, "factory configured").toBeDefined();

      const pk = (process.env.LOGLEDGER_RELAYER_PK!.startsWith("0x")
        ? process.env.LOGLEDGER_RELAYER_PK!
        : `0x${process.env.LOGLEDGER_RELAYER_PK}`) as Hex;
      const account = privateKeyToAccount(pk);
      const transport = http(process.env.RPC_BASE_SEPOLIA);
      const wallet = createWalletClient({ account, chain: baseSepolia, transport });
      const pub = createPublicClient({ chain: baseSepolia, transport });

      // 1) Create a collection.
      const createHash = await wallet.writeContract({
        address: factory,
        abi: FACTORY_ABI,
        functionName: "createCollection",
        args: ["E2E Editions", "E2ED", BigInt(7 * 24 * 3600)],
        gas: BigInt(4_000_000),
      });
      const createRcpt = await pub.waitForTransactionReceipt({ hash: createHash });
      expect(createRcpt.status).toBe("success");
      let collection: Hex | undefined;
      for (const lg of createRcpt.logs) {
        try {
          const d = decodeEventLog({ abi: FACTORY_ABI, data: lg.data, topics: lg.topics });
          if (d.eventName === "CollectionCreated") {
            collection = (d.args as { collection: Hex }).collection;
            break;
          }
        } catch {
          /* not our event */
        }
      }
      expect(collection, "CollectionCreated emitted").toBeDefined();

      // 2) mintEdition(size 3) into the collection.
      const proof = buildCoverCardSvg({ title: "Edition Piece", artist: "E2E", contentHash: keccak256(new TextEncoder().encode("ed")) });
      const mintHash = await wallet.writeContract({
        address: collection!,
        abi: FOREVER_LIBRARY_ABI,
        functionName: "mintEdition",
        args: [account.address, "E2E", "Edition Piece", "image/svg+xml", BigInt(500), keccak256(new TextEncoder().encode("meta")), bytesToHex(proof), 0, 3],
        value: BigInt(0),
        gas: BigInt(3_000_000),
      });
      expect((await pub.waitForTransactionReceipt({ hash: mintHash })).status).toBe("success");

      // 3) Read the 3 edition tokens back (fresh collection → ids 1,2,3).
      //    Poll through public-RPC read-replica lag for token 1.
      let t1 = await readOnchainToken(84532, collection!, BigInt(1));
      for (let i = 0; i < 15 && !t1; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        t1 = await readOnchainToken(84532, collection!, BigInt(1));
      }
      const t2 = await readOnchainToken(84532, collection!, BigInt(2));
      const t3 = await readOnchainToken(84532, collection!, BigInt(3));
      expect(t1 && t2 && t3, "all three edition tokens exist").toBeTruthy();
      expect([t1!.editionSize, t2!.editionSize, t3!.editionSize]).toEqual([3, 3, 3]);
      expect([t1!.editionIndex, t2!.editionIndex, t3!.editionIndex]).toEqual([1, 2, 3]);
      // Shared STATE: same content hash + same collection.
      expect(t1!.permanence.contentHash).toBe(t2!.permanence.contentHash);
      expect(t1!.collectionSlug).toBe(collection!.toLowerCase());
      expect(t1!.id).toBe(`84532-${collection!.toLowerCase()}-1`);

      // 4) The indexer enumerates the new collection.
      const cols = await indexCollections(84532);
      expect(cols.map((c) => c.address.toLowerCase())).toContain(collection!.toLowerCase());
    },
    300_000,
  );
});
