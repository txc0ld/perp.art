import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { indexedCollections, indexAllTokens } from "@/lib/web3/indexer";
import { indexedDropCollections, indexDropTokens } from "@/lib/web3/drops-indexer";
import { Section, MonoLabel, Badge } from "@/components/ui";
import { ArtTile } from "@/components/art/ArtTile";

export const dynamic = "force-dynamic";

const CONTRACT_RE = /^0x[0-9a-fA-F]{40}$/;

export async function generateMetadata(
  { params }: { params: Promise<{ chainId: string; contract: string }> },
): Promise<Metadata> {
  const { chainId, contract } = await params;
  if (!CONTRACT_RE.test(contract)) return { title: "Collection not found · Perpetual" };
  const [cols, dropCols] = await Promise.all([
    indexedCollections(Number(chainId)),
    indexedDropCollections(Number(chainId)),
  ]);
  const col = [...cols, ...dropCols].find((c) => c.slug === contract.toLowerCase());
  return {
    title: col ? `${col.name} · Perpetual` : `Collection ${contract.slice(0, 10)}… · Perpetual`,
    description: col?.description ?? "On-chain collection on Perpetual.",
  };
}

export default async function OnchainCollectionPage(
  { params }: { params: Promise<{ chainId: string; contract: string }> },
) {
  const { chainId, contract } = await params;
  if (!CONTRACT_RE.test(contract)) notFound();

  const chainIdNum = Number(chainId);
  const contractLower = contract.toLowerCase();

  const [cols, dropCols, allTokens, dropTokens] = await Promise.all([
    indexedCollections(chainIdNum),
    indexedDropCollections(chainIdNum),
    indexAllTokens(chainIdNum),
    indexDropTokens(chainIdNum),
  ]);

  const col = [...cols, ...dropCols].find((c) => c.slug === contractLower);
  const isDrop = col?.kind === "drop";
  const tokens = [...allTokens, ...dropTokens].filter((t) => t.collectionSlug === contractLower);

  const name = col?.name ?? `Collection ${contract.slice(0, 10)}…`;

  return (
    <Section>
      <div className="pb-8">
        <div className="flex items-center gap-3">
          <MonoLabel className="text-faint">On-chain Collection</MonoLabel>
          {isDrop ? (
            <Badge tone="muted">Folder permanence</Badge>
          ) : (
            col && <Badge tone="verify">5-shard permanence</Badge>
          )}
          {isDrop && col?.dropRevealed === false && <Badge tone="accent">Pre-reveal</Badge>}
        </div>
        <h1 className="display-sm mt-2 font-brand text-foreground">{name}</h1>
        <p className="mt-1 font-mono text-[11px] text-faint break-all">{contract}</p>
        {col && (
          <p className="mt-3 font-mono text-[12px] text-muted">
            {col.itemCount} {col.itemCount === 1 ? "item" : "items"} · {col.ownerCount} {col.ownerCount === 1 ? "owner" : "owners"}
          </p>
        )}
        {isDrop && (
          <p className="mt-2 max-w-[60ch] text-[12px] leading-relaxed text-muted">
            A folder-permanence drop: the art + metadata live in an IPFS + Arweave folder anchored
            by one on-chain provenance hash. This is a distinct tier from the per-token 5-shard
            guarantee of 1-of-1s and editions.
          </p>
        )}
      </div>

      {tokens.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No tokens minted in this collection yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 lg:gap-5">
          {tokens.map((t, i) => (
            <div key={t.id} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 45}ms` }}>
              <ArtTile token={t} />
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
