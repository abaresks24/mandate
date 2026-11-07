"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Hash,
  ShieldCheck,
  ShieldX,
  Fingerprint,
  Dices,
} from "lucide-react";
import { GuardianReport, GuardianRow, Tally } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  Copyable,
  ErrorBanner,
  LiveIndicator,
  Skeleton,
  Stat,
  StatusBadge,
} from "./ui";
import { motion, CountUp } from "./motion";
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
import { cn } from "@/lib/cn";

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

// ---------------------------------------------------------------------------
// Shared live resolver hook — owns ALL the data logic (view_committeeLive,
// view_report / view_commit, in-browser sha256 binding, mock fallback).
// Both the collapsed summary and the full lifecycle read from this.
// ---------------------------------------------------------------------------
function useResolvedCommittee(actionId: string) {
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

  const quorumUsdc = committee.members.reduce(
    (s, m) => s + Number(m.bond_usdc),
    0
  );

  return { state, committee, resolved, quorumUsdc };
}

// ---------------------------------------------------------------------------
// HERO (default view) — just the tally count-up + minimal guardian chips.
// No commit/reveal detail. Live tally read straight off the chain.
// ---------------------------------------------------------------------------
export function CommitteeSummary({ actionId }: { actionId: string }) {
  const { state, committee } = useResolvedCommittee(actionId);
  const tally = committee.tally;
  const met = tally.threshold_met;

  if (state.loading && committee.members.length === 0) {
    return <Skeleton className="h-56 w-full rounded-3xl" />;
  }

  return (
    <Card
      className={cn(
        "relative overflow-hidden text-center",
        met ? "border-near/30 shadow-glow" : "border-danger/35 shadow-glow-danger"
      )}
    >
      <div
        className={cn(
          "pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl",
          met ? "bg-near/10" : "bg-danger/10"
        )}
        aria-hidden
      />
      <div className="relative flex flex-col items-center gap-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
            action {actionId} · live tally
          </span>
          <LiveIndicator source={state.source} loading={state.loading} />
        </div>

        <div
          className={cn(
            "text-6xl sm:text-7xl font-semibold font-mono tabular-nums",
            met ? "text-near" : "text-danger"
          )}
        >
          <CountUp value={tally.approvals} /> of {committee.member_ids.length}
        </div>

        {met ? (
          <Badge tone="ok" className="text-sm px-3 py-1">
            <CheckCircle2 className="h-4 w-4" /> approved · threshold met
          </Badge>
        ) : (
          <Badge tone="danger" className="text-sm px-3 py-1">
            <Ban className="h-4 w-4" /> blocked · threshold not met
          </Badge>
        )}

        {/* the drawn guardians as minimal chips */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {committee.members.map((m) => {
            const slashed = m.status === "Slashed";
            return (
              <span
                key={m.id}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs",
                  slashed
                    ? "border-danger/30 bg-danger/10 text-danger"
                    : "border-near/25 bg-near/10 text-near"
                )}
              >
                {m.id}
                {slashed && <ShieldX className="h-3 w-3" />}
              </span>
            );
          })}
        </div>
      </div>
    </Card>
  );
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
  const reduce = useReducedMotion();
  const revealed = phase === "reveal" && m.report;
  const slashed = m.row.status === "Slashed";
  const commit = m.commitLive ?? m.commitHash;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: index * 0.08 }}
      className={cn(
        "relative rounded-2xl border p-5 flex flex-col gap-4 backdrop-blur-xl transition-colors",
        slashed
          ? "border-danger/35 bg-danger/[0.04]"
          : "border-white/[0.07] bg-panel/50"
      )}
    >
      {/* header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl border font-mono text-xs font-semibold",
              slashed
                ? "border-danger/30 bg-danger/10 text-danger"
                : "border-near/25 bg-near/10 text-near"
            )}
          >
            {m.row.id}
          </span>
          <div>
            <div className="text-sm font-medium text-white">
              {m.row.account.split(".")[0]}
            </div>
            <div className="text-xs text-zinc-500">guardian</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Badge tone={slashed ? "danger" : "near"}>
            {yoctoToNear(m.row.bond)} Ⓝ
          </Badge>
          {slashed && <StatusBadge status="Slashed" />}
        </div>
      </div>

      {/* phase: draw */}
      {phase === "draw" && (
        <div className="flex items-center gap-2 text-xs text-zinc-500 rounded-lg border border-dashed border-white/10 px-3 py-2.5">
          <Dices className="h-3.5 w-3.5" />
          drawn · awaiting commit…
        </div>
      )}

      {/* phase: commit / reveal — commit hash */}
      {phase !== "draw" && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <Hash className="h-3 w-3 text-zinc-500" />
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              commit hash
            </span>
            {m.source === "live" && m.commitLive && (
              <Badge tone="near">on-chain</Badge>
            )}
          </div>
          {commit ? (
            <Copyable
              value={commit}
              display={shortHash(commit, 16, 8)}
              label="Commit hash copied"
            />
          ) : (
            <span className="font-mono text-xs text-zinc-600">—</span>
          )}
        </div>
      )}

      {/* phase: reveal — the report resolves from the hash (blur → sharp) */}
      <AnimatePresence>
        {revealed && m.report && (
          <motion.div
            initial={reduce ? false : { opacity: 0, filter: "blur(6px)", y: 6 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="border-t border-white/[0.06] pt-4 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                revealed report
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
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              <Stat label="price usdc" value={price6(m.report.facts.price_usdc)} />
              <Stat label="read block" value={m.report.facts.price_block ?? "—"} />
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
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5">
                sources
              </div>
              <div className="flex flex-col gap-1.5">
                {m.report.sources.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {s.verifiable ? (
                      <Badge tone="ok">verifiable</Badge>
                    ) : (
                      <Badge tone="warn">unverifiable</Badge>
                    )}
                    <span className="text-zinc-300">{s.name}</span>
                    <span className="font-mono text-zinc-500 truncate">
                      {s.payload_ref ?? s.endpoint}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* the sha256 binding proof */}
            {m.commitMatches ? (
              <div className="flex items-start gap-2 rounded-lg border border-near/20 bg-near/[0.06] px-3 py-2 text-xs text-near">
                <ShieldCheck className="h-3.5 w-3.5 mt-px shrink-0" />
                <span>
                  sha256(report) =={" "}
                  {m.source === "live" ? "view_commit" : "commit"}
                  <span className="text-zinc-500">
                    {" "}
                    · recomputed in-browser
                    {m.source === "live" ? " vs on-chain" : ""}
                  </span>
                </span>
              </div>
            ) : m.commitMatches === false ? (
              <div className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/[0.06] px-3 py-2 text-xs text-danger">
                <ShieldX className="h-3.5 w-3.5 mt-px shrink-0" />
                sha256(report) != view_commit · binding broken
              </div>
            ) : (
              <div className="text-xs text-zinc-600">
                commit binding unavailable
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const PHASES: { key: Phase; label: string; icon: typeof Dices }[] = [
  { key: "draw", label: "Committee drawn", icon: Dices },
  { key: "commit", label: "Commit hashes", icon: Hash },
  { key: "reveal", label: "Reveal + tally", icon: Fingerprint },
];

function PhaseStepper({
  phase,
  setPhase,
}: {
  phase: Phase;
  setPhase: (p: Phase) => void;
}) {
  const order: Phase[] = ["draw", "commit", "reveal"];
  const idx = order.indexOf(phase);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl border border-white/[0.06] bg-panel/40 backdrop-blur-xl px-5 py-4">
      <div className="flex items-center gap-1.5 flex-wrap">
        {PHASES.map((p, i) => {
          const Icon = p.icon;
          const done = idx > i;
          const active = idx === i;
          return (
            <div key={p.key} className="flex items-center gap-1.5">
              <div
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors",
                  active
                    ? "border-near/35 bg-near/10 text-near"
                    : done
                    ? "border-white/10 bg-white/[0.04] text-zinc-300"
                    : "border-white/[0.06] bg-transparent text-zinc-600"
                )}
              >
                <span className="font-mono opacity-70">{i + 1}</span>
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{p.label}</span>
              </div>
              {i < 2 && (
                <ArrowRight
                  className={cn(
                    "h-3.5 w-3.5",
                    idx > i ? "text-zinc-400" : "text-zinc-700"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 sm:ml-auto">
        <Button
          tone="ghost"
          onClick={() => setPhase(order[Math.max(0, idx - 1)])}
          disabled={idx === 0}
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button
          onClick={() => setPhase(order[Math.min(2, idx + 1)])}
          disabled={idx === 2}
        >
          {phase === "draw" ? "Publish commits" : "Reveal reports"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FULL lifecycle — the interactive commit → reveal with sha256 proof.
// Lives inside a collapsed Details disclosure on the step pages.
// ---------------------------------------------------------------------------
export function CommitteeView({
  actionId,
  template,
}: {
  actionId: string;
  template: string;
}) {
  const [phase, setPhase] = useState<Phase>("draw");
  const { state, committee, resolved, quorumUsdc } =
    useResolvedCommittee(actionId);

  const tally = committee.tally;
  const thresholdMet = tally.threshold_met;

  if (state.loading && resolved.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {state.error && <ErrorBanner message={state.error} />}

      {/* action header */}
      <Card className="relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                action
              </span>
              <LiveIndicator source={state.source} loading={state.loading} />
            </div>
            <div className="font-mono text-sm text-white mt-1.5">
              <span className="text-near">{actionId}</span> · {template}
            </div>
          </div>
          <div className="flex gap-6">
            <Stat
              label="committee"
              value={`${committee.member_ids.length} guardians`}
            />
            <Stat
              label="quorum bond"
              value={
                <span className="text-near font-mono">
                  {usdc(String(quorumUsdc))}
                </span>
              }
            />
            <Stat label="threshold" value={<span className="font-mono">2 of 3</span>} />
          </div>
        </div>
      </Card>

      <PhaseStepper phase={phase} setPhase={setPhase} />

      <div className="grid md:grid-cols-3 gap-4">
        {resolved.map((m, i) => (
          <GuardianCard key={m.row.id} m={m} phase={phase} index={i} />
        ))}
      </div>

      {/* tally — distinct BLOCKED state, NOT the green threshold badge */}
      <Card
        className={cn(
          "transition-all",
          phase !== "reveal"
            ? "opacity-50"
            : thresholdMet
            ? "border-near/30 shadow-glow"
            : "border-danger/35 bg-danger/[0.04] shadow-glow-danger"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              2-of-3 tally{" "}
              <span className="text-zinc-600 normal-case tracking-normal">
                (live on-chain)
              </span>
            </div>
            <div className="text-3xl font-semibold text-white mt-1.5 font-mono tabular-nums">
              {phase === "reveal" ? (
                <CountUp value={tally.approvals} />
              ) : (
                "—"
              )}
              <span className="text-zinc-600 text-xl"> / 3 approvals</span>
            </div>
          </div>
          {phase !== "reveal" ? (
            <Badge tone="muted">reveal to tally</Badge>
          ) : thresholdMet ? (
            <Badge tone="ok">
              <CheckCircle2 className="h-3.5 w-3.5" /> THRESHOLD MET · may execute
            </Badge>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-sm text-danger font-semibold font-mono">
                {tally.approvals}/3 &lt; 2-of-3
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-danger/40 bg-danger/10 px-3 py-1.5 text-sm font-bold text-danger tracking-wide">
                <Ban className="h-4 w-4" /> BLOCKED
              </span>
            </div>
          )}
        </div>
        {phase === "reveal" && !thresholdMet && (
          <p className="text-sm text-zinc-400 mt-4 border-t border-white/[0.06] pt-4 leading-relaxed">
            Only the corrupt guardian approved, alone, off a non-verifiable feed.
            The two honest guardians refused. 1 &lt; 2-of-3 → the action never
            clears. User funds never move on a lie.
          </p>
        )}
      </Card>
    </div>
  );
}
