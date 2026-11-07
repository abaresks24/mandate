import { CommitteeSummary, CommitteeView } from "@/components/CommitteeView";
import { CrossChainProof } from "@/components/CrossChainProof";
import { Reveal } from "@/components/motion";
import { PageIntro, Details } from "@/components/journey";

export default function CommitteePage() {
  return (
    <div className="flex flex-col gap-14">
      <Reveal>
        <PageIntro
          kicker="The committee"
          title="Three guardians vouch for the facts the chain can't see."
          context="A cross-chain Morpho / Sepolia action (a1) draws 3 bond-weighted guardians. They attest the remote facts — and 2 of 3 must agree."
        />
      </Reveal>

      {/* The hero — the tally is the whole focus */}
      <Reveal delay={0.06}>
        <CommitteeSummary actionId="a1" />
      </Reveal>

      <Reveal delay={0.1}>
        <Details label="Show the commit → reveal lifecycle">
          <p className="text-sm text-zinc-400 leading-relaxed mb-6 max-w-2xl">
            Each guardian publishes a commit hash, then reveals its signed report.
            Your browser recomputes{" "}
            <span className="font-mono text-near">sha256(report) == commit</span>{" "}
            against the on-chain commit — proving nobody changed their answer after
            seeing the others.
          </p>
          <CommitteeView actionId="a1" template="AllocateCrossChain · Morpho" />
        </Details>
      </Reveal>

      <Reveal delay={0.14}>
        <div className="border-t border-edge pt-10">
          <CrossChainProof />
        </div>
      </Reveal>

    </div>
  );
}
