import { ArrowUpRight } from "lucide-react";
import { Card, Copyable, Dot, Label } from "./ui";
import { CROSSCHAIN } from "@/lib/near";
import { shortHash } from "@/lib/format";

// The "NEAR controls another chain" punchline: a NEAR vault, via Chain
// Signatures / MPC, derived a real EVM address and landed a mined tx on
// Ethereum Sepolia. All values are real and link-verifiable.
export function CrossChainProof() {
  return (
    <Card>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="max-w-xl">
          <h3 className="text-lg font-semibold tracking-tight text-white">
            Cross-chain landing — proof on Sepolia
          </h3>
          <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed">
            A NEAR account signed and broadcast a transaction on Ethereum
            Sepolia via Chain Signatures (MPC). No bridge, no wrapped key —
            NEAR controls the EVM address directly.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-sm text-zinc-300">
          <Dot tone="near" />
          status 0x1 · mined
        </span>
      </div>

      <div className="grid sm:grid-cols-2 gap-5 mt-6 border-t border-edge pt-6">
        <div>
          <Label className="mb-1.5">MPC-derived EVM address</Label>
          <Copyable value={CROSSCHAIN.mpcAddress} label="Address copied" />
        </div>
        <div>
          <Label className="mb-1.5">chain id</Label>
          <span className="font-mono text-sm text-zinc-300">
            {CROSSCHAIN.chainId} · Sepolia
          </span>
        </div>
        <div className="sm:col-span-2">
          <Label className="mb-1.5">Sepolia tx hash</Label>
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
        className="inline-flex items-center gap-1.5 mt-6 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
      >
        View on Etherscan
        <ArrowUpRight className="h-4 w-4" />
      </a>
    </Card>
  );
}
