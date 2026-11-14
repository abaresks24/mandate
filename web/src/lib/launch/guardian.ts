// Guardian attestation logic (TypeScript port of guardian/src/lib.rs).
//
// Same deterministic rules and the same canonical-JSON + sha256 commit as the
// Rust/OutLayer guardian, so a slasher can recompute any report. Difference from
// the OutLayer build: in this web flow the guardian OPERATOR runs this code on the
// server and signs with the guardian's own NEAR account (no TEE), and the price
// is read on-chain (Chainlink USDC/USD on Sepolia, block-pinned) because the
// Pyth Hermes endpoint the WASM used now requires an API key.

import { createHash } from "node:crypto";

export const USDC_ONE = 1_000_000;
export const PRICE_DEVIATION_BPS = 100; // 1% from the peg => DEPEG
export const SLIPPAGE_MAX_BPS = 100;

const SEPOLIA_RPC = () => process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
/** Chainlink USDC/USD aggregator on Ethereum Sepolia (8 decimals). */
export const CHAINLINK_USDC_USD_SEPOLIA = "0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E";

export type ReasonCode =
  | "PRICE_OK" | "PRICE_DEVIATION" | "SLIPPAGE_OK" | "SLIPPAGE_HIGH" | "PROTOCOL_LIVE"
  | "PROTOCOL_PAUSED" | "DEPEG" | "ORACLE_STALE" | "CROSSCHAIN_STATE_OK"
  | "CROSSCHAIN_STATE_BAD" | "DATA_UNAVAILABLE";

export interface Source {
  name: string;
  verifiable: boolean;
  payload_ref?: string;
  endpoint?: string;
}
export interface GuardianReport {
  action_id: string;
  approve: boolean;
  reason_codes: ReasonCode[];
  facts: { price_usdc: string; price_block: number; observed_slippage_bps: number; protocol_paused: boolean };
  sources: Source[];
}
export interface GatheredFacts {
  price_usdc: number;
  price_block: number;
  observed_slippage_bps: number;
  protocol_paused: boolean;
  sources: Source[];
}
export interface CrossChainTemplate {
  kind: "AllocateCrossChain";
  chain: string;
  protocol: string;
  market: string;
  amount: string;
  max_slippage_bps: number;
}

// ---- canonical JSON + commit ----
function canonicalize(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonicalize);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, canonicalize(o[k])]));
  }
  return v;
}
export const canonicalJson = (v: unknown) => JSON.stringify(canonicalize(v));
export const sha256Hex = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

// ---- pure decision rules (mirror build_report) ----
export const deviationBps = (price: number) => Math.floor((Math.abs(price - USDC_ONE) * 10_000) / USDC_ONE);

export function buildReport(actionId: string, t: CrossChainTemplate, f: GatheredFacts): GuardianReport {
  const reason: ReasonCode[] = [];
  let approve = true;
  const dev = deviationBps(f.price_usdc);
  if (dev > PRICE_DEVIATION_BPS) {
    reason.push("PRICE_DEVIATION", "DEPEG");
    approve = false;
  } else reason.push("PRICE_OK");

  if (f.observed_slippage_bps > SLIPPAGE_MAX_BPS) {
    reason.push("SLIPPAGE_HIGH");
    approve = false;
  } else reason.push("SLIPPAGE_OK");

  if (f.protocol_paused) {
    reason.push("PROTOCOL_PAUSED");
    approve = false;
  } else reason.push("PROTOCOL_LIVE");

  if (f.observed_slippage_bps > t.max_slippage_bps) {
    if (!reason.includes("SLIPPAGE_HIGH")) reason.push("SLIPPAGE_HIGH");
    approve = false;
  }
  reason.push(approve && !f.protocol_paused && dev <= PRICE_DEVIATION_BPS ? "CROSSCHAIN_STATE_OK" : "CROSSCHAIN_STATE_BAD");

  return {
    action_id: actionId,
    approve,
    reason_codes: reason,
    facts: {
      price_usdc: String(f.price_usdc),
      price_block: f.price_block,
      observed_slippage_bps: f.observed_slippage_bps,
      protocol_paused: f.protocol_paused,
    },
    sources: f.sources,
  };
}

/** Fail-closed report when facts can't be gathered. */
export function unavailableReport(actionId: string): GuardianReport {
  return {
    action_id: actionId,
    approve: false,
    reason_codes: ["DATA_UNAVAILABLE"],
    facts: { price_usdc: "0", price_block: 0, observed_slippage_bps: 0, protocol_paused: false },
    sources: [],
  };
}

// ---- fact gathering (Sepolia, block-pinned) ----
async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const r = await fetch(SEPOLIA_RPC(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    cache: "no-store",
  });
  const j = (await r.json()) as { result?: T; error?: { message: string } };
  if (j.error) throw new Error(j.error.message);
  return j.result as T;
}

export async function gatherFacts(t: CrossChainTemplate): Promise<GatheredFacts> {
  // Pin one block; every read is "at" that block so the report is reproducible.
  const block = Number(BigInt(await rpc<string>("eth_blockNumber", [])));
  const tag = "0x" + block.toString(16);

  // USDC/USD: Chainlink latestRoundData().answer (8 dp) -> 6 dp fixed point.
  const round = await rpc<string>("eth_call", [{ to: CHAINLINK_USDC_USD_SEPOLIA, data: "0xfeaf968c" }, tag]);
  const answer = BigInt("0x" + round.slice(2 + 64, 2 + 128)); // 2nd word = answer
  const price = Number(answer / 100n);

  // paused() on the target market at the same block; EOAs / missing selector => not paused.
  let paused = false;
  try {
    const word = await rpc<string>("eth_call", [{ to: t.market, data: "0x5c975abb" }, tag]);
    paused = /[1-9a-f]/i.test(word.slice(2));
  } catch {
    paused = false;
  }

  return {
    price_usdc: price,
    price_block: block,
    // No live AMM route to quote in this demo: 0 bps when the market reads cleanly.
    observed_slippage_bps: 0,
    protocol_paused: paused,
    sources: [
      { name: "chainlink-usdc-usd-sepolia", verifiable: true, payload_ref: `${CHAINLINK_USDC_USD_SEPOLIA}@${block}` },
      // Fixed label on purpose: reports are published on-chain, so never embed a
      // configured RPC URL (it may carry an API key).
      { name: "rpc-sepolia", verifiable: false, endpoint: "ethereum-sepolia json-rpc" },
    ],
  };
}

/** One guardian invocation: gather, decide, return the exact report string + its commit. */
export async function attest(actionId: string, t: CrossChainTemplate) {
  let report: GuardianReport;
  try {
    report = buildReport(actionId, t, await gatherFacts(t));
  } catch {
    report = unavailableReport(actionId);
  }
  const report_json = canonicalJson(report);
  return { report, report_json, commit_hash: sha256Hex(report_json) };
}
