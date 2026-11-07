import { ArrowUpRight, CheckCircle2, Link2 } from "lucide-react";
import { Badge, Card, Copyable } from "./ui";
import { CROSSCHAIN } from "@/lib/near";
import { shortHash } from "@/lib/format";

// The "NEAR controls another chain" punchline: a NEAR vault, via Chain
// Signatures / MPC, derived a real EVM address and landed a mined tx on
// Ethereum Sepolia. All values are real and link-verifiable.
export function CrossChainProof() {
  return (
    <Card className="relative overflow-hidden border-evm/25 bg-gradient-to-br from-evm/[0.06] to-transparent">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-evm/10 blur-3xl"
        aria-hidden
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-evm/25 bg-evm/10 text-evm">
              <Link2 className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-white">
                Cross-chain landing — proof on Sepolia
              </h3>
              <p className="text-sm text-zinc-400 mt-1 max-w-xl leading-relaxed">
                A NEAR account signed and broadcast a transaction on Ethereum
                Sepolia via Chain Signatures (MPC). No bridge, no wrapped key —
                NEAR controls the EVM address directly.
              </p>
            </div>
          </div>
          <Badge tone="ok">
            <CheckCircle2 className="h-3 w-3" /> status 0x1 · mined
          </Badge>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 mt-6">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5">
              MPC-derived EVM address
            </div>
            <Copyable value={CROSSCHAIN.mpcAddress} label="Address copied" />
          </div>
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5">
              chain id
            </div>
            <span className="font-mono text-sm text-evm">
              {CROSSCHAIN.chainId} · Sepolia
            </span>
          </div>
          <div className="sm:col-span-2">
            <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5">
              Sepolia tx hash
            </div>
            <Copyable
              value={CROSSCHAIN.sepoliaTx}
              display={shortHash(CROSSCHAIN.sepoliaTx, 20, 12)}
              label="Tx hash copied"
            />
          </div>
        </div>

        <a
          href={CROSSCHAIN.etherscan}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 mt-6 rounded-xl border border-evm/25 bg-evm/10 px-4 py-2.5 text-sm font-semibold text-evm hover:bg-evm/20 transition-colors"
        >
          View on Etherscan
          <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>
    </Card>
  );
}
