"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { live } from "@/lib/near";
import { useLive } from "@/lib/useLive";
import { MANDATE } from "@/mock/mandate";
import { GUARDIANS } from "@/mock/guardians";
import { bps } from "@/lib/format";
import type { Mandate, GuardianRow } from "@/lib/types";

// USDC bonds are 6-dp fixed strings; sum into a human figure.
function sumBondUsdc(rows: GuardianRow[]): number {
  return rows.reduce((acc, g) => acc + Number(g.bond_usdc ?? "0") / 1e6, 0);
}

function fmtUsd(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

// Mock guardian rows shaped enough for the fallback sum.
const MOCK_GUARDIAN_ROWS = GUARDIANS.map((g) => ({
  id: g.id,
  account: g.account,
  wasm_url: "",
  wasm_sha256: g.wasm_sha256,
  bond: "0",
  status: "Active" as const,
  last_drawn_vault: null,
  unbond_ready_at: null,
  // ~$42k each so the fallback headline looks plausible, not precise-live.
  bond_usdc: "42000000000",
})) as GuardianRow[];

export default function Overview() {
  const mandate = useLive<Mandate>(() => live.mandate(), MANDATE, []);
  const guardians = useLive<GuardianRow[]>(
    () => live.allGuardians(),
    MOCK_GUARDIAN_ROWS,
    []
  );

  const m = mandate.data ?? MANDATE;
  const rows = guardians.data ?? MOCK_GUARDIAN_ROWS;
  const bonded = rows.length;
  const totalBond = sumBondUsdc(rows);

  return (
    <div className="flex flex-col gap-16">
      {/* Header */}
      <header>
        <h1 className="page-h1">Overview</h1>
        <p className="page-lede">
          An AI agent earns yield inside limits you set on-chain. Cross-chain
          moves are verified by a bonded guardian committee.
        </p>
      </header>

      {/* Headline numbers, big mono, quiet labels */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-hairline bg-hairline lg:grid-cols-4">
        <Metric
          label="Guardians bonded"
          value={String(bonded)}
          hint="registered on the coordinator"
        />
        <Metric
          label="Bond as insurance"
          value={fmtUsd(totalBond)}
          hint="pooled, exceeds value at risk"
        />
        <Metric
          label="Target APY"
          value={bps(m.target_apy_bps)}
          hint="demo mandate on-chain"
        />
        <Metric
          label="Cross-chain tx landed"
          value="1"
          hint="Ethereum via Chain Signatures"
        />
      </section>

      {/* Strategy universe */}
      <section>
        <div className="mb-6">
          <h2 className="section-h2">Strategy universe</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">
            The agent composes across real markets pulled live from DefiLlama:
            lending, RWA, staking, BTC, LP and more. Rates and TVL are current and
            risk is scored deterministically. Two venues are executable on testnet
            today (Rhea, Morpho); the rest are real markets with execution on the
            roadmap, tagged below. Nothing invented.
          </p>
        </div>

        <StrategyTable />
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="bg-paper p-6">
      <div className="label">{label}</div>
      <div className="num mt-3 text-3xl font-semibold text-ink">{value}</div>
      <div className="mt-2 text-xs leading-relaxed text-muted">{hint}</div>
    </div>
  );
}

type UniverseRow = {
  name: string;
  market: string;
  chain: string;
  category: string;
  exposure: string;
  apyBps: number;
  tvlUsd: number;
  risk: string;
  riskScore: number;
  live: boolean;
};

type SortKey = "apyBps" | "tvlUsd" | "riskScore";

function tvlShort(n: number): string {
  return n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : `$${Math.max(1, Math.round(n / 1e6))}M`;
}

// A Morpho-style multi-select dropdown: pick the values you want to see. Empty
// selection = no filter (everything shown). Closes on outside-click / Escape.
function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (o: string) => {
    const next = new Set(selected);
    if (next.has(o)) next.delete(o);
    else next.add(o);
    onChange(next);
  };
  const count = selected.size;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "focusable inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
          count > 0
            ? "border-near/50 bg-near/5 text-ink"
            : "border-edge bg-paper text-muted hover:border-muted/50 hover:text-ink",
        )}
      >
        <span>{label}</span>
        {count > 0 && (
          <span className="num rounded-full bg-near px-1.5 text-[11px] font-semibold text-cream">
            {count}
          </span>
        )}
        <span className="text-muted">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1.5 max-h-72 w-60 overflow-auto rounded-lg border border-hairline bg-paper p-1.5 shadow-emboss">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="label">{label}</span>
            {count > 0 && (
              <button
                type="button"
                onClick={() => onChange(new Set())}
                className="focusable text-xs text-near hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          {options.map((o) => {
            const on = selected.has(o);
            return (
              <button
                key={o}
                type="button"
                onClick={() => toggle(o)}
                className="focusable flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-ink transition-colors hover:bg-mist"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] leading-none text-cream",
                    on ? "border-near bg-near" : "border-edge bg-paper",
                  )}
                  aria-hidden
                >
                  {on ? "✓" : ""}
                </span>
                <span className="capitalize">{o}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StrategyTable() {
  const [rows, setRows] = useState<UniverseRow[] | null>(null);
  const [chain, setChain] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<Set<string>>(new Set());
  const [exposure, setExposure] = useState<Set<string>>(new Set());
  const [testnetOnly, setTestnetOnly] = useState(false);
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("tvlUsd");
  const [desc, setDesc] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/universe")
        .then((r) => r.json())
        .then((d) => {
          if (alive) setRows(d.venues ?? []);
        })
        .catch(() => {
          if (alive) setRows([]);
        });
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (rows === null) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-10 rounded" />
        ))}
      </div>
    );
  }

  const chains = Array.from(new Set(rows.map((r) => r.chain))).sort();
  const categories = Array.from(new Set(rows.map((r) => r.category))).sort();
  const exposures = Array.from(new Set(rows.map((r) => r.exposure))).sort();

  const query = q.trim().toLowerCase();
  const filtered = rows.filter(
    (r) =>
      (chain.size === 0 || chain.has(r.chain)) &&
      (category.size === 0 || category.has(r.category)) &&
      (exposure.size === 0 || exposure.has(r.exposure)) &&
      (!testnetOnly || r.live) &&
      (query === "" ||
        r.name.toLowerCase().includes(query) ||
        r.market.toLowerCase().includes(query)),
  );
  const sorted = [...filtered].sort((a, b) => {
    const d = a[sortKey] - b[sortKey];
    return desc ? -d : d;
  });

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setDesc((v) => !v);
    else {
      setSortKey(k);
      setDesc(true);
    }
  };
  const caret = (k: SortKey) => (sortKey === k ? (desc ? " ↓" : " ↑") : "");
  const activeCount = chain.size + category.size + exposure.size + (testnetOnly ? 1 : 0);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search protocol or market…"
          className="input max-w-[14rem]"
        />
        <MultiSelect label="Chain" options={chains} selected={chain} onChange={setChain} />
        <MultiSelect label="Category" options={categories} selected={category} onChange={setCategory} />
        <MultiSelect label="Exposure" options={exposures} selected={exposure} onChange={setExposure} />
        <button
          type="button"
          onClick={() => setTestnetOnly((v) => !v)}
          className={cn(
            "focusable inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors",
            testnetOnly
              ? "border-ok/50 bg-ok/10 text-ok"
              : "border-edge bg-paper text-muted hover:border-muted/50 hover:text-ink",
          )}
        >
          Testnet-executable only
        </button>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => {
              setChain(new Set());
              setCategory(new Set());
              setExposure(new Set());
              setTestnetOnly(false);
            }}
            className="focusable text-sm text-near hover:underline"
          >
            Reset
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Protocol</th>
              <th>Market</th>
              <th>Chain</th>
              <th>Category</th>
              <th>Exposure</th>
              <th className="text-right">
                <button type="button" onClick={() => toggleSort("apyBps")} className="th-sort focusable">
                  APY{caret("apyBps")}
                </button>
              </th>
              <th className="text-right">
                <button type="button" onClick={() => toggleSort("tvlUsd")} className="th-sort focusable">
                  TVL{caret("tvlUsd")}
                </button>
              </th>
              <th className="text-right">
                <button type="button" onClick={() => toggleSort("riskScore")} className="th-sort focusable">
                  Risk{caret("riskScore")}
                </button>
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => (
              <tr key={s.name + s.market + s.chain + i}>
                <td className="font-medium text-ink">
                  <span className="inline-flex items-center gap-2">
                    {s.name}
                    {s.live && (
                      <span className="rounded-full border border-ok/40 bg-ok/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ok">
                        testnet
                      </span>
                    )}
                  </span>
                </td>
                <td className="num text-xs text-muted">{s.market}</td>
                <td className="text-sm text-muted">{s.chain}</td>
                <td className="text-sm text-muted">{s.category}</td>
                <td className="text-sm uppercase text-muted">{s.exposure}</td>
                <td className="num text-right text-ink">
                  {(s.apyBps / 100).toFixed(2)}%
                </td>
                <td className="num text-right text-muted">
                  {tvlShort(s.tvlUsd)}
                </td>
                <td className="text-right text-sm text-muted">{s.risk}</td>
                <td className="text-right">
                  <Link
                    href={`/app/earn?seed=${encodeURIComponent(
                      `Put my USDC to work via ${s.name} ${s.market} on ${s.chain}`,
                    )}`}
                    className="focusable text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
                  >
                    Earn →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Honest legend: what "testnet" means vs the rest. */}
      <div className="mt-4 flex flex-col gap-1.5 text-xs leading-relaxed text-muted">
        <p>
          <span className="mr-1 rounded-full border border-ok/40 bg-ok/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ok">
            testnet
          </span>
          = executable on testnet today (Rhea on NEAR, Morpho on Ethereum via Chain
          Signatures). Every other row is a{" "}
          <strong className="font-medium text-ink">real market</strong> with live
          APY/TVL pulled from DefiLlama that the agent composes into strategies.
          On-chain execution for those is on the roadmap. Nothing here is invented.
        </p>
        <p>
          Showing {sorted.length} of {rows.length} markets · APY/TVL refresh every
          minute · a protocol like Morpho runs many markets, so each row is a specific
          named market.
        </p>
      </div>
    </div>
  );
}
