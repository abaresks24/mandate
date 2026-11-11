import { NextResponse } from "next/server";
import { getLiveApy } from "@/lib/earn/apy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Live APY per venue (DefiLlama), for the Overview table + any client that wants
// current rates. { [catalogueKey]: { apyBps, market, tvlUsd } }.
export async function GET() {
  const apys = await getLiveApy();
  return NextResponse.json(
    { apys },
    { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=120" } },
  );
}
