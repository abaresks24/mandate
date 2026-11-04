import { Badge, Card, Mono, SectionTitle, Stat } from "./ui";
import { CROSSCHAIN } from "@/lib/near";

// The "NEAR controls another chain" punchline: a NEAR vault, via Chain
// Signatures / MPC, derived a real EVM address and landed a mined tx on
// Ethereum Sepolia. All values are real and link-verifiable.
export function CrossChainProof() {
  return (
    <Card className="border-evm/40 bg-evm/5">
      <div className="flex items-center justify-between mb-1">
        <SectionTitle sub="A NEAR account signed and broadcast a transaction on Ethereum Sepolia via Chain Signatures (MPC). No bridge, no wrapped key — NEAR controls the EVM address directly.">
          Cross-chain landing — proof on Sepolia
        </SectionTitle>
        <Badge tone="ok">status 0x1 · mined</Badge>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mt-2">
        <Stat
          label="MPC-derived EVM address"
          value={<Mono>{CROSSCHAIN.mpcAddress}</Mono>}
        />
        <Stat
          label="chain id"
          value={<span className="text-evm">{CROSSCHAIN.chainId} · Sepolia</span>}
        />
        <div className="sm:col-span-2">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
            Sepolia tx hash
          </div>
          <a
            href={CROSSCHAIN.etherscan}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-evm hover:underline break-all"
          >
            {CROSSCHAIN.sepoliaTx} ↗
          </a>
        </div>
      </div>

      <a
        href={CROSSCHAIN.etherscan}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 mt-4 rounded-lg border border-evm/40 bg-evm/10 px-4 py-2 text-sm font-semibold text-evm hover:bg-evm/20 transition"
      >
        View on Etherscan ↗
      </a>
    </Card>
  );
}
