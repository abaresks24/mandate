// Dev harness: run the live Launch steps from the terminal (same code the API uses).
//   npx tsx --conditions=react-server scripts/chain/run-flow.ts "Rhea=100" arm guardrail supply
import { STEPS, type LaunchCtx, type StepName } from "../../src/lib/launch/engine";
const [, , weightsArg, ...steps] = process.argv;
const weights = Object.fromEntries(weightsArg.split(",").map((p) => { const [k, v] = p.split("="); return [k, Number(v)]; }));
let ctx: LaunchCtx = {
  mandate: { target_apy_bps: 700, max_risk_score: 40, allowed_protocols: Object.keys(weights), allowed_chains: ["near", "ethereum-sepolia"], max_share_per_protocol_bps: 7000, max_loss_bps: 300 },
  weights,
};
(async () => {
  for (const s of steps as StepName[]) {
    const t0 = Date.now();
    const r = await STEPS[s](ctx);
    ctx = r.ctx;
    console.log(`\n[${r.ok ? "OK " : "FAIL"}] ${s} (${((Date.now() - t0) / 1000).toFixed(1)}s) ${r.title}\n   ${r.detail}`);
    for (const t of r.txs) console.log(`   tx ${t.label}: ${t.hash} ${t.failure ? "FAILURE: " + t.failure.slice(0, 160) : ""}`);
    if (r.data) console.log("   data:", JSON.stringify(r.data).slice(0, 400));
    if (r.blocker) { console.log("   BLOCKER:", r.blocker); break; }
    if (!r.ok) break;
  }
})();
