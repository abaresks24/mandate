//! Commit-reveal attestation lifecycle (SPEC item 3).
//!
//! Flow per drawn action:
//!   1. Each committee guardian `submit_commit`s `sha256(canonical_report)` (hex)
//!      plus its OutLayer proof, at decision time. The plaintext stays hidden.
//!   2. After execution each guardian `reveal_report`s the plaintext. The
//!      contract recomputes `hex(sha256(report_json))` and REJECTS if it does not
//!      equal the stored commit — binding the reveal to the earlier commit.
//!   3. `tally` counts `approve == true` reveals; `threshold_met` at 2-of-3.

use crate::{ActionId, Coordinator, CoordinatorExt, GuardianId, Tally, APPROVE_THRESHOLD};
use near_sdk::json_types::Base64VecU8;
use near_sdk::{env, near, require};

#[near]
impl Coordinator {
    /// A drawn guardian publishes its commitment hash + OutLayer proof.
    ///
    /// `commit_hash` is the lowercase hex of `sha256(canonical_json(report))`.
    /// `outlayer_proof` is the opaque TEE attestation blob (base64 in JSON).
    pub fn submit_commit(
        &mut self,
        action_id: ActionId,
        guardian_id: GuardianId,
        commit_hash: String,
        outlayer_proof: Base64VecU8,
    ) {
        let mut rec = self.expect_action(&action_id);
        let idx = rec
            .slot_index_pub(&guardian_id)
            .unwrap_or_else(|| env::panic_str("guardian not on this action's committee"));

        // Caller authentication: only the guardian's own account may commit.
        let info = self
            .guardians
            .get(&guardian_id)
            .cloned()
            .unwrap_or_else(|| env::panic_str("unknown guardian"));
        require!(
            info.account == env::predecessor_account_id(),
            "only the guardian's own account may submit a commit"
        );
        require!(
            rec.slots[idx].commit_hash.is_none(),
            "commit already submitted for this slot"
        );

        rec.slots[idx].commit_hash = Some(commit_hash);
        rec.slots[idx].outlayer_proof = Some(outlayer_proof.0);
        self.actions.insert(action_id, rec);
    }

    /// Reveal the plaintext report. The contract recomputes the sha256 and REJECTS
    /// if it mismatches the stored commit. On success it parses `approve`.
    pub fn reveal_report(
        &mut self,
        action_id: ActionId,
        guardian_id: GuardianId,
        report_json: String,
    ) {
        let mut rec = self.expect_action(&action_id);
        let idx = rec
            .slot_index_pub(&guardian_id)
            .unwrap_or_else(|| env::panic_str("guardian not on this action's committee"));

        let commit = rec.slots[idx]
            .commit_hash
            .clone()
            .unwrap_or_else(|| env::panic_str("no commit to reveal against"));

        // Recompute hex(sha256(report_json)) and compare to the stored commit.
        let digest = env::sha256(report_json.as_bytes());
        let recomputed = hex::encode(digest);
        require!(
            recomputed == commit.to_lowercase(),
            "reveal does not match commit (sha256 mismatch)"
        );

        // Parse `approve` out of the revealed report (fixed GuardianReport shape).
        let approve = Self::parse_approve(&report_json);

        rec.slots[idx].report_json = Some(report_json);
        rec.slots[idx].approve = Some(approve);
        self.actions.insert(action_id, rec);

        // Bump the guardian's reveal counter for history.
        if let Some(mut st) = self.guardian_stats.get(&guardian_id).cloned() {
            st.reveals += 1;
            self.guardian_stats.insert(guardian_id, st);
        }
    }

    /// Tally revealed approvals. 2-of-3 threshold.
    pub fn tally(&self, action_id: ActionId) -> Tally {
        let rec = self.expect_action(&action_id);
        let approvals = rec
            .slots
            .iter()
            .filter(|s| s.approve == Some(true))
            .count() as u8;
        Tally {
            approvals,
            threshold_met: approvals >= APPROVE_THRESHOLD,
        }
    }
}

impl Coordinator {
    /// Parse the `approve` boolean from a GuardianReport JSON. Returns false if
    /// the field is missing/not a bool, so a malformed report never approves.
    pub(crate) fn parse_approve(report_json: &str) -> bool {
        match near_sdk::serde_json::from_str::<near_sdk::serde_json::Value>(report_json) {
            Ok(v) => v.get("approve").and_then(|a| a.as_bool()).unwrap_or(false),
            Err(_) => false,
        }
    }
}

// Expose the private `slot_index` helper to this module via an inherent method on
// the record; defined here to keep `ActionRecord` fields crate-private.
impl crate::ActionRecord {
    pub(crate) fn slot_index_pub(&self, guardian_id: &GuardianId) -> Option<usize> {
        self.committee.iter().position(|g| g == guardian_id)
    }
}
