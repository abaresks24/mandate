import { ActionState, GuardianReport } from "@/lib/types";
import { byId } from "./guardians";

// The contrast: a NEAR/Rhea action verified by the contract alone,
// and a Morpho/Sepolia action that requires the committee.

// ---- NEAR Rhea action: contract reads state itself, no committee ----
export const RHEA_ACTION: ActionState = {
  action_id: "v12-a6",
  vault_id: "demo.vaults.mandate.testnet",
  template: {
    kind: "SupplyRhea",
    token: "usdc",
    amount: "1000000000",
    market: "ref-finance-101.testnet",
  },
  value_usdc: "1000000000",
  verifier: "contract-alone",
  chain: "near",
  protocol: "rhea",
  phase: "executed",
  committee: [],
  tally: { approvals: 0, threshold_met: true },
  quorum_bond_near: "0",
  note: "Executed by the Vault contract directly. The contract reads Rhea/Ref state on NEAR in the same transaction, so no external attestation is required. No committee drawn.",
};

// ---- Morpho / Sepolia action: committee required (cross-chain) ----
const g1 = byId("g-03");
const g2 = byId("g-01");
const g3 = byId("g-05");

const report1: GuardianReport = {
  action_id: "v12-a7",
  approve: true,
  reason_codes: ["PRICE_OK", "SLIPPAGE_OK", "PROTOCOL_LIVE", "CROSSCHAIN_STATE_OK"],
  facts: {
    price_usdc: "1000900",
    price_block: 7421883,
    observed_slippage_bps: 12,
    protocol_paused: false,
  },
  sources: [
    { name: "pyth", verifiable: true, payload_ref: "0x5b2e...signed-update" },
    { name: "rpc-sepolia", verifiable: false, endpoint: "https://rpc.sepolia.org" },
  ],
};

const report2: GuardianReport = {
  action_id: "v12-a7",
  approve: true,
  reason_codes: ["PRICE_OK", "SLIPPAGE_OK", "PROTOCOL_LIVE", "CROSSCHAIN_STATE_OK"],
  facts: {
    price_usdc: "1000850",
    price_block: 7421883,
    observed_slippage_bps: 14,
    protocol_paused: false,
  },
  sources: [
    { name: "pyth", verifiable: true, payload_ref: "0x5b2e...signed-update" },
    { name: "rpc-sepolia", verifiable: false, endpoint: "https://sepolia.infura.io" },
  ],
};

const report3: GuardianReport = {
  action_id: "v12-a7",
  approve: true,
  reason_codes: ["PRICE_OK", "SLIPPAGE_OK", "PROTOCOL_LIVE", "CROSSCHAIN_STATE_OK"],
  facts: {
    price_usdc: "1000910",
    price_block: 7421883,
    observed_slippage_bps: 11,
    protocol_paused: false,
  },
  sources: [
    { name: "pyth", verifiable: true, payload_ref: "0x5b2e...signed-update" },
    { name: "rpc-sepolia", verifiable: false, endpoint: "https://rpc2.sepolia.org" },
  ],
};

// commit = sha256(canonical_json(report)); mocked as stable-looking hashes.
export const MORPHO_ACTION: ActionState = {
  action_id: "v12-a7",
  vault_id: "demo.vaults.mandate.testnet",
  template: {
    kind: "AllocateCrossChain",
    chain: "ethereum-sepolia",
    protocol: "morpho",
    market: "0x3a85b...c21",
    amount: "2000000000",
    max_slippage_bps: 50,
  },
  value_usdc: "2000000000",
  verifier: "committee-required",
  chain: "ethereum-sepolia",
  protocol: "morpho",
  phase: "proposed",
  quorum_bond_near: "12500",
  note: "The Vault contract cannot read Ethereum Sepolia state. A bond-weighted committee of 3 guardians is drawn; quorum bond (12,500 NEAR) exceeds the action value, so the bond acts as insurance. Each guardian commits a hash (phase 1), then reveals its signed report (phase 2). 2-of-3 approvals required.",
  committee: [
    {
      guardian: g1,
      commit_hash: "0x7c1a9e2f44b0d8e3a6b19c0f2d5e881744ab3c90e1f6d2aa0cbe3417f9d20e5b1",
      report: report1,
      reveal_matches_commit: true,
    },
    {
      guardian: g2,
      commit_hash: "0xb3f80ac19d4e5602ff71a8c3e0d9b4471286a5f0cc1d3e7b94a6028fd51c7e42",
      report: report2,
      reveal_matches_commit: true,
    },
    {
      guardian: g3,
      commit_hash: "0x1d66c4a0e9f27b3845aa0c1f6e2d9803b57f41ca6e8d20b9f3147ace50db6f09",
      report: report3,
      reveal_matches_commit: true,
    },
  ],
  tally: { approvals: 3, threshold_met: true },
};
