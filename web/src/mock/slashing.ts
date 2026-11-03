import { ActionState, ChallengeState, GuardianReport } from "@/lib/types";
import { byId } from "./guardians";

// A corrupt guardian reports a lying price source (claims depeg to force a
// bad EmergencyExit / block a good action). The other two refuse. 2-of-3 is
// not met from the honest side that the attacker wanted, the action is blocked,
// and a fault proof is submitted → bond slashed → challenger rewarded.

const corrupt = byId("g-04"); // draco — the liar
const honestA = byId("g-03"); // cygnus
const honestB = byId("g-01"); // atlas

const lyingReport: GuardianReport = {
  action_id: "v12-a9",
  approve: false,
  reason_codes: ["DEPEG", "PRICE_DEVIATION"],
  facts: {
    price_usdc: "915000", // claims USDC = $0.915 (fabricated depeg)
    price_block: 7421990,
    observed_slippage_bps: 480,
    protocol_paused: false,
  },
  sources: [
    // NOT verifiable — a self-hosted endpoint, no signed Pyth update.
    { name: "custom-feed", verifiable: false, endpoint: "https://attacker-feed.example" },
  ],
};

const honestReportA: GuardianReport = {
  action_id: "v12-a9",
  approve: true,
  reason_codes: ["PRICE_OK", "SLIPPAGE_OK", "PROTOCOL_LIVE", "CROSSCHAIN_STATE_OK"],
  facts: {
    price_usdc: "1000020",
    price_block: 7421990,
    observed_slippage_bps: 9,
    protocol_paused: false,
  },
  sources: [
    { name: "pyth", verifiable: true, payload_ref: "0x9ad0...signed-update" },
    { name: "rpc-sepolia", verifiable: false, endpoint: "https://rpc.sepolia.org" },
  ],
};

const honestReportB: GuardianReport = {
  action_id: "v12-a9",
  approve: true,
  reason_codes: ["PRICE_OK", "SLIPPAGE_OK", "PROTOCOL_LIVE", "CROSSCHAIN_STATE_OK"],
  facts: {
    price_usdc: "1000010",
    price_block: 7421990,
    observed_slippage_bps: 10,
    protocol_paused: false,
  },
  sources: [
    { name: "pyth", verifiable: true, payload_ref: "0x9ad0...signed-update" },
    { name: "rpc-sepolia", verifiable: false, endpoint: "https://sepolia.infura.io" },
  ],
};

export const SLASHING_ACTION: ActionState = {
  action_id: "v12-a9",
  vault_id: "demo.vaults.mandate.testnet",
  template: {
    kind: "AllocateCrossChain",
    chain: "ethereum-sepolia",
    protocol: "morpho",
    market: "0x3a85b...c21",
    amount: "1500000000",
    max_slippage_bps: 50,
  },
  value_usdc: "1500000000",
  verifier: "committee-required",
  chain: "ethereum-sepolia",
  protocol: "morpho",
  phase: "blocked",
  quorum_bond_near: "11900",
  note: "Guardian draco (g-04) reported a fabricated USDC depeg to $0.915 from a non-verifiable custom feed, trying to force the action into a bad state. The two honest guardians read the SAME block (7421990) from verifiable Pyth updates and saw USDC at $1.00. Their reports disagree with draco's at the same block → draco's attestation is provably false.",
  committee: [
    {
      guardian: corrupt,
      commit_hash: "0xdead10c8b7f23a4091cc5e6d0b1f8e247a39c05ed4f12b6a830e7fc19a2d54bb",
      report: lyingReport,
      reveal_matches_commit: true,
    },
    {
      guardian: honestA,
      commit_hash: "0x4f1b9c0a7e26d3851ab0c2f6e1d9704b58f42ca7e9d31c0af2158bce60ec7f1a",
      report: honestReportA,
      reveal_matches_commit: true,
    },
    {
      guardian: honestB,
      commit_hash: "0x2c88a3f1e0d57b4946bb1d0e7f3a9812c69e52db7f0a24c9e4267adf71fb8e03",
      report: honestReportB,
      reveal_matches_commit: true,
    },
  ],
  // Only the 2 honest guardians approve; the attacker's rejection does not win.
  // The action the attacker wanted (a forced emergency exit at a false price)
  // never clears, and the false attestation is challengeable.
  tally: { approvals: 2, threshold_met: true },
};

export const CHALLENGE: ChallengeState = {
  challenge_id: "ch-17",
  action_id: "v12-a9",
  corrupt_guardian: corrupt,
  fault: "FalseAttestation",
  lying_claim: "USDC = $0.915 @ block 7421990 (source: custom-feed, NOT verifiable)",
  honest_claim:
    "USDC = $1.0001 @ block 7421990 (source: Pyth signed update 0x9ad0..., verifiable; 2 independent guardians agree)",
  proof_json: JSON.stringify(
    {
      action_id: "v12-a9",
      guardian_id: "g-04",
      fault: "FalseAttestation",
      claimed_price_usdc: "915000",
      verifiable_price_usdc: "1000015",
      price_block: 7421990,
      pyth_update_ref: "0x9ad0...signed-update",
      note: "re-derivable: same block + same signed Pyth update yields $1.00, not $0.915",
    },
    null,
    2
  ),
  resolved: false,
  slashed_near: "2600", // draco's full bond
  challenger_reward_near: "1300", // half the slashed bond to challenger
};
