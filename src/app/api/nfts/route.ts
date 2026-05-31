import { NextResponse } from "next/server";
import type { Chain } from "@/lib/types";
import { getRpcUrl } from "@/lib/env";
import type { ExternalNft, OwnedNftsResponse } from "@/lib/api/types";

/**
 * GET /api/nfts?address=0x...&chains=ethereum,base
 * Returns a connected wallet's real NFTs across our EVM chains via the Alchemy
 * NFT API. The Alchemy key lives in the RPC URL (server-side), so this proxy
 * keeps it off the client and adds a caching seam.
 */

export const dynamic = "force-dynamic";

const EVM_NFT_CHAINS: Chain[] = [
  "ethereum",
  "base",
  "polygon",
  "arbitrum",
  "optimism",
  "zora",
  "shape",
];

/** Derive the Alchemy NFT API base from a configured Alchemy RPC URL. */
function nftBaseFor(chain: Chain): string | null {
  const rpc = getRpcUrl(chain);
  if (!rpc || !rpc.includes("g.alchemy.com")) return null;
  // https://eth-mainnet.g.alchemy.com/v2/KEY -> https://eth-mainnet.g.alchemy.com/nft/v3/KEY
  return rpc.replace("/v2/", "/nft/v3/");
}

function pickImage(nft: Record<string, unknown>): string | undefined {
  const image = (nft.image ?? {}) as Record<string, string | undefined>;
  const contract = (nft.contract ?? {}) as Record<string, unknown>;
  const osm = (contract.openSeaMetadata ?? {}) as Record<string, string | undefined>;
  return image.cachedUrl || image.thumbnailUrl || image.originalUrl || osm.imageUrl || undefined;
}

async function fetchChain(chain: Chain, owner: string): Promise<ExternalNft[]> {
  const base = nftBaseFor(chain);
  if (!base) return [];
  const url =
    `${base}/getNFTsForOwner?owner=${owner}` +
    `&withMetadata=true&pageSize=50&excludeFilters[]=SPAM&excludeFilters[]=AIRDROPS`;

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { ownedNfts?: Array<Record<string, unknown>> };
    return (data.ownedNfts ?? []).map((nft) => {
      const contract = (nft.contract ?? {}) as Record<string, unknown>;
      const collection = (nft.collection ?? {}) as Record<string, string | undefined>;
      const contractAddress = String(contract.address ?? "");
      const tokenId = String(nft.tokenId ?? "");
      return {
        id: `${chain}:${contractAddress}:${tokenId}`,
        chain,
        contract: contractAddress,
        tokenId,
        name: String(nft.name || collection.name || `#${tokenId}`),
        collectionName:
          (contract.name as string) || collection.name || undefined,
        image: pickImage(nft),
        tokenType: nft.tokenType as string | undefined,
      } satisfies ExternalNft;
    });
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = (searchParams.get("address") ?? "").trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "invalid address" }, { status: 400 });
  }

  const requested = searchParams.get("chains");
  const chains = requested
    ? (requested.split(",").filter((c) => EVM_NFT_CHAINS.includes(c as Chain)) as Chain[])
    : EVM_NFT_CHAINS;

  const configured = chains.filter((c) => nftBaseFor(c) !== null);

  const results = await Promise.allSettled(configured.map((c) => fetchChain(c, address)));
  const nfts = results
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .filter((n) => n.contract && n.tokenId)
    .slice(0, 120);

  const body: OwnedNftsResponse = {
    address,
    nfts,
    chainsQueried: configured,
    live: configured.length > 0,
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "private, max-age=30" },
  });
}
