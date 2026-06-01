import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { indexedCollections, indexAllTokens } from "@/lib/web3/indexer";
import { Section, MonoLabel } from "@/components/ui";
import { ArtTile } from "@/components/art/ArtTile";

export const dynamic = "force-dynamic";

const CONTRACT_RE = /^0x[0-9a-fA-F]{40}$/;

export async function generateMetadata(
  { params }: { params: Promise<{ chainId: string; contract: string }> },
): Promise<Metadata> {
  const { chainId, contract } = await params;
  if (!CONTRACT_RE.test(contract)) return { title: "Collection not found · Perpetual" };
  const cols = await indexedCollections(Number(chainId));
  const col = cols.find((c) => c.slug === contract.toLowerCase());
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

  const [cols, allTokens] = await Promise.all([
    indexedCollections(chainIdNum),
    indexAllTokens(chainIdNum),
  ]);

  const col = cols.find((c) => c.slug === contractLower);
  const tokens = allTokens.filter((t) => t.collectionSlug === contractLower);

  const name = col?.name ?? `Collection ${contract.slice(0, 10)}…`;

  return (
    <Section>
      <div className="pb-8">
        <MonoLabel className="text-faint">On-chain Collection</MonoLabel>
        <h1 className="display-sm mt-2 font-brand text-foreground">{name}</h1>
        <p className="mt-1 font-mono text-[11px] text-faint break-all">{contract}</p>
        {col && (
          <p className="mt-3 font-mono text-[12px] text-muted">
            {col.itemCount} {col.itemCount === 1 ? "item" : "items"} · {col.ownerCount} {col.ownerCount === 1 ? "owner" : "owners"}
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
