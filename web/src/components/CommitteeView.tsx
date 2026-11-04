"use client";

import { useEffect, useMemo, useState } from "react";
import { GuardianReport, GuardianRow, Tally } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  ErrorBanner,
  LiveIndicator,
  Mono,
  Skeleton,
  Stat,
} from "./ui";
import { ReasonCodeBadges } from "./ReasonCodes";
import {
  canonicalJson,
  price6,
  sha256Hex,
  shortHash,
  usdc,
  yoctoToNear,
} from "@/lib/format";
import { live, MOCK_MODE } from "@/lib/near";
import { useLive } from "@/lib/useLive";
import { REPORTS_BY_ACTION } from "@/mock/reports";
import type { CommitteeLive } from "@/lib/types";

type Phase = "draw" | "commit" | "reveal";

// A committee member resolved for the demo: live guardian row + its revealed
// report. `commitLive` is the on-chain stored commit (view_commit); `commitHash`
// is sha256(reportString) recomputed in-browser over the EXACT bytes returned by
// view_report. `commitMatches` proves the commit-reveal binding against the chain.
interface ResolvedMember {
  row: GuardianRow;
  report: GuardianReport | null;
  reportString: string | null; // raw bytes the commit was computed over
  commitHash: string | null; // recomputed sha256(reportString)
  commitLive: string | null; // on-chain view_commit value
  commitMatches: boolean | null;
  source: "live" | "mock";
}

function GuardianCard({
  m,
  phase,
  index,
}: {
  m: ResolvedMember;
  phase: Phase;
  index: number;
}) {
  const revealed = phase === "reveal" && m.report;
  const slashed = m.row.status === "Slashed";
  return (
    <div
      className={`animate-rise stagger-${index} rounded-lg border p-4 flex flex-col gap-3 ${
        slashed
          ? "border-danger/50 bg-danger/5"
          : "border-edge bg-ink/40"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="font-mono text-xs text-slate-400">{m.row.id}</div>
          <div className="text-sm text-white">
            {m.row.account.split(".")[0]}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone="near">{yoctoToNear(m.row.bond)} Ⓝ bond</Badge>
          {slashed && <Badge tone="danger">SLASHED</Badge>}
        </div>
      </div>

      {phase === "draw" && (
        <div className="text-xs text-slate-500 italic">
          drawn · awaiting commit…
        </div>
      )}

      {phase !== "draw" && (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs uppercase tracking-wide text-slate-500">
              commit hash (phase 1)
            </span>
            {m.source === "live" && m.commitLive && (
              <Badge tone="near">on-chain</Badge>
            )}
          </div>
          <Mono>{shortHash(m.commitLive ?? m.commitHash, 18, 10)}</Mono>
        </div>
      )}

      {revealed && m.report && (
        <div className="animate-reveal border-t border-edge pt-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide text-slate-500">
              revealed report (phase 2)
            </span>
            {m.report.approve ? (
              <Badge tone={slashed ? "danger" : "ok"}>
                {slashed ? "APPROVE (lie)" : "APPROVE"}
              </Badge>
            ) : (
              <Badge tone="ok">REFUSE</Badge>
            )}
          </div>
          <ReasonCodeBadges codes={m.report.reason_codes} />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Stat label="price usdc" value={price6(m.report.facts.price_usdc)} />
            <Stat
              label="read block"
              value={m.report.facts.price_block ?? "—"}
            />
            <Stat
              label="slippage"
              value={
                m.report.facts.observed_slippage_bps != null
                  ? `${m.report.facts.observed_slippage_bps} bps`
                  : "—"
              }
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
          {m.commitMatches ? (
            <div className="text-xs mt-1 text-ok">
              ✓ sha256(report) == {m.source === "live" ? "view_commit" : "commit"}
              <span className="text-slate-600">
                {" "}
                · recomputed in-browser
                {m.source === "live" ? " vs on-chain" : ""}
              </span>
            </div>
          ) : m.commitMatches === false ? (
            <div className="text-xs mt-1 text-danger">
              ✗ sha256(report) != view_commit · binding broken
            </div>
          ) : (
            <div className="text-xs mt-1 text-slate-600">
              commit binding unavailable
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PhaseStepper({
  phase,
  setPhase,
  blocked,
}: {
  phase: Phase;
  setPhase: (p: Phase) => void;
  blocked: boolean;
}) {
  const order: Phase[] = ["draw", "commit", "reveal"];
  const idx = order.indexOf(phase);
  const labels: Record<Phase, string> = {
    draw: "1 · Committee drawn",
    commit: "2 · Commit hashes",
    reveal: "3 · Reveal + tally",
  };
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {order.map((p, i) => (
        <div key={p} className="flex items-center gap-2">
          <div
            className={`rounded-full px-3 py-1 text-xs font-medium border transition ${
              idx >= i
                ? "bg-near/15 text-near border-near/40"
                : "bg-edge/30 text-slate-500 border-edge"
            }`}
          >
            {labels[p]}
          </div>
          {i < 2 && <span className="text-slate-600">→</span>}
        </div>
      ))}
      <div className="ml-auto flex gap-2">
        <Button
          tone="ghost"
          onClick={() => setPhase(order[Math.max(0, idx - 1)])}
          disabled={idx === 0}
        >
          ◀ back
        </Button>
        <Button
          onClick={() => setPhase(order[Math.min(2, idx + 1)])}
          disabled={idx === 2}
        >
          {phase === "draw" ? "Publish commits ▶" : "Reveal reports ▶"}
        </Button>
      </div>
      {blocked && phase === "reveal" && (
        <span className="w-full" />
      )}
    </div>
  );
}

export function CommitteeView({
  actionId,
  template,
}: {
  actionId: string;
  template: string;
}) {
  const [phase, setPhase] = useState<Phase>("draw");

  // Mock fallback committee (shape-compatible) for offline / failure mode.
  const reports = useMemo(() => REPORTS_BY_ACTION[actionId] ?? {}, [actionId]);
  const mockCommittee: CommitteeLive = useMemo(() => {
    const ids = Object.keys(reports);
    const members: GuardianRow[] = ids.map((id) => ({
      id,
      account: `${id}.mandate-arthur.testnet`,
      wasm_url: "",
      wasm_sha256: "mock",
      bond: id === "g7" ? "0" : "3000000000000000000000000",
      status: id === "g7" ? "Slashed" : "Active",
      last_drawn_vault: "demo.vaults.mandate-arthur.testnet",
      unbond_ready_at: null,
      bond_usdc: id === "g7" ? "0" : "15000000",
    }));
    const approvals = ids.filter((id) => reports[id]?.approve).length;
    const tally: Tally = { approvals, threshold_met: approvals >= 2 };
    return { action_id: actionId, member_ids: ids, members, tally };
  }, [actionId, reports]);

  const state = useLive<CommitteeLive>(
    () => live.committeeLive(actionId),
    mockCommittee,
    [actionId]
  );

  const committee = state.data ?? mockCommittee;

  // Resolve each drawn guardian's report + commit binding. In live mode we hit
  // view_report / view_commit on the coordinator, parse the EXACT report string,
  // recompute sha256 over its raw bytes (NOT a re-serialization), and compare it
  // to the on-chain commit. On MOCK_MODE or any call failure we fall back to the
  // mock report payload and hash sha256(canonicalJson(report)).
  const [resolved, setResolved] = useState<ResolvedMember[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out = await Promise.all(
        committee.members.map(async (row): Promise<ResolvedMember> => {
          // Mock fallback payload for this guardian.
          const mockReport = reports[row.id] ?? null;
          const mockResolved = async (): Promise<ResolvedMember> => {
            const commitHash = mockReport
              ? await sha256Hex(canonicalJson(mockReport))
              : null;
            return {
              row,
              report: mockReport,
              reportString: mockReport ? canonicalJson(mockReport) : null,
              commitHash,
              commitLive: commitHash,
              commitMatches: mockReport ? true : null,
              source: "mock",
            };
          };

          if (MOCK_MODE) return mockResolved();

          try {
            const [reportString, commitLive] = await Promise.all([
              live.report(actionId, row.id),
              live.commit(actionId, row.id).catch(() => null),
            ]);
            if (reportString == null) return mockResolved();

            // Hash the EXACT bytes the on-chain commit was computed over.
            const commitHash = await sha256Hex(reportString);
            const report = JSON.parse(reportString) as GuardianReport;
            const commitMatches =
              commitLive != null ? commitHash === commitLive : null;
            return {
              row,
              report,
              reportString,
              commitHash,
              commitLive,
              commitMatches,
              source: "live",
            };
          } catch {
            return mockResolved();
          }
        })
      );
      if (!cancelled) setResolved(out);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committee, actionId]);

  const tally = committee.tally;
  const thresholdMet = tally.threshold_met;
  const quorumUsdc = committee.members.reduce(
    (s, m) => s + Number(m.bond_usdc),
    0
  );

  if (state.loading && resolved.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-20 w-full" />
        <div className="grid md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {state.error && <ErrorBanner message={state.error} />}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wide text-slate-500">
                action
              </span>
              <LiveIndicator source={state.source} loading={state.loading} />
            </div>
            <div className="font-mono text-sm text-white">
              {actionId} · {template}
            </div>
          </div>
          <div className="flex gap-4">
            <Stat label="committee" value={`${committee.member_ids.length} guardians`} />
            <Stat
              label="quorum bond"
              value={
                <span className="text-near">{usdc(String(quorumUsdc))}</span>
              }
            />
            <Stat
              label="threshold"
              value={<span className="text-slate-200">2 of 3</span>}
            />
          </div>
        </div>
      </Card>

      <PhaseStepper phase={phase} setPhase={setPhase} blocked={!thresholdMet} />

      <div className="grid md:grid-cols-3 gap-4">
        {resolved.map((m, i) => (
          <GuardianCard key={m.row.id} m={m} phase={phase} index={i} />
        ))}
      </div>

      {/* tally — distinct BLOCKED state, NOT the green threshold badge */}
      <Card
        className={
          phase !== "reveal"
            ? "opacity-50"
            : thresholdMet
            ? "border-ok/40"
            : "border-danger/50 bg-danger/5"
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">
              2-of-3 tally{" "}
              <span className="text-slate-600">(live on-chain)</span>
            </div>
            <div className="text-2xl font-semibold text-white mt-1">
              {phase === "reveal" ? tally.approvals : "—"}
              <span className="text-slate-500 text-lg"> / 3 approvals</span>
            </div>
          </div>
          {phase !== "reveal" ? (
            <Badge tone="muted">reveal to tally</Badge>
          ) : thresholdMet ? (
            <Badge tone="ok">THRESHOLD MET · action may execute</Badge>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm text-danger font-semibold">
                {tally.approvals}/3 &lt; 2-of-3
              </span>
              <span className="rounded-md border border-danger/50 bg-danger/10 px-3 py-1 text-sm font-bold text-danger tracking-wide">
                ⛔ BLOCKED
              </span>
            </div>
          )}
        </div>
        {phase === "reveal" && !thresholdMet && (
          <p className="text-sm text-slate-400 mt-3 border-t border-edge pt-3">
            Only the corrupt guardian approved, alone, off a non-verifiable
            feed. The two honest guardians refused. 1 &lt; 2-of-3 → the action
            never clears. User funds never move on a lie.
          </p>
        )}
      </Card>
    </div>
  );
}
