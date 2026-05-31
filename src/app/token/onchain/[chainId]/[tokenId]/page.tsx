import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readOnchainToken } from "@/lib/web3/read-token";
import { PermanencePanel } from "@/components/token/PermanencePanel";
import { CertificateOfPermanence } from "@/components/token/CertificateOfPermanence";
import { ProvenanceTimeline } from "@/components/token/ProvenanceTimeline";
import { MediaPreview } from "@/components/mint/MediaPreview";
import { Section } from "@/components/ui";
import { shortAddress } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function load(chainId: string, tokenId: string) {
  const c = Number(chainId);
  const id = /^\d+$/.test(tokenId) ? BigInt(tokenId) : null;
  if (!Number.isInteger(c) || id === null) return null;
  return readOnchainToken(c, id);
}

export async function generateMetadata(
  { params }: { params: Promise<{ chainId: string; tokenId: string }> },
): Promise<Metadata> {
  const { chainId, tokenId } = await params;
  const token = await load(chainId, tokenId);
  if (!token) return { title: "Token not found · Perpetual" };
  return {
    title: `${token.title} · Perpetual`,
    description: `On-chain token #${token.tokenId} by ${token.artistHandle}`,
  };
}

export default async function OnchainTokenPage(
  { params }: { params: Promise<{ chainId: string; tokenId: string }> },
) {
  const { chainId, tokenId } = await params;
  const token = await load(chainId, tokenId);
  if (!token) notFound();

  // STATE shard (index 0) is the on-chain data URI; use it as the display image.
  // LOG shard (backend "log") is the high-res copy — prefer it when present.
  const stateShard = token.permanence.shards.find((s) => s.index === 0);
  const logShard = token.permanence.shards.find((s) => s.backend === "log");
  const displayUrl = logShard?.sourceUrl ?? stateShard?.sourceUrl;

  // Derive a MIME type from the token's mediaType field.
  const mime =
    token.mediaType === "video"
      ? "video/mp4"
      : token.mediaType === "interactive"
      ? "text/html"
      : "image/png";

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
              className="h-full w-full object-contain"
            />
          </div>
          {token.provenance.length > 0 && (
            <ProvenanceTimeline events={token.provenance} />
          )}
        </div>

        {/* Right: header + permanence panels */}
        <div className="space-y-4">
          <header>
            <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
              On-chain · token #{token.tokenId}
            </span>
            <h1 className="mt-1 font-brand text-[28px] font-semibold tracking-[-0.01em] text-foreground">
              {token.title}
            </h1>
            <p className="mt-1 text-sm text-muted">
              by {token.artistHandle} · owner {shortAddress(token.owner)}
            </p>
          </header>
          <PermanencePanel token={token} />
          <CertificateOfPermanence token={token} />
        </div>
      </div>
    </Section>
  );
}
