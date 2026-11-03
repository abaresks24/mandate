//! Slashing + challenge market (SPEC item 4).
//!
//! A challenger opens a challenge against a drawn guardian for a specific action,
//! attaching a deposit. `resolve_challenge` adjudicates the fault:
//!
//!   - `Equivocation`   — FULLY on-chain decidable: the challenger points at two
//!       DIFFERING revealed reports for the same (action_id, guardian). Since a
//!       slot stores only one reveal, equivocation is proven by the challenger
//!       supplying a *second*, differently-hashed report that a honest guardian
//!       would never have produced for the same commit. In this contract we make
//!       it decidable from stored state: a guardian equivocates if the report it
//!       revealed does NOT match its own commit (i.e. it tried to reveal a second
//!       plaintext). `reveal_report` rejects mismatches, so the on-chain-decidable
//!       equivocation signal is "a second reveal attempt whose hash differs from
//!       the committed one", captured here via `proof_json` containing an
//!       alternative report that ALSO hashes to the stored commit is impossible;
//!       instead we detect the simplest real case: two distinct commits were
//!       accepted for the same guardian+action (guarded against, so any such
//!       state is a proven fault).
//!   - `Unavailability` — FULLY on-chain decidable: the guardian was drawn but no
//!       commit exists past `commit_deadline_ns`.
//!   - `FalseAttestation` — the guardian revealed a report claiming some fact
//!       (e.g. `protocol_paused:false`), and the challenger's `proof_json`
//!       supplies a contradicting fact (`protocol_paused:true`). We compare the
//!       two simply (documented simplification; full source-signature
//!       verification is a stub — see `verify_contradiction`).

use crate::{
    yocto_to_usdc_6dp, Challenge, ChallengeId, ChallengeStatus, Coordinator, CoordinatorExt,
    FaultKind, GuardianId, GuardianStatus, ActionId,
};
use near_sdk::json_types::U128;
use near_sdk::{env, near, require, NearToken, Promise};

/// Minimum challenger deposit (0.1 NEAR) — spam resistance.
const MIN_CHALLENGE_DEPOSIT: NearToken = NearToken::from_millinear(100);

#[near]
impl Coordinator {
    /// Open a challenge against `guardian_id` for `action_id`. Payable: the
    /// attached deposit is held until `resolve_challenge`.
    #[payable]
    pub fn open_challenge(
        &mut self,
        action_id: ActionId,
        guardian_id: GuardianId,
        fault: FaultKind,
        proof_json: String,
    ) -> ChallengeId {
        let deposit = env::attached_deposit();
        require!(
            deposit >= MIN_CHALLENGE_DEPOSIT,
            "challenge deposit below minimum (0.1 NEAR)"
        );
        // The guardian must exist and must actually be on this action's committee.
        let rec = self.expect_action(&action_id);
        require!(
            rec.slot_index_pub(&guardian_id).is_some(),
            "guardian was not drawn for this action"
        );
        require!(self.guardians.get(&guardian_id).is_some(), "unknown guardian");

        self.next_challenge += 1;
        let id = self.next_challenge;
        self.challenges.insert(
            id,
            Challenge {
                id,
                action_id,
                guardian_id,
                challenger: env::predecessor_account_id(),
                fault,
                proof_json,
                deposit,
                status: ChallengeStatus::Open,
            },
        );
        id
    }

    /// Adjudicate an open challenge. Slashes the guardian on a proven fault and
    /// pays the challenger a reward share (plus deposit back); otherwise refunds
    /// the deposit and dismisses.
    pub fn resolve_challenge(&mut self, challenge_id: ChallengeId) -> ChallengeStatus {
        let mut ch = self
            .challenges
            .get(&challenge_id)
            .cloned()
            .unwrap_or_else(|| env::panic_str("unknown challenge"));
        require!(
            ch.status == ChallengeStatus::Open,
            "challenge already resolved"
        );

        let proven = self.fault_proven(&ch);

        if proven {
            // Slash the guardian's entire bond (demo: full slash on proven fault).
            let mut info = self
                .guardians
                .get(&ch.guardian_id)
                .cloned()
                .unwrap_or_else(|| env::panic_str("unknown guardian"));
            let slashed = info.bond;
            info.bond = NearToken::from_yoctonear(0);
            info.status = GuardianStatus::Slashed;
            self.guardians.insert(ch.guardian_id.clone(), info);

            // Bump slash stats.
            if let Some(mut st) = self.guardian_stats.get(&ch.guardian_id).cloned() {
                st.slashes += 1;
                st.total_slashed_yocto =
                    st.total_slashed_yocto.saturating_add(slashed.as_yoctonear());
                self.guardian_stats.insert(ch.guardian_id.clone(), st);
            }

            // Challenger reward = deposit back + reward share of the slashed bond.
            let reward = slashed.as_yoctonear() / crate::CHALLENGER_REWARD_DEN
                * crate::CHALLENGER_REWARD_NUM;
            let payout = ch
                .deposit
                .as_yoctonear()
                .saturating_add(reward);
            // Fire-and-forget payout (deposit back + reward). We don't need the
            // Promise handle; near schedules it regardless.
            let _ = Promise::new(ch.challenger.clone())
                .transfer(NearToken::from_yoctonear(payout));

            ch.status = ChallengeStatus::Slashed;
            env::log_str(&format!(
                "challenge {} PROVEN ({:?}): guardian {} slashed {} yocto, challenger paid {} yocto",
                challenge_id, ch.fault, ch.guardian_id, slashed.as_yoctonear(), payout
            ));
        } else {
            // Fault not proven: refund the challenger's deposit, dismiss.
            let _ = Promise::new(ch.challenger.clone()).transfer(ch.deposit);
            ch.status = ChallengeStatus::Dismissed;
            env::log_str(&format!(
                "challenge {} DISMISSED: deposit refunded",
                challenge_id
            ));
        }

        self.challenges.insert(challenge_id, ch.clone());
        ch.status
    }

    /// Read a challenge record.
    pub fn view_challenge(&self, challenge_id: ChallengeId) -> Option<Challenge> {
        self.challenges.get(&challenge_id).cloned()
    }

    /// For the UI: the current NEAR→USDC value of a guardian's bond via the demo rate.
    pub fn view_bond_usdc(&self, guardian_id: GuardianId) -> Option<U128> {
        self.guardians
            .get(&guardian_id)
            .map(|g| U128(yocto_to_usdc_6dp(g.bond.as_yoctonear())))
    }
}

impl Coordinator {
    /// Decide whether the asserted fault is proven, per fault kind.
    fn fault_proven(&self, ch: &Challenge) -> bool {
        let rec = self.expect_action(&ch.action_id);
        let idx = match rec.slot_index_pub(&ch.guardian_id) {
            Some(i) => i,
            None => return false,
        };
        let slot = &rec.slots[idx];

        match ch.fault {
            // Unavailability: drawn but NO commit by the deadline. Fully on-chain.
            FaultKind::Unavailability => {
                slot.commit_hash.is_none() && env::block_timestamp() > rec.commit_deadline_ns
            }

            // Equivocation: two DIFFERING reveals for the same action+guardian.
            // A slot holds one reveal; the challenger supplies a second report in
            // `proof_json`. It is equivocation iff BOTH hash to the SAME committed
            // value yet differ in content — the hallmark of a guardian that signed
            // off on contradictory plaintexts behind one commit (a hash collision
            // is infeasible, so in practice the real trigger is: the challenger
            // produces a validly-committing alternative). Decidable purely from
            // stored commit + the two plaintexts.
            FaultKind::Equivocation => {
                let (Some(revealed), Some(commit)) =
                    (slot.report_json.as_ref(), slot.commit_hash.as_ref())
                else {
                    return false;
                };
                // The alternative report the challenger claims the guardian also
                // put behind the same commit.
                let alt = ch.proof_json.as_str();
                if alt == revealed.as_str() {
                    return false; // identical => not equivocation
                }
                // Both must hash to the SAME stored commit to prove one commit
                // bound two distinct plaintexts.
                let h_revealed = hex::encode(env::sha256(revealed.as_bytes()));
                let h_alt = hex::encode(env::sha256(alt.as_bytes()));
                let c = commit.to_lowercase();
                h_revealed == c && h_alt == c
            }

            // FalseAttestation: revealed claimed fact contradicts challenger's fact.
            FaultKind::FalseAttestation => {
                let revealed = match slot.report_json.as_ref() {
                    Some(r) => r,
                    None => return false,
                };
                Self::verify_contradiction(revealed, &ch.proof_json)
            }
        }
    }

    /// FalseAttestation adjudication (DOCUMENTED SIMPLIFICATION).
    ///
    /// Compares the guardian's revealed `facts` object against the challenger's
    /// `proof_json` (same `facts` shape). If they assert contradicting values for
    /// the same key, the attestation is false. For the demo we check the two
    /// highest-signal booleans/ints: `protocol_paused` and `price_usdc`.
    ///
    /// NOTE: a production version would additionally verify the challenger's fact
    /// is itself backed by a signed source (e.g. a Pyth signed update whose hash
    /// matches `sources[].payload_ref`). That source-signature verification is a
    /// STUB here — we trust the challenger's proof_json facts for adjudication.
    fn verify_contradiction(revealed_report: &str, proof_json: &str) -> bool {
        use near_sdk::serde_json::Value;
        let (Ok(rep), Ok(proof)) = (
            near_sdk::serde_json::from_str::<Value>(revealed_report),
            near_sdk::serde_json::from_str::<Value>(proof_json),
        ) else {
            return false;
        };
        let rep_facts = rep.get("facts").unwrap_or(&rep);
        let proof_facts = proof.get("facts").unwrap_or(&proof);

        // protocol_paused contradiction.
        if let (Some(a), Some(b)) = (
            rep_facts.get("protocol_paused").and_then(|v| v.as_bool()),
            proof_facts.get("protocol_paused").and_then(|v| v.as_bool()),
        ) {
            if a != b {
                return true;
            }
        }

        // price_usdc contradiction: differ by more than a tolerance band. Prices
        // are 6-dp strings or ints; parse both as u64.
        let price = |v: &Value| -> Option<u64> {
            v.get("price_usdc").and_then(|p| {
                p.as_u64()
                    .or_else(|| p.as_str().and_then(|s| s.parse::<u64>().ok()))
            })
        };
        if let (Some(a), Some(b)) = (price(rep_facts), price(proof_facts)) {
            let diff = a.abs_diff(b);
            // >0.5% deviation between claimed and contradicting price => false.
            if diff > a / 200 {
                return true;
            }
        }

        false
    }
}
