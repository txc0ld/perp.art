/**
 * ClosingCTA - artist-acquisition band (design prompt §4.1, §6 closing).
 * Enforced royalties + permanence, ending on a single primary action.
 */
import { Section, ButtonLink, MonoLabel } from "@/components/ui";
import { Reveal } from "./Reveal";
import { AmbientField } from "@/components/visual/AmbientField";

const POINTS = [
  { label: "Enforced royalties", detail: "ERC-2981 royalties honored at settlement - not optional, not bypassed." },
  { label: "Sovereign contracts", detail: "Deploy your own Forever Library contract. You own the rails, not us." },
  { label: "Permanent by default", detail: "Every mint is written across four immutable backends and proven onchain." },
];

export function ClosingCTA() {
  return (
    <Section className="py-0">
      <Reveal>
        <div className="relative isolate overflow-hidden rounded-[8px] border border-border">
          <AmbientField className="-z-10" />
          <div className="px-7 py-16 sm:px-12 sm:py-20 lg:px-16">
            <div className="max-w-2xl">
              <MonoLabel className="text-faint">For artists</MonoLabel>
              <h2 className="display-sm mt-4 text-foreground">
                Mint work that cannot quietly disappear.
              </h2>
              <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-muted">
                Perpetual is built for artists who treat their work as part of the record.
                Enforced royalties, sovereign contracts, and permanence that holds long
                after the marketplace does.
              </p>

              <dl className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
                {POINTS.map((p, i) => (
                  <Reveal key={p.label} delay={i * 80}>
                    <div className="border-l border-border pl-4">
                      <dt className="font-mono text-[11px] uppercase tracking-wider text-foreground">
                        {p.label}
                      </dt>
                      <dd className="mt-2 text-sm leading-relaxed text-muted">{p.detail}</dd>
                    </div>
                  </Reveal>
                ))}
              </dl>

              <div className="mt-11 flex flex-col gap-3 sm:flex-row sm:items-center">
                <ButtonLink href="/mint" variant="accent" size="lg">
                  Start creating
                </ButtonLink>
                <ButtonLink href="/permanence" variant="secondary" size="lg">
                  How permanence works
                </ButtonLink>
              </div>
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

export default ClosingCTA;
