/**
 * PERPETUAL - How permanence works (/permanence)
 *
 * The brand's thesis made visible: an honest, marketing-grade explainer proving
 * the permanence story. Server component throughout; only the verification-flow
 * visual is interactive ("use client"). Honest-claims tone (PRD §5.2) - claim
 * permanence, never false decentralization.
 *
 * Sections (PRD §2, §6.1, §7.2, §8.2, §9.3, §9.4, §13.3, §18):
 *   1. Hero - AmbientField behind the thesis statement
 *   2. The problem - the storage-failure epidemic
 *   3. URI sharding model - the five shards as a layered diagram
 *   4. Verification service (#verify) - the read-only, reproducible checks
 *   5. The architectural invariant - the centerpiece pledge
 *   6. Indexer spec (#indexer) - published, public-data-only schema
 *   7. Royalties (#royalties) - enforced at settlement, protocol level
 *   8. Stats + closing CTA
 */
import type { Metadata } from "next";

import { AmbientField } from "@/components/visual/AmbientField";
import {
  Badge,
  ButtonLink,
  Divider,
  MonoLabel,
  MonoValue,
  Section,
  SectionHeader,
  StatusGlyph,
  Surface,
} from "@/components/ui";
import { getMarketStats } from "@/lib/mock-data";

import { ProblemSection } from "@/components/permanence/ProblemSection";
import { ShardDiagram } from "@/components/permanence/ShardDiagram";
import { ShardStack3D } from "@/components/permanence/ShardStack3D";
import { VerificationFlow } from "@/components/permanence/VerificationFlow";
import { IndexerSpec } from "@/components/permanence/IndexerSpec";

export const metadata: Metadata = {
  title: "How permanence works - Perpetual",
  description:
    "How Perpetual keeps every artwork provably permanent, independent of Perpetual itself. A mandatory onchain proof shard, a read-only verification service anyone can reproduce, and a published indexer schema, documented in full.",
};

export default function PermanencePage() {
  const stats = getMarketStats();

  return (
    <>
      {/* ============================================================ */}
      {/* 1 - HERO                                                     */}
      {/* ============================================================ */}
      <section className="relative isolate overflow-hidden border-b border-border">
        <AmbientField className="-z-10" />
        {/* Hairline grid raked into depth - a quiet floor plane behind the thesis. */}
        <div
          aria-hidden
          className="perspective-1400 pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <div
            className="preserve-3d absolute inset-x-[-20%] bottom-[-30%] top-[10%] opacity-[0.05]"
            style={{
              transform: "rotateX(62deg)",
              transformOrigin: "center bottom",
              backgroundImage:
                "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
              backgroundSize: "88px 88px",
              maskImage:
                "radial-gradient(120% 90% at 50% 100%, #000 20%, transparent 75%)",
              WebkitMaskImage:
                "radial-gradient(120% 90% at 50% 100%, #000 20%, transparent 75%)",
            }}
          />
        </div>

        <div className="mx-auto w-full max-w-[1320px] px-6 py-28 sm:px-8 lg:py-36">
          <div className="max-w-3xl">
            <div className="animate-rise" style={{ animationDelay: "40ms" }}>
              <MonoLabel className="text-faint">
                Documentation · Permanence, made verifiable
              </MonoLabel>
            </div>

            <h1 className="display-lg mt-6 text-foreground">
              <span className="block overflow-hidden">
                <span
                  className="animate-reveal block"
                  style={{ animationDelay: "120ms" }}
                >
                  The art cannot die.
                </span>
              </span>
            </h1>

            <p
              className="animate-rise mt-7 max-w-2xl text-[18px] leading-relaxed text-muted"
              style={{ animationDelay: "320ms" }}
            >
              Every artwork on Perpetual is provably permanent, and that permanence
              does not depend on Perpetual. A mandatory on-chain STATE shard
              (SSTORE2) anchors each token to Ethereum. Anyone can reproduce the
              verification, and the entire index can be rebuilt from public data
              alone. This page explains, precisely, how.
            </p>

            <div
              className="animate-fade mt-9 flex flex-wrap items-center gap-x-6 gap-y-3"
              style={{ animationDelay: "520ms" }}
            >
              <span className="inline-flex items-center gap-2">
                <StatusGlyph status="verified" />
                <span className="font-mono text-xs uppercase tracking-wider text-muted">
                  {stats.permanenceIntegrity}% permanence integrity
                </span>
              </span>
              <span className="hidden h-3 w-px bg-border sm:block" aria-hidden />
              <span className="font-mono text-xs uppercase tracking-wider text-faint">
                {stats.onchainProofRate}% onchain-proof coverage
              </span>
            </div>

            {/* honest-claims note */}
            <p
              className="animate-fade mt-8 max-w-xl text-sm leading-relaxed text-faint"
              style={{ animationDelay: "640ms" }}
            >
              We claim exactly one thing, and we claim it precisely: the artwork
              survives. The orderbook and index are run conventionally, centralized
              for speed, and their failure can never touch your art or your ownership.
              We do not claim a decentralization we have not built.
            </p>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* 2 - THE PROBLEM                                              */}
      {/* ============================================================ */}
      <Section>
        <SectionHeader
          eyebrow="The problem"
          title="Most NFT art is one missed invoice from gone."
          description="The token lives on Ethereum forever. The file it points to usually does not. When a pin lapses or a server goes dark, the chain still records your ownership of something that no longer resolves to anything."
        />
        <div className="mt-12">
          <ProblemSection />
        </div>
      </Section>

      <div className="mx-auto w-full max-w-[1320px] px-6 sm:px-8">
        <Divider />
      </div>

      {/* ============================================================ */}
      {/* 3 - URI SHARDING MODEL                                       */}
      {/* ============================================================ */}
      <Section>
        <SectionHeader
          eyebrow="The storage model"
          title="Five parallel shards. One consensus-guaranteed backstop."
          description="Each token carries five parallel, independently-verifiable shards across independent storage backends. Four add resolution and redundancy. Shard 0 — the STATE shard, stored on-chain via SSTORE2 — is the consensus-guaranteed permanence backstop, and the only one permanence actually requires."
        />
        {/* The signature visual: shards as translucent planes stacked in depth. */}
        <div className="mt-12">
          <ShardStack3D />
        </div>

        {/* The authoritative, plain-language legend (documented in full). */}
        <div className="mt-14">
          <ShardDiagram />
        </div>

        {/* §13.3 - permanence decoupled from operator solvency */}
        <Surface className="mt-12 p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="accent">Shard 0 is the guarantee</Badge>
            <MonoLabel className="text-faint">Why this holds</MonoLabel>
          </div>
          <p className="mt-4 max-w-3xl text-[16px] leading-relaxed text-muted">
            Because the STATE shard (SSTORE2) is consensus-guaranteed and lives
            in contract state, it is the permanence backstop on its own. The LOG
            shard and off-chain copies (IPFS, Arweave, Irys) are{" "}
            <span className="text-foreground">performance and redundancy
            optimizations, not permanence obligations</span>. If Perpetual stops
            paying for pinning, permanence is unaffected. This is the point most
            architectures miss: permanence is decoupled from operator solvency.
            The art does not depend on us staying in business.
          </p>
        </Surface>
      </Section>

      <div className="mx-auto w-full max-w-[1320px] px-6 sm:px-8">
        <Divider />
      </div>

      {/* ============================================================ */}
      {/* 4 - VERIFICATION SERVICE                                     */}
      {/* ============================================================ */}
      <Section id="verify">
        <SectionHeader
          eyebrow="The verification service"
          title="Do not trust us. Reproduce it."
          description="A read-only service continuously resolves every shard, hashes the content it gets back, and compares that hash against the record written onchain at mint. It reads only public data, so anyone can run the exact same checks and arrive at the exact same result. Verifiability, not our word."
        />
        <div className="mt-12">
          <VerificationFlow />
        </div>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-wider text-faint">
          read-only · independently reproducible · no proprietary inputs
        </p>
      </Section>

      <div className="mx-auto w-full max-w-[1320px] px-6 sm:px-8">
        <Divider />
      </div>

      {/* ============================================================ */}
      {/* 5 - THE ARCHITECTURAL INVARIANT (centerpiece)               */}
      {/* ============================================================ */}
      <Section>
        <Surface className="relative overflow-hidden p-8 sm:p-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-px -z-0 opacity-40"
            style={{
              background:
                "radial-gradient(80% 120% at 0% 0%, rgba(254,147,237,0.08), transparent 60%)",
            }}
          />
          <div className="relative">
            <MonoLabel className="text-accent">
              The architectural invariant
            </MonoLabel>
            <blockquote className="mt-6 max-w-4xl text-balance text-[22px] font-medium leading-snug text-foreground sm:text-[28px]">
              &ldquo;Perpetual can disappear entirely and every NFT remains fully
              intact: owned by the correct wallet, resolving to its artwork via
              the onchain proof shard, with complete provenance. A third party can
              re-index the contracts and stand up a replacement marketplace with
              zero cooperation from us.&rdquo;
            </blockquote>
            <p className="mt-8 max-w-2xl text-[16px] leading-relaxed text-muted">
              This is not a feature of Perpetual. It is the property Perpetual exists
              to preserve. Every decision on this page is tested against the sentence
              above. If a choice could break it, the choice does not ship.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { label: "Ownership", detail: "stays onchain, always correct" },
                { label: "Artwork", detail: "resolves via Shard 0, forever" },
                { label: "Provenance", detail: "complete, public, rebuildable" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-[8px] border border-border bg-background/40 px-4 py-4"
                >
                  <div className="flex items-center gap-2">
                    <StatusGlyph status="verified" />
                    <span className="text-sm font-medium text-foreground">
                      {item.label}
                    </span>
                  </div>
                  <p className="mt-1.5 font-mono text-[11px] text-faint">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Surface>
      </Section>

      <div className="mx-auto w-full max-w-[1320px] px-6 sm:px-8">
        <Divider />
      </div>

      {/* ============================================================ */}
      {/* 6 - INDEXER SPEC                                             */}
      {/* ============================================================ */}
      <Section id="indexer">
        <SectionHeader
          eyebrow="The published indexer spec"
          title="The index is public infrastructure, not a moat."
          description="The indexer reads only public onchain and storage data, and its schema is published in full. Anyone can run their own against the same sources. That openness is precisely what makes the invariant enforceable rather than merely promised."
        />
        <div className="mt-12">
          <IndexerSpec />
        </div>
      </Section>

      <div className="mx-auto w-full max-w-[1320px] px-6 sm:px-8">
        <Divider />
      </div>

      {/* ============================================================ */}
      {/* 7 - ROYALTIES                                               */}
      {/* ============================================================ */}
      <Section id="royalties">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <SectionHeader
            eyebrow="Enforced royalties"
            title="Enforced at settlement. Not optional."
            description="Royalties are checked at the protocol level, via ERC-2981, against the token's onchain configuration. A sale that does not honor the artist's royalty is rejected by the settlement contract itself. There is no marketplace toggle that turns this off."
          />
          <div className="flex flex-col justify-center gap-4">
            <div className="rounded-[8px] border border-border bg-surface px-5 py-4">
              <div className="flex items-center justify-between">
                <MonoLabel className="text-muted">Protocol-level guarantee</MonoLabel>
                <StatusGlyph status="verified" />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Not a UI suggestion, not an honor system. The contract enforces it
                on every fill.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-[8px] border border-border bg-surface px-5 py-4">
                <MonoLabel className="text-faint">Lookup</MonoLabel>
                <MonoValue className="mt-2 block text-foreground">
                  royaltyInfo()
                </MonoValue>
              </div>
              <div className="rounded-[8px] border border-border bg-surface px-5 py-4">
                <MonoLabel className="text-faint">Standard</MonoLabel>
                <MonoValue className="mt-2 block text-foreground">ERC-2981</MonoValue>
              </div>
            </div>
            <p className="font-mono text-[11px] uppercase tracking-wider text-faint">
              dishonored royalty → settlement rejected
            </p>
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/* 8 - STATS + CLOSING CTA                                      */}
      {/* ============================================================ */}
      <Section className="pt-4">
        <Surface className="overflow-hidden">
          {/* stat band */}
          <div className="grid grid-cols-2 divide-x divide-border border-b border-border sm:grid-cols-4 sm:divide-y-0">
            {[
              { value: `${stats.permanenceIntegrity}%`, label: "Permanence integrity" },
              { value: `${stats.onchainProofRate}%`, label: "Onchain-proof coverage" },
              { value: stats.verifiedShards.toLocaleString(), label: "Verified shards" },
              { value: stats.works.toLocaleString(), label: "Works archived" },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={`px-5 py-7 sm:px-6 ${i >= 2 ? "border-t border-border sm:border-t-0" : ""}`}
              >
                <p className="font-mono text-[26px] tabular-nums text-foreground sm:text-[30px]">
                  {stat.value}
                </p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-faint">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          {/* closing CTA */}
          <div className="flex flex-col items-start gap-6 px-6 py-10 sm:px-10 sm:py-12 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 className="display-sm text-foreground">
                The art survives, even if Perpetual does not.
              </h2>
              <p className="mt-3 text-[16px] leading-relaxed text-muted">
                Browse work engineered to outlast its marketplace, or mint your
                own onto a record that cannot be revoked.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <ButtonLink href="/explore" variant="accent" size="lg">
                Explore the collection
              </ButtonLink>
              <ButtonLink href="/mint" variant="secondary" size="lg">
                Mint permanent art
              </ButtonLink>
            </div>
          </div>
        </Surface>
      </Section>

      <div className="h-12 sm:h-20" />
    </>
  );
}
