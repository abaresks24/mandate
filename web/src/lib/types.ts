// Canonical SPEC types (mirror of SPEC.md "Core data types").
// Swapping to live is a data-source change; these shapes stay fixed.

export interface Mandate {
  owner: string;
  target_apy_bps: number;
  max_risk_score: number;
  allowed_protocols: string[];
  allowed_chains: string[];
  max_share_per_protocol_bps: number;
  max_loss_bps: number;
  daily_cap_usdc: string; // u128 string
  committee_threshold_usdc: string; // 0 => committee permanent
}

export type ActionTemplate =
  | { kind: "SupplyRhea"; token: string; amount: string; market: string }
  | { kind: "WithdrawToUsdc"; protocol: string }
  | {
      kind: "AllocateCrossChain";
      chain: string;
      protocol: string;
      market: string;
      amount: string;
      max_slippage_bps: number;
    }
  | { kind: "EmergencyExit"; reason_code: ReasonCode };

export type ReasonCode =
  | "PRICE_OK"
  | "PRICE_DEVIATION"
  | "SLIPPAGE_OK"
  | "SLIPPAGE_HIGH"
  | "PROTOCOL_LIVE"
  | "PROTOCOL_PAUSED"
  | "DEPEG"
  | "ORACLE_STALE"
  | "CROSSCHAIN_STATE_OK"
  | "CROSSCHAIN_STATE_BAD"
  | "DATA_UNAVAILABLE";

export interface GuardianFacts {
  price_usdc: string; // 6-dp fixed
  price_block: number;
  observed_slippage_bps: number;
  protocol_paused: boolean;
}

export interface GuardianSource {
  name: string;
  verifiable: boolean;
  payload_ref?: string;
  endpoint?: string;
}

export interface GuardianReport {
  action_id: string;
  approve: boolean;
  reason_codes: ReasonCode[];
  facts: GuardianFacts;
  sources: GuardianSource[];
}

export interface Tally {
  approvals: number;
  threshold_met: boolean;
}

// ---- UI-adjacent view types (how contract views surface in the demo) ----

export type GuardianId = string;

export interface GuardianInfo {
  id: GuardianId;
  account: string;
  bond_near: string;
  wasm_sha256: string;
  reputation: number; // 0..100
  status: "active" | "unbonding" | "slashed";
}

export interface CommitteeMember {
  guardian: GuardianInfo;
  commit_hash: string | null; // phase 1
  report: GuardianReport | null; // phase 2 (revealed)
  reveal_matches_commit: boolean | null;
}

export type Verifier = "contract-alone" | "committee-required";

export interface ActionState {
  action_id: string;
  vault_id: string;
  template: ActionTemplate;
  value_usdc: string;
  verifier: Verifier;
  chain: string;
  protocol: string;
  phase: "proposed" | "committed" | "revealed" | "executed" | "blocked";
  committee: CommitteeMember[];
  tally: Tally;
  quorum_bond_near: string;
  note?: string;
}

export interface Position {
  protocol: string;
  chain: string;
  token: string;
  amount_usdc: string;
  apy_bps: number;
  risk_score: number;
}

export interface AllocationOption {
  id: string;
  label: string;
  template: ActionTemplate;
  expected_apy_bps: number;
  risk_score: number;
  risk_explanation: string;
  risk_factors: { factor: string; weight: number; note: string }[];
}

export interface BriefProposal {
  refused: boolean;
  refusal_reason?: string;
  mandate?: Mandate;
  options: AllocationOption[];
  explanation?: string;
}

// slashing demo
export type FaultKind = "FalseAttestation" | "Equivocation" | "Unavailability";

export interface ChallengeState {
  challenge_id: string;
  action_id: string;
  corrupt_guardian: GuardianInfo;
  fault: FaultKind;
  lying_claim: string;
  honest_claim: string;
  proof_json: string;
  resolved: boolean;
  slashed_near: string;
  challenger_reward_near: string;
}
