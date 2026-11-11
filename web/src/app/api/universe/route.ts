import { NextResponse } from "next/server";
import { buildShortlist } from "@/lib/earn/universe";
import { scoreProtocol, riskLabel } from "@/lib/earn/risk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The live market universe the agent composes from — real markets from DefiLlama.
// Compact shape for the Overview table.
export async function GET() {
  const venues = await buildShortlist();
  const rows = Object.values(venues)
    .map((v) => {
      const risk = scoreProtocol(v.risk);
      return {
        name: v.displayName,
        market: v.market,
        chain: v.chainLabel,
        category: v.category,
        exposure: v.asset,
        apyBps: v.apyBps,
        tvlUsd: v.tvlUsd,
        risk: riskLabel(risk),
        riskScore: risk,
        live: v.live,
      };
    })
    .sort((a, b) => b.tvlUsd - a.tvlUsd);

  return NextResponse.json(
    { venues: rows },
    { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=180" } },
  );
}
