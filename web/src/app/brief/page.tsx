"use client";

import { useState } from "react";
import { postBrief } from "@/lib/agent";
import { EXAMPLE_BAD, EXAMPLE_GOOD } from "@/mock/brief";
import { AllocationOption, BriefProposal, Mandate } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  Copyable,
  RiskMeter,
  SectionTitle,
  Stat,
} from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { Reveal } from "@/components/motion";
import { bps, usdc } from "@/lib/format";
import { Ban, Sparkles, Users, Cpu, Loader2 } from "lucide-react";

function MandateView({ m }: { m: Mandate }) {
  return (
    <Card>
      <SectionTitle
        className="mb-5"
        sub="The agent proposes a Mandate it can honor. It holds only a function-call key scoped to this vault."
      >
        Proposed Mandate
      </SectionTitle>
      <div className="grid sm:grid-cols-3 gap-x-6 gap-y-4">
        <Stat label="owner" value={<Copyable value={m.owner} />} />
        <Stat
          label="target APY"
          value={<span className="font-mono">{bps(m.target_apy_bps)}</span>}
        />
        <Stat
          label="max risk score"
          value={<span className="font-mono">{m.max_risk_score}/100</span>}
        />
        <Stat label="allowed protocols" value={m.allowed_protocols.join(", ")} />
        <Stat label="allowed chains" value={m.allowed_chains.join(", ")} />
        <Stat
          label="max share / protocol"
          value={
            <span className="font-mono">{bps(m.max_share_per_protocol_bps)}</span>
          }
        />
        <Stat
          label="max loss"
          value={<span className="font-mono">{bps(m.max_loss_bps)}</span>}
        />
        <Stat
          label="daily cap"
          value={<span className="font-mono">{usdc(m.daily_cap_usdc)}</span>}
        />
        <Stat
          label="committee threshold"
          value={
            m.committee_threshold_usdc === "0" ? (
              <Badge tone="evm">PERMANENT · every cross-chain action</Badge>
            ) : (
              <span className="font-mono">{usdc(m.committee_threshold_usdc)}</span>
            )
          }
        />
      </div>
    </Card>
  );
}

function OptionCard({ o }: { o: AllocationOption }) {
  const crossChain = o.template.kind === "AllocateCrossChain";
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
              crossChain
                ? "border-evm/25 bg-evm/10 text-evm"
                : "border-near/25 bg-near/10 text-near"
            }`}
          >
            {crossChain ? <Users className="h-4 w-4" /> : <Cpu className="h-4 w-4" />}
          </span>
          <h3 className="font-semibold text-white tracking-tight">{o.label}</h3>
        </div>
        {crossChain ? (
          <Badge tone="evm">committee required</Badge>
        ) : (
          <Badge tone="near">contract alone</Badge>
        )}
      </div>
      <div className="flex gap-6 items-end">
        <Stat
          label="expected APY"
          value={<span className="font-mono text-near">{bps(o.expected_apy_bps)}</span>}
        />
        <div className="flex-1">
          <RiskMeter score={o.risk_score} />
        </div>
      </div>
      <p className="text-sm text-zinc-400 leading-relaxed">{o.risk_explanation}</p>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            deterministic risk factors · computed in TS, not the LLM
          </span>
          <span className="text-[10px] text-zinc-500">
            <span className="text-danger">+ risk</span> ·{" "}
            <span className="text-near">− risk</span>
          </span>
        </div>
        <div className="flex flex-col">
          {o.risk_factors.map((f) => {
            const adds = f.weight > 0;
            const reduces = f.weight < 0;
            return (
              <div
                key={f.factor}
                className="flex items-center justify-between text-xs border-b border-white/[0.04] py-1.5"
              >
                <span className="text-zinc-300 w-28 shrink-0">{f.factor}</span>
                <span className="text-zinc-500 flex-1 px-3 truncate">{f.note}</span>
                <span
                  className={`font-mono tabular-nums ${
                    adds ? "text-danger" : reduces ? "text-near" : "text-zinc-400"
                  }`}
                  title={
                    adds
                      ? "increases risk score"
                      : reduces
                      ? "decreases risk score"
                      : "neutral"
                  }
                >
                  {adds ? `+${f.weight}` : f.weight}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="border-t border-white/[0.06] pt-4">
        <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5">
          templated action
        </div>
        <Mono value={JSON.stringify(o.template)} />
      </div>
    </Card>
  );
}

// small wrapper so JSON template is copyable
function Mono({ value }: { value: string }) {
  return <Copyable value={value} label="Template copied" />;
}

export default function BriefPage() {
  const [brief, setBrief] = useState(EXAMPLE_GOOD);
  const [result, setResult] = useState<{
    proposal: BriefProposal;
    source: "live" | "mock";
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    const r = await postBrief(brief);
    setResult(r);
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<Badge tone="near">agent</Badge>}
        title="Brief → Proposal"
        sub="POST /brief → NEAR AI Cloud when the agent service is up; falls back to mock here. Risk scores are deterministic — the LLM only explains them."
      />

      <Reveal>
        <Card>
          <div className="relative">
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={3}
              className="w-full rounded-xl bg-ink border border-white/[0.08] p-4 text-sm text-zinc-100 outline-none transition-colors focus:border-near/40 focus:ring-4 focus:ring-near/5 resize-none"
              placeholder="Describe what you want in plain language…"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2.5 mt-4">
            <Button type="submit" onClick={submit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Submit brief
                </>
              )}
            </Button>
            <Button tone="ghost" onClick={() => setBrief(EXAMPLE_GOOD)}>
              Load realistic example
            </Button>
            <Button tone="ghost" onClick={() => setBrief(EXAMPLE_BAD)}>
              Load unrealistic (&quot;40% no risk&quot;)
            </Button>
            {result && (
              <Badge tone={result.source === "live" ? "ok" : "warn"}>
                source: {result.source}
              </Badge>
            )}
          </div>
        </Card>
      </Reveal>

      {result?.proposal.refused && (
        <Reveal>
          <Card className="border-danger/35 bg-danger/[0.05]">
            <div className="flex items-center gap-2.5 mb-3">
              <Badge tone="danger">
                <Ban className="h-3 w-3" /> REFUSED
              </Badge>
              <span className="text-white font-semibold">
                The agent will not propose a Mandate it cannot honor.
              </span>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">
              {result.proposal.refusal_reason}
            </p>
          </Card>
        </Reveal>
      )}

      {result && !result.proposal.refused && (
        <>
          {result.proposal.explanation && (
            <Reveal>
              <Card>
                <p className="text-sm text-zinc-300 leading-relaxed">
                  {result.proposal.explanation}
                </p>
              </Card>
            </Reveal>
          )}
          {result.proposal.mandate && (
            <Reveal>
              <MandateView m={result.proposal.mandate} />
            </Reveal>
          )}
          <SectionTitle>Allocation options</SectionTitle>
          <div className="grid md:grid-cols-2 gap-4">
            {result.proposal.options.map((o) => (
              <Reveal key={o.id}>
                <OptionCard o={o} />
              </Reveal>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
