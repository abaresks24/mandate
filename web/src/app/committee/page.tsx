import { CommitteeView } from "@/components/CommitteeView";
import { Badge, Card, SectionTitle } from "@/components/ui";
import { MORPHO_ACTION } from "@/mock/actions";

export default function CommitteePage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <SectionTitle sub="Cross-chain Morpho/Sepolia allocation. The Vault contract cannot read Sepolia, so a bond-weighted committee must attest the facts.">
          Committee — the hero screen
        </SectionTitle>
        <Badge tone="evm">committee required · cross-chain</Badge>
      </div>

      <Card className="bg-evm/5 border-evm/30">
        <p className="text-sm text-slate-300">
          Step through the lifecycle:{" "}
          <span className="text-white">draw</span> the 3 random guardians →
          publish their <span className="text-white">commit hashes</span>{" "}
          (plaintext hidden from everyone, incl. the operator; TEE guarantees it)
          → <span className="text-white">reveal</span> the signed reports and
          verify sha256(report) == commit → tally{" "}
          <span className="text-white">2-of-3</span>.
        </p>
      </Card>

      <CommitteeView action={MORPHO_ACTION} />
    </div>
  );
}
