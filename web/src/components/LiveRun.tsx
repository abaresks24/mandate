"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, Copy, Loader2, X } from "lucide-react";
import { Button } from "@/components/button";

// Drives the live Launch flow: every row below is one REAL transaction (or a real
// on-chain rejection) on NEAR testnet / Ethereum Sepolia, run by /api/launch.

type Weights = Record<string, number>;
interface MandateIn {
  target_apy_bps: number;
  max_risk_score: number;
  allowed_protocols: string[];
  allowed_chains: string[];
  max_share_per_protocol_bps: number;
  max_loss_bps: number;
}
interface StepTx { label: string; hash: string; url: string; failure?: string }
interface StepResult {
  ok: boolean;
  title: string;
  detail: string;
  txs: StepTx[];
  ctx: unknown;
  data?: Record<string, any>;
  blocker?: { code: string; message: string; address?: string };
}

const PLAN = [
  { key: "arm", title: "Arm the vault", what: "Your mandate is written into the vault and a testnet deposit is recorded." },
  { key: "guardrail", title: "Out-of-mandate proposal", what: "A prompt-injected move is proposed. The vault must refuse it on-chain." },
  { key: "supply", title: "Supply on NEAR", what: "NEAR-native leg, verified by the vault contract itself." },
  { key: "propose", title: "Cross-chain proposal", what: "The agent proposes a Morpho allocation on Ethereum Sepolia." },
  { key: "draw", title: "Committee draw", what: "Random, bond-weighted. Quorum bond must cover the value." },
  { key: "commit", title: "Guardians commit", what: "Each guardian publishes only sha256(report)." },
  { key: "tamper", title: "A lying guardian is blocked", what: "A guardian tries to reveal different bytes than it committed." },
  { key: "reveal", title: "Guardians reveal", what: "Hashes are re-checked on-chain, then tallied 2-of-3." },
  { key: "execute", title: "Execute via Chain Signatures", what: "Vault applies the attested facts, builds the EVM tx, MPC signs it." },
  { key: "broadcast", title: "Land on Ethereum Sepolia", what: "The signed transaction is broadcast and mined." },
] as const;

type Status = "pending" | "running" | "ok" | "fail";

export function LiveRun({
  mandate,
  weights,
  autoStart,
}: {
  mandate: MandateIn;
  weights: Weights;
  autoStart: boolean;
}) {
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [results, setResults] = useState<Record<string, StepResult>>({});
  const [running, setRunning] = useState(false);
  const [blocker, setBlocker] = useState<StepResult["blocker"] | null>(null);
  const ctxRef = useRef<unknown>({ mandate, weights });
  const startedRef = useRef(false);
  const [copied, setCopied] = useState(false);

  const run = useCallback(
    async (from: number) => {
      setRunning(true);
      setBlocker(null);
      for (let i = from; i < PLAN.length; i++) {
        const key = PLAN[i]!.key;
        setStatus((s) => ({ ...s, [key]: "running" }));
        let r: StepResult;
        try {
          const res = await fetch("/api/launch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ step: key, ctx: ctxRef.current }),
          });
          r = (await res.json()) as StepResult;
        } catch {
          r = { ok: false, title: PLAN[i]!.title, detail: "Could not reach the launch service.", txs: [], ctx: ctxRef.current };
        }
        if (r.ctx) ctxRef.current = r.ctx;
        setResults((m) => ({ ...m, [key]: r }));
        if (r.blocker) {
          setStatus((s) => ({ ...s, [key]: "fail" }));
          setBlocker(r.blocker);
          setRunning(false);
          return;
        }
        setStatus((s) => ({ ...s, [key]: r.ok ? "ok" : "fail" }));
        if (!r.ok) {
          setRunning(false);
          return;
        }
      }
      setRunning(false);
    },
    [],
  );

  useEffect(() => {
    if (autoStart && !startedRef.current) {
      startedRef.current = true;
      void run(0);
    }
  }, [autoStart, run]);

  const firstFailed = PLAN.findIndex((p) => status[p.key] === "fail");
  const allDone = PLAN.every((p) => status[p.key] === "ok");
  const eth = results["broadcast"]?.data as { ethTx?: string; etherscan?: string; from?: string } | undefined;

  return (
    <div className="mt-8 rounded-xl border border-hairline bg-mist p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="label">Live execution</div>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            Every step below is a real transaction on NEAR testnet or Ethereum Sepolia, not a replay.
            The testnet slice is 20 USDC, split by your weights across the venues that settle on testnet today.
          </p>
        </div>
        {!running && !startedRef.current && (
          <Button variant="primary" onClick={() => { startedRef.current = true; void run(0); }}>
            Run live
          </Button>
        )}
      </div>

      <ol className="mt-5 flex flex-col">
        {PLAN.map((p, i) => {
          const st = status[p.key] ?? "pending";
          const r = results[p.key];
          return (
            <li key={p.key} className="flex gap-3 border-t border-hairline py-3 first:border-t-0">
              <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                {st === "running" && <Loader2 className="h-4 w-4 animate-spin text-near" aria-label="running" />}
                {st === "ok" && <Check className="h-4 w-4 text-near" aria-label="done" />}
                {st === "fail" && <X className="h-4 w-4 text-danger" aria-label="failed" />}
                {st === "pending" && <span className="h-1.5 w-1.5 rounded-full bg-hairline" aria-hidden />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className={st === "pending" ? "text-sm text-muted" : "text-sm font-medium text-ink"}>
                    {i + 1}. {p.title}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{r ? r.detail : p.what}</p>
                {r && <StepExtras k={p.key} r={r} />}
                {r && r.txs.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                    {r.txs.map((t, j) =>
                      t.hash ? (
                        <a key={j} href={t.url} target="_blank" rel="noopener noreferrer" className="ext-link text-xs">
                          {t.label}
                          {t.failure ? " (rejected)" : ""} · {t.hash.slice(0, 6)}…{t.hash.slice(-4)}
                          <ArrowUpRight className="h-3 w-3" />
                        </a>
                      ) : null,
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {blocker?.code === "NEEDS_SEPOLIA_ETH" && blocker.address && (
        <div className="mt-4 rounded-lg border border-warn/40 bg-warn/5 p-4">
          <div className="text-sm font-medium text-ink">The vault needs Sepolia ETH for gas</div>
          <p className="mt-1 text-xs leading-relaxed text-muted">{blocker.message}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="num break-all text-xs text-ink">{blocker.address}</code>
            <button
              type="button"
              className="focusable inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
              onClick={() => {
                void navigator.clipboard?.writeText(blocker.address!);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              <Copy className="h-3 w-3" /> {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <Button variant="secondary" className="mt-3" disabled={running} onClick={() => void run(Math.max(0, firstFailed))}>
            Check again
          </Button>
        </div>
      )}

      {!blocker && firstFailed >= 0 && !running && (
        <Button variant="secondary" className="mt-4" onClick={() => void run(firstFailed)}>
          Retry from step {firstFailed + 1}
        </Button>
      )}

      {allDone && eth?.etherscan && (
        <div className="mt-5 rounded-lg border border-near/40 bg-near/5 p-4">
          <div className="text-sm font-medium text-ink">Executed end to end</div>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            A NEAR vault, gated by a bonded committee, signed an Ethereum transaction through MPC and it was mined on Sepolia.
          </p>
          <a href={eth.etherscan} target="_blank" rel="noopener noreferrer" className="ext-link mt-2 text-sm">
            {eth.ethTx!.slice(0, 18)}…{eth.ethTx!.slice(-10)}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}

function short(h: string) {
  return `${h.slice(0, 8)}…${h.slice(-6)}`;
}

// Small per-step evidence blocks (committee, commits, tally).
function StepExtras({ k, r }: { k: string; r: StepResult }) {
  const d = r.data ?? {};
  if (k === "draw" && Array.isArray(d.committee)) {
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {(d.committee as { id: string; account: string; bondNear: number }[]).map((g) => (
          <span key={g.id} className="num rounded-md border border-hairline px-2 py-1 text-xs text-ink">
            {g.id} <span className="text-muted">· {g.bondNear} Ⓝ bond</span>
          </span>
        ))}
      </div>
    );
  }
  if (k === "commit" && Array.isArray(d.commits)) {
    return (
      <div className="mt-2 flex flex-col gap-1">
        {(d.commits as { guardian: string; commit: string; block: number }[]).map((c) => (
          <div key={c.guardian} className="num text-xs text-muted">
            {c.guardian} committed <span className="text-ink">{short(c.commit)}</span> · Sepolia block {c.block}
          </div>
        ))}
      </div>
    );
  }
  if (k === "tamper" && d.forgedHash) {
    return (
      <div className="num mt-2 text-xs text-muted">
        committed <span className="text-ink">{short(String(d.committedHash))}</span> ≠ forged{" "}
        <span className="text-danger">{short(String(d.forgedHash))}</span>
      </div>
    );
  }
  return null;
}
