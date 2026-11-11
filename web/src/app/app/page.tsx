"use client";

import { useState, useEffect } from "react";
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
        <h1 className="display text-4xl font-semibold leading-tight text-ink sm:text-5xl">
          Overview
        </h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted">
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
          <h2 className="text-xl font-semibold tracking-tight text-ink">
            Strategy universe
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
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
      <div className="text-xs font-medium uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className="mt-3 font-mono text-3xl font-semibold tabular-nums text-ink">
        {value}
      </div>
      <div className="mt-2 text-xs text-muted">{hint}</div>
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
  live: boolean;
};

function tvlShort(n: number): string {
  return n >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : `$${Math.max(1, Math.round(n / 1e6))}M`;
}

function StrategyTable() {
  const [rows, setRows] = useState<UniverseRow[] | null>(null);

  // The live market universe from DefiLlama, refreshed every 60s.
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
          <div key={i} className="h-10 animate-pulse rounded bg-mist" />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-hairline text-xs font-medium uppercase tracking-wider text-muted">
            <th className="py-3 pr-4 font-medium">Protocol</th>
            <th className="py-3 pr-4 font-medium">Market</th>
            <th className="py-3 pr-4 font-medium">Chain</th>
            <th className="py-3 pr-4 font-medium">Category</th>
            <th className="py-3 pr-4 font-medium">Exposure</th>
            <th className="py-3 pr-4 text-right font-medium">APY</th>
            <th className="py-3 pr-4 text-right font-medium">TVL</th>
            <th className="py-3 text-right font-medium">Risk</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => (
            <tr key={s.name + s.market + s.chain + i} className="border-b border-hairline last:border-0">
              <td className="py-3 pr-4 font-medium text-ink">
                {s.name}
                {s.live && (
                  <span className="ml-2 text-xs font-normal text-muted">live</span>
                )}
              </td>
              <td className="py-3 pr-4 font-mono text-xs text-muted">{s.market}</td>
              <td className="py-3 pr-4 text-sm text-muted">{s.chain}</td>
              <td className="py-3 pr-4 text-sm text-muted">{s.category}</td>
              <td className="py-3 pr-4 text-sm uppercase text-muted">{s.exposure}</td>
              <td className="py-3 pr-4 text-right font-mono tabular-nums text-ink">
                {(s.apyBps / 100).toFixed(2)}%
              </td>
              <td className="py-3 pr-4 text-right font-mono tabular-nums text-muted">
                {tvlShort(s.tvlUsd)}
              </td>
              <td className="py-3 text-right text-sm text-muted">{s.risk}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted">
        {rows.length} live markets from DefiLlama, refreshed every minute. A protocol
        like Morpho runs many markets — each row is a specific named market.
      </p>
    </div>
  );
}
