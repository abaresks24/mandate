import { describe, expect, it } from "vitest";
import {
  proposeTemplates,
  templateAllowedByMandate,
  StubVaultSigner,
} from "./propose.js";
import type { ActionTemplate, Mandate } from "./types.js";

const mandate: Mandate = {
  owner: "alice.testnet",
  target_apy_bps: 800,
  max_risk_score: 60,
  allowed_protocols: ["rhea", "morpho"],
  allowed_chains: ["near", "ethereum-sepolia"],
  max_share_per_protocol_bps: 5000,
  max_loss_bps: 300,
  daily_cap_usdc: "5000000000",
  committee_threshold_usdc: "0",
};

const supply: ActionTemplate = {
  kind: "SupplyRhea",
  token: "usdc",
  amount: "1000000000",
  market: "ref-finance-101.testnet",
};

const crossChain: ActionTemplate = {
  kind: "AllocateCrossChain",
  chain: "ethereum-sepolia",
  protocol: "morpho",
  market: "0x0000000000000000000000000000000000000000",
  amount: "1000000000",
  max_slippage_bps: 50,
};

describe("templateAllowedByMandate", () => {
  it("accepts a valid SupplyRhea", () => {
    expect(templateAllowedByMandate(supply, mandate).ok).toBe(true);
  });

  it("accepts a valid AllocateCrossChain", () => {
    expect(templateAllowedByMandate(crossChain, mandate).ok).toBe(true);
  });

  it("rejects a cross-chain allocation to a disallowed chain", () => {
    const bad: ActionTemplate = { ...crossChain, chain: "base-sepolia" };
    const res = templateAllowedByMandate(bad, mandate);
    expect(res.ok).toBe(false);
  });

  it("rejects a non-numeric amount", () => {
    const bad: ActionTemplate = { ...supply, amount: "1e9" };
    expect(templateAllowedByMandate(bad, mandate).ok).toBe(false);
  });
});

describe("proposeTemplates", () => {
  it("emits valid templates and returns action ids", async () => {
    const signer = new StubVaultSigner("v1");
    const results = await proposeTemplates(
      [supply, crossChain],
      mandate,
      "v1.vaults.mandate.testnet",
      signer,
    );
    expect(results).toHaveLength(2);
    expect(results[0]!.action_id).toBe("v1-a1");
    expect(results[1]!.action_id).toBe("v1-a2");
    // the emitted object is the template, never raw tx
    expect(results[0]!.template.kind).toBe("SupplyRhea");
  });

  it("refuses to propose an out-of-mandate template", async () => {
    const signer = new StubVaultSigner();
    const bad: ActionTemplate = { ...crossChain, chain: "base-sepolia" };
    await expect(
      proposeTemplates([bad], mandate, "v1.vaults.mandate.testnet", signer),
    ).rejects.toThrow(/out-of-mandate/);
  });
});
