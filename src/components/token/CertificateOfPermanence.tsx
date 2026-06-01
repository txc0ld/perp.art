"use client";

/**
 * CertificateOfPermanence - an archival SVG certificate a collector would
 * actually want to keep. Carries the title, artist (ENS/name), token id,
 * content hash, the shard list with backends, mint date, the permanence grade,
 * the fixed-point brand mark, and the line "This artwork survives even if
 * perpetual.art disappears."
 *
 * One SVG string serves both the on-page preview and the download (serialized
 * to a Blob, saved as certificate-{tokenId}.svg). Generated on the client so
 * the download wiring stays self-contained; the SVG itself is deterministic.
 *
 * On-brand: near-black, hairline rules, mono technical values, a single accent
 * touch on the fixed-point mark and the grade.
 */
import * as React from "react";
import type { Token } from "@/lib/types";
import { permanenceScore } from "@/lib/permanence";
import { getChainMeta } from "@/lib/chains";
import { useEnsName } from "@/lib/use-ens";
import { displayName } from "@/lib/ens";
import { Button } from "@/components/ui";
import { shortAddress, shortHash, cn } from "@/lib/utils";

const BACKEND_LABEL: Record<string, string> = {
  onchain: "Onchain STATE (SSTORE2)",
  log: "Onchain LOG (high-res)",
  ipfs: "IPFS",
  arweave: "Arweave",
  irys: "Irys",
  cdn: "CDN",
};

/** XML-escape for safe interpolation into SVG text nodes. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface CertData {
  title: string;
  artist: string;
  tokenId: number;
  contractLabel: string;
  contentHash: string;
  shards: Array<{ label: string; status: string }>;
  mintDate: string;
  grade: string;
  score: number;
  chain: string;
}

function buildCertData(token: Token, artistName: string): CertData {
  const { grade, score } = permanenceScore(token);
  const mintEvent = token.provenance.find((e) => e.kind === "minted");
  const mintDate = mintEvent
    ? new Date(mintEvent.timestamp).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";
  return {
    title: token.title,
    artist: artistName,
    tokenId: token.tokenId,
    contractLabel: shortAddress(token.royalty.receiver),
    contentHash: shortHash(token.permanence.contentHash, 10),
    shards: token.permanence.shards.map((s) => ({
      label: BACKEND_LABEL[s.backend] ?? s.label,
      status: s.status,
    })),
    mintDate,
    grade,
    score,
    chain: getChainMeta(token.chain).label,
  };
}

/** The certificate as a standalone SVG string (used for both preview and download). */
function buildSvg(d: CertData): string {
  const W = 820;
  const H = 1100;
  const PINK = "#fe93ed";
  const BG = "#050505";
  const SURFACE = "#18181b";
  const BORDER = "#3f3f46";
  const FG = "#ffffff";
  const MUTED = "#a1a1aa";
  const FAINT = "#8b8b93";

  // Shard rows
  const shardStartY = 690;
  const rowH = 40;
  const shardRows = d.shards
    .map((s, i) => {
      const y = shardStartY + i * rowH;
      const ok = s.status === "verified";
      const dot = ok ? PINK : FAINT;
      const statusLabel = ok ? "VERIFIED" : "BACKSTOPPED";
      return `
    <g>
      <circle cx="78" cy="${y - 4}" r="3.5" fill="${dot}"/>
      <text x="98" y="${y}" font-family="'JetBrains Mono', monospace" font-size="14" fill="${FG}">${esc(
        s.label,
      )}</text>
      <text x="${W - 72}" y="${y}" text-anchor="end" font-family="'JetBrains Mono', monospace" font-size="11" letter-spacing="1.5" fill="${ok ? PINK : FAINT}">${statusLabel}</text>
    </g>`;
    })
    .join("");

  // Fixed-point brand mark: unbroken white ring + single pink center dot.
  const markCx = W / 2;
  const markCy = 150;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Certificate of Permanence for ${esc(
    d.title,
  )}">
  <rect x="0" y="0" width="${W}" height="${H}" fill="${BG}"/>
  <rect x="24" y="24" width="${W - 48}" height="${H - 48}" fill="${SURFACE}" stroke="${BORDER}" stroke-width="1" rx="10"/>
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" fill="none" stroke="${BORDER}" stroke-width="1" rx="6" opacity="0.5"/>

  <!-- Fixed-point brand mark -->
  <circle cx="${markCx}" cy="${markCy}" r="22" fill="none" stroke="${FG}" stroke-width="2"/>
  <circle cx="${markCx}" cy="${markCy}" r="5" fill="${PINK}"/>

  <!-- Wordmark -->
  <text x="${markCx}" y="${markCy + 56}" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="20" font-weight="600" letter-spacing="-0.7" fill="${FG}">perpetual<tspan fill="${PINK}">.</tspan><tspan font-family="'JetBrains Mono', monospace" fill="${MUTED}" font-size="16">art</tspan></text>

  <!-- Eyebrow -->
  <text x="${markCx}" y="${markCy + 104}" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="12" letter-spacing="4" fill="${FAINT}">CERTIFICATE OF PERMANENCE</text>

  <line x1="72" y1="312" x2="${W - 72}" y2="312" stroke="${BORDER}" stroke-width="1"/>

  <!-- Title -->
  <text x="72" y="372" font-family="'Plus Jakarta Sans', sans-serif" font-size="40" font-weight="500" letter-spacing="-0.5" fill="${FG}">${esc(
    d.title,
  )}</text>
  <text x="72" y="406" font-family="'Inter', sans-serif" font-size="16" fill="${MUTED}">by ${esc(
    d.artist,
  )}</text>

  <!-- Grade plate -->
  <rect x="${W - 200}" y="338" width="128" height="84" rx="8" fill="none" stroke="${PINK}" stroke-width="1" opacity="0.5"/>
  <text x="${W - 136}" y="392" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="44" font-weight="600" fill="${PINK}">${esc(
    d.grade,
  )}</text>
  <text x="${W - 136}" y="412" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="10" letter-spacing="2" fill="${FAINT}">${d.score}/100</text>

  <!-- Detail grid -->
  <g font-family="'JetBrains Mono', monospace">
    <text x="72" y="476" font-size="11" letter-spacing="1.5" fill="${FAINT}">TOKEN ID</text>
    <text x="72" y="500" font-size="15" fill="${FG}">#${d.tokenId}</text>

    <text x="300" y="476" font-size="11" letter-spacing="1.5" fill="${FAINT}">CHAIN</text>
    <text x="300" y="500" font-size="15" fill="${FG}">${esc(d.chain)}</text>

    <text x="528" y="476" font-size="11" letter-spacing="1.5" fill="${FAINT}">CONTRACT</text>
    <text x="528" y="500" font-size="15" fill="${FG}">${esc(d.contractLabel)}</text>

    <text x="72" y="552" font-size="11" letter-spacing="1.5" fill="${FAINT}">CONTENT HASH</text>
    <text x="72" y="576" font-size="15" fill="${FG}">${esc(d.contentHash)}</text>

    <text x="528" y="552" font-size="11" letter-spacing="1.5" fill="${FAINT}">MINTED</text>
    <text x="528" y="576" font-size="15" fill="${FG}">${esc(d.mintDate)}</text>
  </g>

  <line x1="72" y1="620" x2="${W - 72}" y2="620" stroke="${BORDER}" stroke-width="1"/>
  <text x="72" y="660" font-family="'JetBrains Mono', monospace" font-size="11" letter-spacing="1.5" fill="${FAINT}">PERMANENCE SHARDS</text>
  ${shardRows}

  <!-- Sealed statement -->
  <line x1="72" y1="${H - 168}" x2="${W - 72}" y2="${H - 168}" stroke="${BORDER}" stroke-width="1"/>
  <text x="72" y="${H - 124}" font-family="'Inter', sans-serif" font-size="18" font-weight="500" fill="${FG}">This artwork survives even if perpetual.art disappears.</text>
  <text x="72" y="${H - 96}" font-family="'JetBrains Mono', monospace" font-size="11" letter-spacing="0.5" fill="${FAINT}">Backed by an onchain proof on ${esc(
    d.chain,
  )}, independently verifiable by anyone.</text>

  <!-- Seal -->
  <g transform="translate(${W - 132}, ${H - 132})">
    <circle cx="0" cy="0" r="34" fill="none" stroke="${PINK}" stroke-width="1" opacity="0.6"/>
    <circle cx="0" cy="0" r="26" fill="none" stroke="${BORDER}" stroke-width="1"/>
    <path d="M-9 1 l6 6 l12 -13" fill="none" stroke="${PINK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="0" y="22" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="7" letter-spacing="1" fill="${FAINT}">SEALED</text>
  </g>
</svg>`;
}

export function CertificateOfPermanence({ token }: { token: Token }) {
  // ENS/name for the artist receiver address; falls back to short address.
  const artistEns = useEnsName(token.royalty.receiver);
  const artistName = displayName(token.royalty.receiver, artistEns);

  const data = React.useMemo(
    () => buildCertData(token, artistName),
    [token, artistName],
  );
  const svg = React.useMemo(() => buildSvg(data), [data]);

  // Preview variant: the SVG carries explicit width/height for a faithful
  // download, but injected inline that fixed size overflows and clips its
  // container. Swap the root width/height for a responsive box (the viewBox
  // preserves the aspect ratio) so the preview scales to its column.
  const previewSvg = React.useMemo(
    () =>
      svg.replace(
        /width="\d+" height="\d+"/,
        'width="100%" height="auto" style="display:block"',
      ),
    [svg],
  );

  const [downloaded, setDownloaded] = React.useState(false);
  const resetTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  const download = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `certificate-${token.tokenId}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloaded(true);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setDownloaded(false), 2400);
  }, [svg, token.tokenId]);

  return (
    <section
      aria-label="Certificate of permanence"
      className="overflow-hidden rounded-[10px] border border-border bg-surface"
    >
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
        {/* Preview */}
        <div className="border-b border-border bg-background/40 p-4 sm:p-6 lg:border-b-0 lg:border-r">
          <div
            className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[8px] border border-border shadow-[0_40px_90px_-50px_rgba(0,0,0,0.9)]"
            // Responsive preview of the exact SVG that downloads. Static, generated string.
            dangerouslySetInnerHTML={{ __html: previewSvg }}
          />
        </div>

        {/* Copy + action */}
        <div className="flex flex-col justify-center gap-4 p-4 sm:p-6">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
              Archival record
            </span>
            <h3 className="mt-2 font-brand text-[20px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
              A certificate worth keeping
            </h3>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">
              An archival SVG that records this work&apos;s permanence: its
              content hash, every storage shard, the mint date, and its
              permanence grade. Vector, self-contained, and verifiable. Keep it,
              print it, or attach it to a provenance file.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="accent" size="md" onClick={download}>
              {downloaded ? "Certificate saved" : "Download certificate"}
            </Button>
            <span
              className={cn(
                "font-mono text-[10px] uppercase tracking-wider text-faint transition-opacity duration-300",
                downloaded ? "opacity-100" : "opacity-0",
              )}
              aria-live="polite"
            >
              certificate-{token.tokenId}.svg
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
