//! Canonical data types mirroring SPEC.md (serde JSON).
//!
//! These are the shared interface types. `U128` amounts are strings in JSON
//! (NEAR's standard `near_sdk::json_types::U128`), matching the SPEC's
//! `"daily_cap_usdc": "5000000000"` convention.

use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::AccountId;

/// The user-set investment mandate. Every field from SPEC.md's `Mandate`.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub struct Mandate {
    pub owner: AccountId,
    pub target_apy_bps: u32,
    pub max_risk_score: u32,
    pub allowed_protocols: Vec<String>,
    pub allowed_chains: Vec<String>,
    pub max_share_per_protocol_bps: u32,
    pub max_loss_bps: u32,
    pub daily_cap_usdc: U128,
    /// 0 => committee is PERMANENT (every external/cross-chain action attested).
    pub committee_threshold_usdc: U128,
}

/// The ONLY things the agent may propose. Agent cannot build arbitrary calldata.
///
/// `kind` is the serde tag so JSON matches SPEC exactly, e.g.
/// `{ "kind": "SupplyRhea", "token": "usdc", "amount": "1000000000", "market": "ref-...testnet" }`.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
#[serde(tag = "kind")]
pub enum ActionTemplate {
    SupplyRhea {
        token: String,
        amount: U128,
        market: String,
    },
    WithdrawToUsdc {
        protocol: String,
    },
    AllocateCrossChain {
        chain: String,
        protocol: String,
        market: String,
        amount: U128,
        max_slippage_bps: u32,
    },
    EmergencyExit {
        reason_code: String,
    },
}

impl ActionTemplate {
    /// Canonical kind string for `allowed template kinds` gating + logs.
    pub fn kind(&self) -> &'static str {
        match self {
            ActionTemplate::SupplyRhea { .. } => "SupplyRhea",
            ActionTemplate::WithdrawToUsdc { .. } => "WithdrawToUsdc",
            ActionTemplate::AllocateCrossChain { .. } => "AllocateCrossChain",
            ActionTemplate::EmergencyExit { .. } => "EmergencyExit",
        }
    }

    /// The protocol this template touches, if any (None = no protocol gate, e.g. EmergencyExit).
    pub fn protocol(&self) -> Option<&str> {
        match self {
            // SupplyRhea is implicitly the "rhea" protocol on NEAR.
            ActionTemplate::SupplyRhea { .. } => Some("rhea"),
            ActionTemplate::WithdrawToUsdc { protocol } => Some(protocol.as_str()),
            ActionTemplate::AllocateCrossChain { protocol, .. } => Some(protocol.as_str()),
            ActionTemplate::EmergencyExit { .. } => None,
        }
    }

    /// The chain this template targets.
    pub fn chain(&self) -> Option<&str> {
        match self {
            // SupplyRhea / WithdrawToUsdc are NEAR-native.
            ActionTemplate::SupplyRhea { .. } => Some("near"),
            ActionTemplate::WithdrawToUsdc { .. } => Some("near"),
            ActionTemplate::AllocateCrossChain { chain, .. } => Some(chain.as_str()),
            ActionTemplate::EmergencyExit { .. } => None,
        }
    }

    /// USDC amount this action moves (6-dp). De-risking / withdraw templates move 0
    /// *new* capital, so they don't consume the daily cap.
    pub fn amount_usdc(&self) -> u128 {
        match self {
            ActionTemplate::SupplyRhea { amount, .. } => amount.0,
            ActionTemplate::AllocateCrossChain { amount, .. } => amount.0,
            ActionTemplate::WithdrawToUsdc { .. } => 0,
            ActionTemplate::EmergencyExit { .. } => 0,
        }
    }

    /// Whether this template is strictly de-risking (moves funds toward USDC/home).
    /// Used to gate `emergency_exit` and to exempt from daily-cap / share checks.
    pub fn is_de_risking(&self) -> bool {
        matches!(
            self,
            ActionTemplate::WithdrawToUsdc { .. } | ActionTemplate::EmergencyExit { .. }
        )
    }
}

/// Lifecycle status of a proposed action.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub enum ActionStatus {
    /// Passed deterministic mandate checks; awaiting committee attestation.
    Proposed,
    /// Executed on-chain (Rhea call or Chain Signatures EVM tx requested).
    Executed,
    /// Rejected at execution (facts violated mandate rules, e.g. slippage).
    Rejected,
}

/// Stored state for one action.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub struct ActionState {
    pub id: String,
    pub template: ActionTemplate,
    pub status: ActionStatus,
    /// Human-readable note set at execution/rejection time.
    pub note: Option<String>,
}

/// A single protocol position the vault holds.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub struct Position {
    pub protocol: String,
    pub chain: String,
    /// Notional in USDC 6-dp.
    pub amount_usdc: U128,
}

/// Snapshot returned by `view_positions`.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub struct Positions {
    pub positions: Vec<Position>,
    /// USDC held idle (home currency), 6-dp.
    pub idle_usdc: U128,
    /// Total AUM (idle + positions), 6-dp. Convenience for share math.
    pub total_usdc: U128,
}

/// The facts the guardian committee attests (subset of SPEC's GuardianReport.facts)
/// that the vault applies to mandate rules at execution time.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub struct GuardianFacts {
    pub observed_slippage_bps: u32,
    pub protocol_paused: bool,
    /// 6-dp fixed price of USDC on the target chain. ~1_000_000 == $1.00.
    #[serde(default)]
    pub price_usdc: Option<u64>,
}
