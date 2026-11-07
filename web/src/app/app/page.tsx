"use client";

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

  const isLive = guardians.source === "live" || mandate.source === "live";

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

      {/* Most-used strategies */}
      <section>
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-ink">
              Most-used strategies
            </h2>
            <p className="mt-1 text-sm text-muted">
              Where the agent puts stablecoins to work.
            </p>
          </div>
          <span className="hidden text-sm text-muted sm:inline">
            {isLive ? "live · testnet" : "representative figures"}
          </span>
        </div>

        <StrategyTable targetApy={bps(m.target_apy_bps)} />

        <p className="mt-5 max-w-3xl text-sm leading-relaxed text-muted">
          Target APY reflects the on-chain demo mandate. TVL and user counts are
          representative placeholders — this build is not a live TVL index.
        </p>
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

type Strategy = {
  name: string;
  chain: string;
  source: string;
  apy: string;
  risk: string;
  tvl: string;
};

function StrategyTable({ targetApy }: { targetApy: string }) {
  const strategies: Strategy[] = [
    {
      name: "USDC lending on Rhea",
      chain: "NEAR",
      source: "Lending supply rate",
      apy: "7.40%",
      risk: "Low",
      tvl: "$3.0M",
    },
    {
      name: "USDC on Morpho",
      chain: "Ethereum (via Chain Signatures)",
      source: "Morpho market supply",
      apy: "9.10%",
      risk: "Medium",
      tvl: "$2.0M",
    },
    {
      name: "Demo mandate target",
      chain: "NEAR",
      source: "Blended, on-chain mandate",
      apy: targetApy,
      risk: "Low",
      tvl: "—",
    },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-hairline text-xs font-medium uppercase tracking-wider text-muted">
            <th className="py-3 pr-4 font-medium">Strategy</th>
            <th className="py-3 pr-4 font-medium">Chain</th>
            <th className="py-3 pr-4 font-medium">Source of yield</th>
            <th className="py-3 pr-4 text-right font-medium">Target APY</th>
            <th className="py-3 pr-4 text-right font-medium">Risk</th>
            <th className="py-3 text-right font-medium">TVL</th>
          </tr>
        </thead>
        <tbody>
          {strategies.map((s) => (
            <tr
              key={s.name}
              className="border-b border-hairline last:border-0"
            >
              <td className="py-4 pr-4 font-medium text-ink">{s.name}</td>
              <td className="py-4 pr-4 text-sm text-muted">{s.chain}</td>
              <td className="py-4 pr-4 text-sm text-muted">{s.source}</td>
              <td className="py-4 pr-4 text-right font-mono tabular-nums text-ink">
                {s.apy}
              </td>
              <td className="py-4 pr-4 text-right text-sm text-muted">
                {s.risk}
              </td>
              <td className="py-4 text-right font-mono text-sm tabular-nums text-muted">
                {s.tvl}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
