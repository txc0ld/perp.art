"use client";

/**
 * TradePanel — live EIP-712 listing + fulfillOrder buy flow.
 *
 * List path (owner):
 *   approval check → signTypedData → POST /api/orders
 * Buy path (non-owner, active listing):
 *   writeContract fulfillOrder → waitForTransactionReceipt → POST /api/orders/filled
 *
 * ES2017 target: no BigInt literals — BigInt() constructor only.
 */
import * as React from "react";
import { useAccount } from "wagmi";
import {
  readContract,
  writeContract,
  waitForTransactionReceipt,
  signTypedData,
} from "@wagmi/core";
import { hashTypedData, parseEther, formatEther } from "viem";
import { wagmiConfig } from "@/lib/web3/config";
import { getContracts, chainLabelForId } from "@/lib/web3/contracts";
import { FOREVER_LIBRARY_ABI, SETTLEMENT_ABI } from "@/lib/web3/abis";
import {
  ORDER_TYPES,
  buildOrderDomain,
  serializeOrder,
  deserializeOrder,
  type SignedOrder,
  type OrderStruct,
  type SerializedSignedOrder,
} from "@/lib/web3/orders";
import { Button, MonoLabel, MonoValue, Surface } from "@/components/ui";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TradePanelProps {
  chainId: number;
  tokenId: number;
  nft: `0x${string}`;
  owner: `0x${string}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shortErr(e: unknown): string {
  if (!e) return "Unknown error";
  if (typeof e === "object" && e !== null) {
    // User rejected wallet request
    const code = (e as { code?: number }).code;
    if (code === 4001) return "Wallet request rejected.";
    const msg = (e as { shortMessage?: string; message?: string }).shortMessage
      ?? (e as { message?: string }).message;
    if (msg && typeof msg === "string") {
      // Trim long revert strings
      return msg.slice(0, 120);
    }
  }
  return String(e).slice(0, 120);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Phase =
  | "idle"
  | "checking-approval"
  | "approving"
  | "signing"
  | "posting"
  | "buying"
  | "confirming"
  | "done";

export function TradePanel({ chainId, tokenId, nft, owner }: TradePanelProps) {
  const { address, chainId: walletChainId } = useAccount();

  const [listing, setListing] = React.useState<SignedOrder | null | undefined>(undefined); // undefined = loading
  const [priceInput, setPriceInput] = React.useState("");
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  // Lowercased comparisons
  const connectedLower = address?.toLowerCase();
  const ownerLower = owner.toLowerCase();
  const isOwner = Boolean(connectedLower && connectedLower === ownerLower);
  const isConnected = Boolean(address);
  const isWrongChain = isConnected && walletChainId !== chainId;

  // ------------------------------------------------------------------
  // Fetch active listing
  // ------------------------------------------------------------------

  const fetchListing = React.useCallback(async () => {
    setListing(undefined); // loading
    setError(null);
    try {
      const res = await fetch(
        `/api/orders?chainId=${chainId}&nft=${nft}&tokenId=${tokenId}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setListing(null);
        return;
      }
      const data = (await res.json()) as { orders: SerializedSignedOrder[] };
      if (data.orders && data.orders.length > 0) {
        setListing(deserializeOrder(data.orders[0]));
      } else {
        setListing(null);
      }
    } catch {
      setListing(null);
    }
  }, [chainId, nft, tokenId]);

  React.useEffect(() => {
    fetchListing();
  }, [fetchListing]);

  // ------------------------------------------------------------------
  // List for sale
  // ------------------------------------------------------------------

  async function handleList(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const contracts = getContracts(chainId);
    if (!contracts.settlement) {
      setError("Settlement contract not configured for this chain.");
      return;
    }
    const settlement = contracts.settlement;

    if (!address) {
      setError("Wallet not connected.");
      return;
    }

    let priceWei: bigint;
    try {
      priceWei = parseEther(priceInput.trim());
    } catch {
      setError("Invalid ETH amount.");
      return;
    }
    if (priceWei <= BigInt(0)) {
      setError("Price must be greater than 0.");
      return;
    }

    try {
      // 1. Check approval
      setPhase("checking-approval");
      const approved = await readContract(wagmiConfig, {
        address: nft,
        abi: FOREVER_LIBRARY_ABI,
        functionName: "isApprovedForAll",
        args: [address, settlement],
        chainId,
      });

      if (!approved) {
        // 2. Approve
        setPhase("approving");
        const approveTx = await writeContract(wagmiConfig, {
          address: nft,
          abi: FOREVER_LIBRARY_ABI,
          functionName: "setApprovalForAll",
          args: [settlement, true],
          chainId,
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: approveTx, chainId });
      }

      // 3. Fetch counter
      setPhase("signing");
      const counter = await readContract(wagmiConfig, {
        address: settlement,
        abi: SETTLEMENT_ABI,
        functionName: "getCounter",
        args: [address],
        chainId,
      });

      const now = Math.floor(Date.now() / 1000);
      const order: OrderStruct = {
        seller: address,
        nft,
        tokenId: BigInt(tokenId),
        paymentToken: "0x0000000000000000000000000000000000000000",
        price: priceWei,
        startTime: BigInt(0),
        endTime: BigInt(now + 30 * 86400),
        counter: counter as bigint,
        salt: BigInt(Math.floor(Math.random() * 1e15)),
      };

      const domain = buildOrderDomain(chainId, settlement);
      const orderHash = hashTypedData({
        domain,
        types: ORDER_TYPES,
        primaryType: "Order",
        message: order,
      });

      // 4. Sign
      const signature = await signTypedData(wagmiConfig, {
        domain,
        types: ORDER_TYPES,
        primaryType: "Order",
        message: order,
        account: address,
      });

      // 5. POST to API
      setPhase("posting");
      const signedOrder = {
        order,
        signature,
        chainId,
        orderHash: orderHash as `0x${string}`,
        createdAt: Date.now(),
      };

      const body = serializeOrder(signedOrder);
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({ error: "POST failed" }))) as { error?: string };
        setError(err.error ?? "Failed to submit listing.");
        setPhase("idle");
        return;
      }

      setSuccess("Listed successfully.");
      setPriceInput("");
      setPhase("done");
      await fetchListing();
      setPhase("idle");
    } catch (e) {
      setError(shortErr(e));
      setPhase("idle");
    }
  }

  // ------------------------------------------------------------------
  // Buy
  // ------------------------------------------------------------------

  async function handleBuy() {
    if (!listing || !address) return;
    setError(null);
    setSuccess(null);

    const contracts = getContracts(chainId);
    if (!contracts.settlement) {
      setError("Settlement contract not configured for this chain.");
      return;
    }
    const settlement = contracts.settlement;

    try {
      setPhase("buying");
      const { order, signature, orderHash } = listing;

      // Build order tuple matching ABI field order exactly
      const orderTuple = {
        seller: order.seller,
        nft: order.nft,
        tokenId: order.tokenId,
        paymentToken: order.paymentToken,
        price: order.price,
        startTime: order.startTime,
        endTime: order.endTime,
        counter: order.counter,
        salt: order.salt,
      } as const;

      const txHash = await writeContract(wagmiConfig, {
        address: settlement,
        abi: SETTLEMENT_ABI,
        functionName: "fulfillOrder",
        args: [orderTuple, signature],
        value: order.price,
        chainId,
      });

      setPhase("confirming");
      await waitForTransactionReceipt(wagmiConfig, { hash: txHash, chainId });

      // Mark filled
      await fetch("/api/orders/filled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chainId, orderHash }),
      });

      setSuccess("Purchase complete!");
      setPhase("done");
      await fetchListing();
      setPhase("idle");
    } catch (e) {
      setError(shortErr(e));
      setPhase("idle");
    }
  }

  // ------------------------------------------------------------------
  // Loading state
  // ------------------------------------------------------------------

  if (listing === undefined) {
    return (
      <Surface className="p-5">
        <MonoLabel className="text-faint">Trade</MonoLabel>
        <p className="mt-2 font-mono text-[12px] uppercase tracking-wider text-faint animate-pulse">
          Loading…
        </p>
      </Surface>
    );
  }

  const busy = phase !== "idle" && phase !== "done";
  const chainLabel = chainLabelForId(chainId);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <Surface className="p-5 space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <MonoLabel className="text-faint">Trade</MonoLabel>
        <span className="font-mono text-[10px] uppercase tracking-wider text-faint">
          testnet · unaudited
        </span>
      </div>

      {/* Not connected or wrong chain */}
      {!isConnected || isWrongChain ? (
        <p className="text-[13px] leading-relaxed text-muted">
          Connect a wallet on <span className="text-foreground">{chainLabel}</span> to trade.
        </p>
      ) : isOwner ? (
        /* ---- Owner view ---- */
        listing ? (
          // Already listed
          <div className="space-y-2">
            <MonoLabel className="text-faint">Your listing</MonoLabel>
            <MonoValue className="text-foreground text-[22px] font-semibold">
              {formatEther(listing.order.price)} ETH
            </MonoValue>
            <p className="text-[12px] text-muted">
              This token is listed for sale. Cancel not yet available.
            </p>
          </div>
        ) : (
          // List form
          <form onSubmit={handleList} className="space-y-3">
            <div>
              <label htmlFor="trade-price" className="label-mono text-faint block mb-1.5">
                List price (ETH)
              </label>
              <input
                id="trade-price"
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                disabled={busy}
                className={[
                  "w-full rounded-[6px] border border-border bg-background px-3 py-2",
                  "font-mono text-sm text-foreground placeholder:text-faint",
                  "focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/60",
                  "disabled:opacity-40",
                ].join(" ")}
              />
            </div>

            <Button
              type="submit"
              variant="accent"
              size="md"
              className="w-full"
              disabled={busy || !priceInput}
            >
              {listPhaseLabel(phase)}
            </Button>
          </form>
        )
      ) : listing ? (
        /* ---- Buyer view — active listing ---- */
        <div className="space-y-3">
          <div>
            <MonoLabel className="text-faint">Price</MonoLabel>
            <p className="mt-1 font-mono text-[26px] font-semibold leading-none tabular-nums text-foreground">
              {formatEther(listing.order.price)}
              <span className="ml-1.5 text-base font-medium text-muted">ETH</span>
            </p>
          </div>
          <Button
            variant="accent"
            size="lg"
            className="w-full"
            disabled={busy}
            onClick={handleBuy}
          >
            {phase === "buying"
              ? "Confirm in wallet…"
              : phase === "confirming"
              ? "Waiting for confirmation…"
              : `Buy for ${formatEther(listing.order.price)} ETH`}
          </Button>
        </div>
      ) : (
        /* ---- Not listed, not owner ---- */
        <p className="text-[13px] leading-relaxed text-muted">
          Not listed for sale.
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="rounded-[6px] border border-border bg-surface-2 px-3 py-2 font-mono text-[12px] text-muted">
          {error}
        </p>
      )}

      {/* Success */}
      {success && !error && (
        <p className="rounded-[6px] border border-accent/30 bg-accent/5 px-3 py-2 font-mono text-[12px] text-accent">
          {success}
        </p>
      )}
    </Surface>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function listPhaseLabel(phase: Phase): string {
  switch (phase) {
    case "checking-approval": return "Checking approval…";
    case "approving": return "Approving the exchange…";
    case "signing": return "Sign in wallet…";
    case "posting": return "Submitting…";
    default: return "List for sale";
  }
}
