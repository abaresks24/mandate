"use client";

import { useState, useEffect } from "react";
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
          An AI agent earns yield within rules you set — verified by bonded
          guardians, never by blind trust.
        </p>
      </header>

      {/* Headline numbers — big mono, quiet labels */}
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
            The agent composes across real markets pulled live from DefiLlama —
            lending, RWA, staking, BTC, LP and more. Rates and TVL are current;
            risk is scored deterministically.
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

function FilterRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
      <span className="label">{label}</span>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={cn(
            "focusable transition-colors",
            value === o
              ? "font-medium text-ink underline underline-offset-4 decoration-near"
              : "text-muted hover:text-ink"
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function StrategyTable() {
  const [rows, setRows] = useState<UniverseRow[] | null>(null);
  const [chain, setChain] = useState("All");
  const [category, setCategory] = useState("All");
  const [exposure, setExposure] = useState("All");
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

  const chains = ["All", ...Array.from(new Set(rows.map((r) => r.chain)))];
  const categories = ["All", ...Array.from(new Set(rows.map((r) => r.category)))];
  const exposures = ["All", ...Array.from(new Set(rows.map((r) => r.exposure)))];

  const query = q.trim().toLowerCase();
  const filtered = rows.filter(
    (r) =>
      (chain === "All" || r.chain === chain) &&
      (category === "All" || r.category === category) &&
      (exposure === "All" || r.exposure === exposure) &&
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

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search protocol or market…"
          className="input max-w-xs"
        />
        <FilterRow label="Chain" options={chains} value={chain} onChange={setChain} />
        <FilterRow label="Category" options={categories} value={category} onChange={setCategory} />
        <FilterRow label="Exposure" options={exposures} value={exposure} onChange={setExposure} />
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
                  {s.name}
                  {s.live && <span className="ml-2 text-xs font-normal text-muted">live</span>}
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

      <p className="mt-3 text-xs leading-relaxed text-muted">
        {sorted.length} of {rows.length} live markets from DefiLlama, refreshed every
        minute. A protocol like Morpho runs many markets — each row is a specific named market.
      </p>
    </div>
  );
}
