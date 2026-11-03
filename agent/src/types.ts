// Canonical MANDATE data types, mirrored from SPEC.md.
// These are the integration contract — keep in sync with the Rust serde mirrors.

/** Mandate — the rules a vault enforces. See SPEC.md "Mandate". */
export interface Mandate {
  owner: string;
  target_apy_bps: number;
  max_risk_score: number; // 0..100
  allowed_protocols: string[];
  allowed_chains: string[];
  max_share_per_protocol_bps: number;
  max_loss_bps: number;
  daily_cap_usdc: string; // u128 as decimal string (6-dp USDC)
  committee_threshold_usdc: string; // "0" => committee PERMANENT
}

/**
 * ActionTemplate — the ONLY things the agent may propose.
 * The agent cannot construct arbitrary calldata. See SPEC.md "ActionTemplate".
 */
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
  | { kind: "EmergencyExit"; reason_code: string };

export type ActionTemplateKind = ActionTemplate["kind"];

/** Deterministic risk-scoring inputs for a single protocol. See src/risk.ts. */
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

/** 0..100, higher = riskier. Produced ONLY by the deterministic module. */
export type RiskScore = number;

/** Allocation option attached to a proposal. */
export interface AllocationOption {
  label: string;
  template: ActionTemplate;
  protocol: string;
  risk_score: RiskScore; // deterministic, NOT from the LLM
  /** Human-readable explanation of the deterministic score (LLM-authored). */
  explanation: string;
  estimated_apy_bps: number;
}

export interface MandateProposal {
  status: "proposed";
  mandate: Mandate;
  allocations: AllocationOption[]; // up to 2
  /** Short natural-language summary of the proposal (LLM-authored). */
  summary: string;
}

export interface MandateRefusal {
  status: "refused";
  /** Machine-usable reason code for the refusal. */
  reason_code:
    | "UNREALISTIC_APY"
    | "RISK_MANDATE_CONTRADICTION"
    | "UNSUPPORTED_PROTOCOL"
    | "MALFORMED_BRIEF";
  reason: string; // human explanation
}

export type BriefResult = MandateProposal | MandateRefusal;
