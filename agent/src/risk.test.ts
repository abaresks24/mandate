import { describe, expect, it } from "vitest";
import { scoreProtocol, scoreBreakdown } from "./risk.js";
import type { ProtocolRiskInput } from "./types.js";

const base: ProtocolRiskInput = {
  name: "base",
  audits: 2,
  tvl_usd: 100_000_000,
  age_days: 365,
  exploit_history: 0,
  oracle_dependency: false,
  yield_source: "lending",
};

describe("risk scoring", () => {
  it("is deterministic — same input, same score", () => {
    const a = scoreProtocol(base);
    const b = scoreProtocol({ ...base });
    expect(a).toBe(b);
  });

  it("always produces 0..100", () => {
    const min = scoreProtocol({
      name: "safe",
      audits: 10,
      tvl_usd: 5_000_000_000,
      age_days: 3000,
      exploit_history: 0,
      oracle_dependency: false,
      yield_source: "lending",
    });
    const max = scoreProtocol({
      name: "degen",
      audits: 0,
      tvl_usd: 100,
      age_days: 0,
      exploit_history: 10,
      oracle_dependency: true,
      yield_source: "algorithmic",
    });
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(100);
    expect(max).toBeGreaterThan(min);
  });

  it("monotonic: more audits never increases risk", () => {
    const low = scoreProtocol({ ...base, audits: 0 });
    const mid = scoreProtocol({ ...base, audits: 2 });
    const high = scoreProtocol({ ...base, audits: 5 });
    expect(low).toBeGreaterThanOrEqual(mid);
    expect(mid).toBeGreaterThanOrEqual(high);
  });

  it("monotonic: more TVL never increases risk", () => {
    const small = scoreProtocol({ ...base, tvl_usd: 2_000_000 });
    const big = scoreProtocol({ ...base, tvl_usd: 500_000_000 });
    expect(small).toBeGreaterThanOrEqual(big);
  });

  it("monotonic: more age never increases risk", () => {
    const young = scoreProtocol({ ...base, age_days: 10 });
    const old = scoreProtocol({ ...base, age_days: 1000 });
    expect(young).toBeGreaterThanOrEqual(old);
  });

  it("monotonic: more exploits never decreases risk", () => {
    const clean = scoreProtocol({ ...base, exploit_history: 0 });
    const one = scoreProtocol({ ...base, exploit_history: 1 });
    const many = scoreProtocol({ ...base, exploit_history: 5 });
    expect(one).toBeGreaterThanOrEqual(clean);
    expect(many).toBeGreaterThanOrEqual(one);
  });

  it("oracle dependency never decreases risk", () => {
    const without = scoreProtocol({ ...base, oracle_dependency: false });
    const withOracle = scoreProtocol({ ...base, oracle_dependency: true });
    expect(withOracle).toBeGreaterThanOrEqual(without);
  });

  it("riskier yield source never decreases risk", () => {
    const lending = scoreProtocol({ ...base, yield_source: "lending" });
    const lp = scoreProtocol({ ...base, yield_source: "lp" });
    const algo = scoreProtocol({ ...base, yield_source: "algorithmic" });
    expect(lp).toBeGreaterThanOrEqual(lending);
    expect(algo).toBeGreaterThanOrEqual(lp);
  });

  it("breakdown contributions sum (approximately) to the score", () => {
    const rows = scoreBreakdown(base);
    const sum = rows.reduce((a, r) => a + r.contribution, 0);
    expect(Math.abs(sum - scoreProtocol(base))).toBeLessThanOrEqual(1);
  });
});
