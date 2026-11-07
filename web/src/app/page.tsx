"use client";

import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { CROSSCHAIN } from "@/lib/near";
import { Reveal } from "@/components/motion";
import { StepHeader, StepNav, Details } from "@/components/journey";

export default function ProblemStep() {
  return (
    <div className="flex flex-col gap-10">
      <Reveal>
        <StepHeader
          n={1}
          kicker="the problem"
          title={
            <>
              Hand your money to an AI agent —{" "}
              <span className="text-near">without trusting it.</span>
            </>
          }
          context="An off-chain agent moves your capital. You should not have to trust it — or the operator running it. Here is how we make that safe, in five steps."
        />
      </Reveal>

      {/* HERO — two tiny live proof chips */}
      <Reveal delay={0.1}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-near/25 bg-near/[0.07] px-4 py-2 text-sm text-near">
            <ShieldCheck className="h-4 w-4" />
            Committee a1 · 3 / 3 verified
          </div>
          <a
            href={CROSSCHAIN.etherscan}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-evm/25 bg-evm/[0.07] px-4 py-2 text-sm text-evm hover:bg-evm/[0.12] transition-colors"
          >
            <ShieldCheck className="h-4 w-4" />
            Sepolia tx · status 0x1
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </Reveal>

      <Reveal delay={0.16}>
        <Details label="Show how it works">
          <p className="text-sm leading-relaxed text-zinc-300 max-w-2xl">
            Two independent guarantees. A <span className="text-white">TEE</span>{" "}
            proves the guardian ran the exact attested code — so no operator can
            tamper with what it reports. A <span className="text-white">bond</span>{" "}
            proves the data: the quorum&apos;s pooled bond exceeds the action value,
            so <span className="text-near">the bond is insurance</span>. Lie about a
            cross-chain fact and you get slashed — the loss is covered.
          </p>
        </Details>
      </Reveal>

      <StepNav n={1} />
    </div>
  );
}
