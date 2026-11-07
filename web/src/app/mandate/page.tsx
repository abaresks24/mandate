"use client";

import { useState } from "react";
import { Ban, Check } from "lucide-react";
import { live } from "@/lib/near";
import { useLive } from "@/lib/useLive";
import { MANDATE } from "@/mock/mandate";
import { Badge, Card, Copyable, LiveIndicator, Stat } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { StepHeader, StepNav, Details } from "@/components/journey";
import { bps, usdc } from "@/lib/format";
import type { Mandate } from "@/lib/types";
import { cn } from "@/lib/cn";

export default function MandateStep() {
  const mandate = useLive<Mandate>(() => live.mandate(), MANDATE, []);
  const m = mandate.data ?? MANDATE;
  const [refused, setRefused] = useState(false);

  return (
    <div className="flex flex-col gap-10">
      <Reveal>
        <StepHeader
          n={2}
          kicker="set a mandate"
          title="You set the rules. The agent can only move within them."
          context="A mandate is a hard contract: target yield, a risk ceiling, and the only protocols the agent may ever touch. The agent refuses anything it cannot honor."
        />
      </Reveal>

      {/* HERO — the proposed mandate as a few key chips + refuse toggle */}
      <Reveal delay={0.08}>
        <Card className="relative overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              proposed mandate
            </span>
            <LiveIndicator source={mandate.source} loading={mandate.loading} />
          </div>

          {refused ? (
            <div className="flex flex-col items-start gap-3 py-2">
              <Badge tone="danger">
                <Ban className="h-3.5 w-3.5" /> REFUSED
              </Badge>
              <p className="text-base text-zinc-200 leading-relaxed max-w-xl">
                &ldquo;40% APY with no risk&rdquo; is not realizable. The deterministic
                risk model floors it above every sane ceiling.{" "}
                <span className="text-white">
                  The agent will not propose a mandate it cannot honor.
                </span>
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              <KeyChip label="target APY" value={bps(m.target_apy_bps)} tone="near" />
              <KeyChip
                label="max risk"
                value={`${m.max_risk_score}/100`}
                tone="near"
              />
              <KeyChip
                label="allowed protocols"
                value={m.allowed_protocols.join(", ")}
                tone="evm"
              />
            </div>
          )}

          {/* the refuse toggle */}
          <div className="mt-7 flex items-center gap-2 border-t border-white/[0.06] pt-5">
            <span className="text-xs text-zinc-500 mr-1">try a brief:</span>
            <ToggleBtn active={!refused} onClick={() => setRefused(false)}>
              <Check className="h-3.5 w-3.5" /> realistic 8%
            </ToggleBtn>
            <ToggleBtn active={refused} onClick={() => setRefused(true)}>
              <Ban className="h-3.5 w-3.5" /> 40% · no risk
            </ToggleBtn>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.14}>
        <Details label="Show the full mandate rules">
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
            <Stat label="owner" value={<Copyable value={m.owner} />} />
            <Stat
              label="max loss"
              value={<span className="font-mono">{bps(m.max_loss_bps)}</span>}
            />
            <Stat
              label="max share / protocol"
              value={
                <span className="font-mono">
                  {bps(m.max_share_per_protocol_bps)}
                </span>
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
                  <span className="font-mono">
                    {usdc(m.committee_threshold_usdc)}
                  </span>
                )
              }
            />
          </div>
          <p className="text-xs text-zinc-500 mt-5 leading-relaxed border-t border-white/[0.06] pt-4">
            propose_action validates these deterministically BEFORE touching the
            committee — it fails closed. Out-of-mandate templates are rejected
            without ever drawing guardians (prompt-injection defense).
          </p>
        </Details>
      </Reveal>

      <StepNav n={2} />
    </div>
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
