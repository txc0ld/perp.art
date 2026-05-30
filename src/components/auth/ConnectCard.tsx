"use client";

import { useRouter } from "next/navigation";
import { useWallet, disconnectWallet } from "@/lib/wallet";
import { Surface, Button, MonoLabel, Divider } from "@/components/ui";
import { shortAddress } from "@/lib/utils";
import { ConnectorList } from "./ConnectorList";

/**
 * ConnectCard (design prompt §4.6) - the highest-craft auth moment. A focused,
 * centered, non-custodial access flow: mono eyebrow, masked-reveal heading,
 * one-line subhead, connector list, and transparent reassurance footer.
 * When already connected, shows a calm "you're connected" state.
 */
export function ConnectCard() {
  const wallet = useWallet();
  const router = useRouter();
  const connected = wallet.connected && wallet.address;

  return (
    <Surface className="w-full max-w-[440px] p-8 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.9)] sm:p-10">
      {/* Eyebrow */}
      <div className="flex items-center gap-2">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
        <MonoLabel className="text-faint">Secure access · Non-custodial</MonoLabel>
      </div>

      {connected ? (
        <ConnectedState
          connector={wallet.connector}
          address={wallet.address!}
          onDisconnect={disconnectWallet}
          onProfile={() => router.push("/profile")}
        />
      ) : (
        <>
          <h1 className="animate-reveal mt-5 text-[28px] font-medium leading-[1.08] tracking-[-0.01em] text-foreground">
            Enter the conservatory
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Connect a wallet to hold art engineered to outlast its marketplace.
            Perpetual is fully non-custodial. You keep the keys, always.
          </p>

          <div className="mt-8">
            <ConnectorList />
          </div>

          <Divider className="my-7" />

          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2.5">
              <ShieldGlyph />
              <p className="text-xs leading-relaxed text-muted">
                Perpetual never takes custody of your assets or funds. Connecting
                only reads your public address.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <EyeGlyph />
              <p className="text-xs leading-relaxed text-muted">
                Every signing request is shown in full before you approve. We never
                ask you to sign a blind or off-site transaction.
              </p>
            </div>
          </div>
        </>
      )}
    </Surface>
  );
}

function ConnectedState({
  connector,
  address,
  onDisconnect,
  onProfile,
}: {
  connector: string | null;
  address: string;
  onDisconnect: () => void;
  onProfile: () => void;
}) {
  return (
    <>
      <h1 className="animate-reveal mt-5 text-[28px] font-medium leading-[1.08] tracking-[-0.01em] text-foreground">
        You&rsquo;re connected
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Your wallet is linked. Perpetual holds none of your assets, and you can disconnect at any time.
      </p>

      <div className="mt-7 flex items-center gap-3 rounded-[8px] border border-border bg-surface-2 px-4 py-3.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/40 text-accent">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
            <path d="M3.5 8.5l3 3 6-6.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="font-mono text-sm tabular-nums text-foreground">{shortAddress(address)}</p>
          {connector && (
            <p className="font-mono text-[10px] uppercase tracking-wider text-faint">
              via {connector}
            </p>
          )}
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-2.5">
        <Button variant="accent" size="lg" onClick={onProfile}>
          Go to profile
        </Button>
        <Button variant="ghost" size="md" onClick={onDisconnect}>
          Disconnect
        </Button>
      </div>
    </>
  );
}

function ShieldGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" fill="none" aria-hidden>
      <path d="M8 2l5 2v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4l5-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function EyeGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" fill="none" aria-hidden>
      <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <circle cx="8" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
