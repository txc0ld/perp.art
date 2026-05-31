import type { Chain } from "@/lib/types";

/**
 * A real NFT owned by a connected wallet, normalized from the Alchemy NFT API.
 * Distinct from the Perpetual `Token` type (which carries permanence/shard data);
 * these are external holdings surfaced as live data on the profile.
 */
export interface ExternalNft {
  /** `${chain}:${contract}:${tokenId}` */
  id: string;
  chain: Chain;
  contract: string;
  tokenId: string;
  name: string;
  collectionName?: string;
  image?: string;
  tokenType?: string;
}

export interface OwnedNftsResponse {
  address: string;
  nfts: ExternalNft[];
  chainsQueried: Chain[];
  /** True when at least one chain had a configured Alchemy endpoint. */
  live: boolean;
}
