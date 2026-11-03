//! Canonical data types for the Coordinator, mirroring SPEC.md with serde.
//!
//! JSON conventions match SPEC: `U128` amounts are strings; enums use their
//! variant name as the serialized value. The `near_sdk::serde` crate path is
//! used throughout so these derive on the contract's vendored serde.

use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{AccountId, NearToken};

/// A guardian identity is a short string handle (e.g. "g1"); it maps to a NEAR
/// account in `GuardianInfo`. Vaults reference guardians by this id.
pub type GuardianId = String;
/// Action identifier, assigned by the vault (e.g. "v12-a7").
pub type ActionId = String;
/// Monotonic challenge identifier assigned by the coordinator.
pub type ChallengeId = u64;

/// Lifecycle status of a registered guardian.
#[derive(
    BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq,
)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub enum GuardianStatus {
    /// Bonded and eligible to be drawn.
    Active,
    /// `request_unbond` called; still bonded until the delay elapses, NOT drawable.
    Unbonding,
    /// Bond fully slashed to zero; retired.
    Slashed,
    /// Unbond delay elapsed / withdrawn; retired.
    Exited,
}

/// Registry record for one guardian. Bond is stored as `NearToken` (yocto).
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub struct GuardianInfo {
    pub id: GuardianId,
    pub account: AccountId,
    pub wasm_url: String,
    pub wasm_sha256: String,
    /// Bond in yoctoNEAR; serialized as a decimal string (NearToken JSON).
    pub bond: NearToken,
    pub status: GuardianStatus,
    /// Last vault this guardian was drawn for (rotation: can't be drawn twice in a
    /// row for the SAME vault). `None` until first draw.
    pub last_drawn_vault: Option<AccountId>,
    /// Block timestamp (ns) at which the unbond delay elapses; set by request_unbond.
    #[serde(default)]
    pub unbond_ready_at: Option<u64>,
}

/// Result of `tally(action_id)`. Shape is fixed and mirrored by the vault crate.
#[derive(
    BorshDeserialize,
    BorshSerialize,
    Serialize,
    Deserialize,
    Clone,
    Debug,
    PartialEq,
    Eq,
    Default,
)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub struct Tally {
    /// Number of revealed reports with `approve == true`.
    pub approvals: u8,
    /// True once `approvals >= APPROVE_THRESHOLD` (2-of-3).
    pub threshold_met: bool,
}

/// Committee-attested facts, aggregated across the revealed reports, that a
/// vault applies to its mandate rules at execution time. This is the integration
/// bridge: `tally` alone returns only the approval count, but the vault must also
/// see the facts the committee observed (slippage, protocol-paused, price) to
/// enforce DEPEG / SLIPPAGE_HIGH / PROTOCOL_PAUSED. `tally_facts` returns both.
///
/// Aggregation is CONSERVATIVE (fail-closed): across all revealed reports we take
/// the worst observed value — max slippage, OR of protocol_paused, and the price
/// furthest from $1.00 — so a single honest guardian reporting danger blocks the
/// action even if others under-report.
#[derive(
    BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq, Default,
)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub struct TallyFacts {
    /// Max observed slippage (bps) across revealed reports.
    pub observed_slippage_bps: u32,
    /// True if ANY revealed report says the protocol is paused.
    pub protocol_paused: bool,
    /// Price (6-dp) furthest from $1.00 across revealed reports, if any present.
    pub price_usdc: Option<u64>,
}

/// `tally` + aggregated committee facts, returned by `tally_facts`. The vault's
/// `on_tally` callback deserializes this and feeds it to its mandate gate.
#[derive(
    BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq, Default,
)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub struct TallyWithFacts {
    pub tally: Tally,
    pub facts: TallyFacts,
}

/// The fault categories a challenge can assert. Per SPEC.
///
/// - `Equivocation` and `Unavailability` are FULLY on-chain decidable from
///   stored commit/reveal state (no external input trusted).
/// - `FalseAttestation` compares the guardian's revealed claimed fact against a
///   contradicting fact supplied in the challenge `proof_json` (adjudication is
///   a documented, simplified comparison for the demo — see `slashing.rs`).
#[derive(
    BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq,
)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub enum FaultKind {
    FalseAttestation,
    Equivocation,
    Unavailability,
}

/// Challenge lifecycle status.
#[derive(
    BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq,
)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub enum ChallengeStatus {
    Open,
    /// Fault proven; guardian slashed, challenger rewarded.
    Slashed,
    /// Fault not proven; challenger deposit refunded.
    Dismissed,
}

/// Stored challenge record.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub struct Challenge {
    pub id: ChallengeId,
    pub action_id: ActionId,
    pub guardian_id: GuardianId,
    pub challenger: AccountId,
    pub fault: FaultKind,
    pub proof_json: String,
    /// Challenger's attached deposit (yocto), refunded or forfeited on resolve.
    pub deposit: NearToken,
    pub status: ChallengeStatus,
}

/// Measured outcome of a mandate job, appended by the vault at job close.
/// Mirrors SPEC's `OutcomeRecord`.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub struct OutcomeRecord {
    /// Whether the mandate rules were respected for the whole job.
    pub mandate_respected: bool,
    /// Realized APY, basis points (signed is unnecessary at demo scale → u32).
    pub realized_apy_bps: u32,
    /// Worst observed drawdown, basis points.
    pub max_loss_bps: u32,
    /// Whether scheduled exits happened on time.
    pub exits_on_time: bool,
}

/// Aggregate reputation for an agent (keyed by the vault's agent account).
/// Appended-to by `record_outcome`; read by `view_reputation`.
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, Debug, PartialEq)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub struct ReputationSummary {
    pub agent_id: AccountId,
    pub jobs: u32,
    /// Count of jobs where `mandate_respected == true`.
    pub mandates_respected: u32,
    /// Count of jobs where `exits_on_time == true`.
    pub exits_on_time: u32,
    /// Simple running mean of realized APY (bps). Integer mean is fine for demo.
    pub avg_realized_apy_bps: u32,
    /// Worst `max_loss_bps` ever recorded.
    pub worst_max_loss_bps: u32,
}

impl ReputationSummary {
    pub fn empty(agent_id: AccountId) -> Self {
        Self {
            agent_id,
            jobs: 0,
            mandates_respected: 0,
            exits_on_time: 0,
            avg_realized_apy_bps: 0,
            worst_max_loss_bps: 0,
        }
    }

    /// Fold one outcome into the running aggregate.
    pub fn apply(&mut self, o: &OutcomeRecord) {
        // Running integer mean: new_mean = (old_mean*n + x) / (n+1).
        let n = self.jobs as u128;
        let total = self.avg_realized_apy_bps as u128 * n + o.realized_apy_bps as u128;
        self.jobs += 1;
        self.avg_realized_apy_bps = (total / self.jobs as u128) as u32;
        if o.mandate_respected {
            self.mandates_respected += 1;
        }
        if o.exits_on_time {
            self.exits_on_time += 1;
        }
        if o.max_loss_bps > self.worst_max_loss_bps {
            self.worst_max_loss_bps = o.max_loss_bps;
        }
    }
}

/// History of a guardian's attestation + slashing activity, for `view_guardian_history`.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub struct GuardianHistory {
    pub guardian_id: GuardianId,
    pub info: GuardianInfo,
    /// How many committees this guardian has been drawn into.
    pub draws: u32,
    /// How many reveals this guardian has submitted.
    pub reveals: u32,
    /// How many times slashed.
    pub slashes: u32,
    /// Total yocto slashed over the guardian's lifetime, as a string.
    pub total_slashed: U128,
}

/// Error type returned by `draw_committee` et al. Surfaced to the caller so the
/// vault can split/refuse. We use a serde enum so a cross-contract caller reading
/// a `Result` (returned as JSON) can match on the variant name.
///
/// `FunctionError` lets near-sdk's `#[handle_result]` turn an `Err` into a clean
/// contract panic carrying the variant name (via the `Display` impl below), so
/// the vault sees `QuorumBondTooLow` and can split/refuse the action.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, near_sdk::FunctionError)]
#[serde(crate = "near_sdk::serde")]
pub enum CoordinatorError {
    /// sum(bond of the 3 drawn guardians) < action_value_usdc (converted via the
    /// fixed demo NEAR/USDC rate). The vault must split the action or refuse.
    QuorumBondTooLow,
    /// Fewer than 3 eligible (Active, not drawn last-round-for-this-vault) guardians.
    NotEnoughGuardians,
}

impl core::fmt::Display for CoordinatorError {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        let s = match self {
            CoordinatorError::QuorumBondTooLow => "QuorumBondTooLow",
            CoordinatorError::NotEnoughGuardians => "NotEnoughGuardians",
        };
        f.write_str(s)
    }
}
