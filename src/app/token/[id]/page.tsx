import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Section, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Legacy token route. The canonical live token page is
 * `/token/onchain/[chainId]/[contract]/[tokenId]`. A live token id has the
 * shape `${chainId}-${contract}-${tokenId}` (decimal chain id, 0x-prefixed
 * 40-hex contract, decimal token id); when `[id]` matches that we permanently
 * route to the onchain page. Anything else is not a real token → empty state.
 */
const LIVE_ID_RE = /^(\d+)-(0x[0-9a-fA-F]{40})-(\d+)$/;

function onchainPath(id: string): string | null {
  const m = LIVE_ID_RE.exec(id);
  if (!m) return null;
  const [, chainId, contract, tokenId] = m;
  return `/token/onchain/${chainId}/${contract}/${tokenId}`;
}

export function generateMetadata(): Metadata {
  return { title: "Token · Perpetual" };
}

export default async function LegacyTokenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const dest = onchainPath(id);
  if (dest) redirect(dest);

  return (
    <Section>
      <EmptyState
        eyebrow="Token"
        title="Token not found"
        body="This artwork isn't available. Browse the live works on Explore to find a permanent piece."
      />
    </Section>
  );
}
