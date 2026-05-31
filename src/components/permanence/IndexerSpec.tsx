/**
 * IndexerSpec - a "published spec excerpt" styled block (PRD §9.3). The indexer
 * reads only public onchain + storage data; the schema is published so anyone
 * can run their own, preserving the architectural invariant. The schema below
 * is a plausible, clean outline made to read like real documentation.
 * Server component.
 */
import { Badge, MonoLabel } from "@/components/ui";

const SPEC = `# perpetual-indexer / schema.v1
# Reads ONLY public onchain + public storage data.
# No proprietary inputs. Anyone may run this to reconstruct the index.

source contracts {
  forever_library  native   # marketplace-deployed instances
  forever_library  sovereign # artist-owned instances (federated)
  settlement       seaport  # order fills, cancellations
}

record mint {
  contract       address
  token_id       uint256
  creator        address
  block_number   uint64
  timestamp      uint64       # block time
  title          string
  media_type     enum
  royalty_bps    uint16
  metadata_hash  bytes32      # from getMintData(tokenId)
}

record shard_status {
  token_id       uint256
  index          uint8        # 0 = STATE (SSTORE2, mandatory) · 1 = LOG (LogLedger)
  backend        enum         # onchain | log | ipfs | arweave | irys | cdn
  resolves       bool
  hash_matches   bool         # hash(content) == mint.metadata_hash
  locked         bool         # isLocked(tokenId)
  last_checked   timestamp
}

record settlement {
  order_hash     bytes32
  token_id       uint256
  from           address
  to             address
  price_wei      uint256
  royalty_paid   uint256      # enforced at settlement (ERC-2981)
  block_number   uint64
}

derive {
  ownership         <- transfers ∪ settlements   # current holder
  provenance        <- mint ∪ transfers ∪ sales  # full history
  permanence_status <- shard_status              # per-token integrity
}`;

export function IndexerSpec() {
  return (
    <div className="rounded-[8px] border border-border bg-surface">
      {/* spec header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <MonoLabel className="text-muted">schema.v1 · published</MonoLabel>
        <div className="flex items-center gap-2">
          <Badge tone="muted">Public data only</Badge>
          <Badge tone="verify">Re-indexable</Badge>
        </div>
      </div>

      {/* the spec excerpt */}
      <pre className="overflow-x-auto px-5 py-5 font-mono text-[12px] leading-relaxed text-muted">
        <code>{SPEC}</code>
      </pre>

      <div className="border-t border-border px-5 py-4">
        <p className="text-sm leading-relaxed text-faint">
          Because every input is public, a third party can stand up an identical
          index with zero cooperation from Perpetual. An open schema is what turns
          the invariant from a promise into something you can verify for yourself.
        </p>
      </div>
    </div>
  );
}

export default IndexerSpec;
