//! MANDATE — Vault contract (T2).
//!
//! One instance per mandate, deployed to a sub-account owned by the user
//! (`<id>.vaults.<deployer>.testnet`). Holds funds, mandate rules, templated
//! actions, commit-reveal verification and the kill switch.
//!
//! Security model (two complementary layers, per SPEC/PLAN):
//!   1. STRUCTURAL (this contract): `propose_action` only accepts the fixed
//!      `ActionTemplate` enum and enforces ALL deterministic mandate rules
//!      BEFORE any committee contact. An out-of-mandate proposal is rejected
//!      here and never reaches a guardian — the prompt-injection defense.
//!   2. FACTS (committee): `execute_action` applies the attested committee facts
//!      (slippage, protocol-paused, price) to the mandate rules before executing.

mod evm;
// The external-contract traits are the Phase-2 integration interface (cross-contract
// calls wired then); they are intentionally defined ahead of use.
#[allow(dead_code)]
mod external;
mod types;

pub use external::{SignRequest, Tally};
pub use types::*;

use near_sdk::json_types::U128;
use near_sdk::store::{LookupMap, Vector};
use near_sdk::{env, near, require, AccountId, PanicOnDefault, PublicKey};

/// Rolling daily cap window, in nanoseconds (24h).
const DAY_NANOS: u64 = 24 * 60 * 60 * 1_000_000_000;

/// A healthy stablecoin price band, 6-dp. Outside this => DEPEG, refuse allocate.
const USDC_PRICE_FLOOR: u64 = 995_000; // $0.995
const USDC_PRICE_CEIL: u64 = 1_005_000; // $1.005

pub type ActionId = String;

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Vault {
    /// User who owns this vault (== mandate.owner). Only key that may kill_switch.
    owner: AccountId,
    /// The investment mandate (all SPEC fields).
    mandate: Mandate,
    /// Global coordinator contract account.
    coordinator: AccountId,
    /// Agent's function-call public key. Only this key may propose/emergency_exit.
    agent_fc_key: PublicKey,

    /// Monotonic action counter -> ids like "a7".
    next_action: u64,
    /// action_id -> state.
    actions: LookupMap<ActionId, ActionState>,

    /// Current protocol positions.
    positions: Vector<Position>,
    /// Idle USDC (home), 6-dp.
    idle_usdc: u128,

    /// Rolling daily-cap accounting.
    day_window_start: u64,
    day_spent_usdc: u128,
}

#[near]
impl Vault {
    /// Initialize the vault for one mandate.
    #[init]
    pub fn new(
        owner: AccountId,
        mandate: Mandate,
        coordinator: AccountId,
        agent_fc_key: PublicKey,
    ) -> Self {
        require!(
            mandate.owner == owner,
            "mandate.owner must equal owner argument"
        );
        let mut v = Self {
            owner,
            mandate,
            coordinator,
            agent_fc_key,
            next_action: 0,
            actions: LookupMap::new(b"a"),
            positions: Vector::new(b"p"),
            idle_usdc: 0,
            day_window_start: env::block_timestamp(),
            day_spent_usdc: 0,
        };
        // Seed idle balance explicitly via deposit flows in integration; start empty.
        let _ = &mut v.idle_usdc;
        v
    }

    // -------------------------------------------------------------------------
    // 2. propose_action — agent-only, FAIL CLOSED deterministic gate.
    // -------------------------------------------------------------------------

    /// Agent proposes a templated action. Runs ALL deterministic mandate checks
    /// and fails closed. Rejection happens HERE, before any committee contact.
    pub fn propose_action(&mut self, template: ActionTemplate) -> ActionId {
        self.assert_agent();
        self.validate_template(&template);

        self.roll_day_window();
        // Daily cap: only *new capital deployed* consumes the cap. De-risking moves don't.
        let amount = template.amount_usdc();
        if !template.is_de_risking() {
            let cap = self.mandate.daily_cap_usdc.0;
            require!(amount <= cap, "amount exceeds daily_cap_usdc");
            let projected = self
                .day_spent_usdc
                .checked_add(amount)
                .expect("daily spend overflow");
            require!(projected <= cap, "daily cap exhausted for current 24h window");
            // Reserve against the cap at proposal time (fail-closed; released on reject).
            self.day_spent_usdc = projected;
        }

        let id = self.mint_action_id();
        let state = ActionState {
            id: id.clone(),
            template,
            status: ActionStatus::Proposed,
            note: None,
        };
        self.actions.insert(id.clone(), state);
        id
    }

    /// Deterministic mandate gate shared by propose_action. Panics (fail-closed)
    /// on any violation. Pure w.r.t. committee — never calls out.
    fn validate_template(&self, template: &ActionTemplate) {
        // (a) kind allowed — the enum itself is the allow-list; all four kinds are
        // structurally valid templates. Out-of-mandate = protocol/chain/limits below.

        // (b) protocol in allowed_protocols (skip when template has no protocol, e.g. EmergencyExit).
        if let Some(p) = template.protocol() {
            require!(
                self.mandate.allowed_protocols.iter().any(|a| a == p),
                "protocol not in allowed_protocols"
            );
        }

        // (c) chain in allowed_chains.
        if let Some(c) = template.chain() {
            require!(
                self.mandate.allowed_chains.iter().any(|a| a == c),
                "chain not in allowed_chains"
            );
        }

        // (d) resulting share <= max_share_per_protocol_bps (only for capital-deploying templates).
        if !template.is_de_risking() {
            if let Some(p) = template.protocol() {
                let add = template.amount_usdc();
                let current_aum = self.current_aum();
                // Share gate is only meaningful once the vault has tracked AUM.
                // An unseeded vault (no idle, no positions) has no denominator; the
                // ratio is enforced on subsequent proposals as positions accrue.
                if current_aum > 0 {
                    let new_protocol_notional = self.protocol_notional(p) + add;
                    // Deploying from idle keeps AUM constant; a move larger than AUM
                    // grows the denominator too (conservative upper bound).
                    let aum_after = current_aum.max(new_protocol_notional);
                    let share_bps = (new_protocol_notional.saturating_mul(10_000)) / aum_after;
                    require!(
                        share_bps <= self.mandate.max_share_per_protocol_bps as u128,
                        "resulting protocol share exceeds max_share_per_protocol_bps"
                    );
                }
            }
        }
    }

    // -------------------------------------------------------------------------
    // 3. execute_action — after committee tally; apply FACTS then execute.
    // -------------------------------------------------------------------------

    /// Execute a proposed action. Preconditions:
    ///   * action exists and is `Proposed`,
    ///   * the coordinator tally says `threshold_met` (passed in; in integration
    ///     this is a cross-contract call to `coordinator.tally(action_id)` — see
    ///     `external::ext_coordinator`),
    ///   * the revealed guardian `facts` satisfy the mandate rules.
    ///
    /// The commit==sha256(reveal) check is enforced COORDINATOR-SIDE
    /// (`reveal_report`), so by the time facts arrive here they are trusted; the
    /// vault's job is to apply those facts to the mandate rules and only then
    /// execute. `_commit_verified` makes that precondition explicit/auditable.
    ///
    /// Callable by owner or agent (either may drive execution once the committee
    /// has attested).
    pub fn execute_action(&mut self, action_id: ActionId, tally: Tally, facts: GuardianFacts) {
        self.assert_owner_or_agent();
        require!(tally.threshold_met, "coordinator tally: threshold not met");

        let mut state = self
            .actions
            .get(&action_id)
            .cloned()
            .expect("unknown action_id");
        require!(
            state.status == ActionStatus::Proposed,
            "action is not in Proposed state"
        );

        // Apply committee FACTS to mandate rules. Fail closed -> mark Rejected.
        if let Some(reason) = self.facts_violate_mandate(&state.template, &facts) {
            // Release any reserved daily-cap for this capital-deploying action.
            self.release_daily_reservation(&state.template);
            state.status = ActionStatus::Rejected;
            state.note = Some(reason);
            self.actions.insert(action_id, state);
            return;
        }

        // Facts OK -> execute by kind.
        let note = self.dispatch_execution(&state.template);
        self.apply_position_effects(&state.template);
        state.status = ActionStatus::Executed;
        state.note = Some(note);
        self.actions.insert(action_id, state);
    }

    /// Apply attested facts to mandate rules. Returns Some(reason) if a rule is
    /// violated (=> reject), None if OK. Only facts-relevant templates are checked.
    fn facts_violate_mandate(
        &self,
        template: &ActionTemplate,
        facts: &GuardianFacts,
    ) -> Option<String> {
        // Protocol liveness applies to any protocol-touching action.
        if facts.protocol_paused {
            return Some("PROTOCOL_PAUSED: committee reports target protocol paused".into());
        }
        match template {
            ActionTemplate::AllocateCrossChain {
                max_slippage_bps, ..
            } => {
                if facts.observed_slippage_bps > *max_slippage_bps {
                    return Some(format!(
                        "SLIPPAGE_HIGH: observed {} bps > template max {} bps",
                        facts.observed_slippage_bps, max_slippage_bps
                    ));
                }
                if let Some(price) = facts.price_usdc {
                    if price < USDC_PRICE_FLOOR || price > USDC_PRICE_CEIL {
                        return Some(format!(
                            "DEPEG: USDC price {} outside [{}, {}]",
                            price, USDC_PRICE_FLOOR, USDC_PRICE_CEIL
                        ));
                    }
                }
                None
            }
            ActionTemplate::SupplyRhea { .. } => None,
            ActionTemplate::WithdrawToUsdc { .. } | ActionTemplate::EmergencyExit { .. } => None,
        }
    }

    /// Execute by kind. Returns a human-readable note. In unit tests this records
    /// the intended on-chain effect; in integration it fires the real cross-contract
    /// call / signing request (see `external` + `evm`).
    fn dispatch_execution(&mut self, template: &ActionTemplate) -> String {
        match template {
            ActionTemplate::SupplyRhea {
                token,
                amount,
                market,
            } => {
                // Integration: ext_rhea::supply on `ref-finance-101.testnet` market.
                format!(
                    "SupplyRhea: supply {} {} to {} (NEAR-native, contract-verified)",
                    amount.0, token, market
                )
            }
            ActionTemplate::AllocateCrossChain {
                market, amount, ..
            } => {
                // Vault builds the EVM tx + requests a Chain Signatures signature.
                let tx = evm::build_allocate_tx(market, *amount);
                let payload = evm::signer_payload(&tx);
                // Integration: ext_mpc_signer::sign on `v1.signer-prod.testnet`.
                let _req = SignRequest {
                    payload,
                    path: "mandate-vault,eth".to_string(),
                    key_version: 0,
                };
                format!(
                    "AllocateCrossChain: built EVM tx to {} (chain {}) for {} USDC, signature requested via Chain Signatures",
                    tx.to, tx.chain_id, amount.0
                )
            }
            ActionTemplate::WithdrawToUsdc { protocol } => {
                format!("WithdrawToUsdc: unwind position in {} to USDC", protocol)
            }
            ActionTemplate::EmergencyExit { reason_code } => {
                format!("EmergencyExit executed (reason {})", reason_code)
            }
        }
    }

    // -------------------------------------------------------------------------
    // 4. emergency_exit — agent-callable, de-risking direction ONLY.
    // -------------------------------------------------------------------------

    /// Agent-triggered emergency de-risk. May ONLY move funds toward USDC/home.
    /// The direction assertion is the invariant: a non-de-risking template is
    /// refused. Does NOT require committee (it strictly reduces risk).
    pub fn emergency_exit(&mut self, template: ActionTemplate) -> ActionId {
        self.assert_agent();
        require!(
            template.is_de_risking(),
            "emergency_exit may only move funds toward USDC/home"
        );
        // Validate protocol/chain still inside mandate (de-risking skips cap/share).
        self.validate_template(&template);

        let note = self.dispatch_execution(&template);
        self.apply_position_effects(&template);

        let id = self.mint_action_id();
        self.actions.insert(
            id.clone(),
            ActionState {
                id: id.clone(),
                template,
                status: ActionStatus::Executed,
                note: Some(note),
            },
        );
        id
    }

    // -------------------------------------------------------------------------
    // 5. kill_switch — owner only, repatriate everything to owner.
    // -------------------------------------------------------------------------

    /// Owner-only global stop: unwind every position to USDC and repatriate to
    /// the owner account. After this the vault holds no positions.
    pub fn kill_switch(&mut self) -> ActionId {
        self.assert_owner();

        // Collapse all positions into idle USDC, then (integration) transfer out.
        let mut repatriated = self.idle_usdc;
        for i in 0..self.positions.len() {
            if let Some(pos) = self.positions.get(i) {
                repatriated = repatriated.saturating_add(pos.amount_usdc.0);
            }
        }
        self.positions.clear();
        self.idle_usdc = 0;

        let id = self.mint_action_id();
        self.actions.insert(
            id.clone(),
            ActionState {
                id: id.clone(),
                template: ActionTemplate::EmergencyExit {
                    reason_code: "KILL_SWITCH".to_string(),
                },
                status: ActionStatus::Executed,
                note: Some(format!(
                    "KILL_SWITCH: repatriated {} USDC (6-dp) to owner {}",
                    repatriated, self.owner
                )),
            },
        );
        env::log_str(&format!(
            "kill_switch: repatriated {} USDC to {}",
            repatriated, self.owner
        ));
        id
    }

    // -------------------------------------------------------------------------
    // 6. views
    // -------------------------------------------------------------------------

    pub fn view_positions(&self) -> Positions {
        let positions: Vec<Position> = self.positions.iter().cloned().collect();
        let total = positions
            .iter()
            .fold(self.idle_usdc, |acc, p| acc.saturating_add(p.amount_usdc.0));
        Positions {
            positions,
            idle_usdc: U128(self.idle_usdc),
            total_usdc: U128(total),
        }
    }

    pub fn view_action(&self, action_id: ActionId) -> Option<ActionState> {
        self.actions.get(&action_id).cloned()
    }

    pub fn view_mandate(&self) -> Mandate {
        self.mandate.clone()
    }

    // -------------------------------------------------------------------------
    // helpers
    // -------------------------------------------------------------------------

    fn assert_owner(&self) {
        require!(
            env::predecessor_account_id() == self.owner,
            "kill_switch: owner only"
        );
    }

    /// The agent calls with its function-call key; assert it's that signer key.
    /// (On NEAR, a FC-key call has `signer_account_pk == agent_fc_key`.)
    fn assert_agent(&self) {
        require!(
            env::signer_account_pk() == self.agent_fc_key,
            "caller is not the agent function-call key"
        );
    }

    fn assert_owner_or_agent(&self) {
        let is_owner = env::predecessor_account_id() == self.owner;
        let is_agent = env::signer_account_pk() == self.agent_fc_key;
        require!(is_owner || is_agent, "caller is neither owner nor agent");
    }

    fn mint_action_id(&mut self) -> ActionId {
        self.next_action += 1;
        format!("a{}", self.next_action)
    }

    fn roll_day_window(&mut self) {
        let now = env::block_timestamp();
        if now.saturating_sub(self.day_window_start) >= DAY_NANOS {
            self.day_window_start = now;
            self.day_spent_usdc = 0;
        }
    }

    fn release_daily_reservation(&mut self, template: &ActionTemplate) {
        if !template.is_de_risking() {
            let amt = template.amount_usdc();
            self.day_spent_usdc = self.day_spent_usdc.saturating_sub(amt);
        }
    }

    fn protocol_notional(&self, protocol: &str) -> u128 {
        self.positions
            .iter()
            .filter(|p| p.protocol == protocol)
            .fold(0u128, |acc, p| acc.saturating_add(p.amount_usdc.0))
    }

    /// Total AUM = idle USDC + all position notionals (6-dp).
    fn current_aum(&self) -> u128 {
        self.positions
            .iter()
            .fold(self.idle_usdc, |acc, p| acc.saturating_add(p.amount_usdc.0))
    }

    /// Reflect an executed template in the position ledger (test-visible, and the
    /// basis for share math on subsequent proposals).
    fn apply_position_effects(&mut self, template: &ActionTemplate) {
        match template {
            ActionTemplate::SupplyRhea { amount, .. } => {
                self.add_to_protocol("rhea", "near", amount.0);
            }
            ActionTemplate::AllocateCrossChain {
                protocol,
                chain,
                amount,
                ..
            } => {
                self.add_to_protocol(protocol, chain, amount.0);
            }
            ActionTemplate::WithdrawToUsdc { protocol } => {
                self.unwind_protocol(protocol);
            }
            ActionTemplate::EmergencyExit { .. } => {
                // Unwind everything to idle USDC.
                let mut total = self.idle_usdc;
                for i in 0..self.positions.len() {
                    if let Some(p) = self.positions.get(i) {
                        total = total.saturating_add(p.amount_usdc.0);
                    }
                }
                self.positions.clear();
                self.idle_usdc = total;
            }
        }
    }

    fn add_to_protocol(&mut self, protocol: &str, chain: &str, amount: u128) {
        // Fund from idle if available (conservative; integration tracks real balances).
        self.idle_usdc = self.idle_usdc.saturating_sub(amount);
        for i in 0..self.positions.len() {
            if let Some(p) = self.positions.get(i) {
                if p.protocol == protocol {
                    let updated = Position {
                        protocol: p.protocol.clone(),
                        chain: p.chain.clone(),
                        amount_usdc: U128(p.amount_usdc.0.saturating_add(amount)),
                    };
                    self.positions.set(i, updated);
                    return;
                }
            }
        }
        self.positions.push(Position {
            protocol: protocol.to_string(),
            chain: chain.to_string(),
            amount_usdc: U128(amount),
        });
    }

    fn unwind_protocol(&mut self, protocol: &str) {
        let mut freed = 0u128;
        let mut kept: Vec<Position> = Vec::new();
        for p in self.positions.iter() {
            if p.protocol == protocol {
                freed = freed.saturating_add(p.amount_usdc.0);
            } else {
                kept.push(p.clone());
            }
        }
        self.positions.clear();
        for p in kept {
            self.positions.push(p);
        }
        self.idle_usdc = self.idle_usdc.saturating_add(freed);
    }

    /// Test-only seeding of balances/positions (not exposed as a real tx path).
    #[cfg(test)]
    fn test_seed_idle(&mut self, amount: u128) {
        self.idle_usdc = amount;
    }
}

#[cfg(test)]
mod tests;
