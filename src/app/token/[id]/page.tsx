import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getToken,
  getAllTokens,
  getArtist,
  getCollection,
  getTokensByCollection,
  getSwapsForToken,
} from "@/lib/mock-data";
import { Section, SectionHeader, Badge, StatusGlyph } from "@/components/ui";
import { ArtTile } from "@/components/art/ArtTile";
import { ArtworkViewer } from "@/components/token/ArtworkViewer";
import { BuyPanel } from "@/components/token/BuyPanel";
import { PermanencePanel } from "@/components/token/PermanencePanel";
import { ProvenanceTimeline } from "@/components/token/ProvenanceTimeline";
import { TraitsGrid } from "@/components/token/TraitsGrid";
import { OffersList } from "@/components/token/OffersList";
import { Accordion } from "@/components/token/Accordion";
import { ItemTabs } from "@/components/token/ItemTabs";
import { ItemActions } from "@/components/token/ItemActions";
import { SectionNav } from "@/components/token/SectionNav";
import { TokenSwaps } from "@/components/token/TokenSwaps";
import {
  shortAddress,
  shortHash,
  bpsToPct,
  formatEth,
  cn,
} from "@/lib/utils";

/** Pre-render every known token route (PRD §10.4). */
export function generateStaticParams() {
  return getAllTokens().map((t) => ({ id: t.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const token = getToken(id);
  if (!token) return { title: "Artwork not found - Perpetual" };
  const artist = getArtist(token.artistHandle);
  const artistName = artist?.name ?? token.artistHandle;
  return {
    title: `${token.title} by ${artistName} · Perpetual`,
    description: `${token.title}, a permanent work by ${artistName}. Provenance recorded onchain and replicated across independent permanent backends, so it survives even if the operator disappears.`,
  };
}

/** Small mono key/value row used inside the Details + collection accordions. */
function DetailRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="font-mono text-[11px] uppercase tracking-wider text-faint">
        {label}
      </span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate font-mono text-[13px] tabular-nums text-muted transition-colors hover:text-accent"
        >
          {value}
        </a>
      ) : (
        <span className="truncate font-mono text-[13px] tabular-nums text-foreground">
          {value}
        </span>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-border bg-surface-2/40 px-3 py-2.5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-faint">{label}</p>
      <p className="mt-1 font-mono text-[13px] tabular-nums text-foreground">{value}</p>
    </div>
  );
}

/** Token / Artwork page - OpenSea item layout in the Perpetual dark + pink theme. */
export default async function TokenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const token = getToken(id);
  if (!token) notFound();

  const artist = getArtist(token.artistHandle);
  const collection = getCollection(token.collectionSlug);
  const siblings = getTokensByCollection(token.collectionSlug)
    .filter((t) => t.id !== token.id)
    .slice(0, 5);
  const swaps = getSwapsForToken(token.id);

  const chainLabel = token.chain === "ethereum" ? "Ethereum" : "Base";
  const verifiedShards = token.permanence.shards.filter(
    (s) => s.status === "verified",
  ).length;
  const allVerified =
    verifiedShards === token.permanence.shards.length &&
    token.permanence.contentHashMatches;

  // In-page sub-nav: only the sections actually rendered for this token.
  const navItems = [
    { id: "section-permanence", label: "Permanence" },
    ...(token.traits.length > 0
      ? [{ id: "section-traits", label: "Traits" }]
      : []),
    ...(collection ? [{ id: "section-about", label: "About" }] : []),
    { id: "section-details", label: "Details" },
    { id: "section-market", label: "Offers" },
    { id: "section-market", label: "Activity" },
  ].filter(
    // de-dupe the shared market anchor (Offers + Activity live in one section)
    (item, i, arr) => arr.findIndex((x) => x.label === item.label) === i,
  );

  return (
    <Section>
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-faint">
        <Link href="/explore" className="transition-colors hover:text-foreground">
          Explore
        </Link>
        <span>/</span>
        {collection && (
          <>
            <Link
              href={`/collections/${collection.slug}`}
              className="transition-colors hover:text-foreground"
            >
              {collection.name}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-muted">#{token.tokenId}</span>
      </nav>

      {/*
        Two-column on desktop: media + detail cards left (~58%), sticky buy box
        right (~42%). On mobile the single column reorders so the buy box sits
        right under the artwork - price and Buy stay reachable without scrolling
        past the long permanence/detail content.
      */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,58fr)_minmax(0,42fr)] lg:gap-x-10 lg:gap-y-4">
        {/* ---------------------------------------------------------------- */}
        {/* MEDIA - top-left, full width of the media column                  */}
        {/* ---------------------------------------------------------------- */}
        <div className="order-1 flex flex-col gap-4 lg:col-start-1 lg:row-start-1">
          <div className="animate-fade">
            <ArtworkViewer token={token} />
          </div>

          {/* In-page sub-nav - hidden on mobile (jumps belong below the buy box). */}
          <SectionNav items={navItems} className="mt-1 hidden lg:flex" />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* DETAIL CARDS - left column, below the media on desktop;           */}
        {/* on mobile they sit after the buy box (order-3).                   */}
        {/* ---------------------------------------------------------------- */}
        <div className="order-3 flex flex-col gap-4 lg:col-start-1 lg:row-start-2">
          {/* In-page sub-nav for mobile - sits just above the detail cards. */}
          <SectionNav items={navItems} className="lg:hidden" />

          {/* Permanence - the differentiator, default OPEN, brighter frame. */}
          <div className="animate-rise" style={{ animationDelay: "60ms" }}>
            <Accordion
              eyebrow="Permanence"
              title="Provably permanent"
              anchorId="section-permanence"
              defaultOpen
              bright
              icon={<StatusGlyph status="verified" className="h-4 w-4" />}
              badge={
                allVerified ? (
                  <Badge tone="accent">Verified</Badge>
                ) : (
                  <Badge tone="muted">
                    {verifiedShards}/{token.permanence.shards.length}
                  </Badge>
                )
              }
            >
              <PermanencePanel token={token} />
            </Accordion>
          </div>

          {/* Traits */}
          {token.traits.length > 0 && (
            <Accordion
              eyebrow="Traits"
              title="Attributes"
              anchorId="section-traits"
              defaultOpen
              badge={<Badge tone="muted">{token.traits.length}</Badge>}
            >
              <TraitsGrid traits={token.traits} />
            </Accordion>
          )}

          {/* About this collection */}
          {collection && (
            <Accordion
              eyebrow="About"
              title="The collection"
              anchorId="section-about"
            >
              <p className="max-w-2xl text-[14px] leading-relaxed text-muted">
                {collection.description}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <Stat label="Floor" value={`${formatEth(collection.floorEth)} ETH`} />
                <Stat label="Volume" value={`${formatEth(collection.volumeEth)} ETH`} />
                <Stat label="Items" value={collection.itemCount.toLocaleString()} />
                <Stat label="Owners" value={collection.ownerCount.toLocaleString()} />
              </div>
            </Accordion>
          )}

          {/* Details */}
          <Accordion eyebrow="Details" title="Onchain record" anchorId="section-details">
            <div className="divide-y divide-border">
              <DetailRow
                label="Contract"
                value={shortAddress(
                  collection?.contractAddress ?? token.royalty.receiver,
                )}
                href={`https://etherscan.io/address/${
                  collection?.contractAddress ?? token.royalty.receiver
                }`}
              />
              <DetailRow label="Token ID" value={`#${token.tokenId}`} />
              <DetailRow label="Token standard" value="ERC-721" />
              <DetailRow label="Chain" value={chainLabel} />
              <DetailRow
                label="Creator royalty"
                value={bpsToPct(token.royalty.bps)}
              />
              <DetailRow
                label="Metadata hash"
                value={shortHash(token.permanence.contentHash)}
              />
            </div>
          </Accordion>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* BUY BOX - right column on desktop (sticky), directly under the    */}
        {/* artwork on mobile (order-2) so price + Buy are reachable early.   */}
        {/* ---------------------------------------------------------------- */}
        <div className="order-2 flex flex-col gap-5 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-24 lg:self-start">
          {/* Collection + verified/sovereign */}
          <div className="animate-rise flex items-center justify-between gap-3">
            {collection ? (
              <Link
                href={`/collections/${collection.slug}`}
                className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-accent"
              >
                {collection.name}
                {artist?.verified && <StatusGlyph status="verified" />}
              </Link>
            ) : (
              <span />
            )}
            {collection?.sovereign && <Badge tone="muted">Sovereign</Badge>}
          </div>

          {/* Title + favorite/share */}
          <div className="animate-rise flex items-start justify-between gap-4">
            <h1 className="display-sm text-balance text-foreground">{token.title}</h1>
            <ItemActions />
          </div>

          {/* Provenance line */}
          <p className="animate-rise font-mono text-[12px] text-muted">
            Held by{" "}
            <span className="text-foreground">{shortAddress(token.owner)}</span>
          </p>

          {/* Price box + Buy / Make offer (existing BuyPanel/BuyModal) */}
          <div className="animate-rise" style={{ animationDelay: "60ms" }}>
            <BuyPanel token={token} />
          </div>

          {/* Compact survival reassurance, ties the buy box to permanence. */}
          <p
            className={cn(
              "animate-fade flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-faint",
            )}
            style={{ animationDelay: "120ms" }}
          >
            <StatusGlyph status="verified" />
            Endures even if Perpetual does not
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Full-width tabs: Offers / Activity                                  */}
      {/* ------------------------------------------------------------------ */}
      <div id="section-market" className="mt-16 scroll-mt-24 lg:mt-20">
        <ItemTabs
          tabs={[
            {
              key: "offers",
              label: "Offers",
              count: token.offers.length,
              panel: <OffersList offers={token.offers} />,
            },
            {
              key: "activity",
              label: "Activity",
              count: token.provenance.length,
              panel: <ProvenanceTimeline events={token.provenance} />,
            },
          ]}
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Swaps - NFT-for-NFT barter + cross-chain settlement                 */}
      {/* ------------------------------------------------------------------ */}
      <div id="section-swaps" className="mt-16 scroll-mt-24 lg:mt-20">
        <SectionHeader
          eyebrow="Trade"
          title="Swaps"
          description="Barter this work directly, no sale required. Offer a piece from your collection, balance value with ETH, and settle atomically, even across chains."
        />
        <TokenSwaps token={token} swaps={swaps} />
      </div>

      {/* More from this collection */}
      {siblings.length > 0 && (
        <div className="mt-16 lg:mt-20">
          <SectionHeader
            eyebrow="Collection"
            title={`More from ${collection?.name ?? "the collection"}`}
            action={
              collection && (
                <Link
                  href={`/collections/${collection.slug}`}
                  className="font-mono text-[11px] uppercase tracking-wider text-muted transition-colors hover:text-accent"
                >
                  View all
                </Link>
              )
            }
          />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5 lg:gap-5">
            {siblings.map((t, i) => (
              <div
                key={t.id}
                className="animate-rise"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <ArtTile token={t} />
              </div>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}
