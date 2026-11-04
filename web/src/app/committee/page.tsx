import { CommitteeView } from "@/components/CommitteeView";
import { CrossChainProof } from "@/components/CrossChainProof";
import { Badge, Card, SectionTitle } from "@/components/ui";

export default function CommitteePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <SectionTitle sub="Cross-chain Morpho/Sepolia allocation (action a1). The Vault contract cannot read Sepolia, so a bond-weighted committee must attest the facts.">
          Committee — the hero screen
        </SectionTitle>
        <Badge tone="evm">committee required · cross-chain</Badge>
      </div>

      <Card className="bg-evm/5 border-evm/30">
        <p className="text-sm text-slate-300">
          Step through the lifecycle:{" "}
          <span className="text-white">draw</span> the 3 bond-weighted guardians
          (live on-chain: committee <span className="font-mono">[g5,g1,g2]</span>
          ) → publish their <span className="text-white">commit hashes</span>{" "}
          (plaintext hidden from everyone, incl. the operator; the TEE
          guarantees it) → <span className="text-white">reveal</span> the signed
          reports and verify{" "}
          <span className="font-mono">sha256(report) == commit</span> →{" "}
          <span className="text-white">tally 2-of-3</span> (read live from{" "}
          <span className="font-mono">tally(&quot;a1&quot;)</span>).
        </p>
      </Card>

      <CommitteeView actionId="a1" template="AllocateCrossChain · Morpho" />

      <CrossChainProof />
    </div>
  );
}
