"use client";

import { useState } from "react";
import { ActionState, CommitteeMember } from "@/lib/types";
import { Badge, Button, Card, Mono, Stat } from "./ui";
import { ReasonCodeBadges } from "./ReasonCodes";
import { price6, shortHash, usdc } from "@/lib/format";

type Phase = "draw" | "commit" | "reveal";

function GuardianCard({
  m,
  phase,
}: {
  m: CommitteeMember;
  phase: Phase;
}) {
  const revealed = phase === "reveal" && m.report;
  return (
    <div className="rounded-lg border border-edge bg-ink/40 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-xs text-slate-400">{m.guardian.id}</div>
          <div className="text-sm text-white">
            {m.guardian.account.split(".")[0]}
          </div>
        </div>
        <Badge tone="near">bond {Number(m.guardian.bond_near).toLocaleString()} Ⓝ</Badge>
      </div>

      {phase === "draw" && (
        <div className="text-xs text-slate-500 italic">
          drawn · awaiting commit…
        </div>
      )}

      {phase !== "draw" && (
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
            commit hash (phase 1)
          </div>
          <Mono>{shortHash(m.commit_hash, 18, 10)}</Mono>
        </div>
      )}

      {revealed && m.report && (
        <div className="border-t border-edge pt-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-slate-500">
              revealed report (phase 2)
            </span>
            {m.report.approve ? (
              <Badge tone="ok">APPROVE</Badge>
            ) : (
              <Badge tone="danger">REJECT</Badge>
            )}
          </div>
          <ReasonCodeBadges codes={m.report.reason_codes} />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Stat label="price usdc" value={price6(m.report.facts.price_usdc)} />
            <Stat label="read block" value={m.report.facts.price_block} />
            <Stat
              label="slippage"
              value={`${m.report.facts.observed_slippage_bps} bps`}
            />
            <Stat
              label="paused"
              value={m.report.facts.protocol_paused ? "yes" : "no"}
            />
          </div>
          <div className="text-xs text-slate-500 mt-1">sources</div>
          <div className="flex flex-col gap-1">
            {m.report.sources.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {s.verifiable ? (
                  <Badge tone="ok">verifiable</Badge>
                ) : (
                  <Badge tone="warn">unverifiable</Badge>
                )}
                <span className="text-slate-300">{s.name}</span>
                <Mono>{s.payload_ref ?? s.endpoint}</Mono>
              </div>
            ))}
          </div>
          <div className="text-xs mt-1">
            {m.reveal_matches_commit ? (
              <span className="text-ok">
                ✓ sha256(report) == commit
              </span>
            ) : (
              <span className="text-danger">✗ reveal does not match commit</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function CommitteeView({ action }: { action: ActionState }) {
  const [phase, setPhase] = useState<Phase>("draw");

  const approvals = action.committee.filter(
    (m) => m.report?.approve
  ).length;
  const quorumBond = action.committee.reduce(
    (s, m) => s + Number(m.guardian.bond_near),
    0
  );

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              action
            </div>
            <div className="font-mono text-sm text-white">
              {action.action_id} · {action.template.kind}
            </div>
          </div>
          <div className="flex gap-4">
            <Stat label="value" value={usdc(action.value_usdc)} />
            <Stat
              label="quorum bond"
              value={
                <span className="text-near">
                  {quorumBond.toLocaleString()} Ⓝ
                </span>
              }
            />
            <Stat
              label="bond > value"
              value={
                quorumBond * 1e6 >= Number(action.value_usdc) ? (
                  <span className="text-ok">✓ insured</span>
                ) : (
                  <span className="text-danger">✗</span>
                )
              }
            />
          </div>
        </div>
        {action.note && (
          <p className="text-sm text-slate-400 mt-3 border-t border-edge pt-3">
            {action.note}
          </p>
        )}
      </Card>

      {/* phase stepper */}
      <div className="flex items-center gap-2">
        {(["draw", "commit", "reveal"] as Phase[]).map((p, i) => {
          const active =
            ["draw", "commit", "reveal"].indexOf(phase) >= i;
          const labels = {
            draw: "1 · Committee drawn",
            commit: "2 · Commit hashes",
            reveal: "3 · Reveal + tally",
          };
          return (
            <div key={p} className="flex items-center gap-2">
              <div
                className={`rounded-full px-3 py-1 text-xs font-medium border ${
                  active
                    ? "bg-near/15 text-near border-near/40"
                    : "bg-edge/30 text-slate-500 border-edge"
                }`}
              >
                {labels[p]}
              </div>
              {i < 2 && <span className="text-slate-600">→</span>}
            </div>
          );
        })}
        <div className="ml-auto flex gap-2">
          <Button
            tone="ghost"
            onClick={() =>
              setPhase(phase === "reveal" ? "commit" : "draw")
            }
            disabled={phase === "draw"}
          >
            ◀ back
          </Button>
          <Button
            onClick={() =>
              setPhase(phase === "draw" ? "commit" : "reveal")
            }
            disabled={phase === "reveal"}
          >
            {phase === "draw"
              ? "Publish commits ▶"
              : "Reveal reports ▶"}
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {action.committee.map((m) => (
          <GuardianCard key={m.guardian.id} m={m} phase={phase} />
        ))}
      </div>

      {/* tally */}
      <Card className={phase === "reveal" ? "" : "opacity-50"}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              2-of-3 tally
            </div>
            <div className="text-2xl font-semibold text-white mt-1">
              {phase === "reveal" ? approvals : "—"}
              <span className="text-slate-500 text-lg"> / 3 approvals</span>
            </div>
          </div>
          {phase === "reveal" ? (
            approvals >= 2 ? (
              <Badge tone="ok">THRESHOLD MET · action may execute</Badge>
            ) : (
              <Badge tone="danger">THRESHOLD NOT MET · action blocked</Badge>
            )
          ) : (
            <Badge tone="muted">reveal to tally</Badge>
          )}
        </div>
      </Card>
    </div>
  );
}
