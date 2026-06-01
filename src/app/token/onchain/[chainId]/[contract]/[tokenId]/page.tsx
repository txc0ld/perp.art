import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLiveToken } from "@/lib/live/catalog";
import { readOnchainToken } from "@/lib/web3/read-token";
import { resolveEnsName, displayName } from "@/lib/ens";
import { PermanencePanel } from "@/components/token/PermanencePanel";
import { PermanenceScoreCard } from "@/components/token/PermanenceScoreCard";
import { PermanenceScoreBadge } from "@/components/token/PermanenceScoreBadge";
import { CertificateOfPermanence } from "@/components/token/CertificateOfPermanence";
import { ProvenanceTimeline } from "@/components/token/ProvenanceTimeline";
import { TradePanel } from "@/components/token/TradePanel";
import { Identity } from "@/components/identity/Identity";
import { MediaPreview } from "@/components/mint/MediaPreview";
import { Section, SectionHeader, EmptyState } from "@/components/ui";
import { getChainMeta } from "@/lib/chains";
import type { Hex } from "viem";

export const dynamic = "force-dynamic";

const CONTRACT_RE = /^0x[0-9a-fA-F]{40}$/;

function tokenIdFor(chainId: string, contract: string, tokenId: string): string | null {
  const c = Number(chainId);
  if (!Number.isInteger(c) || !/^\d+$/.test(tokenId) || !CONTRACT_RE.test(contract)) return null;
  // catalog keys are `${chainId}-${contract.toLowerCase()}-${tokenId}`
  return `${c}-${contract.toLowerCase()}-${tokenId}`;
}

/**
 * Resolve the live token. Prefer the listing-enriched catalog entry; fall back
 * to a direct on-chain read when the indexer hasn't surfaced the token yet (so
 * a freshly minted, not-yet-indexed token still renders — sans listing, which
 * TradePanel fetches live regardless).
 */
async function loadToken(chainId: string, contract: string, tokenId: string) {
  const id = tokenIdFor(chainId, contract, tokenId);
  if (!id) return undefined;
  const fromCatalog = await getLiveToken(id);
  if (fromCatalog) return fromCatalog;
  const direct = await readOnchainToken(Number(chainId), contract as Hex, BigInt(tokenId));
  return direct ?? undefined;
}

export async function generateMetadata(
  { params }: { params: Promise<{ chainId: string; contract: string; tokenId: string }> },
): Promise<Metadata> {
  const { chainId, contract, tokenId } = await params;
  const token = await loadToken(chainId, contract, tokenId);
  if (!token) return { title: "Token not found · Perpetual" };
  return {
    title: `${token.title} · Perpetual`,
    description: `On-chain token #${token.tokenId} by ${token.artistHandle}`,
  };
}

export default async function OnchainTokenPage(
  { params }: { params: Promise<{ chainId: string; contract: string; tokenId: string }> },
) {
  const { chainId, contract, tokenId } = await params;
  if (!CONTRACT_RE.test(contract)) notFound();

  const token = await loadToken(chainId, contract, tokenId);
  if (!token) notFound();

  const chainIdNum = Number(chainId);
  const chainMeta = getChainMeta(token.chain);

  // Real ENS for the artist label (royalty.receiver == on-chain creator).
  const artistEns = await resolveEnsName(token.royalty.receiver);
  const artistLabel =
    token.artistHandle && !token.artistHandle.startsWith("0x")
      ? token.artistHandle
      : displayName(token.royalty.receiver, artistEns);

  const stateShard = token.permanence.shards.find((s) => s.index === 0);
  const logShard = token.permanence.shards.find((s) => s.backend === "log");
  const displayUrl = logShard?.sourceUrl ?? stateShard?.sourceUrl;

  const mime =
    token.mediaType === "video"
      ? "video/mp4"
      : token.mediaType === "interactive"
      ? "text/html"
      : "image/png";

  const isEdition = token.editionSize !== undefined && token.editionSize > 1;

  return (
    <Section>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)]">
        {/* Left: media + provenance */}
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[10px] border border-border bg-surface-2">
            <MediaPreview
              url={displayUrl}
              mime={mime}
              seed={token.artSeed}
              genre={token.genre}
              alt={`${token.title} by ${artistLabel}`}
              className="h-full w-full object-contain"
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] uppercase tracking-wider text-faint">
            <span className="whitespace-nowrap">{token.id}</span>
            <span className="whitespace-nowrap">{chainMeta.label}</span>
            <span className="whitespace-nowrap text-muted">{token.genre}</span>
          </div>
        </div>

        {/* Right: header + panels */}
        <div className="space-y-4">
          <header className="space-y-2.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
              On-chain · token #{token.tokenId}
              {isEdition && (
                <> · Edition {token.editionIndex}/{token.editionSize}</>
              )}
            </span>
            <h1 className="font-brand text-[28px] font-semibold tracking-[-0.01em] text-foreground">
              {token.title}
            </h1>
            <PermanenceScoreBadge token={token} className="self-start" />
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted">
              <span>by {artistLabel}</span>
              <span className="text-faint">·</span>
              <span className="inline-flex items-center gap-1.5">
                held by <Identity address={token.owner} className="text-foreground" />
              </span>
            </p>
          </header>

          <TradePanel
            chainId={chainIdNum}
            tokenId={token.tokenId}
            nft={contract as Hex}
            owner={token.owner as Hex}
          />

          <PermanencePanel token={token} />

          <div>
            <p className="mb-2.5 font-mono text-[10px] uppercase tracking-wider text-faint">
              Permanence score
            </p>
            <PermanenceScoreCard token={token} />
          </div>
        </div>
      </div>

      {/* Provenance — real on-chain Transfer history */}
      {token.provenance.length > 0 && (
        <div className="mt-16 lg:mt-20">
          <SectionHeader
            eyebrow="Provenance"
            title="On-chain history"
            description="Every transfer of this token, read directly from the chain."
          />
          <ProvenanceTimeline events={token.provenance} />
        </div>
      )}

      {/* Offers — no live bids backend yet (the orderbook handles sell listings,
          surfaced in TradePanel). Honest coming-soon rather than fabricated bids. */}
      <div className="mt-16 lg:mt-20">
        <SectionHeader
          eyebrow="Offers"
          title="Offers"
          description="Signed, gasless bids that the holder can accept on their own terms."
        />
        <EmptyState
          eyebrow="Coming soon"
          title="Offers aren't live yet"
          body="Buying and selling work today through listings in the trade panel above. Collector offers are on the way."
        />
      </div>

      {/* Certificate of permanence */}
      <div className="mt-16 lg:mt-20">
        <SectionHeader
          eyebrow="Keepsake"
          title="Certificate of permanence"
          description="An archival, self-contained SVG that records this work's permanence: content hash, every storage shard, mint date, and its permanence grade."
        />
        <CertificateOfPermanence token={token} />
      </div>
    </Section>
  );
}
