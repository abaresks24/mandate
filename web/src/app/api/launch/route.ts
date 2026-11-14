import { NextResponse } from "next/server";
import { STEPS, evmAddress, type LaunchCtx, type StepName } from "@/lib/launch/engine";
import { keys, view } from "@/lib/launch/chain";
import { sepolia } from "@/lib/launch/evm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET: preflight for the Launch panel (is the live path ready? what must be funded?).
export async function GET() {
  try {
    const k = keys();
    const address = await evmAddress();
    const [wei, pos, guardians] = await Promise.all([
      sepolia.balanceWei(address),
      view<{ idle_usdc: string; total_usdc: string }>(k.vault, "view_positions"),
      Promise.all(
        ["g1", "g2", "g3", "g4", "g5", "g6"].map((id) =>
          view<{ status: string; bond: string }>(k.coordinator, "view_guardian", { guardian_id: id }).catch(() => null),
        ),
      ),
    ]);
    return NextResponse.json({
      ready: true,
      vault: k.vault,
      coordinator: k.coordinator,
      evmAddress: address,
      sepoliaEthWei: wei.toString(),
      fundedForSepolia: wei >= 2_000_000_000_000_000n,
      positions: pos,
      guardians: guardians.filter(Boolean).length,
    });
  } catch (e) {
    return NextResponse.json({ ready: false, error: e instanceof Error ? e.message : String(e) });
  }
}

// POST { step, ctx }: run ONE step of the flow for real, return its result + updated ctx.
export async function POST(req: Request) {
  let body: { step?: string; ctx?: LaunchCtx };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const step = body.step as StepName;
  if (!step || !(step in STEPS)) return NextResponse.json({ error: "unknown step" }, { status: 400 });
  const ctx = body.ctx;
  if (!ctx?.mandate || !ctx.weights) return NextResponse.json({ error: "missing ctx" }, { status: 400 });
  try {
    return NextResponse.json(await STEPS[step](ctx));
  } catch (e) {
    return NextResponse.json({
      ok: false, title: step, ctx, txs: [],
      detail: `Step failed: ${e instanceof Error ? e.message : String(e)}`,
    });
  }
}
