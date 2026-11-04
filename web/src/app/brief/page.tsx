"use client";

import { useState } from "react";
import { postBrief } from "@/lib/agent";
import { EXAMPLE_BAD, EXAMPLE_GOOD } from "@/mock/brief";
import { AllocationOption, BriefProposal, Mandate } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  Mono,
  RiskMeter,
  SectionTitle,
  Stat,
} from "@/components/ui";
import { bps, usdc } from "@/lib/format";

function MandateView({ m }: { m: Mandate }) {
  return (
    <Card>
      <SectionTitle sub="The agent proposes a Mandate it can honor. It holds only a function-call key scoped to this vault.">
        Proposed Mandate
      </SectionTitle>
      <div className="grid sm:grid-cols-3 gap-4">
        <Stat label="owner" value={<Mono>{m.owner}</Mono>} />
        <Stat label="target APY" value={bps(m.target_apy_bps)} />
        <Stat label="max risk score" value={`${m.max_risk_score}/100`} />
        <Stat label="allowed protocols" value={m.allowed_protocols.join(", ")} />
        <Stat label="allowed chains" value={m.allowed_chains.join(", ")} />
        <Stat
          label="max share / protocol"
          value={bps(m.max_share_per_protocol_bps)}
        />
        <Stat label="max loss" value={bps(m.max_loss_bps)} />
        <Stat label="daily cap" value={usdc(m.daily_cap_usdc)} />
        <Stat
          label="committee threshold"
          value={
            m.committee_threshold_usdc === "0" ? (
              <Badge tone="evm">PERMANENT (every cross-chain action)</Badge>
            ) : (
              usdc(m.committee_threshold_usdc)
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
        <h3 className="font-semibold text-white">{o.label}</h3>
        {crossChain ? (
          <Badge tone="evm">committee required</Badge>
        ) : (
          <Badge tone="near">contract alone</Badge>
        )}
      </div>
      <div className="flex gap-6">
        <Stat label="expected APY" value={bps(o.expected_apy_bps)} />
        <div className="flex-1">
          <RiskMeter score={o.risk_score} />
        </div>
      </div>
      <p className="text-sm text-slate-400">{o.risk_explanation}</p>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wide text-slate-500">
            deterministic risk factors (computed in TS, not by the LLM)
          </span>
          <span className="text-[10px] text-slate-500">
            <span className="text-danger">+ adds risk</span> ·{" "}
            <span className="text-ok">− reduces risk</span>
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {o.risk_factors.map((f) => {
            const adds = f.weight > 0;
            const reduces = f.weight < 0;
            return (
              <div
                key={f.factor}
                className="flex items-center justify-between text-xs border-b border-edge/60 py-1"
              >
                <span className="text-slate-300">{f.factor}</span>
                <span className="text-slate-500 flex-1 px-3">{f.note}</span>
                <span
                  className={`font-mono ${
                    adds ? "text-danger" : reduces ? "text-ok" : "text-slate-400"
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
                  <span className="text-slate-600">
                    {" "}
                    {adds ? "risk" : reduces ? "risk" : ""}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="border-t border-edge pt-3">
        <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
          templated action
        </div>
        <Mono>{JSON.stringify(o.template)}</Mono>
      </div>
    </Card>
  );
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
    <div className="flex flex-col gap-6">
      <div>
        <SectionTitle sub="POST /brief → NEAR AI Cloud when the agent service is up; falls back to mock here. Risk scores are deterministic; the LLM only explains them.">
          Brief → Proposal
        </SectionTitle>
      </div>

      <Card>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={3}
          className="w-full rounded-lg bg-ink border border-edge p-3 text-sm text-slate-100 outline-none focus:border-near/50"
          placeholder="Describe what you want in plain language…"
        />
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <Button type="submit" onClick={submit} disabled={loading}>
            {loading ? "Thinking…" : "Submit brief"}
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

      {result?.proposal.refused && (
        <Card className="border-danger/50 bg-danger/5">
          <div className="flex items-center gap-2 mb-2">
            <Badge tone="danger">REFUSED</Badge>
            <span className="text-white font-semibold">
              The agent will not propose a Mandate it cannot honor.
            </span>
          </div>
          <p className="text-sm text-slate-300">
            {result.proposal.refusal_reason}
          </p>
        </Card>
      )}

      {result && !result.proposal.refused && (
        <>
          {result.proposal.explanation && (
            <Card>
              <p className="text-sm text-slate-300">
                {result.proposal.explanation}
              </p>
            </Card>
          )}
          {result.proposal.mandate && (
            <MandateView m={result.proposal.mandate} />
          )}
          <SectionTitle>Allocation options</SectionTitle>
          <div className="grid md:grid-cols-2 gap-4">
            {result.proposal.options.map((o) => (
              <OptionCard key={o.id} o={o} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
