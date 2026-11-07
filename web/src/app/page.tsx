"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  Ban,
  Check,
  Cpu,
  Eye,
  EyeOff,
  ShieldCheck,
  Users,
} from "lucide-react";
import { CROSSCHAIN, live } from "@/lib/near";
import { useLive } from "@/lib/useLive";
import { MANDATE } from "@/mock/mandate";
import { Reveal } from "@/components/motion";
import { PageIntro, Details } from "@/components/journey";
import { Badge, Card, Copyable, LiveIndicator, Stat } from "@/components/ui";
import { CrossChainProof } from "@/components/CrossChainProof";
import { bps, usdc } from "@/lib/format";
import type { Mandate } from "@/lib/types";
import { cn } from "@/lib/cn";

export default function Overview() {
  return (
    <div className="flex flex-col gap-10">
      <Reveal>
        <PageIntro
          kicker="the thesis"
          title={
            <>
              Hand your money to an AI agent —{" "}
              <span className="text-near">without trusting it.</span>
            </>
          }
          context="An off-chain agent moves your capital within rules you set. You should not have to trust it — or the operator running it. A randomly-drawn, bonded TEE guardian committee attests the cross-chain facts the contract can't read. Bond = insurance. Lie and get slashed."
        />
      </Reveal>

      {/* Two tiny LIVE proof chips */}
      <Reveal delay={0.08}>
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

      {/* The Rhea-vs-Morpho contrast in ONE glance (was /propose) */}
      <Reveal delay={0.12}>
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="relative overflow-hidden border-near/25 bg-gradient-to-br from-near/[0.05] to-transparent">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-near/25 bg-near/10 text-near">
                <Cpu className="h-5 w-5" />
              </span>
              <div>
                <div className="text-xs text-zinc-500">NEAR · Rhea</div>
                <div className="text-white font-semibold">
                  The contract decides alone
                </div>
              </div>
            </div>
            <Badge tone="near">
              <Eye className="h-3 w-3" /> verified by contract
            </Badge>
          </Card>

          <Card className="relative overflow-hidden border-evm/25 bg-gradient-to-br from-evm/[0.05] to-transparent">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-evm/25 bg-evm/10 text-evm">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <div className="text-xs text-zinc-500">
                  Cross-chain · Morpho / Sepolia
                </div>
                <div className="text-white font-semibold">
                  The committee is required
                </div>
              </div>
            </div>
            <Badge tone="evm">
              <EyeOff className="h-3 w-3" /> committee required
            </Badge>
          </Card>
        </div>
      </Reveal>

      {/* Cross-chain Sepolia proof */}
      <Reveal delay={0.16}>
        <CrossChainProof />
      </Reveal>

      {/* Secondary — why the contrast, collapsed */}
      <Reveal delay={0.18}>
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
            <p className="text-zinc-400 border-t border-white/[0.06] pt-4">
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

      {/* Secondary — the proposed mandate rules, collapsed */}
      <Reveal delay={0.2}>
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
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          proposed mandate
        </span>
        <LiveIndicator source={mandate.source} loading={mandate.loading} />
      </div>

      {refused ? (
        <div className="flex flex-col items-start gap-3 py-1">
          <Badge tone="danger">
            <Ban className="h-3.5 w-3.5" /> REFUSED
          </Badge>
          <p className="text-base text-zinc-200 leading-relaxed max-w-xl">
            &ldquo;40% APY with no risk&rdquo; is not realizable. The
            deterministic risk model floors it above every sane ceiling.{" "}
            <span className="text-white">
              The agent will not propose a mandate it cannot honor.
            </span>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
          <KeyChip label="target APY" value={bps(m.target_apy_bps)} tone="near" />
          <KeyChip label="max risk" value={`${m.max_risk_score}/100`} tone="near" />
          <KeyChip
            label="allowed protocols"
            value={m.allowed_protocols.join(", ")}
            tone="evm"
          />
        </div>
      )}

      {/* the refuse toggle */}
      <div className="mt-6 flex items-center gap-2 border-t border-white/[0.06] pt-5">
        <span className="text-xs text-zinc-500 mr-1">try a brief:</span>
        <ToggleBtn active={!refused} onClick={() => setRefused(false)}>
          <Check className="h-3.5 w-3.5" /> realistic 8%
        </ToggleBtn>
        <ToggleBtn active={refused} onClick={() => setRefused(true)}>
          <Ban className="h-3.5 w-3.5" /> 40% · no risk
        </ToggleBtn>
      </div>

      <div className="mt-6 grid sm:grid-cols-2 gap-x-6 gap-y-4 border-t border-white/[0.06] pt-5">
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
              <Badge tone="evm">permanent · every cross-chain action</Badge>
            ) : (
              <span className="font-mono">{usdc(m.committee_threshold_usdc)}</span>
            )
          }
        />
      </div>
      <p className="text-xs text-zinc-500 mt-5 leading-relaxed border-t border-white/[0.06] pt-4">
        propose_action validates these deterministically BEFORE touching the
        committee — it fails closed. Out-of-mandate templates are rejected without
        ever drawing guardians.
      </p>
    </Details>
  );
}

function KeyChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "near" | "evm";
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div
        className={cn(
          "mt-1.5 text-lg font-semibold font-mono",
          tone === "near" ? "text-near" : "text-evm"
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
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-near/35 bg-near/10 text-near"
          : "border-white/10 bg-white/[0.02] text-zinc-400 hover:text-zinc-200"
      )}
    >
      {children}
    </button>
  );
}
