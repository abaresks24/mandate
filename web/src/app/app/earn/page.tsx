"use client";

import { useState, useEffect, useRef } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/button";
import Link from "next/link";
import { useWallet } from "@/components/wallet/WalletProvider";
import { CROSSCHAIN } from "@/lib/near";
import { registerMandate, txExplorerUrl } from "@/lib/registry";
import { Donut, GrowthCurve, ApyBars, type Slice } from "@/components/StrategyVisuals";
import type {
  Allocation,
  ProposedStrategy,
  ProposeResult,
} from "@/lib/earn/propose";

const EXAMPLE_BRIEF =
  "J'ai des usdc et j'ai envie de faire 5% dessus, et j'aimerai avoir une petite exposition btc d'environ 30%";

type Turn = { role: "user" | "agent"; text: string };

function pct(bps: number) {
  return `${(bps / 100).toFixed(1)}%`;
}

export default function Earn() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ProposeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sub-panel state
  const [showDetail, setShowDetail] = useState(false);
  const [showDiscuss, setShowDiscuss] = useState(false);
  const [showLaunch, setShowLaunch] = useState(false);

  // Discuss thread
  const [thread, setThread] = useState<Turn[]>([]);
  const [refineMsg, setRefineMsg] = useState("");
  const [refining, setRefining] = useState(false);

  // Prefill the prompt from a ?seed= (e.g. "Earn →" from the Overview market list).
  useEffect(() => {
    const seed = new URLSearchParams(window.location.search).get("seed");
    if (seed) setPrompt(seed);
  }, []);

  const strategy = result?.status === "proposed" ? result.strategy : null;

  async function propose(brief: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    setShowDetail(false);
    setShowDiscuss(false);
    setShowLaunch(false);
    setThread([]);
    try {
      const res = await fetch("/api/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      const data = (await res.json()) as ProposeResult;
      setResult(data);
    } catch {
      setError("Could not reach the strategy agent. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    void propose(prompt);
  }

  async function onRefine(e: React.FormEvent) {
    e.preventDefault();
    if (!refineMsg.trim() || refining || !strategy) return;
    const msg = refineMsg.trim();
    setRefineMsg("");
    setThread((t) => [...t, { role: "user", text: msg }]);
    setRefining(true);
    try {
      const res = await fetch("/api/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: prompt, priorStrategy: strategy, message: msg }),
      });
      const data = (await res.json()) as ProposeResult;
      setResult(data);
      if (data.status === "proposed") {
        setThread((t) => [...t, { role: "agent", text: data.strategy.summary }]);
      } else {
        setThread((t) => [...t, { role: "agent", text: data.reason }]);
      }
    } catch {
      setThread((t) => [
        ...t,
        { role: "agent", text: "Could not reach the agent to refine the strategy." },
      ]);
    } finally {
      setRefining(false);
    }
  }

  return (
    <div className="flex flex-col gap-16">
      <header>
        <h1 className="page-h1">Earn</h1>
        <p className="page-lede">
          Describe what you want. The agent proposes a strategy that fits your
          on-chain mandate; anything outside the rules is refused.
        </p>
      </header>

      {/* Prompt input */}
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label htmlFor="brief" className="label">
          Your brief
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="brief"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want, e.g. '5,000 USDC, around 8%, low risk'"
            className="input flex-1 px-4 py-3 text-base"
          />
          <Button type="submit" variant="primary" size="lg" disabled={loading}>
            {loading ? "Drafting…" : "Propose a strategy →"}
          </Button>
        </div>
        <button
          type="button"
          onClick={() => setPrompt(EXAMPLE_BRIEF)}
          className="focusable self-start text-left text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          Try: &ldquo;{EXAMPLE_BRIEF}&rdquo;
        </button>
      </form>

      {/* Result area */}
      <section className="border-t border-hairline pt-10">
        {loading && <LoadingState />}

        {!loading && error && (
          <div className="rounded-xl border border-danger/30 bg-danger/5 p-6">
            <p className="text-sm leading-relaxed text-danger">{error}</p>
          </div>
        )}

        {!loading && !error && result?.status === "refused" && (
          <RefusedState reason={result.reason} code={result.reason_code} />
        )}

        {!loading && !error && strategy && (
          <ProposalView
            strategy={strategy}
            showDetail={showDetail}
            showDiscuss={showDiscuss}
            showLaunch={showLaunch}
            toggleDetail={() => setShowDetail((v) => !v)}
            toggleDiscuss={() => setShowDiscuss((v) => !v)}
            toggleLaunch={() => setShowLaunch((v) => !v)}
            thread={thread}
            refineMsg={refineMsg}
            setRefineMsg={setRefineMsg}
            refining={refining}
            onRefine={onRefine}
          />
        )}

        {!loading && !error && !result && (
          <div className="max-w-md rounded-xl border border-dashed border-hairline p-8">
            <h2 className="text-base font-semibold text-ink">
              Your proposed strategy will appear here
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Enter a brief above and the agent will draft an allocation inside
              your mandate, with an expected APY and a risk breakdown you can
              inspect before anything runs.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-6">
      <div className="live-ind">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-near" aria-hidden />
        Drafting a strategy and scoring protocol risk…
      </div>
      <div className="surface-card p-6">
        <div className="skeleton h-7 w-48 rounded" />
        <div className="skeleton mt-3 h-4 w-full max-w-xl rounded" />
        <div className="mt-6 space-y-3 border-t border-hairline pt-6">
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-5/6 rounded" />
        </div>
      </div>
    </div>
  );
}

function RefusedState({ reason, code }: { reason: string; code: string }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="live-ind">
        <span className="h-1.5 w-1.5 rounded-full bg-danger" aria-hidden />
        The agent declined this brief
      </div>
      <div className="surface-card p-6">
        <h2 className="text-xl font-semibold text-ink">No strategy proposed</h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">{reason}</p>
        <p className="num mt-4 text-xs uppercase tracking-wider text-muted">
          reason: {code}
        </p>
      </div>
    </div>
  );
}

function ProposalView(props: {
  strategy: ProposedStrategy;
  showDetail: boolean;
  showDiscuss: boolean;
  showLaunch: boolean;
  toggleDetail: () => void;
  toggleDiscuss: () => void;
  toggleLaunch: () => void;
  thread: Turn[];
  refineMsg: string;
  setRefineMsg: (v: string) => void;
  refining: boolean;
  onRefine: (e: React.FormEvent) => void;
}) {
  const { strategy: s } = props;

  const discussRef = useRef<HTMLDivElement>(null);
  const launchRef = useRef<HTMLDivElement>(null);

  // When a panel opens, bring it into view (accounts for the sticky top bar).
  useEffect(() => {
    if (props.showDiscuss) {
      requestAnimationFrame(() =>
        discussRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }, [props.showDiscuss]);
  useEffect(() => {
    if (props.showLaunch) {
      requestAnimationFrame(() =>
        launchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }, [props.showLaunch]);

  // Breakdown by protocol (merge markets of the same protocol) and by asset.
  const byProtocol = new Map<string, number>();
  const byAsset = new Map<string, number>();
  for (const a of s.allocations) {
    byProtocol.set(a.label, (byProtocol.get(a.label) ?? 0) + a.weightPct);
    byAsset.set(a.exposure, (byAsset.get(a.exposure) ?? 0) + a.weightPct);
  }
  const protocolSlices: Slice[] = Array.from(byProtocol, ([label, value]) => ({ label, value })).sort(
    (x, y) => y.value - x.value,
  );
  const assetSlices: Slice[] = Array.from(byAsset, ([label, value]) => ({
    label: label.toUpperCase(),
    value,
  })).sort((x, y) => y.value - x.value);

  return (
    <div className="flex flex-col gap-6">
      <div className="live-ind">
        <span className="h-1.5 w-1.5 rounded-full bg-near" aria-hidden />
        Proposed strategy
      </div>

      <div className="surface-card p-6 sm:p-8">
        {/* Headline */}
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-hairline pb-6">
          <div>
            <div className="label">Expected APY</div>
            <div className="num mt-1 text-5xl font-semibold text-near">
              {pct(s.expectedApyBps)}
            </div>
          </div>
          <div className="text-right">
            <div className="label">Risk level</div>
            <div className="num mt-1 text-3xl font-semibold text-ink">
              {s.riskLevel}
            </div>
          </div>
        </div>

        <p className="mt-6 max-w-2xl text-base leading-relaxed text-ink">{s.summary}</p>
        {s.caveat && (
          <p className="mt-3 max-w-2xl border-l-2 border-warn/60 pl-4 text-sm leading-relaxed text-muted">
            {s.caveat}
          </p>
        )}

        {/* Breakdown — donuts */}
        <div className="mt-8 grid gap-8 border-t border-hairline pt-8 sm:grid-cols-2">
          <Donut title="Allocation by protocol" slices={protocolSlices} />
          <Donut title="Exposure by asset" slices={assetSlices} />
        </div>

        {/* Yield — per-allocation APY + projected growth */}
        <div className="mt-10 grid gap-8 border-t border-hairline pt-8 lg:grid-cols-2">
          <ApyBars
            items={s.allocations.map((a) => ({
              label: a.apyMarket ? `${a.label} · ${a.apyMarket}` : a.label,
              apyBps: a.apyBps,
              weightPct: a.weightPct,
            }))}
          />
          <GrowthCurve apyBps={s.expectedApyBps} />
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted">
          APYs are current live rates (DefiLlama); the blended figure and the projection
          are weighted by allocation. The projection is illustrative, not a guarantee.
        </p>

        {/* Each allocation, explained */}
        <div className="mt-10 border-t border-hairline pt-8">
          <div className="label mb-4">Each allocation, explained</div>
          <div className="flex flex-col gap-4">
            {s.allocations.map((a) => (
              <AllocationExplain key={a.protocol} a={a} />
            ))}
          </div>
        </div>

        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted">{s.riskBreakdown}</p>

        {/* Actions */}
        <div className="mt-8 flex flex-wrap gap-3 border-t border-hairline pt-6">
          <Button variant="secondary" onClick={props.toggleDetail}>
            {props.showDetail ? "Hide details" : "Learn more"}
          </Button>
          <Button variant="secondary" onClick={props.toggleDiscuss}>
            {props.showDiscuss ? "Close" : "Discuss"}
          </Button>
          <Button variant="primary" onClick={props.toggleLaunch}>
            Launch
          </Button>
        </div>

        {props.showDetail && <DetailPanel strategy={s} />}
        {props.showDiscuss && (
          <div ref={discussRef} className="scroll-mt-24">
            <DiscussPanel
              thread={props.thread}
              refineMsg={props.refineMsg}
              setRefineMsg={props.setRefineMsg}
              refining={props.refining}
              onRefine={props.onRefine}
            />
          </div>
        )}
        {props.showLaunch && (
          <div ref={launchRef} className="scroll-mt-24">
            <LaunchPanel strategy={s} />
          </div>
        )}
      </div>
    </div>
  );
}

function AllocationExplain({ a }: { a: Allocation }) {
  return (
    <div className="surface-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-hairline pb-3">
        <div className="font-medium text-ink">
          {a.label}
          {a.apyMarket && <span className="num ml-2 text-xs text-muted">{a.apyMarket}</span>}
          <span className="ml-2 text-sm font-normal text-muted">· {a.chain}</span>
        </div>
        <div className="text-sm text-muted">
          <span className="num text-ink">{a.weightPct}%</span> weight ·{" "}
          <span className="num text-ink">{(a.apyBps / 100).toFixed(2)}%</span> APY ·{" "}
          <span className="uppercase">{a.exposure}</span> · risk{" "}
          <span className="num text-ink">{a.riskScore}</span>/100
        </div>
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="label mb-1">Where the yield comes from</div>
          <p className="text-sm leading-relaxed text-ink">{a.sourceOfYield}</p>
        </div>
        <div>
          <div className="label mb-1">Key risk to watch</div>
          <p className="text-sm leading-relaxed text-ink">{a.keyRisk}</p>
        </div>
      </div>
      {a.explanation && (
        <p className="mt-3 text-sm leading-relaxed text-muted">{a.explanation}</p>
      )}
    </div>
  );
}

function DetailPanel({ strategy }: { strategy: ProposedStrategy }) {
  return (
    <div className="mt-8 border-t border-hairline pt-8">
      <h3 className="label">How this strategy works</h3>
      <div className="mt-6 flex flex-col gap-8">
        {strategy.allocations.map((a) => (
          <div key={a.protocol} className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-4 border-b border-hairline pb-2">
              <div>
                <span className="text-lg font-semibold text-ink">
                  {a.label} · {a.chain}
                </span>
                <div className="mt-0.5 text-xs text-muted">
                  {a.category} · exposure: <span className="uppercase">{a.exposure}</span> ·{" "}
                  {(a.apyBps / 100).toFixed(2)}% APY
                  {a.apyMarket ? ` · ${a.apyMarket} market (live)` : " (indicative)"}
                </div>
              </div>
              <span className="num whitespace-nowrap text-sm text-ink">
                {a.weightPct}% · risk {a.riskScore}/100 ({a.riskLabel})
              </span>
            </div>

            <div>
              <div className="label">Where the yield comes from</div>
              <p className="mt-1 text-sm leading-relaxed text-ink">{a.sourceOfYield}</p>
            </div>

            <div>
              <div className="label">Key risk to watch</div>
              <p className="mt-1 text-sm leading-relaxed text-ink">{a.keyRisk}</p>
            </div>

            <div>
              <div className="label">Why this risk score</div>
              <p className="mt-1 text-sm leading-relaxed text-ink">{a.explanation}</p>
              <table className="data-table mt-3 max-w-md text-xs">
                <thead>
                  <tr>
                    <th>Factor</th>
                    <th className="text-right">Weight</th>
                    <th className="text-right">Contribution</th>
                  </tr>
                </thead>
                <tbody>
                  {a.riskFactors.map((f) => (
                    <tr key={f.factor}>
                      <td className="py-1.5 text-muted">{f.factor}</td>
                      <td className="num py-1.5 text-right text-muted">
                        {Math.round(f.weight * 100)}%
                      </td>
                      <td className="num py-1.5 text-right text-ink">
                        {f.contribution.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <div className="label">How it executes on-chain</div>
              <p className="mt-1 text-sm leading-relaxed text-ink">{a.mechanics}</p>
            </div>
          </div>
        ))}

        {/* Mandate mapping */}
        <div className="border-t border-hairline pt-6">
          <div className="label">The on-chain mandate that bounds this</div>
          <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <MandateRow label="Target APY" value={pct(strategy.mandate.target_apy_bps)} />
            <MandateRow label="Max risk score" value={`${strategy.mandate.max_risk_score}/100`} />
            <MandateRow
              label="Allowed protocols"
              value={strategy.mandate.allowed_protocols.join(", ")}
            />
            <MandateRow
              label="Allowed chains"
              value={strategy.mandate.allowed_chains.join(", ")}
            />
            <MandateRow label="Max loss" value={pct(strategy.mandate.max_loss_bps)} />
            <MandateRow
              label="Max share / protocol"
              value={`${strategy.mandate.max_share_per_protocol_bps / 100}%`}
            />
          </dl>
        </div>
      </div>
    </div>
  );
}

function MandateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-1">
      <dt className="text-muted">{label}</dt>
      <dd className="num text-right text-ink">{value}</dd>
    </div>
  );
}

function DiscussPanel(props: {
  thread: Turn[];
  refineMsg: string;
  setRefineMsg: (v: string) => void;
  refining: boolean;
  onRefine: (e: React.FormEvent) => void;
}) {
  return (
    <div className="mt-8 border-t border-hairline pt-8">
      <h3 className="label">Discuss &amp; refine</h3>
      {props.thread.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {props.thread.map((t, i) => (
            <div
              key={i}
              className={
                t.role === "user"
                  ? "self-end max-w-md rounded-lg border border-ink/20 px-4 py-2 text-sm text-ink"
                  : "self-start max-w-md rounded-lg bg-mist px-4 py-2 text-sm text-ink"
              }
            >
              {t.text}
            </div>
          ))}
          {props.refining && (
            <div className="self-start max-w-md rounded-lg bg-mist px-4 py-2 text-sm text-muted">
              Updating the proposal…
            </div>
          )}
        </div>
      )}
      <form onSubmit={props.onRefine} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          value={props.refineMsg}
          onChange={(e) => props.setRefineMsg(e.target.value)}
          placeholder="e.g. 'lower the risk', 'more on NEAR', 'what if I accept 10%?'"
          className="input flex-1 px-4"
        />
        <Button type="submit" variant="secondary" disabled={props.refining}>
          {props.refining ? "Sending…" : "Send"}
        </Button>
      </form>
    </div>
  );
}

function shortLabel(summary: string): string {
  const s = summary.trim().replace(/\s+/g, " ");
  return s.length <= 96 ? s : `${s.slice(0, 93)}…`;
}

type LaunchState =
  | { phase: "idle" }
  | { phase: "signing" }
  | { phase: "done"; hash: string | null }
  | { phase: "error"; message: string };

function LaunchPanel({ strategy }: { strategy: ProposedStrategy }) {
  const { accountId, signIn, signAndSendTransaction } = useWallet();
  const [state, setState] = useState<LaunchState>({ phase: "idle" });

  async function onDeploy() {
    if (!accountId) return;
    setState({ phase: "signing" });
    try {
      const mandate_json = JSON.stringify(strategy.mandate);
      const label = shortLabel(strategy.summary);
      const { hash } = await registerMandate(
        signAndSendTransaction,
        accountId,
        { mandate_json, label },
      );
      setState({ phase: "done", hash });
    } catch (err) {
      // Wallet-selector surfaces user rejection as an Error; show it plainly.
      const raw = err instanceof Error ? err.message : String(err);
      const message = /reject|cancel|denied/i.test(raw)
        ? "Transaction rejected in your wallet — nothing was registered."
        : `Could not register the mandate: ${raw}`;
      setState({ phase: "error", message });
    }
  }

  return (
    <div className="mt-8 border-t border-hairline pt-8">
      <h3 className="label">Launch this strategy</h3>

      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-ink">
        Launching registers an <span className="font-medium">on-chain mandate</span> — the rules
        the vault enforces — with a real, wallet-signed transaction. The agent can only ever
        propose moves inside it; anything outside the mandate is rejected on-chain, before it
        can run.
      </p>

      {/* Mandate summary */}
      <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
        <MandateRow label="Target APY" value={pct(strategy.mandate.target_apy_bps)} />
        <MandateRow label="Max risk score" value={`${strategy.mandate.max_risk_score}/100`} />
        <MandateRow
          label="Allowed protocols"
          value={strategy.mandate.allowed_protocols.join(", ")}
        />
        <MandateRow label="Allowed chains" value={strategy.mandate.allowed_chains.join(", ")} />
        <MandateRow label="Max loss" value={pct(strategy.mandate.max_loss_bps)} />
        <MandateRow
          label="Committee"
          value={strategy.mandate.committee_threshold_usdc === "0" ? "Permanent" : "Threshold"}
        />
      </dl>

      {/* The mechanism */}
      <div className="mt-8">
        <div className="label">How execution is secured</div>
        <ol className="mt-3 flex flex-col gap-3 text-sm text-ink sm:flex-row sm:items-stretch">
          <Step n={1} title="Mandate set" body="Rules are written on-chain. The vault enforces them." />
          <Arrow />
          <Step
            n={2}
            title="Guardian committee verifies"
            body="A bond-weighted committee checks each cross-chain move. The bond is the insurance — quorum bond exceeds the value at risk."
          />
          <Arrow />
          <Step
            n={3}
            title="Executes on-chain"
            body="Only verified moves run. NEAR signs the EVM tx via Chain Signatures."
          />
        </ol>
      </div>

      {/* Real proofs */}
      <div className="mt-8 rounded-xl border border-hairline bg-mist p-5">
        <div className="label">This mechanism is already live</div>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-ink">
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-near" aria-hidden />
            Committee action <span className="num">a1</span> verified on the coordinator.
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-near" aria-hidden />
            Real cross-chain tx landed on Ethereum Sepolia (status 0x1, mined).
          </li>
        </ul>
        <a
          href={CROSSCHAIN.etherscan}
          target="_blank"
          rel="noopener noreferrer"
          className="ext-link mt-3"
        >
          {CROSSCHAIN.sepoliaTx.slice(0, 18)}…{CROSSCHAIN.sepoliaTx.slice(-10)}
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* CTA — REAL wallet-signed on-chain registration */}
      <div className="mt-8 flex flex-col gap-3 border-t border-hairline pt-6">
        {!accountId ? (
          <>
            <Button variant="primary" size="lg" className="self-start" onClick={signIn}>
              Connect wallet to deploy
            </Button>
            <p className="text-xs leading-relaxed text-muted">
              Connect a NEAR wallet to sign the mandate. Nothing is registered until you
              explicitly sign the transaction in your wallet.
            </p>
          </>
        ) : state.phase === "done" ? (
          <div className="rounded-xl border border-near/40 bg-near/5 p-5">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <span className="h-1.5 w-1.5 rounded-full bg-near" aria-hidden />
              Mandate registered on-chain
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
              Your mandate is now recorded under{" "}
              <span className="num text-ink">{accountId}</span> on the registry
              contract. This write is real and wallet-signed.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
              {state.hash && (
                <a
                  href={txExplorerUrl(state.hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ext-link"
                >
                  {state.hash.slice(0, 10)}…{state.hash.slice(-8)}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              )}
              <Link
                href="/app/portfolio"
                className="focusable text-sm font-medium text-ink underline-offset-4 hover:underline"
              >
                View in Portfolio →
              </Link>
            </div>
          </div>
        ) : (
          <>
            <Button
              variant="primary"
              size="lg"
              className="self-start"
              disabled={state.phase === "signing"}
              onClick={onDeploy}
            >
              {state.phase === "signing" ? "Confirm in your wallet…" : "Deploy this mandate →"}
            </Button>
            {state.phase === "error" && (
              <p className="text-xs leading-relaxed text-danger">{state.message}</p>
            )}
            <p className="text-xs leading-relaxed text-muted">
              Connected as <span className="num text-ink">{accountId}</span>. Deploying
              signs a real <span className="num">register_mandate</span> transaction
              (0.01 NEAR attached) that records this mandate on-chain under your account.
              Funding and deploying the per-mandate vault is the documented next step, proven
              via the CLI scripts; everything downstream (committee verification, cross-chain
              execution) is already live on testnet.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex-1 rounded-xl border border-hairline p-4">
      <div className="num text-xs text-muted">{n}</div>
      <div className="mt-1 font-medium text-ink">{title}</div>
      <p className="mt-1 text-xs leading-relaxed text-muted">{body}</p>
    </li>
  );
}

function Arrow() {
  return (
    <div className="hidden items-center justify-center text-muted sm:flex" aria-hidden>
      →
    </div>
  );
}
