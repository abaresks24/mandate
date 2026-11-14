//! MANDATE — Coordinator contract (T1).
//!
//! ONE global NEAR contract (`coordinator.<deployer>.testnet`). It is the trust
//! spine of the system: it holds the bonded-guardian registry, draws random
//! bond-weighted committees, runs the commit-reveal attestation tally, slashes
//! faulty guardians, and keeps agent reputation.
//!
//! Security thesis (PLAN): bond = insurance. A committee may only be drawn if
//! the sum of the drawn guardians' bonds covers the USD value of the action, so
//! a dishonest quorum always has more at stake than it can steal.
//!
//! Module layout:
//!   - `types`       : SPEC-mirrored serde/borsh data types.
//!   - (this file)   : contract state + guardian registry/bonds + `draw_committee`
//!                     + reputation.
//!   - `attestation` : `submit_commit` / `reveal_report` / `tally`.
//!   - `slashing`    : `open_challenge` / `resolve_challenge`.

mod attestation;
mod slashing;
mod types;

pub use types::*;

use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::json_types::U128;
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{env, near, require, AccountId, NearToken, PanicOnDefault};

// ----------------------------------------------------------------------------
// Economic constants (demo-tuned; documented so reviewers see the assumptions).
// ----------------------------------------------------------------------------

/// Minimum bond to register as a guardian (1 NEAR). Keeps the registry meaningful.
const MIN_BOND: NearToken = NearToken::from_near(1);

/// Unbonding delay in nanoseconds (3 days). A guardian that `request_unbond`s is
/// immediately un-drawable but stays slashable until this elapses, so a guardian
/// can't dodge an in-flight challenge by exiting.
const UNBOND_DELAY_NS: u64 = 3 * 24 * 60 * 60 * 1_000_000_000;

/// Fixed DEMO NEAR/USDC rate: how many USDC (6-dp) one NEAR (1e24 yocto) is worth.
/// 1 NEAR = $5.00 => 5_000_000 in 6-dp USDC. A real deployment would read an
/// oracle; for the hackathon this is a constant so `draw_committee`'s quorum-bond
/// invariant is deterministic and testable.
const NEAR_USDC_6DP: u128 = 5_000_000;

/// Committee size: always draw exactly 3 guardians.
const COMMITTEE_SIZE: usize = 3;

/// Approval threshold for `tally`: 2-of-3.
pub const APPROVE_THRESHOLD: u8 = 2;

/// Fraction of a slashed bond paid to the successful challenger (the rest is
/// burned/kept by the contract). 50% here.
const CHALLENGER_REWARD_NUM: u128 = 1;
const CHALLENGER_REWARD_DEN: u128 = 2;

/// Convert a yoctoNEAR bond into its USDC (6-dp) value via the fixed demo rate.
/// `yocto / 1e24 * NEAR_USDC_6DP`, done as `yocto * NEAR_USDC_6DP / 1e24` to keep
/// precision. Returns a u128 in 6-dp USDC.
pub(crate) fn yocto_to_usdc_6dp(yocto: u128) -> u128 {
    const ONE_NEAR_YOCTO: u128 = 1_000_000_000_000_000_000_000_000; // 1e24
    // Multiply first (u128 is wide enough: 1e24 * 5e6 fits in < 2^93).
    yocto.saturating_mul(NEAR_USDC_6DP) / ONE_NEAR_YOCTO
}

// ----------------------------------------------------------------------------
// Per-action committee + attestation bookkeeping.
// ----------------------------------------------------------------------------

/// One guardian's attestation slot for a drawn action.
#[derive(BorshDeserialize, BorshSerialize, Clone, Debug)]
#[borsh(crate = "near_sdk::borsh")]
pub struct Attestation {
    /// sha256 commit hash (hex) submitted at decision time.
    pub commit_hash: Option<String>,
    /// OutLayer proof blob accompanying the commit (opaque at this layer).
    pub outlayer_proof: Option<Vec<u8>>,
    /// The revealed report plaintext (after execution).
    pub report_json: Option<String>,
    /// Parsed `approve` field from the revealed report.
    pub approve: Option<bool>,
}

impl Default for Attestation {
    fn default() -> Self {
        Self {
            commit_hash: None,
            outlayer_proof: None,
            report_json: None,
            approve: None,
        }
    }
}

/// All per-action state: which guardians were drawn + their attestation slots.
#[derive(BorshDeserialize, BorshSerialize, Clone, Debug)]
#[borsh(crate = "near_sdk::borsh")]
pub struct ActionRecord {
    pub vault_id: AccountId,
    /// The 3 guardians drawn, in draw order.
    pub committee: Vec<GuardianId>,
    /// Parallel attestation slots, one per committee member (same index).
    pub slots: Vec<Attestation>,
    /// Block timestamp (ns) by which commits must arrive (for Unavailability).
    pub commit_deadline_ns: u64,
}

// (slot-lookup helper lives in `attestation.rs` as `slot_index_pub`.)

// ----------------------------------------------------------------------------
// Contract state.
// ----------------------------------------------------------------------------

/// Storage-key discriminants for the prefixed collections.
#[derive(BorshSerialize, near_sdk::BorshStorageKey)]
#[borsh(crate = "near_sdk::borsh")]
enum StorageKey {
    Guardians,
    Actions,
    Challenges,
    Reputation,
    GuardianStats,
    LastCommittee,
}

/// Aggregate per-guardian activity counters (for `view_guardian_history`).
#[derive(BorshDeserialize, BorshSerialize, Clone, Debug, Default)]
#[borsh(crate = "near_sdk::borsh")]
pub struct GuardianStats {
    pub draws: u32,
    pub reveals: u32,
    pub slashes: u32,
    pub total_slashed_yocto: u128,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Coordinator {
    /// Contract deployer / admin. Allowed to withdraw exited bonds etc.
    owner: AccountId,

    /// guardian_id -> GuardianInfo.
    guardians: IterableMap<GuardianId, GuardianInfo>,
    /// Monotonic counter for auto-assigning guardian ids ("g1", "g2", ...).
    next_guardian: u64,

    /// action_id -> ActionRecord (committee + attestations).
    actions: LookupMap<ActionId, ActionRecord>,

    /// challenge_id -> Challenge.
    challenges: LookupMap<ChallengeId, Challenge>,
    next_challenge: u64,

    /// agent_id -> ReputationSummary.
    reputation: LookupMap<AccountId, ReputationSummary>,

    /// guardian_id -> activity stats.
    guardian_stats: LookupMap<GuardianId, GuardianStats>,

    /// vault -> the committee drawn for that vault's most recent action. Rotation
    /// excludes exactly these guardians from the vault's NEXT draw, so a single
    /// vault can keep drawing forever (alternating committees) instead of
    /// exhausting the pool the way a per-guardian `last_drawn_vault` flag does.
    last_committee: LookupMap<AccountId, Vec<GuardianId>>,
}

#[near]
impl Coordinator {
    /// Deploy the single global coordinator. `owner` is the admin account.
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            owner,
            guardians: IterableMap::new(StorageKey::Guardians),
            next_guardian: 0,
            actions: LookupMap::new(StorageKey::Actions),
            challenges: LookupMap::new(StorageKey::Challenges),
            next_challenge: 0,
            reputation: LookupMap::new(StorageKey::Reputation),
            guardian_stats: LookupMap::new(StorageKey::GuardianStats),
            last_committee: LookupMap::new(StorageKey::LastCommittee),
        }
    }

    // ------------------------------------------------------------------
    // 1. Guardian registry + bonds.
    // ------------------------------------------------------------------

    /// Register a new guardian, bonding the attached deposit. Returns the new id.
    /// The bond must be at least `MIN_BOND`.
    #[payable]
    pub fn register_guardian(&mut self, wasm_url: String, wasm_sha256: String) -> GuardianId {
        let bond = env::attached_deposit();
        require!(
            bond >= MIN_BOND,
            "bond below MIN_BOND (1 NEAR) — attach more deposit"
        );
        self.next_guardian += 1;
        let id = format!("g{}", self.next_guardian);
        let info = GuardianInfo {
            id: id.clone(),
            account: env::predecessor_account_id(),
            wasm_url,
            wasm_sha256,
            bond,
            status: GuardianStatus::Active,
            last_drawn_vault: None,
            unbond_ready_at: None,
        };
        self.guardians.insert(id.clone(), info);
        self.guardian_stats
            .insert(id.clone(), GuardianStats::default());
        env::log_str(&format!("guardian {} registered, bond {}", id, bond));
        id
    }

    /// Add more NEAR to an existing guardian's bond. Only the guardian's own
    /// account may top up its bond.
    #[payable]
    pub fn top_up_bond(&mut self, guardian_id: GuardianId) {
        let add = env::attached_deposit();
        require!(add > NearToken::from_yoctonear(0), "attach a positive deposit");
        let mut info = self
            .guardians
            .get(&guardian_id)
            .cloned()
            .unwrap_or_else(|| env::panic_str("unknown guardian"));
        require!(
            info.account == env::predecessor_account_id(),
            "only the guardian's own account may top up"
        );
        require!(
            info.status != GuardianStatus::Slashed && info.status != GuardianStatus::Exited,
            "guardian is retired"
        );
        info.bond = info
            .bond
            .checked_add(add)
            .unwrap_or_else(|| env::panic_str("bond overflow"));
        self.guardians.insert(guardian_id, info);
    }

    /// Begin unbonding: the guardian becomes un-drawable immediately and its bond
    /// is withdrawable only after `UNBOND_DELAY_NS`. Keeping it slashable during
    /// the delay stops a guardian from escaping a pending challenge.
    pub fn request_unbond(&mut self, guardian_id: GuardianId) {
        let mut info = self
            .guardians
            .get(&guardian_id)
            .cloned()
            .unwrap_or_else(|| env::panic_str("unknown guardian"));
        require!(
            info.account == env::predecessor_account_id(),
            "only the guardian's own account may unbond"
        );
        require!(
            info.status == GuardianStatus::Active,
            "guardian not active"
        );
        info.status = GuardianStatus::Unbonding;
        info.unbond_ready_at = Some(env::block_timestamp() + UNBOND_DELAY_NS);
        self.guardians.insert(guardian_id, info);
    }

    /// Read a guardian record.
    pub fn view_guardian(&self, guardian_id: GuardianId) -> Option<GuardianInfo> {
        self.guardians.get(&guardian_id).cloned()
    }

    /// Read the committee drawn for an action (the 3 guardians, in draw order).
    pub fn view_committee(&self, action_id: ActionId) -> Option<Vec<GuardianId>> {
        self.actions.get(&action_id).map(|r| r.committee.clone())
    }

    /// Read a guardian's revealed report (plaintext) for an action, if revealed.
    /// The commit hash that this report must match is in the slot; the UI can
    /// recompute sha256 to show the commit-reveal binding is real.
    pub fn view_report(&self, action_id: ActionId, guardian_id: GuardianId) -> Option<String> {
        let rec = self.actions.get(&action_id)?;
        let idx = rec.slot_index_pub(&guardian_id)?;
        rec.slots[idx].report_json.clone()
    }

    /// Read a guardian's commit hash for an action (hex of sha256 of the report).
    pub fn view_commit(&self, action_id: ActionId, guardian_id: GuardianId) -> Option<String> {
        let rec = self.actions.get(&action_id)?;
        let idx = rec.slot_index_pub(&guardian_id)?;
        rec.slots[idx].commit_hash.clone()
    }

    // ------------------------------------------------------------------
    // 2. Committee draw.
    // ------------------------------------------------------------------

    /// Draw a committee of 3 guardians for `action_id` on `vault_id`.
    ///
    /// - Bond-weighted random sampling using `env::random_seed()`.
    /// - Rotation: guardians on this vault's PREVIOUS committee are excluded, so
    ///   no guardian sits on two consecutive committees for the SAME vault.
    /// - INVARIANT: sum(bond of the 3 drawn, in USDC 6-dp) >= `action_value_usdc`,
    ///   else returns `Err(QuorumBondTooLow)` so the vault splits or refuses.
    ///
    /// SECURITY CAVEAT on `env::random_seed()`: the seed is derived from the
    /// block's VRF output, which the block producer influences/knows before
    /// others. A malicious producer scheduled to produce this block could, within
    /// limits, bias which committee is drawn (grind over txs it controls). For a
    /// hackathon demo this is acceptable; a production system would use a
    /// commit-reveal / drand / future-block randomness beacon to remove producer
    /// bias. Documented here deliberately.
    #[handle_result]
    pub fn draw_committee(
        &mut self,
        vault_id: AccountId,
        action_id: ActionId,
        action_value_usdc: U128,
    ) -> Result<Vec<GuardianId>, CoordinatorError> {
        // Eligible = Active status AND not last-drawn for THIS vault (rotation).
        let previous: Vec<GuardianId> = self
            .last_committee
            .get(&vault_id)
            .cloned()
            .unwrap_or_default();
        let mut pool: Vec<(GuardianId, u128)> = self
            .guardians
            .iter()
            .filter(|(id, g)| g.status == GuardianStatus::Active && !previous.contains(*id))
            .map(|(id, g)| (id.clone(), g.bond.as_yoctonear()))
            .collect();

        if pool.len() < COMMITTEE_SIZE {
            return Err(CoordinatorError::NotEnoughGuardians);
        }

        let seed = env::random_seed();
        let mut drawn: Vec<GuardianId> = Vec::with_capacity(COMMITTEE_SIZE);
        let mut drawn_bond_yocto: u128 = 0;

        // Bond-weighted sampling WITHOUT replacement: for each of 3 slots, pick a
        // random point in [0, total_weight) and walk the cumulative weights. Use a
        // fresh 8 bytes of the seed per draw (seed is 32 bytes → enough for 3).
        for i in 0..COMMITTEE_SIZE {
            let total_weight: u128 = pool.iter().map(|(_, w)| *w).sum();
            // Guardians might all have weight 0 only if MIN_BOND were 0; it isn't,
            // but guard anyway to avoid a modulo-by-zero.
            let rnd = Self::seed_u128(&seed, i);
            let mut target = if total_weight == 0 {
                rnd % pool.len() as u128 // fall back to uniform index
            } else {
                rnd % total_weight
            };

            let mut chosen = 0usize;
            if total_weight == 0 {
                chosen = target as usize;
            } else {
                for (idx, (_, w)) in pool.iter().enumerate() {
                    if target < *w {
                        chosen = idx;
                        break;
                    }
                    target -= *w;
                }
            }

            let (gid, w) = pool.remove(chosen);
            drawn_bond_yocto = drawn_bond_yocto.saturating_add(w);
            drawn.push(gid);
        }

        // ENFORCE THE QUORUM-BOND INVARIANT.
        let quorum_usdc = yocto_to_usdc_6dp(drawn_bond_yocto);
        if quorum_usdc < action_value_usdc.0 {
            // Reject WITHOUT mutating last_drawn_vault / committee state: the draw
            // never happened from the system's point of view.
            return Err(CoordinatorError::QuorumBondTooLow);
        }

        // Commit the draw: record committee, bump rotation, bump stats.
        let now = env::block_timestamp();
        for gid in &drawn {
            if let Some(mut info) = self.guardians.get(gid).cloned() {
                info.last_drawn_vault = Some(vault_id.clone());
                self.guardians.insert(gid.clone(), info);
            }
            if let Some(mut st) = self.guardian_stats.get(gid).cloned() {
                st.draws += 1;
                self.guardian_stats.insert(gid.clone(), st);
            }
        }
        self.last_committee.insert(vault_id.clone(), drawn.clone());
        let slots = vec![Attestation::default(); COMMITTEE_SIZE];
        self.actions.insert(
            action_id.clone(),
            ActionRecord {
                vault_id,
                committee: drawn.clone(),
                slots,
                // Demo commit deadline: 10 minutes after the draw.
                commit_deadline_ns: now + 10 * 60 * 1_000_000_000,
            },
        );
        Ok(drawn)
    }

    /// Extract a u128 from 16 bytes of the random seed, offset by slot index so
    /// each of the 3 draws uses distinct entropy.
    fn seed_u128(seed: &[u8], slot: usize) -> u128 {
        let mut buf = [0u8; 16];
        // seed is 32 bytes; take a 16-byte window, wrapping if needed.
        for k in 0..16 {
            buf[k] = seed[(slot * 11 + k) % seed.len()];
        }
        u128::from_le_bytes(buf)
    }

    // ------------------------------------------------------------------
    // 5. Reputation.
    // ------------------------------------------------------------------

    /// Append a measured job outcome for the vault's agent. The `vault_id` is the
    /// vault account; reputation is keyed by that account (the agent operating it).
    /// In integration this is called by the vault on job close.
    pub fn record_outcome(&mut self, vault_id: AccountId, outcome: OutcomeRecord) {
        let mut rep = self
            .reputation
            .get(&vault_id)
            .cloned()
            .unwrap_or_else(|| ReputationSummary::empty(vault_id.clone()));
        rep.apply(&outcome);
        self.reputation.insert(vault_id, rep);
    }

    /// Read an agent's reputation summary (empty if none recorded).
    pub fn view_reputation(&self, agent_id: AccountId) -> ReputationSummary {
        self.reputation
            .get(&agent_id)
            .cloned()
            .unwrap_or_else(|| ReputationSummary::empty(agent_id))
    }

    /// Read a guardian's full history (registry info + activity counters).
    pub fn view_guardian_history(&self, guardian_id: GuardianId) -> Option<GuardianHistory> {
        let info = self.guardians.get(&guardian_id).cloned()?;
        let st = self
            .guardian_stats
            .get(&guardian_id)
            .cloned()
            .unwrap_or_default();
        Some(GuardianHistory {
            guardian_id,
            info,
            draws: st.draws,
            reveals: st.reveals,
            slashes: st.slashes,
            total_slashed: U128(st.total_slashed_yocto),
        })
    }

}

// Shared internal helpers used by the attestation/slashing modules. Kept in a
// plain (non-`#[near]`) impl so they stay ordinary inherent methods rather than
// being treated as contract entrypoints by the macro.
impl Coordinator {
    pub(crate) fn expect_action(&self, action_id: &ActionId) -> ActionRecord {
        self.actions
            .get(action_id)
            .cloned()
            .unwrap_or_else(|| env::panic_str("unknown action_id (no committee drawn)"))
    }
}

#[cfg(test)]
mod tests;
