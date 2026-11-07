import { CommitteeView } from "@/components/CommitteeView";
import { CrossChainProof } from "@/components/CrossChainProof";
import { Badge, Card } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { Reveal } from "@/components/motion";
import { Dices, Hash, Fingerprint, ListChecks } from "lucide-react";

const STEPS = [
  {
    icon: Dices,
    title: "Draw",
    body: "3 bond-weighted guardians drawn live on-chain — committee [g5, g1, g2].",
  },
  {
    icon: Hash,
    title: "Commit",
    body: "Each publishes a commit hash. Plaintext is hidden from everyone, incl. the operator — the TEE guarantees it.",
  },
  {
    icon: Fingerprint,
    title: "Reveal",
    body: "Signed reports revealed; sha256(report) == commit is recomputed in your browser.",
  },
  {
    icon: ListChecks,
    title: "Tally",
    body: "2-of-3 read live from tally(\"a1\"). Threshold met → the action may execute.",
  },
];

export default function CommitteePage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<Badge tone="evm">committee required · cross-chain</Badge>}
        title="The committee — the hero screen"
        sub="A cross-chain Morpho / Sepolia allocation (action a1). The Vault contract cannot read Sepolia, so a bond-weighted committee must attest the facts the chain can't see."
      />

      <Reveal>
        <Card className="bg-evm/[0.04] border-evm/20">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-evm/25 bg-evm/10 text-evm shrink-0">
                      <Icon className="h-4 w-4" />
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">
                      <span className="text-zinc-600 font-mono mr-1">
                        {i + 1}
                      </span>
                      {s.title}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                      {s.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </Reveal>

      <CommitteeView actionId="a1" template="AllocateCrossChain · Morpho" />

      <Reveal>
        <CrossChainProof />
      </Reveal>
    </div>
  );
}
