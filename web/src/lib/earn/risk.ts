// Deterministic risk-scoring module — ported verbatim from agent/src/risk.ts.
//
// CONTRACT: this is a PURE function. The LLM must NEVER compute or influence
// the score — it only explains the number this module produces. Same inputs
// always yield the same score (deterministic), and the score is MONOTONIC in
// each input (more audits / more TVL / more age never increases risk; more
// exploits / oracle dependency / riskier yield source never decreases it).
//
// Output domain: 0..100, higher = riskier.

export type YieldSource =
  | "lending" // supplying to a money market (Burrow/Morpho style)
  | "lp" // providing liquidity to an AMM pool
  | "staking" // native/liquid staking
  | "derivatives" // perps / structured / delta-neutral
  | "algorithmic"; // algorithmic/rebasing — highest intrinsic risk

export interface ProtocolRiskInput {
  name: string;
  audits: number; // count of independent security audits
  tvl_usd: number; // current total value locked, USD
  age_days: number; // days since protocol launch
  exploit_history: number; // count of past exploits/incidents
  oracle_dependency: boolean; // relies on an external price oracle
  yield_source: YieldSource;
}

export type RiskScore = number; // 0..100, higher = riskier.

const WEIGHTS = {
  audits: 0.2,
  tvl: 0.2,
  age: 0.15,
  exploits: 0.25,
  oracle: 0.1,
  yieldSource: 0.1,
} as const;

const WEIGHT_SUM = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
if (Math.abs(WEIGHT_SUM - 1) > 1e-9) {
  throw new Error(`risk weights must sum to 1, got ${WEIGHT_SUM}`);
}

/** More audits => less risk. 0 audits = full risk, saturates at 4 audits. */
function auditRisk(audits: number): number {
  const a = Math.max(0, audits);
  return clamp01(1 - Math.min(a, 4) / 4);
}

/** More TVL => less risk. Log-scaled between $1M and $1B. */
function tvlRisk(tvlUsd: number): number {
  const tvl = Math.max(0, tvlUsd);
  if (tvl <= 1_000_000) return 1;
  if (tvl >= 1_000_000_000) return 0;
  const lo = Math.log10(1_000_000);
  const hi = Math.log10(1_000_000_000);
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

/** Compute the deterministic risk score (0..100, higher = riskier). Pure. */
export function scoreProtocol(input: ProtocolRiskInput): RiskScore {
  const sub =
    WEIGHTS.audits * auditRisk(input.audits) +
    WEIGHTS.tvl * tvlRisk(input.tvl_usd) +
    WEIGHTS.age * ageRisk(input.age_days) +
    WEIGHTS.exploits * exploitRisk(input.exploit_history) +
    WEIGHTS.oracle * oracleRisk(input.oracle_dependency) +
    WEIGHTS.yieldSource * yieldSourceRisk(input.yield_source);

  return Math.round(clamp01(sub) * 100);
}

export interface RiskFactor {
  factor: string;
  weight: number;
  risk01: number;
  contribution: number;
}

/** Exposed for UI: the per-factor breakdown behind a score. */
export function scoreBreakdown(input: ProtocolRiskInput): RiskFactor[] {
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

/** Coarse risk label from a 0..100 score, for editorial headlines. */
export function riskLabel(score: number): "Low" | "Moderate" | "Elevated" | "High" {
  if (score <= 25) return "Low";
  if (score <= 45) return "Moderate";
  if (score <= 65) return "Elevated";
  return "High";
}
