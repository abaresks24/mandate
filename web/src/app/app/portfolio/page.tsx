"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useWallet } from "@/components/wallet/WalletProvider";
import { live, CROSSCHAIN, type MandateRecord } from "@/lib/near";
import { useLive } from "@/lib/useLive";
import { bps, usdc } from "@/lib/format";
import { MANDATE } from "@/mock/mandate";
import type { Mandate, PositionsLive, Position, Tally } from "@/lib/types";

// The showcased portfolio is the on-chain demo vault. These views are read
// live; on any failure useLive falls back to the mock shape and reports it.
// Positions are expected to be EMPTY on-chain (idle vault) — we never
// fabricate a position, we show an honest empty state instead.

const EMPTY_POSITIONS: PositionsLive = {
  positions: [],
  idle_usdc: "0",
  total_usdc: "0",
};

const EMPTY_TALLY: Tally = { approvals: 0, threshold_met: false };

function truncateAccount(id: string): string {
  if (id.length <= 22) return id;
  return `${id.slice(0, 10)}…${id.slice(-10)}`;
}

function chainLabel(chain: string): string {
  const c = chain.toLowerCase();
  if (c.includes("near")) return "NEAR";
  if (c.includes("sepolia")) return "Ethereum Sepolia";
  if (c.includes("ethereum")) return "Ethereum";
  return chain;
}

function protocolLabel(p: string): string {
  const s = p.toLowerCase();
  if (s.includes("rhea")) return "USDC lending on Rhea";
  if (s.includes("morpho")) return "USDC on Morpho";
  return p;
}

export default function Portfolio() {
  const { accountId, signIn } = useWallet();

  const mandate = useLive<Mandate>(() => live.mandate(), MANDATE, []);
  const positions = useLive<PositionsLive>(
    () => live.positions(),
    EMPTY_POSITIONS,
    []
  );
  const a1 = useLive<Tally>(() => live.tally("a1"), EMPTY_TALLY, []);
  const a2 = useLive<Tally>(() => live.tally("a2"), EMPTY_TALLY, []);

  // The connected user's OWN on-chain mandate (their real data), re-fetched when
  // the account changes. Returns null if they never registered one.
  const myMandate = useLive<MandateRecord | null>(
    () =>
      accountId
        ? live.myMandate(accountId)
        : Promise.reject(new Error("no wallet")),
    null,
    [accountId]
  );
  const ownRecord = accountId ? myMandate.data : null;

  const m = mandate.data ?? MANDATE;
  const pos = positions.data ?? EMPTY_POSITIONS;
  const activeCount = pos.positions.length;

  const metricsLoading = positions.loading || mandate.loading;
  const metricsLive = positions.source === "live" && mandate.source === "live";

  return (
    <div className="flex flex-col gap-16">
      {/* Header + wallet awareness */}
      <header>
        <h1 className="display text-4xl font-semibold leading-tight text-ink sm:text-5xl">
          Portfolio
        </h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted">
          The live state of the showcased vault — its value, the mandate that
          bounds it, and every action the guardian committee has verified.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          {accountId ? (
            <span>
              Connected as{" "}
              <span className="font-mono text-ink">
                {truncateAccount(accountId)}
              </span>
              .{" "}
              {ownRecord
                ? "Your registered mandate is shown below, above the demo vault."
                : "No mandate registered under this account yet — showing the demo vault."}
            </span>
          ) : (
            <span>
              Showing the demo vault.{" "}
              <button
                type="button"
                onClick={signIn}
                className="underline underline-offset-4 hover:text-ink"
              >
                Connect a wallet
              </button>{" "}
              to see your account — this page works either way.
            </span>
          )}
        </div>
      </header>

      {/* Your strategy — the connected user's OWN on-chain mandate */}
      {ownRecord && (
        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-xl font-semibold tracking-tight text-ink">
              Your strategy
            </h2>
            <span className="hidden text-sm text-muted sm:inline">
              live · your account
            </span>
          </div>
          <YourStrategy record={ownRecord} />
        </section>
      )}

      {/* Demo vault heading */}
      <div className={ownRecord ? "border-t border-hairline pt-10" : undefined}>
        <h2 className="text-xl font-semibold tracking-tight text-ink">
          Demo vault
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
          The live state of the showcased vault — its value, the mandate that
          bounds it, and every action the guardian committee has verified.
        </p>
      </div>

      {/* Top metrics strip */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-hairline bg-hairline lg:grid-cols-4">
        <Metric
          label="Total value"
          value={metricsLoading ? null : usdc(pos.total_usdc)}
          hint="demo vault · idle on-chain"
        />
        <Metric
          label="Target APY"
          value={metricsLoading ? null : bps(m.target_apy_bps)}
          hint="on-chain mandate"
        />
        <Metric
          label="Max loss tolerated"
          value={metricsLoading ? null : bps(m.max_loss_bps)}
          hint="enforced by the vault"
        />
        <Metric
          label="Active positions"
          value={metricsLoading ? null : String(activeCount)}
          hint={activeCount === 0 ? "none open yet" : "live on-chain"}
        />
      </section>

      {/* Positions */}
      <section>
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-ink">
            Positions
          </h2>
          <span className="hidden text-sm text-muted sm:inline">
            {positions.loading
              ? "reading vault…"
              : metricsLive
              ? "live · testnet"
              : "representative (live call unavailable)"}
          </span>
        </div>

        {positions.loading ? (
          <PositionsSkeleton />
        ) : activeCount === 0 ? (
          <EmptyPositions idle={pos.idle_usdc} live={positions.source === "live"} />
        ) : (
          <PositionsTable positions={pos.positions} total={pos.total_usdc} />
        )}
      </section>

      {/* Mandate summary */}
      <section>
        <h2 className="text-xl font-semibold tracking-tight text-ink">
          Mandate
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
          The rules the vault enforces on-chain. The agent can only ever propose
          moves inside these bounds — anything outside is rejected before it can
          run.
        </p>
        <MandateSummary mandate={m} loading={mandate.loading} />
      </section>

      {/* Activity feed — real on-chain proofs framed as portfolio activity */}
      <section>
        <h2 className="text-xl font-semibold tracking-tight text-ink">
          Activity
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
          Every verified move, the proofs behind it, and the one slash the
          committee has issued.
        </p>
        <ActivityFeed a1={a1} a2={a2} />
      </section>
    </div>
  );
}

function YourStrategy({ record }: { record: MandateRecord }) {
  let parsed: Partial<Mandate> = {};
  try {
    parsed = JSON.parse(record.mandate_json) as Partial<Mandate>;
  } catch {
    parsed = {};
  }
  const apy =
    typeof parsed.target_apy_bps === "number" ? bps(parsed.target_apy_bps) : "—";
  const protocols = (parsed.allowed_protocols ?? []).join(", ") || "—";
  const chains = (parsed.allowed_chains ?? [])
    .map((c) => chainLabel(c))
    .join(", ") || "—";
  const maxRisk =
    typeof parsed.max_risk_score === "number" ? `${parsed.max_risk_score}/100` : "—";
  const when =
    record.registered_at_ns > 0
      ? new Date(record.registered_at_ns / 1e6).toLocaleString()
      : "—";

  return (
    <div className="rounded-xl border border-hairline">
      <div className="border-b border-hairline p-5">
        <div className="font-mono text-base text-ink">{record.label || "Mandate"}</div>
        <div className="mt-1 text-sm text-muted">
          Registered on-chain under{" "}
          <span className="font-mono text-ink">{truncateAccount(record.owner)}</span>
          {when !== "—" ? ` · ${when}` : ""}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px bg-hairline sm:grid-cols-4">
        <YourStrategyCell label="Target APY" value={apy} accent />
        <YourStrategyCell label="Max risk" value={maxRisk} />
        <YourStrategyCell label="Protocols" value={protocols} />
        <YourStrategyCell label="Chains" value={chains} />
      </div>
    </div>
  );
}

function YourStrategyCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-paper p-5">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div
        className={`mt-1 font-mono text-lg text-ink ${accent ? "font-semibold" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | null;
  hint: string;
}) {
  return (
    <div className="bg-paper p-6">
      <div className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </div>
      {value === null ? (
        <div className="mt-3 h-9 w-24 animate-pulse rounded bg-mist" />
      ) : (
        <div className="mt-3 font-mono text-3xl font-semibold tabular-nums text-ink">
          {value}
        </div>
      )}
      <div className="mt-2 text-xs text-muted">{hint}</div>
    </div>
  );
}

function PositionsSkeleton() {
  return (
    <div className="rounded-xl border border-hairline p-6">
      <div className="space-y-4">
        <div className="h-4 w-full animate-pulse rounded bg-mist" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-mist" />
        <div className="h-4 w-4/6 animate-pulse rounded bg-mist" />
      </div>
    </div>
  );
}

function EmptyPositions({ idle, live }: { idle: string; live: boolean }) {
  const idleN = Number(idle) / 1e6;
  return (
    <div className="mt-6 rounded-xl border border-dashed border-hairline p-12 text-center">
      <p className="text-base font-medium text-ink">No active positions yet</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        {live
          ? "The vault is live on testnet and currently idle — no capital has been allocated into a strategy yet."
          : "The vault has no open positions."}
        {idleN > 0 && (
          <>
            {" "}
            Idle balance:{" "}
            <span className="font-mono text-ink">{usdc(idle)}</span>.
          </>
        )}
      </p>
      <div className="mt-6">
        <Link
          href="/app/earn"
          className="text-sm font-medium text-ink underline-offset-4 hover:underline"
        >
          Propose a strategy →
        </Link>
      </div>
    </div>
  );
}

function PositionsTable({
  positions,
  total,
}: {
  positions: Position[];
  total: string;
}) {
  const totalN = Number(total);
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-hairline text-xs font-medium uppercase tracking-wider text-muted">
            <th className="py-3 pr-4 font-medium">Strategy</th>
            <th className="py-3 pr-4 font-medium">Chain</th>
            <th className="py-3 pr-4 text-right font-medium">Allocation</th>
            <th className="py-3 pr-4 text-right font-medium">Value</th>
            <th className="py-3 text-right font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p, i) => {
            const share =
              totalN > 0
                ? `${((Number(p.amount_usdc) / totalN) * 100).toFixed(1)}%`
                : "—";
            return (
              <tr
                key={`${p.protocol}-${p.chain}-${i}`}
                className="border-b border-hairline last:border-0"
              >
                <td className="py-4 pr-4 font-medium text-ink">
                  {protocolLabel(p.protocol)}
                </td>
                <td className="py-4 pr-4 text-sm text-muted">
                  {chainLabel(p.chain)}
                </td>
                <td className="py-4 pr-4 text-right font-mono tabular-nums text-ink">
                  {share}
                </td>
                <td className="py-4 pr-4 text-right font-mono tabular-nums text-ink">
                  {usdc(p.amount_usdc)}
                </td>
                <td className="py-4 text-right text-sm text-muted">Open</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MandateSummary({
  mandate,
  loading,
}: {
  mandate: Mandate;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <div className="mt-6 space-y-3">
        <div className="h-4 w-full animate-pulse rounded bg-mist" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-mist" />
      </div>
    );
  }

  const killSwitch =
    mandate.committee_threshold_usdc === "0"
      ? "Permanent committee — every move is verified."
      : `Committee engages above ${usdc(mandate.committee_threshold_usdc)}.`;

  return (
    <div className="mt-6">
      {/* Always-visible compact rules */}
      <dl className="grid grid-cols-1 gap-x-10 gap-y-2 text-sm sm:grid-cols-2">
        <MandateRow
          label="Allowed protocols"
          value={mandate.allowed_protocols.join(", ") || "—"}
        />
        <MandateRow
          label="Allowed chains"
          value={mandate.allowed_chains.map(chainLabel).join(", ") || "—"}
        />
        <MandateRow label="Max risk score" value={`${mandate.max_risk_score}/100`} />
        <MandateRow label="Max loss" value={bps(mandate.max_loss_bps)} />
      </dl>

      {/* Disclosure for the rest */}
      <div className="mt-4 border-t border-hairline">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="py-4 text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          {open ? "Hide caps & kill-switch" : "Caps & kill-switch →"}
        </button>
        {open && (
          <dl className="grid grid-cols-1 gap-x-10 gap-y-2 pb-2 text-sm sm:grid-cols-2">
            <MandateRow
              label="Max share / protocol"
              value={`${mandate.max_share_per_protocol_bps / 100}%`}
            />
            <MandateRow
              label="Daily cap"
              value={usdc(mandate.daily_cap_usdc)}
            />
            <MandateRow label="Target APY" value={bps(mandate.target_apy_bps)} />
            <MandateRow label="Kill-switch / committee" value={killSwitch} />
          </dl>
        )}
      </div>
    </div>
  );
}

function MandateRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-1.5">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right font-mono text-ink">{value}</dd>
    </div>
  );
}

function ActivityFeed({
  a1,
  a2,
}: {
  a1: ReturnType<typeof useLive<Tally>>;
  a2: ReturnType<typeof useLive<Tally>>;
}) {
  const a1Tally = a1.data;
  const a2Tally = a2.data;

  return (
    <ul className="mt-6 flex flex-col">
      <ActivityRow
        tone="near"
        title="Cross-chain allocation verified by committee"
        meta={
          a1.loading
            ? "reading tally…"
            : a1Tally
            ? `action a1 · tally ${a1Tally.approvals}/3 · ${
                a1Tally.threshold_met ? "Executed" : "pending"
              }`
            : "action a1"
        }
        body="A bond-weighted committee checked the move and reached threshold. Only then did it execute."
      />
      <ActivityRow
        tone="danger"
        title="Blocked a manipulated action + slashed guardian g7"
        meta={
          a2.loading
            ? "reading tally…"
            : a2Tally
            ? `action a2 · tally ${a2Tally.approvals}/3 · Blocked · g7 slashed`
            : "action a2 · g7 slashed"
        }
        body="A guardian submitted a false attestation. The committee refused quorum and the dishonest guardian's bond was slashed."
      />
      <ActivityRow
        tone="evm"
        title="Cross-chain tx landed on Sepolia"
        meta={`chain ${CROSSCHAIN.chainId} · status ${CROSSCHAIN.sepoliaStatus} · mined`}
        body="NEAR signed the EVM transaction via Chain Signatures from the MPC-derived address."
        link={{ href: CROSSCHAIN.etherscan, label: `${CROSSCHAIN.sepoliaTx.slice(0, 18)}…${CROSSCHAIN.sepoliaTx.slice(-10)}` }}
      />
    </ul>
  );
}

function ActivityRow({
  tone,
  title,
  meta,
  body,
  link,
}: {
  tone: "near" | "danger" | "evm";
  title: string;
  meta: string;
  body: string;
  link?: { href: string; label: string };
}) {
  const dot =
    tone === "near" ? "bg-near" : tone === "danger" ? "bg-danger" : "bg-ink";
  return (
    <li className="flex gap-4 border-b border-hairline py-5 last:border-0">
      <span
        className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="font-medium text-ink">{title}</span>
          <span className="font-mono text-xs text-muted">{meta}</span>
        </div>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
          {body}
        </p>
        {link && (
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 font-mono text-xs text-muted hover:text-ink"
          >
            {link.label}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </li>
  );
}
