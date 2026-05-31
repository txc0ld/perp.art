/**
 * PERPETUAL - Documentation hub (/docs)
 *
 * The definitive, on-site guide to how Perpetual works. A premium, editorial
 * long-form: a hero, a small stats strip, then a sticky in-page contents rail
 * beside anchored content sections. Server component throughout (no client
 * state); anchors are plain links, keyboard-navigable and honest.
 *
 * Brand voice: calm, archival, precise. Claim permanence, never a
 * decentralization the system has not built. Mono for every technical term.
 *
 * Sections (per scope):
 *   01 Overview              07 Verification features
 *   02 Permanence            08 ENS identities
 *   03 Networks              09 Sovereign contracts
 *   04 Trading               10 Indexer and rebuildability
 *   05 Cross-chain settlement 11 Getting started
 *   06 Royalties
 */
import type { Metadata } from "next";

import {
  Badge,
  ButtonLink,
  Divider,
  MonoLabel,
  StatusGlyph,
} from "@/components/ui";
import { getMarketStats, getChains } from "@/lib/mock-data";
import { DocsNav } from "@/components/docs/DocsNav";
import { Callout, DefRow, DocSection, Term } from "@/components/docs/DocsKit";

export const metadata: Metadata = {
  title: "Documentation - Perpetual",
  description:
    "The definitive guide to how Perpetual works: the five-shard permanence model — a mandatory SSTORE2 STATE shard plus a high-res LOG shard and three permanent off-chain copies — nine supported networks, NFT-for-NFT and criteria swaps, atomic cross-chain settlement, enforced ERC-2981 royalties, ENS identities, the Permanence Score, the Vanish Test, the Certificate of Permanence, sovereign contracts, and a rebuildable, public-data indexer.",
};

export default function DocsPage() {
  const stats = getMarketStats();
  const chains = getChains();

  const statStrip: Array<{ value: string; label: string }> = [
    { value: `${stats.permanenceIntegrity}%`, label: "Permanence integrity" },
    { value: `${stats.onchainProofRate}%`, label: "Onchain-proof coverage" },
    { value: stats.verifiedShards.toLocaleString(), label: "Verified shards" },
    { value: stats.works.toLocaleString(), label: "Works archived" },
  ];

  return (
    <>
      {/* ============================================================ */}
      {/* HERO                                                         */}
      {/* ============================================================ */}
      <section className="border-b border-border">
        <div className="mx-auto w-full max-w-[1600px] px-4 py-20 sm:px-6 lg:py-28">
          <div className="max-w-3xl">
            <MonoLabel className="text-faint">
              Documentation · How Perpetual works
            </MonoLabel>
            <h1 className="display-lg mt-6 text-foreground">
              The manual for art that outlasts its marketplace.
            </h1>
            <p className="mt-7 max-w-2xl text-[18px] leading-relaxed text-muted">
              Perpetual is a permanence-first NFT marketplace. Every artwork is
              provably permanent, and that permanence does not depend on
              Perpetual. This is the full, plain-language account of the storage
              model, the trading desk, settlement, royalties, and the invariant
              that holds all of it together. Verifiable claims only, documented
              in full.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <span className="inline-flex items-center gap-2">
                <StatusGlyph status="verified" />
                <span className="font-mono text-xs uppercase tracking-wider text-muted">
                  Non-custodial by design
                </span>
              </span>
              <span className="hidden h-3 w-px bg-border sm:block" aria-hidden />
              <span className="font-mono text-xs uppercase tracking-wider text-faint">
                Built on Forever Library · 9 networks
              </span>
            </div>
          </div>

          {/* Stats strip - the indexer's headline health numbers. */}
          <div className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-border bg-border sm:grid-cols-4">
            {statStrip.map((stat) => (
              <div key={stat.label} className="bg-surface px-5 py-6 sm:px-6">
                <p className="font-mono text-[24px] tabular-nums text-foreground sm:text-[28px]">
                  {stat.value}
                </p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-faint">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* BODY - sticky contents rail + anchored sections              */}
      {/* ============================================================ */}
      <div className="mx-auto w-full max-w-[1600px] px-4 py-16 sm:px-6 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-[240px_1fr] lg:gap-16">
          {/* Left rail */}
          <aside className="lg:order-1">
            <DocsNav />
          </aside>

          {/* Content column */}
          <div className="min-w-0 max-w-3xl space-y-20 lg:order-2">
            {/* ---------------------------------------------------- */}
            {/* 01 OVERVIEW                                          */}
            {/* ---------------------------------------------------- */}
            <DocSection
              id="overview"
              index="01"
              eyebrow="The thesis"
              title="Art, engineered to outlast everything."
              lede="Most NFTs store the token onchain and the artwork somewhere it can quietly disappear. When a pin lapses or a server goes dark, the chain still records that you own something that no longer resolves to anything. Perpetual exists to close that gap."
            >
              <p>
                The promise is narrow and exact: the artwork survives, and its
                survival does not depend on the operator. Ownership, provenance,
                and the work itself remain intact even if Perpetual disappears
                entirely. We claim permanence because the architecture
                guarantees it. We do not claim a decentralization we have not
                built.
              </p>
              <p>
                To keep that honest, the system is layered. The asset and its
                provenance are permanent and operator-independent. Settlement is
                onchain. The orderbook, the indexer, and this frontend are run
                conventionally, centralized for speed, because their failure can
                lose listings and search but can never touch your art or your
                ownership.
              </p>
              <Callout label="The one claim" accent>
                Every other marketplace&rsquo;s NFTs break when storage fails.
                Perpetual&rsquo;s cannot. That is the whole product, and the rest
                of this document is how it is enforced.
              </Callout>
            </DocSection>

            <Divider />

            {/* ---------------------------------------------------- */}
            {/* 02 PERMANENCE                                        */}
            {/* ---------------------------------------------------- */}
            <DocSection
              id="permanence"
              index="02"
              eyebrow="The storage model"
              title="Five parallel shards. One consensus-guaranteed backstop."
              lede={
                <>
                  Each token carries five parallel, independently-verifiable
                  shards across independent storage backends. Four add resolution
                  and redundancy. <Term>shard 0</Term> — the STATE shard, written
                  on-chain via <Term>SSTORE2</Term> — is the only one permanence
                  actually requires.
                </>
              }
            >
              <div className="rounded-[10px] border border-border bg-surface px-5 py-2 sm:px-6">
                <DefRow term="shard 0 · STATE (SSTORE2)" glyph={<StatusGlyph status="verified" />}>
                  The consensus-guaranteed backstop. A low-res canonical image
                  written on-chain as contract bytecode via <Term>SSTORE2</Term>{" "}
                  inside the ForeverLibrary contract. Its content hash is computed
                  on-chain. Lives in contract state — cannot be pruned.{" "}
                  <span className="text-foreground">
                    Mandatory for every listed token.
                  </span>
                </DefRow>
                <DefRow term="shard 1 · LOG (LogLedger)" glyph={<StatusGlyph status="verified" />}>
                  The high-resolution primary copy. Full-resolution media stored
                  cheaply in event logs via a standalone <Term>LogLedger</Term>{" "}
                  contract (~8 gas/byte); only a Merkle root + size live in
                  contract state. Root-verifiable by anyone; retention-monitored
                  (nodes may prune historical logs per EIP-4444), backstopped by
                  the STATE shard. Cost-efficient, not consensus-guaranteed.
                </DefRow>
                <DefRow term="shard 2 · IPFS" glyph={<StatusGlyph status="verified" />}>
                  Content-addressed redundant off-chain copy, pinned via Pinata,
                  referenced by <Term>CID</Term>. Fast to serve; backstopped if a
                  pin ever lapses.
                </DefRow>
                <DefRow term="shard 3 · Arweave" glyph={<StatusGlyph status="verified" />}>
                  Pay-once permanent storage. An architecturally distinct,
                  independent permanence layer.
                </DefRow>
                <DefRow term="shard 4 · Irys" glyph={<StatusGlyph status="verified" />}>
                  Additional permanent redundancy on the Datachain. A separate
                  operator and separate failure domain from Arweave.
                </DefRow>
              </div>

              <p>
                No token is listable unless <Term>shard0Configured(tokenId)</Term>{" "}
                is true and its content hash matches the record written onchain at
                mint. Every shard&rsquo;s content is hashed, and that hash is
                anchored onchain, so resolution and integrity can be checked
                against an immutable reference.
              </p>

              <h3 className="pt-2 font-brand text-[17px] font-semibold text-foreground">
                The verification service
              </h3>
              <p>
                A read-only service continuously resolves every shard, hashes
                what it gets back, and compares that hash against the onchain
                record. It reads only public data, so anyone can run the same
                checks and reach the same result. The per-token{" "}
                <span className="text-foreground">Permanence Status</span> panel
                on each token page surfaces this live, with every row linking to
                its raw source. Do not trust us; reproduce it.
              </p>

              <Callout label="Why shard 0 is the guarantee" accent>
                Because the STATE shard (SSTORE2) is consensus-guaranteed and
                lives in contract state, it is the permanence backstop on its own.
                The LOG shard and off-chain copies are cost-efficient performance
                and redundancy layers, not permanence obligations. If Perpetual
                stops paying for pinning, permanence is unaffected. Permanence is
                decoupled from operator solvency.
              </Callout>

              <p className="text-sm">
                <ButtonLink href="/permanence" variant="ghost" size="sm" className="-ml-3">
                  Read the full permanence explainer →
                </ButtonLink>
              </p>
            </DocSection>

            <Divider />

            {/* ---------------------------------------------------- */}
            {/* 03 NETWORKS                                          */}
            {/* ---------------------------------------------------- */}
            <DocSection
              id="networks"
              index="03"
              eyebrow="One-stop shop"
              title="Nine networks, one marketplace."
              lede="Perpetual indexes and trades across nine networks. Six are EVM chains where Forever Library deploys and permanence is native; three are non-EVM chains that are indexed and traded using their native storage. Every price is shown in the chain's own currency."
            >
              <p>
                Discovery is unified. Explore, rankings, and market stats filter
                across all nine networks at once, so the marketplace reads as one
                place rather than nine. Each token carries its chain, and prices
                render in that chain&rsquo;s native currency rather than a single
                normalized unit.
              </p>

              <h3 className="font-brand text-[17px] font-semibold text-foreground">
                Permanence-native (EVM)
              </h3>
              <p>
                On these chains the full permanence model applies directly:
                Forever Library deploys here, and the mandatory{" "}
                <Term>shard 0</Term> onchain proof is written natively.
              </p>
              <div className="rounded-[10px] border border-border bg-surface px-5 py-2 sm:px-6">
                {chains
                  .filter((c) => c.permanenceNative)
                  .map((c) => (
                    <DefRow
                      key={c.id}
                      term={c.label}
                      glyph={<StatusGlyph status="verified" />}
                    >
                      Native currency <Term>{c.currency}</Term>. Forever Library
                      and settlement deploy here; permanence is native.
                    </DefRow>
                  ))}
              </div>

              <h3 className="pt-2 font-brand text-[17px] font-semibold text-foreground">
                Indexed and traded (non-EVM)
              </h3>
              <p>
                These chains are indexed and traded using their native storage and
                provenance. They participate in discovery and in cross-chain
                swaps, settling against the escrow bridge.
              </p>
              <div className="rounded-[10px] border border-border bg-surface px-5 py-2 sm:px-6">
                {chains
                  .filter((c) => !c.permanenceNative)
                  .map((c) => (
                    <DefRow key={c.id} term={c.label}>
                      Native currency <Term>{c.currency}</Term>. Indexed and
                      traded with native storage.
                    </DefRow>
                  ))}
              </div>
            </DocSection>

            <Divider />

            {/* ---------------------------------------------------- */}
            {/* 04 TRADING                                           */}
            {/* ---------------------------------------------------- */}
            <DocSection
              id="trading"
              index="04"
              eyebrow="The trading desk"
              title="List, offer, and swap, gaslessly."
              lede="Listings and offers are signed messages, settled onchain only when filled, so listing costs no gas. Beyond fixed price, Perpetual restores barter: the NFT-for-NFT trading OpenSea abandoned."
            >
              <h3 className="font-brand text-[17px] font-semibold text-foreground">
                Fixed-price listings and offers
              </h3>
              <p>
                List a token at a fixed price, or make an offer on one that is
                not listed. Orders are valid onchain regardless of orderbook
                availability, so a sophisticated buyer could fill an order
                directly against the settlement contract even if the orderbook
                were down.
              </p>

              <h3 className="pt-2 font-brand text-[17px] font-semibold text-foreground">
                Swap types
              </h3>
              <div className="rounded-[10px] border border-border bg-surface px-5 py-2 sm:px-6">
                <DefRow term="NFT-for-NFT">
                  Propose a barter: your tokens for theirs, with optional{" "}
                  <Term>ETH</Term> added on either side to balance value. A pure
                  trade, or a trade plus a top-up, in one order.
                </DefRow>
                <DefRow term="Criteria swap">
                  Offer against a collection or a trait rather than a specific
                  token: &ldquo;any token from this collection, optionally with
                  this trait, for mine.&rdquo; The counterparty chooses which
                  qualifying token fills it.
                </DefRow>
              </div>
              <p>
                Every incoming proposal can be accepted, declined, or countered.
                A counter re-opens the terms; nothing moves until both sides have
                signed and the trade settles atomically.
              </p>
              <p className="text-sm">
                <ButtonLink href="/swaps" variant="ghost" size="sm" className="-ml-3">
                  Open the swaps desk →
                </ButtonLink>
              </p>
            </DocSection>

            <Divider />

            {/* ---------------------------------------------------- */}
            {/* 05 CROSS-CHAIN SETTLEMENT                            */}
            {/* ---------------------------------------------------- */}
            <DocSection
              id="settlement"
              index="05"
              eyebrow="Cross-chain settlement"
              title="Any two of nine chains, settled atomically."
              lede="Most trades settle on a single chain. When the two sides of a swap live on different networks, anywhere across the nine supported chains, the trade settles atomically through an escrow bridge rather than as two separate, trust-dependent transfers."
            >
              <p>
                A cross-chain trade proceeds in order: lock the asset on chain A,
                release the counter-asset on chain B, and on any failure, roll
                back. There is no intermediate state where one side has parted
                with value and the other has not. Either the whole trade
                completes, or nothing moves.
              </p>
              <div className="rounded-[10px] border border-border bg-surface px-5 py-2 sm:px-6">
                <DefRow term="1 · lock" glyph={<StatusGlyph status="verified" />}>
                  The asset on chain A is locked in escrow.
                </DefRow>
                <DefRow term="2 · release" glyph={<StatusGlyph status="verified" />}>
                  The counter-asset is released on chain B.
                </DefRow>
                <DefRow term="3 · rollback" glyph={<StatusGlyph status="failed" />}>
                  If either leg fails, the escrow unwinds and both sides keep what
                  they started with.
                </DefRow>
              </div>
              <Callout label="Shown before you sign">
                The bridge fee for a cross-chain trade is displayed at the point
                of trade, alongside the protocol fee and royalty, before you
                confirm anything. No hidden costs at settlement.
              </Callout>
            </DocSection>

            <Divider />

            {/* ---------------------------------------------------- */}
            {/* 06 ROYALTIES                                         */}
            {/* ---------------------------------------------------- */}
            <DocSection
              id="royalties"
              index="06"
              eyebrow="Enforced royalties"
              title="Enforced at settlement, not optional."
              lede={
                <>
                  Royalties are checked at the protocol level via{" "}
                  <Term>ERC-2981</Term>, against the token&rsquo;s onchain
                  configuration. A sale that does not honor the artist&rsquo;s
                  royalty is rejected by the settlement contract itself.
                </>
              }
            >
              <p>
                The royalty is set per token by the artist at mint and read at
                settlement via <Term>royaltyInfo()</Term>. This is not a
                marketplace toggle and not an honor system. There is no setting
                that turns it off, because enforcement lives in the contract, not
                in the interface.
              </p>
              <Callout label="The guarantee" accent>
                Dishonored royalty, settlement rejected. Enforcement is a hard
                protocol-level property, the same on Perpetual as on any client
                that fills these orders.
              </Callout>
            </DocSection>

            <Divider />

            {/* ---------------------------------------------------- */}
            {/* 07 VERIFICATION FEATURES                             */}
            {/* ---------------------------------------------------- */}
            <DocSection
              id="verification"
              index="07"
              eyebrow="Verification-backed features"
              title="Permanence you can grade, test, and keep."
              lede="The same read-only verification that powers the Permanence Status panel feeds three further surfaces. Each is data-backed, never decorative, and reproducible from public sources."
            >
              <div className="rounded-[10px] border border-border bg-surface px-5 py-2 sm:px-6">
                <DefRow term="Permanence Score" glyph={<StatusGlyph status="verified" />}>
                  A graded score per token, up to <Term>A+</Term>, computed from
                  the verified onchain proof, the content-hash match, redundant
                  permanent copies, and lock state. Shown as a badge and a detail
                  card. Your profile rolls every holding into a portfolio{" "}
                  <span className="text-foreground">Permanence Report</span>.
                </DefRow>
                <DefRow term="The Vanish Test">
                  An interactive proof on each token page. It simulates the
                  operator-dependent layers, the Perpetual indexer, the CDN
                  mirror, then even the IPFS pin, going offline one by one, while{" "}
                  <Term>shard 0</Term> stays lit and keeps resolving the artwork
                  from Ethereum itself. It is reduced-motion safe.
                </DefRow>
                <DefRow term="Certificate of Permanence">
                  A downloadable <Term>SVG</Term> certificate per token, carrying
                  the title, artist, token id, content hash, the shard list, mint
                  date, and the permanence grade. An archival record a collector
                  can keep independently of the marketplace.
                </DefRow>
              </div>
              <p className="text-sm">
                <ButtonLink href="/permanence" variant="ghost" size="sm" className="-ml-3">
                  Read the full permanence explainer →
                </ButtonLink>
              </p>
            </DocSection>

            <Divider />

            {/* ---------------------------------------------------- */}
            {/* 08 ENS IDENTITIES                                    */}
            {/* ---------------------------------------------------- */}
            <DocSection
              id="identities"
              index="08"
              eyebrow="Human-readable identities"
              title="Addresses resolve to names."
              lede={
                <>
                  Where an address has a primary <Term>ENS</Term> name, Perpetual
                  shows the name instead of raw hex, across profiles, swaps,
                  provenance, offers, and activity. Wallets without a name fall
                  back to a short, copyable address.
                </>
              }
            >
              <p>
                Resolution is presentational only. The underlying address is
                always the source of truth for ownership and settlement, and the
                interface never relies on a name to move value. Identity makes the
                marketplace legible without weakening any onchain guarantee.
              </p>
            </DocSection>

            <Divider />

            {/* ---------------------------------------------------- */}
            {/* 09 SOVEREIGN CONTRACTS                               */}
            {/* ---------------------------------------------------- */}
            <DocSection
              id="sovereign"
              index="09"
              eyebrow="Artist sovereignty"
              title="Deploy and own your contract outright."
              lede="Artists can deploy their own Forever Library contract instance rather than minting into a shared marketplace contract. They own it outright, and they can leave with it intact."
            >
              <p>
                A sovereign contract is yours. Perpetual indexes it the same way
                it indexes native mints, as a federated index over independently
                owned contracts. Nothing about your collection is held hostage by
                the marketplace: if you leave, your contract, your tokens, their
                provenance, and their permanence all leave with you, unchanged.
              </p>
              <p>
                This is the difference between renting space on a platform and
                owning the building. The marketplace becomes one client of your
                contract, not its landlord.
              </p>
            </DocSection>

            <Divider />

            {/* ---------------------------------------------------- */}
            {/* 10 INDEXER AND REBUILDABILITY                        */}
            {/* ---------------------------------------------------- */}
            <DocSection
              id="indexer"
              index="10"
              eyebrow="The published indexer"
              title="The index is public infrastructure, not a moat."
              lede="The indexer reads only public onchain data and public storage networks. No proprietary input is required to reconstruct it, and the schema is published in full so anyone can run their own."
            >
              <p>
                That openness is what makes the central promise enforceable
                rather than merely stated. Because the index can be rebuilt from
                public sources alone, the marketplace is not a single point of
                failure for discovery any more than it is for storage.
              </p>
              <Callout label="The architectural invariant" accent>
                Perpetual can vanish entirely and every NFT remains: owned by the
                correct wallet, resolving to its artwork via the onchain proof
                shard, with complete provenance. A third party can re-index the
                public contracts and stand up a replacement marketplace with zero
                cooperation from us. The operator can disappear; the assets
                remain; the marketplace is rebuildable.
              </Callout>
              <p className="text-sm">
                <ButtonLink href="/permanence#indexer" variant="ghost" size="sm" className="-ml-3">
                  See the indexer spec →
                </ButtonLink>
              </p>
            </DocSection>

            <Divider />

            {/* ---------------------------------------------------- */}
            {/* 11 GETTING STARTED                                   */}
            {/* ---------------------------------------------------- */}
            <DocSection
              id="getting-started"
              index="11"
              eyebrow="Getting started"
              title="Connect, mint, trade."
              lede="Three steps to using Perpetual. The marketplace is non-custodial throughout: it never takes custody of your assets or funds."
            >
              <ol className="space-y-4">
                <li className="flex gap-4">
                  <span className="mt-0.5 font-mono text-[12px] text-accent">01</span>
                  <p>
                    <span className="text-foreground">Connect a wallet.</span>{" "}
                    Sign in with any standard wallet. Connection is
                    non-custodial; you keep your keys, and signing a listing or
                    swap costs no gas until it fills.
                  </p>
                </li>
                <li className="flex gap-4">
                  <span className="mt-0.5 font-mono text-[12px] text-accent">02</span>
                  <p>
                    <span className="text-foreground">Mint with shards.</span>{" "}
                    Upload your work (up to ~100 MB), set the royalty, and
                    configure permanence. The mandatory <Term>shard 0</Term>{" "}
                    STATE shard (SSTORE2) is auto-configured; the LOG shard plus
                    IPFS, Arweave, and Irys copies are added by default.
                    Optionally lock the shards for guaranteed immutability.
                  </p>
                </li>
                <li className="flex gap-4">
                  <span className="mt-0.5 font-mono text-[12px] text-accent">03</span>
                  <p>
                    <span className="text-foreground">
                      Buy, offer, or swap.
                    </span>{" "}
                    Purchase at a fixed price, make an offer, or propose an
                    NFT-for-NFT or criteria swap. Fees and royalties, and any
                    bridge fee on a cross-chain trade, are shown before you
                    confirm.
                  </p>
                </li>
              </ol>

              <div className="flex flex-col gap-3 pt-3 sm:flex-row">
                <ButtonLink href="/connect" variant="accent">
                  Connect a wallet
                </ButtonLink>
                <ButtonLink href="/mint" variant="secondary">
                  Mint permanent art
                </ButtonLink>
                <ButtonLink href="/explore" variant="ghost">
                  Explore the collection
                </ButtonLink>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Badge tone="muted">Non-custodial</Badge>
                <Badge tone="muted">Gasless listings</Badge>
                <Badge tone="verify">Royalties enforced</Badge>
              </div>

              <Callout label="Local development">
                Minting, the on-chain read layer, the lite indexer, and
                fixed-price trading are live on testnet. Locally, the demo
                gallery (deterministic in-memory data) runs with no
                configuration required. To wire the full live stack — per-chain
                RPCs, WalletConnect, deployed contracts, the bridge, the indexer
                and database, storage providers, and ENS — every variable is
                documented in <Term>.env.example</Term>.
              </Callout>
            </DocSection>
          </div>
        </div>
      </div>

      <div className="h-8 sm:h-16" />
    </>
  );
}
