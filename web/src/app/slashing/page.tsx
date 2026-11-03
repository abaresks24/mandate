"use client";

import { useState } from "react";
import { coordinator } from "@/lib/near";
import { CHALLENGE, SLASHING_ACTION } from "@/mock/slashing";
import { CommitteeView } from "@/components/CommitteeView";
import { Badge, Button, Card, Mono, SectionTitle, Stat } from "@/components/ui";
import { price6 } from "@/lib/format";

type Step = "attack" | "challenged" | "resolved";

export default function SlashingPage() {
  const [step, setStep] = useState<Step>("attack");
  const c = CHALLENGE;

  async function openChallenge() {
    await coordinator.open_challenge(
      c.action_id,
      c.corrupt_guardian.id,
      c.fault,
      c.proof_json
    );
    setStep("challenged");
  }
  async function resolve() {
    await coordinator.resolve_challenge(c.challenge_id);
    setStep("resolved");
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle sub="A corrupt guardian lies about a price source. Honest guardians refuse, the action is blocked, and a fault proof gets the liar slashed.">
        Slashing demo
      </SectionTitle>

      <Card className="border-danger/40 bg-danger/5">
        <div className="flex items-center gap-2 mb-2">
          <Badge tone="danger">attack</Badge>
          <span className="text-white font-semibold">
            Guardian {c.corrupt_guardian.id} ({c.corrupt_guardian.account.split(".")[0]})
            reports a fabricated depeg
          </span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-2">
          <Stat
            label="liar claims"
            value={<span className="text-danger">{c.lying_claim}</span>}
          />
          <Stat
            label="honest guardians read"
            value={<span className="text-ok">{c.honest_claim}</span>}
          />
        </div>
        <p className="text-sm text-slate-400 mt-3">
          The liar&apos;s only source is a non-verifiable custom endpoint. The
          two honest guardians read the SAME block from a verifiable Pyth signed
          update and saw USDC at {price6("1000015")}. Because reports are
          deterministic for a given block, anyone can re-derive the truth — the
          false attestation is provable.
        </p>
      </Card>

      <div>
        <SectionTitle>Committee outcome — action blocked</SectionTitle>
        <CommitteeView action={SLASHING_ACTION} />
      </div>

      <Card>
        <SectionTitle sub="open_challenge(action_id, guardian_id, FalseAttestation, proof_json) — payable with a challenger deposit.">
          Fault proof → slashing
        </SectionTitle>

        {/* progress */}
        <div className="flex items-center gap-2 mb-5">
          {(
            [
              ["attack", "Action blocked"],
              ["challenged", "Challenge opened"],
              ["resolved", "Bond slashed"],
            ] as [Step, string][]
          ).map(([s, label], i) => {
            const idx = ["attack", "challenged", "resolved"].indexOf(step);
            const active = idx >= i;
            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={`rounded-full px-3 py-1 text-xs font-medium border ${
                    active
                      ? "bg-danger/15 text-danger border-danger/40"
                      : "bg-edge/30 text-slate-500 border-edge"
                  }`}
                >
                  {i + 1} · {label}
                </div>
                {i < 2 && <span className="text-slate-600">→</span>}
              </div>
            );
          })}
        </div>

        {step === "attack" && (
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-300 flex-1">
              A challenger (any honest party or guardian) submits the fault
              proof below.
            </p>
            <Button tone="danger" onClick={openChallenge}>
              Submit fault proof
            </Button>
          </div>
        )}

        {step === "challenged" && (
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-300 flex-1">
              Challenge <Mono>{c.challenge_id}</Mono> opened against{" "}
              <Mono>{c.corrupt_guardian.id}</Mono>. The coordinator re-derives
              the report from the same block + signed update.
            </p>
            <Button tone="danger" onClick={resolve}>
              resolve_challenge()
            </Button>
          </div>
        )}

        {step === "resolved" && (
          <div className="grid sm:grid-cols-3 gap-4">
            <Card className="bg-danger/5 border-danger/40">
              <Stat
                label="guardian"
                value={
                  <span>
                    {c.corrupt_guardian.id}{" "}
                    <Badge tone="danger">SLASHED</Badge>
                  </span>
                }
              />
              <div className="mt-2 text-2xl font-semibold text-danger">
                −{Number(c.slashed_near).toLocaleString()} Ⓝ
              </div>
              <div className="text-xs text-slate-500">full bond slashed</div>
            </Card>
            <Card className="bg-ok/5 border-ok/40">
              <Stat label="challenger" value={<Badge tone="ok">REWARDED</Badge>} />
              <div className="mt-2 text-2xl font-semibold text-ok">
                +{Number(c.challenger_reward_near).toLocaleString()} Ⓝ
              </div>
              <div className="text-xs text-slate-500">
                deposit refunded + reward
              </div>
            </Card>
            <Card>
              <Stat label="action" value={<Mono>{c.action_id}</Mono>} />
              <div className="mt-2 text-sm text-slate-300">
                stayed <span className="text-danger">BLOCKED</span>. User funds
                never moved on a lie.
              </div>
            </Card>
          </div>
        )}

        <div className="mt-5">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
            proof_json (re-derivable)
          </div>
          <pre className="rounded-lg bg-ink border border-edge p-3 text-xs text-slate-300 overflow-x-auto">
            {c.proof_json}
          </pre>
        </div>
      </Card>
    </div>
  );
}
