"use client";

import { useState } from "react";
import Link from "next/link";
import { live } from "@/lib/near";
import { useLive } from "@/lib/useLive";
import { MANDATE } from "@/mock/mandate";
import { Reveal } from "@/components/motion";
import { PageIntro, Details } from "@/components/journey";
import { Copyable, Dot, Label, LiveIndicator, Stat } from "@/components/ui";
import { CrossChainProof } from "@/components/CrossChainProof";
import { bps, usdc } from "@/lib/format";
import type { Mandate } from "@/lib/types";
import { cn } from "@/lib/cn";

export default function Overview() {
  return (
    <div className="flex flex-col gap-14">
      <Reveal>
        <PageIntro
          kicker="The thesis"
          title={
            <>
              Hand your money to an AI agent —{" "}
              <span className="text-near">without trusting it.</span>
            </>
          }
          context="An off-chain agent moves your capital within rules you set. You should not have to trust it — or the operator running it. A randomly-drawn, bonded TEE guardian committee attests the cross-chain facts the contract can't read. Bond is insurance. Lie and get slashed."
        />
      </Reveal>

      {/* The single, obvious starting action */}
      <Reveal delay={0.06}>
        <div>
          <Link
            href="/committee"
            className="group inline-flex items-baseline gap-2 text-xl sm:text-2xl font-medium text-white hover:text-near transition-colors"
          >
            See the committee decide
            <span
              aria-hidden
              className="transition-transform group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
          <p className="text-sm text-zinc-500 mt-2 max-w-xl leading-relaxed">
            Three bonded guardians read a remote Sepolia fact and vote. Two of
            three must agree before any money moves. Start there.
          </p>
        </div>
      </Reveal>

      {/* The Rhea-vs-Morpho contrast — two columns, dividers not boxes */}
      <Reveal delay={0.1}>
        <div className="grid sm:grid-cols-2 gap-x-10 gap-y-8 border-t border-edge pt-10">
          <div>
            <Label>NEAR · Rhea</Label>
            <h3 className="text-white font-medium mt-2">
              The contract decides alone
            </h3>
            <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed">
              Same-transaction reads of Rhea / Ref state. The chain is the source
              of truth.
            </p>
            <div className="flex items-center gap-2 text-sm text-zinc-300 mt-3">
              <Dot tone="near" />
              verified by contract
            </div>
          </div>
          <div className="sm:border-l sm:border-edge sm:pl-10">
            <Label>Cross-chain · Morpho / Sepolia</Label>
            <h3 className="text-white font-medium mt-2">
              The committee is required
            </h3>
            <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed">
              A NEAR contract cannot read Ethereum. A drawn, bonded committee
              attests the facts it cannot see.
            </p>
            <div className="flex items-center gap-2 text-sm text-zinc-300 mt-3">
              <Dot tone="evm" />
              committee required
            </div>
          </div>
        </div>
      </Reveal>

      {/* Cross-chain Sepolia proof — the one card on this page */}
      <Reveal delay={0.14}>
        <div className="border-t border-edge pt-10">
          <CrossChainProof />
        </div>
      </Reveal>

      {/* Secondary — collapsed */}
      <Reveal delay={0.16}>
        <Details label="Why a committee for cross-chain, not for NEAR">
          <div className="flex flex-col gap-4 text-sm leading-relaxed text-zinc-300 max-w-2xl">
            <p>
              On NEAR, the Vault contract reads Rhea / Ref state in the{" "}
              <span className="text-white">same transaction</span>. The chain IS
              the source of truth — no committee, no bond, nothing external to
              attest.
            </p>
            <p>
              A NEAR contract{" "}
              <span className="text-white">cannot read Ethereum Sepolia</span>.
              Price, slippage and protocol-liveness are facts it cannot see. So a
              drawn, bonded committee reads Sepolia in a TEE and attests — their
              pooled bond exceeds the action value, so{" "}
              <span className="text-near">the bond is insurance</span>.
            </p>
            <p className="text-zinc-400 border-t border-edge pt-4">
              The mandate check runs first:{" "}
              <span className="text-white">
                out-of-mandate actions are rejected without ever drawing a
                committee
              </span>{" "}
              — guardians are never spent on an action that was never allowed
              (prompt-injection defense).
            </p>
          </div>
        </Details>
      </Reveal>

      <Reveal delay={0.18}>
        <MandateDetails />
      </Reveal>

    </div>
  );
}

function MandateDetails() {
  const mandate = useLive<Mandate>(() => live.mandate(), MANDATE, []);
  const m = mandate.data ?? MANDATE;
  const [refused, setRefused] = useState(false);

  return (
    <Details label="The mandate — the rules the agent must honor">
      <div className="flex items-center justify-between mb-5">
        <Label>proposed mandate</Label>
        <LiveIndicator source={mandate.source} loading={mandate.loading} />
      </div>

      {refused ? (
        <div className="flex flex-col items-start gap-3 py-1">
          <div className="flex items-center gap-2 text-sm font-medium text-danger">
            <Dot tone="danger" />
            refused
          </div>
          <p className="text-base text-zinc-200 leading-relaxed max-w-xl">
            &ldquo;40% APY with no risk&rdquo; is not realizable. The
            deterministic risk model floors it above every sane ceiling.{" "}
            <span className="text-white">
              The agent will not propose a mandate it cannot honor.
            </span>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-5">
          <KeyStat label="target APY" value={bps(m.target_apy_bps)} accent />
          <KeyStat label="max risk" value={`${m.max_risk_score}/100`} accent />
          <KeyStat
            label="allowed protocols"
            value={m.allowed_protocols.join(", ")}
          />
        </div>
      )}

      {/* the refuse toggle */}
      <div className="mt-6 flex items-center gap-4 border-t border-edge pt-5">
        <span className="text-xs text-zinc-500">try a brief:</span>
        <ToggleBtn active={!refused} onClick={() => setRefused(false)}>
          realistic 8%
        </ToggleBtn>
        <ToggleBtn active={refused} onClick={() => setRefused(true)}>
          40% · no risk
        </ToggleBtn>
      </div>

      <div className="mt-6 grid sm:grid-cols-2 gap-x-8 gap-y-4 border-t border-edge pt-5">
        <Stat label="owner" value={<Copyable value={m.owner} />} />
        <Stat
          label="max loss"
          value={<span className="font-mono">{bps(m.max_loss_bps)}</span>}
        />
        <Stat
          label="max share / protocol"
          value={
            <span className="font-mono">{bps(m.max_share_per_protocol_bps)}</span>
          }
        />
        <Stat
          label="daily cap"
          value={<span className="font-mono">{usdc(m.daily_cap_usdc)}</span>}
        />
        <Stat label="allowed chains" value={m.allowed_chains.join(", ")} />
        <Stat
          label="committee"
          value={
            m.committee_threshold_usdc === "0" ? (
              <span className="text-evm">permanent · every cross-chain action</span>
            ) : (
              <span className="font-mono">{usdc(m.committee_threshold_usdc)}</span>
            )
          }
        />
      </div>
      <p className="text-xs text-zinc-500 mt-5 leading-relaxed border-t border-edge pt-4">
        propose_action validates these deterministically BEFORE touching the
        committee — it fails closed. Out-of-mandate templates are rejected without
        ever drawing guardians.
      </p>
    </Details>
  );
}

function KeyStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div
        className={cn(
          "mt-1.5 text-lg font-semibold font-mono",
          accent ? "text-white" : "text-zinc-300"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-xs transition-colors border-b pb-0.5",
        active
          ? "text-near border-near"
          : "text-zinc-500 border-transparent hover:text-zinc-300"
      )}
    >
      {children}
    </button>
  );
}
