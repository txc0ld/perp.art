"use client";

import { useOwnedNfts } from "@/lib/api/nfts";
import { ChainBadge } from "@/components/chain/ChainBadge";
import { MonoLabel, Badge } from "@/components/ui";

/**
 * Wallet tab - the connected wallet's REAL NFTs across our EVM chains, fetched
 * live from the Alchemy NFT API via /api/nfts. This is genuine on-chain data
 * (as opposed to the mock Perpetual catalog), so it proves the live pipeline.
 */
export function WalletNfts({ address }: { address: string }) {
  const { data, isLoading, isError } = useOwnedNfts(address);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="animate-pulse overflow-hidden rounded-[10px] border border-border bg-surface">
            <div className="aspect-square bg-surface-2" />
            <div className="space-y-2 p-3">
              <div className="h-3 w-3/4 rounded bg-surface-2" />
              <div className="h-3 w-1/2 rounded bg-surface-2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <Empty
        title="Could not load wallet NFTs"
        body="The NFT service did not respond. Try again shortly."
      />
    );
  }

  if (data && !data.live) {
    return (
      <Empty
        title="Live NFT data not configured"
        body="Add Alchemy RPC endpoints (NEXT_PUBLIC_RPC_*) to enable live wallet holdings across chains."
      />
    );
  }

  const nfts = data?.nfts ?? [];
  if (nfts.length === 0) {
    return (
      <Empty
        title="No NFTs found"
        body={`No holdings detected across ${data?.chainsQueried.length ?? 0} chains for this wallet.`}
      />
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-2.5">
          <MonoLabel className="text-foreground">Wallet holdings</MonoLabel>
          <Badge tone="verify">Live</Badge>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-wider text-faint">
          {nfts.length} items
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {nfts.map((nft) => (
          <div
            key={nft.id}
            className="group overflow-hidden rounded-[10px] border border-border bg-surface transition-colors hover:border-border-bright"
          >
            <div className="relative aspect-square overflow-hidden bg-surface-2">
              {nft.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={nft.image}
                  alt={nft.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-faint">No image</span>
                </div>
              )}
              <div className="absolute left-2.5 top-2.5">
                <ChainBadge chain={nft.chain} className="border-border/60 bg-background/70 backdrop-blur-md" />
              </div>
            </div>
            <div className="flex flex-col gap-0.5 p-3">
              <p className="truncate text-sm font-semibold text-foreground">{nft.name}</p>
              {nft.collectionName && (
                <p className="truncate text-xs text-muted">{nft.collectionName}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[10px] border border-dashed border-border bg-surface/40 px-6 py-14 text-center">
      <p className="text-base font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}
