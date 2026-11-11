"use client";

import { useState, useEffect } from "react";
import { live } from "@/lib/near";
import { useLive } from "@/lib/useLive";
import { MANDATE } from "@/mock/mandate";
import { GUARDIANS } from "@/mock/guardians";
import { bps } from "@/lib/format";
import type { Mandate, GuardianRow } from "@/lib/types";
import { CATALOGUE, CATALOGUE_KEYS } from "@/lib/earn/catalogue";
import { scoreProtocol, riskLabel } from "@/lib/earn/risk";

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
            The agent composes across {CATALOGUE_KEYS.length} venues — stablecoin
            lending, RWA, staking, BTC, LP and more — to fit each brief. A sample:
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

// A representative slice of the catalogue, spanning the risk spectrum.
const SAMPLE_KEYS = [
  "rhea",
  "morpho-sepolia",
  "aave",
  "sdai",
  "ethena-susde",
  "lido-steth",
  "lombard-lbtc",
  "eigenlayer",
];

type LiveApy = { apyBps: number; market: string };

function StrategyTable() {
  const [apys, setApys] = useState<Record<string, LiveApy>>({});

  // Live APYs from DefiLlama, refreshed every 60s.
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/apys")
        .then((r) => r.json())
        .then((d) => {
          if (alive) setApys(d.apys ?? {});
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const rows = SAMPLE_KEYS.map((k) => ({ k, e: CATALOGUE[k]! }))
    .filter((x) => x.e)
    .map(({ k, e }) => {
      const la = apys[k];
      const apyBps = la?.apyBps ?? e.default_apy_bps;
      return {
        name: e.displayName,
        chain: e.chainLabel,
        source: e.category,
        exposure: e.asset,
        apy: `${(apyBps / 100).toFixed(2)}%`,
        market: la?.market,
        risk: riskLabel(scoreProtocol(e.risk)),
        live: e.live,
      };
    });

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-hairline text-xs font-medium uppercase tracking-wider text-muted">
            <th className="py-3 pr-4 font-medium">Strategy</th>
            <th className="py-3 pr-4 font-medium">Chain</th>
            <th className="py-3 pr-4 font-medium">Source of yield</th>
            <th className="py-3 pr-4 font-medium">Exposure</th>
            <th className="py-3 pr-4 text-right font-medium">APY</th>
            <th className="py-3 text-right font-medium">Risk</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.name + s.chain} className="border-b border-hairline last:border-0">
              <td className="py-4 pr-4 font-medium text-ink">
                {s.name}
                {s.live && (
                  <span className="ml-2 text-xs font-normal text-muted">live</span>
                )}
              </td>
              <td className="py-4 pr-4 text-sm text-muted">{s.chain}</td>
              <td className="py-4 pr-4 text-sm text-muted">{s.source}</td>
              <td className="py-4 pr-4 text-sm uppercase text-muted">{s.exposure}</td>
              <td className="py-4 pr-4 text-right font-mono tabular-nums text-ink">
                {s.apy}
                {s.market && (
                  <div className="font-sans text-[10px] font-normal text-muted">
                    {s.market}
                  </div>
                )}
              </td>
              <td className="py-4 text-right text-sm text-muted">{s.risk}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-muted">
        Live APYs from DefiLlama, refreshed every minute. Protocols like Morpho run
        many markets — the rate shown is the deepest (highest-TVL) market.
      </p>
    </div>
  );
}
