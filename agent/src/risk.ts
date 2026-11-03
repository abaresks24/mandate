// Deterministic risk-scoring module.
//
// CONTRACT: this is a PURE function. The LLM must NEVER compute or influence
// the score — it only explains the number this module produces. Same inputs
// always yield the same score (deterministic), and the score is MONOTONIC in
// each input (more audits / more TVL / more age never increases risk; more
// exploits / oracle dependency / riskier yield source never decreases it).
//
// Output domain: 0..100, higher = riskier.

import type { ProtocolRiskInput, RiskScore, YieldSource } from "./types.js";

/**
 * Risk is built as a weighted sum of per-factor risk contributions, each
 * normalised to 0..1, then scaled to 0..100. Weights sum to 1 so the result is
 * always within [0, 100]. All sub-scores are monotone in their input in the
 * "risk" direction.
 */
const WEIGHTS = {
  audits: 0.2,
  tvl: 0.2,
  age: 0.15,
  exploits: 0.25,
  oracle: 0.1,
  yieldSource: 0.1,
} as const;

// Sanity: weights must sum to 1 (keeps output in [0,100]).
const WEIGHT_SUM = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
if (Math.abs(WEIGHT_SUM - 1) > 1e-9) {
  throw new Error(`risk weights must sum to 1, got ${WEIGHT_SUM}`);
}

/** More audits => less risk. 0 audits = full risk, saturates at 4 audits. */
function auditRisk(audits: number): number {
  const a = Math.max(0, audits);
  return clamp01(1 - Math.min(a, 4) / 4);
}

/**
 * More TVL => less risk. Log-scaled: $1M ~ high risk, $1B ~ near zero.
 * Uses log10 between 1e6 and 1e9.
 */
function tvlRisk(tvlUsd: number): number {
  const tvl = Math.max(0, tvlUsd);
  if (tvl <= 1_000_000) return 1;
  if (tvl >= 1_000_000_000) return 0;
  const lo = Math.log10(1_000_000); // 6
  const hi = Math.log10(1_000_000_000); // 9
  const frac = (Math.log10(tvl) - lo) / (hi - lo);
  return clamp01(1 - frac);
}

/** Older => less risk. Saturates at 2 years (730 days). */
function ageRisk(ageDays: number): number {
  const age = Math.max(0, ageDays);
  return clamp01(1 - Math.min(age, 730) / 730);
}

/** More exploits => more risk. Each exploit adds risk, saturates at 3. */
function exploitRisk(exploits: number): number {
  const e = Math.max(0, exploits);
  return clamp01(Math.min(e, 3) / 3);
}

/** Depending on an external oracle adds a fixed risk premium. */
function oracleRisk(oracleDependency: boolean): number {
  return oracleDependency ? 1 : 0;
}

// Intrinsic risk per yield source, ordered least -> most risky.
const YIELD_SOURCE_RISK: Record<YieldSource, number> = {
  lending: 0.2,
  staking: 0.3,
  lp: 0.5,
  derivatives: 0.8,
  algorithmic: 1.0,
};

function yieldSourceRisk(source: YieldSource): number {
  return YIELD_SOURCE_RISK[source];
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/**
 * Compute the deterministic risk score (0..100, higher = riskier).
 * Pure: no I/O, no randomness, no LLM.
 */
export function scoreProtocol(input: ProtocolRiskInput): RiskScore {
  const sub =
    WEIGHTS.audits * auditRisk(input.audits) +
    WEIGHTS.tvl * tvlRisk(input.tvl_usd) +
    WEIGHTS.age * ageRisk(input.age_days) +
    WEIGHTS.exploits * exploitRisk(input.exploit_history) +
    WEIGHTS.oracle * oracleRisk(input.oracle_dependency) +
    WEIGHTS.yieldSource * yieldSourceRisk(input.yield_source);

  // sub is in [0,1]; scale to 0..100 and round to an integer score.
  return Math.round(clamp01(sub) * 100);
}

/** Exposed for tests/UI: the per-factor breakdown behind a score. */
export function scoreBreakdown(input: ProtocolRiskInput): {
  factor: string;
  weight: number;
  risk01: number;
  contribution: number;
}[] {
  const rows: [string, number, number][] = [
    ["audits", WEIGHTS.audits, auditRisk(input.audits)],
    ["tvl", WEIGHTS.tvl, tvlRisk(input.tvl_usd)],
    ["age", WEIGHTS.age, ageRisk(input.age_days)],
    ["exploits", WEIGHTS.exploits, exploitRisk(input.exploit_history)],
    ["oracle", WEIGHTS.oracle, oracleRisk(input.oracle_dependency)],
    ["yield_source", WEIGHTS.yieldSource, yieldSourceRisk(input.yield_source)],
  ];
  return rows.map(([factor, weight, risk01]) => ({
    factor,
    weight,
    risk01,
    contribution: Math.round(weight * risk01 * 100 * 100) / 100,
  }));
}
