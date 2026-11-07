"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { GuardianReport, GuardianRow, Tally } from "@/lib/types";
import {
  Button,
  Copyable,
  Dot,
  ErrorBanner,
  Label,
  LiveIndicator,
  Skeleton,
  Stat,
} from "./ui";
import { motion, CountUp } from "./motion";
import { ReasonCodes } from "./ReasonCodes";
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
// SUMMARY (default view) — the tally is the hero: one huge "N of M", quiet
// everything else. No card, no glow. The verdict is a coloured word.
// ---------------------------------------------------------------------------
export function CommitteeSummary({ actionId }: { actionId: string }) {
  const { state, committee } = useResolvedCommittee(actionId);
  const tally = committee.tally;
  const met = tally.threshold_met;

  if (state.loading && committee.members.length === 0) {
    return <Skeleton className="h-40 w-full rounded-xl" />;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Label>action {actionId} · tally</Label>
        <LiveIndicator source={state.source} loading={state.loading} />
      </div>

      <div
        className={cn(
          "text-6xl sm:text-7xl font-semibold font-mono tabular-nums tracking-tight",
          met ? "text-white" : "text-danger"
        )}
      >
        <CountUp value={tally.approvals} /> of {committee.member_ids.length}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Dot tone={met ? "near" : "danger"} />
        <span className={met ? "text-near" : "text-danger"}>
          {met ? "approved" : "blocked"}
        </span>
        <span className="text-zinc-500">
          · {met ? "threshold met" : "threshold not met"}
        </span>
      </div>

      {/* the drawn guardians — plain mono list */}
      <div className="flex items-center gap-x-4 gap-y-1 flex-wrap font-mono text-xs text-zinc-400">
        {committee.members.map((m) => {
          const slashed = m.status === "Slashed";
          return (
            <span key={m.id} className="inline-flex items-center gap-1.5">
              <Dot tone={slashed ? "danger" : "near"} />
              <span className={slashed ? "text-danger" : "text-zinc-300"}>
                {m.id}
              </span>
              {slashed && <span className="text-danger">slashed</span>}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function GuardianRowView({
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
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: index * 0.06 }}
      className="py-5 first:pt-0"
    >
      {/* header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Dot tone={slashed ? "danger" : "near"} />
          <span className="font-mono text-sm text-white">{m.row.id}</span>
          <span className="text-sm text-zinc-500">
            {m.row.account.split(".")[0]}
          </span>
          {slashed && (
            <span className="text-xs text-danger">slashed</span>
          )}
        </div>
        <span
          className={cn(
            "font-mono text-sm",
            slashed ? "text-danger" : "text-zinc-300"
          )}
        >
          {yoctoToNear(m.row.bond)} Ⓝ
        </span>
      </div>

      {/* phase: draw */}
      {phase === "draw" && (
        <p className="mt-3 text-xs text-zinc-500">drawn · awaiting commit</p>
      )}

      {/* phase: commit / reveal — commit hash */}
      {phase !== "draw" && (
        <div className="mt-3">
          <Label className="mb-1.5">
            commit hash
            {m.source === "live" && m.commitLive ? (
              <span className="text-near ml-2 normal-case tracking-normal">
                on-chain
              </span>
            ) : null}
          </Label>
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
            className="mt-4 border-t border-edge pt-4 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <Label>revealed report</Label>
              <span
                className={cn(
                  "text-xs font-medium",
                  m.report.approve
                    ? slashed
                      ? "text-danger"
                      : "text-near"
                    : "text-zinc-300"
                )}
              >
                {m.report.approve
                  ? slashed
                    ? "APPROVE (lie)"
                    : "APPROVE"
                  : "REFUSE"}
              </span>
            </div>
            <ReasonCodes codes={m.report.reason_codes} />
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
              <Label className="mb-1.5">sources</Label>
              <div className="flex flex-col gap-1.5">
                {m.report.sources.map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span
                      className={s.verifiable ? "text-zinc-400" : "text-warn"}
                    >
                      {s.verifiable ? "verifiable" : "unverifiable"}
                    </span>
                    <span className="text-zinc-300">{s.name}</span>
                    <span className="font-mono text-zinc-500 truncate">
                      {s.payload_ref ?? s.endpoint}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* the sha256 binding proof — the ONE green signal of this view */}
            {m.commitMatches ? (
              <p className="flex items-start gap-1.5 text-xs text-near">
                <Dot tone="near" className="mt-1" />
                <span>
                  sha256(report) =={" "}
                  {m.source === "live" ? "view_commit" : "commit"}
                  <span className="text-zinc-500">
                    {" "}
                    · recomputed in-browser
                    {m.source === "live" ? " vs on-chain" : ""}
                  </span>
                </span>
              </p>
            ) : m.commitMatches === false ? (
              <p className="flex items-start gap-1.5 text-xs text-danger">
                <Dot tone="danger" className="mt-1" />
                sha256(report) != view_commit · binding broken
              </p>
            ) : (
              <p className="text-xs text-zinc-600">commit binding unavailable</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const PHASES: { key: Phase; label: string }[] = [
  { key: "draw", label: "Drawn" },
  { key: "commit", label: "Commit" },
  { key: "reveal", label: "Reveal" },
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
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-y border-edge py-4">
      <div className="flex items-center gap-4 text-sm font-mono">
        {PHASES.map((p, i) => {
          const active = idx === i;
          const done = idx > i;
          return (
            <span key={p.key} className="inline-flex items-center gap-2">
              <span
                className={cn(
                  "text-[11px] tabular-nums",
                  active ? "text-near" : "text-zinc-600"
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={cn(
                  active
                    ? "text-white"
                    : done
                    ? "text-zinc-400"
                    : "text-zinc-600"
                )}
              >
                {p.label}
              </span>
            </span>
          );
        })}
      </div>
      <div className="flex gap-2 sm:ml-auto">
        <Button
          tone="ghost"
          onClick={() => setPhase(order[Math.max(0, idx - 1)])}
          disabled={idx === 0}
        >
          Back
        </Button>
        <Button
          onClick={() => setPhase(order[Math.min(2, idx + 1)])}
          disabled={idx === 2}
        >
          {phase === "draw" ? "Publish commits →" : "Reveal reports →"}
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
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {state.error && <ErrorBanner message={state.error} />}

      {/* action header — flat */}
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <div className="flex items-center gap-2.5">
            <Label>action</Label>
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
              <span className="font-mono text-zinc-200">
                {usdc(String(quorumUsdc))}
              </span>
            }
          />
          <Stat label="threshold" value={<span className="font-mono">2 of 3</span>} />
        </div>
      </div>

      <PhaseStepper phase={phase} setPhase={setPhase} />

      <div className="divide-y divide-edge">
        {resolved.map((m, i) => (
          <GuardianRowView key={m.row.id} m={m} phase={phase} index={i} />
        ))}
      </div>

      {/* tally — the one bordered surface. BLOCKED is red; met is quiet white. */}
      <div
        className={cn(
          "rounded-xl border p-6 transition-opacity",
          phase !== "reveal" ? "opacity-50 border-edge" : "border-edge"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Label>
              2-of-3 tally{" "}
              <span className="text-zinc-600 normal-case tracking-normal">
                (live on-chain)
              </span>
            </Label>
            <div className="text-4xl font-semibold text-white mt-1.5 font-mono tabular-nums">
              {phase === "reveal" ? <CountUp value={tally.approvals} /> : "—"}
              <span className="text-zinc-600 text-xl"> / 3 approvals</span>
            </div>
          </div>
          {phase !== "reveal" ? (
            <span className="text-sm text-zinc-500">reveal to tally</span>
          ) : thresholdMet ? (
            <span className="inline-flex items-center gap-2 text-sm text-near">
              <Dot tone="near" />
              threshold met · may execute
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-danger">
              <Dot tone="danger" />
              {tally.approvals}/3 &lt; 2-of-3 · blocked
            </span>
          )}
        </div>
        {phase === "reveal" && !thresholdMet && (
          <p className="text-sm text-zinc-400 mt-5 border-t border-edge pt-5 leading-relaxed">
            Only the corrupt guardian approved, alone, off a non-verifiable feed.
            The two honest guardians refused. 1 &lt; 2-of-3 → the action never
            clears. User funds never move on a lie.
          </p>
        )}
      </div>
    </div>
  );
}
