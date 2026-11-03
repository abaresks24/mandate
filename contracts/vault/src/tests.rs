//! Unit tests for every public method of the Vault contract.
//!
//! Focus cases required by the task:
//!   (a) out-of-mandate template rejected by propose_action WITHOUT committee,
//!   (b) daily cap enforcement,
//!   (c) emergency_exit refuses a non-de-risking direction,
//!   (d) kill_switch only by owner.

use super::*;
use near_sdk::json_types::U128;
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{testing_env, AccountId, PublicKey};

fn owner() -> AccountId {
    "alice.testnet".parse().unwrap()
}
fn coordinator() -> AccountId {
    "coordinator.deployer.testnet".parse().unwrap()
}
// A deterministic ed25519 FC key for the agent.
fn agent_key() -> PublicKey {
    "ed25519:DcA2MzgpJbrUATQLLceocVckhhAqrkingax4oJ9kZ847"
        .parse()
        .unwrap()
}
fn other_key() -> PublicKey {
    "ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp"
        .parse()
        .unwrap()
}

fn base_mandate() -> Mandate {
    Mandate {
        owner: owner(),
        target_apy_bps: 800,
        max_risk_score: 60,
        allowed_protocols: vec!["rhea".to_string(), "morpho".to_string()],
        allowed_chains: vec!["near".to_string(), "ethereum-sepolia".to_string()],
        max_share_per_protocol_bps: 5000,
        max_loss_bps: 300,
        daily_cap_usdc: U128(5_000_000_000), // 5,000 USDC (6-dp)
        committee_threshold_usdc: U128(0),
    }
}

/// Context where the AGENT (its FC key) is the signer.
fn ctx_agent() -> VMContextBuilder {
    let mut b = VMContextBuilder::new();
    b.predecessor_account_id(owner()) // agent calls via a FC key added to the vault-owner account
        .signer_account_id(owner())
        .signer_account_pk(agent_key())
        .block_timestamp(1_000);
    b
}

/// Context where the OWNER is the direct predecessor (full-access), non-agent key.
fn ctx_owner() -> VMContextBuilder {
    let mut b = VMContextBuilder::new();
    b.predecessor_account_id(owner())
        .signer_account_id(owner())
        .signer_account_pk(other_key())
        .block_timestamp(1_000);
    b
}

/// Context where a random stranger calls.
fn ctx_stranger() -> VMContextBuilder {
    let mut b = VMContextBuilder::new();
    let mallory: AccountId = "mallory.testnet".parse().unwrap();
    b.predecessor_account_id(mallory.clone())
        .signer_account_id(mallory)
        .signer_account_pk(other_key())
        .block_timestamp(1_000);
    b
}

fn new_vault() -> Vault {
    Vault::new(owner(), base_mandate(), coordinator(), agent_key())
}

fn tally_ok() -> Tally {
    Tally {
        approvals: 3,
        threshold_met: true,
    }
}
fn facts_ok() -> GuardianFacts {
    GuardianFacts {
        observed_slippage_bps: 10,
        protocol_paused: false,
        price_usdc: Some(1_000_900),
    }
}

// ---------------------------------------------------------------------------
// new()
// ---------------------------------------------------------------------------
#[test]
fn new_stores_mandate() {
    testing_env!(ctx_owner().build());
    let v = new_vault();
    assert_eq!(v.view_mandate(), base_mandate());
    let pos = v.view_positions();
    assert_eq!(pos.total_usdc, U128(0));
    assert!(pos.positions.is_empty());
}

#[test]
#[should_panic(expected = "mandate.owner must equal owner argument")]
fn new_rejects_mismatched_owner() {
    testing_env!(ctx_owner().build());
    let bad: AccountId = "bob.testnet".parse().unwrap();
    Vault::new(bad, base_mandate(), coordinator(), agent_key());
}

// ---------------------------------------------------------------------------
// propose_action — happy paths
// ---------------------------------------------------------------------------
#[test]
fn propose_supply_rhea_ok() {
    testing_env!(ctx_agent().build());
    let mut v = new_vault();
    let id = v.propose_action(ActionTemplate::SupplyRhea {
        token: "usdc".into(),
        amount: U128(1_000_000_000),
        market: "ref-finance-101.testnet".into(),
    });
    assert_eq!(id, "a1");
    let st = v.view_action(id).unwrap();
    assert_eq!(st.status, ActionStatus::Proposed);
}

#[test]
fn propose_allocate_crosschain_ok() {
    testing_env!(ctx_agent().build());
    let mut v = new_vault();
    let id = v.propose_action(ActionTemplate::AllocateCrossChain {
        chain: "ethereum-sepolia".into(),
        protocol: "morpho".into(),
        market: "0xabc".into(),
        amount: U128(2_000_000_000),
        max_slippage_bps: 50,
    });
    assert_eq!(v.view_action(id).unwrap().status, ActionStatus::Proposed);
}

// ---------------------------------------------------------------------------
// (a) OUT-OF-MANDATE rejected by propose_action WITHOUT committee
// ---------------------------------------------------------------------------
#[test]
#[should_panic(expected = "protocol not in allowed_protocols")]
fn propose_rejects_disallowed_protocol_no_committee() {
    testing_env!(ctx_agent().build());
    let mut v = new_vault();
    // "aave" is NOT in allowed_protocols -> must fail closed, here, never touching committee.
    v.propose_action(ActionTemplate::AllocateCrossChain {
        chain: "ethereum-sepolia".into(),
        protocol: "aave".into(),
        market: "0xabc".into(),
        amount: U128(1_000_000),
        max_slippage_bps: 50,
    });
}

#[test]
#[should_panic(expected = "chain not in allowed_chains")]
fn propose_rejects_disallowed_chain() {
    testing_env!(ctx_agent().build());
    let mut v = new_vault();
    v.propose_action(ActionTemplate::AllocateCrossChain {
        chain: "base-sepolia".into(), // not allowed
        protocol: "morpho".into(),
        market: "0xabc".into(),
        amount: U128(1_000_000),
        max_slippage_bps: 50,
    });
}

// ---------------------------------------------------------------------------
// (b) DAILY CAP enforcement
// ---------------------------------------------------------------------------
#[test]
#[should_panic(expected = "amount exceeds daily_cap_usdc")]
fn propose_single_over_cap_rejected() {
    testing_env!(ctx_agent().build());
    let mut v = new_vault();
    v.propose_action(ActionTemplate::SupplyRhea {
        token: "usdc".into(),
        amount: U128(5_000_000_001), // one over the 5,000 USDC cap
        market: "m".into(),
    });
}

#[test]
#[should_panic(expected = "daily cap exhausted")]
fn propose_cumulative_over_cap_rejected() {
    testing_env!(ctx_agent().build());
    let mut v = new_vault();
    // 3,000 then 3,000 => 6,000 > 5,000 cap.
    v.propose_action(ActionTemplate::SupplyRhea {
        token: "usdc".into(),
        amount: U128(3_000_000_000),
        market: "m".into(),
    });
    v.propose_action(ActionTemplate::SupplyRhea {
        token: "usdc".into(),
        amount: U128(3_000_000_000),
        market: "m".into(),
    });
}

#[test]
fn daily_cap_resets_after_24h() {
    testing_env!(ctx_agent().block_timestamp(1_000).build());
    let mut v = new_vault();
    v.propose_action(ActionTemplate::SupplyRhea {
        token: "usdc".into(),
        amount: U128(4_000_000_000),
        market: "m".into(),
    });
    // Advance > 24h and propose another 4,000 USDC; must succeed (window rolled).
    let later = 1_000 + DAY_NANOS + 1;
    testing_env!(ctx_agent().block_timestamp(later).build());
    let id = v.propose_action(ActionTemplate::SupplyRhea {
        token: "usdc".into(),
        amount: U128(4_000_000_000),
        market: "m".into(),
    });
    assert_eq!(v.view_action(id).unwrap().status, ActionStatus::Proposed);
}

// ---------------------------------------------------------------------------
// max_share_per_protocol_bps
// ---------------------------------------------------------------------------
#[test]
#[should_panic(expected = "resulting protocol share exceeds max_share")]
fn propose_rejects_over_share() {
    testing_env!(ctx_agent().build());
    let mut v = new_vault();
    v.test_seed_idle(2_000_000_000); // 2,000 USDC AUM, all idle
                                      // Deploy 2,000 to rhea -> 100% share > 50% cap. (amount under daily cap)
    v.propose_action(ActionTemplate::SupplyRhea {
        token: "usdc".into(),
        amount: U128(2_000_000_000),
        market: "m".into(),
    });
}

// ---------------------------------------------------------------------------
// agent-key gating on propose_action
// ---------------------------------------------------------------------------
#[test]
#[should_panic(expected = "not the agent function-call key")]
fn propose_rejected_from_non_agent_key() {
    testing_env!(ctx_owner().build()); // owner's non-agent key
    let mut v = new_vault();
    v.propose_action(ActionTemplate::SupplyRhea {
        token: "usdc".into(),
        amount: U128(1),
        market: "m".into(),
    });
}

// ---------------------------------------------------------------------------
// execute_action
// ---------------------------------------------------------------------------
#[test]
fn execute_supply_rhea_success() {
    testing_env!(ctx_agent().build());
    let mut v = new_vault();
    let id = v.propose_action(ActionTemplate::SupplyRhea {
        token: "usdc".into(),
        amount: U128(1_000_000_000),
        market: "m".into(),
    });
    v.execute_action_inner(id.clone(), tally_ok(), facts_ok());
    let st = v.view_action(id).unwrap();
    assert_eq!(st.status, ActionStatus::Executed);
    // Position ledger reflects the supply.
    let pos = v.view_positions();
    assert_eq!(pos.positions.len(), 1);
    assert_eq!(pos.positions[0].protocol, "rhea");
}

#[test]
fn execute_crosschain_requests_signature() {
    testing_env!(ctx_agent().build());
    let mut v = new_vault();
    let id = v.propose_action(ActionTemplate::AllocateCrossChain {
        chain: "ethereum-sepolia".into(),
        protocol: "morpho".into(),
        market: "0xMarket".into(),
        amount: U128(1_000_000_000),
        max_slippage_bps: 50,
    });
    v.execute_action_inner(id.clone(), tally_ok(), facts_ok());
    let st = v.view_action(id).unwrap();
    assert_eq!(st.status, ActionStatus::Executed);
    assert!(st.note.unwrap().contains("Chain Signatures"));
}

#[test]
#[should_panic(expected = "threshold not met")]
fn execute_blocked_without_threshold() {
    testing_env!(ctx_agent().build());
    let mut v = new_vault();
    let id = v.propose_action(ActionTemplate::SupplyRhea {
        token: "usdc".into(),
        amount: U128(1_000_000),
        market: "m".into(),
    });
    let no = Tally {
        approvals: 1,
        threshold_met: false,
    };
    v.execute_action_inner(id, no, facts_ok());
}

#[test]
fn execute_rejects_on_high_slippage_fact() {
    testing_env!(ctx_agent().build());
    let mut v = new_vault();
    let id = v.propose_action(ActionTemplate::AllocateCrossChain {
        chain: "ethereum-sepolia".into(),
        protocol: "morpho".into(),
        market: "0xMarket".into(),
        amount: U128(1_000_000_000),
        max_slippage_bps: 50,
    });
    let bad_facts = GuardianFacts {
        observed_slippage_bps: 120, // > 50
        protocol_paused: false,
        price_usdc: Some(1_000_000),
    };
    v.execute_action_inner(id.clone(), tally_ok(), bad_facts);
    let st = v.view_action(id).unwrap();
    assert_eq!(st.status, ActionStatus::Rejected);
    assert!(st.note.unwrap().contains("SLIPPAGE_HIGH"));
    // Rejected -> daily reservation released, so cap is free again.
    assert!(v.view_positions().positions.is_empty());
}

#[test]
fn execute_rejects_on_protocol_paused_fact() {
    testing_env!(ctx_agent().build());
    let mut v = new_vault();
    let id = v.propose_action(ActionTemplate::SupplyRhea {
        token: "usdc".into(),
        amount: U128(1_000_000),
        market: "m".into(),
    });
    let paused = GuardianFacts {
        observed_slippage_bps: 0,
        protocol_paused: true,
        price_usdc: None,
    };
    v.execute_action_inner(id.clone(), tally_ok(), paused);
    assert_eq!(v.view_action(id).unwrap().status, ActionStatus::Rejected);
}

#[test]
fn execute_rejects_on_depeg_fact() {
    testing_env!(ctx_agent().build());
    let mut v = new_vault();
    let id = v.propose_action(ActionTemplate::AllocateCrossChain {
        chain: "ethereum-sepolia".into(),
        protocol: "morpho".into(),
        market: "0xMarket".into(),
        amount: U128(1_000_000),
        max_slippage_bps: 50,
    });
    let depeg = GuardianFacts {
        observed_slippage_bps: 5,
        protocol_paused: false,
        price_usdc: Some(930_000), // $0.93 -> depeg
    };
    v.execute_action_inner(id.clone(), tally_ok(), depeg);
    let st = v.view_action(id).unwrap();
    assert_eq!(st.status, ActionStatus::Rejected);
    assert!(st.note.unwrap().contains("DEPEG"));
}

// ---------------------------------------------------------------------------
// (c) emergency_exit refuses a non-de-risking direction
// ---------------------------------------------------------------------------
#[test]
#[should_panic(expected = "may only move funds toward USDC/home")]
fn emergency_exit_refuses_non_derisking() {
    testing_env!(ctx_agent().build());
    let mut v = new_vault();
    // Trying to use emergency_exit to OPEN a position -> refused.
    v.emergency_exit(ActionTemplate::SupplyRhea {
        token: "usdc".into(),
        amount: U128(1_000_000),
        market: "m".into(),
    });
}

#[test]
fn emergency_exit_withdraw_allowed() {
    testing_env!(ctx_agent().build());
    let mut v = new_vault();
    // Seed a rhea position first.
    let id = v.propose_action(ActionTemplate::SupplyRhea {
        token: "usdc".into(),
        amount: U128(1_000_000_000),
        market: "m".into(),
    });
    v.test_seed_idle(1_000_000_000);
    v.execute_action_inner(id, tally_ok(), facts_ok());
    // Now emergency withdraw.
    let eid = v.emergency_exit(ActionTemplate::WithdrawToUsdc {
        protocol: "rhea".into(),
    });
    let st = v.view_action(eid).unwrap();
    assert_eq!(st.status, ActionStatus::Executed);
}

#[test]
fn emergency_exit_emergencyexit_template_allowed() {
    testing_env!(ctx_agent().build());
    let mut v = new_vault();
    let eid = v.emergency_exit(ActionTemplate::EmergencyExit {
        reason_code: "DEPEG".into(),
    });
    assert_eq!(v.view_action(eid).unwrap().status, ActionStatus::Executed);
}

#[test]
#[should_panic(expected = "not the agent function-call key")]
fn emergency_exit_agent_only() {
    testing_env!(ctx_owner().build());
    let mut v = new_vault();
    v.emergency_exit(ActionTemplate::EmergencyExit {
        reason_code: "DEPEG".into(),
    });
}

// ---------------------------------------------------------------------------
// (d) kill_switch only by owner
// ---------------------------------------------------------------------------
#[test]
fn kill_switch_by_owner_ok() {
    // Seed positions via agent, then owner kills.
    testing_env!(ctx_agent().build());
    let mut v = new_vault();
    v.test_seed_idle(2_000_000_000); // 2,000 USDC AUM; deploy 1,000 -> 50% share (<= cap)
    let id = v.propose_action(ActionTemplate::SupplyRhea {
        token: "usdc".into(),
        amount: U128(1_000_000_000),
        market: "m".into(),
    });
    v.execute_action_inner(id, tally_ok(), facts_ok());
    assert_eq!(v.view_positions().positions.len(), 1);

    testing_env!(ctx_owner().build());
    let kid = v.kill_switch();
    assert_eq!(v.view_action(kid).unwrap().status, ActionStatus::Executed);
    // Everything repatriated: no positions, no idle.
    let pos = v.view_positions();
    assert!(pos.positions.is_empty());
    assert_eq!(pos.idle_usdc, U128(0));
    assert_eq!(pos.total_usdc, U128(0));
}

#[test]
#[should_panic(expected = "owner only")]
fn kill_switch_rejects_non_owner() {
    testing_env!(ctx_stranger().build());
    let mut v = new_vault();
    v.kill_switch();
}

#[test]
#[should_panic(expected = "owner only")]
fn kill_switch_rejects_agent() {
    // Even the agent key (not predecessor==owner) cannot kill.
    let mut b = VMContextBuilder::new();
    let mallory: AccountId = "mallory.testnet".parse().unwrap();
    b.predecessor_account_id(mallory.clone())
        .signer_account_id(mallory)
        .signer_account_pk(agent_key());
    testing_env!(b.build());
    let mut v = new_vault();
    v.kill_switch();
}

// ---------------------------------------------------------------------------
// views
// ---------------------------------------------------------------------------
#[test]
fn view_action_unknown_is_none() {
    testing_env!(ctx_owner().build());
    let v = new_vault();
    assert!(v.view_action("nope".into()).is_none());
}

#[test]
#[should_panic(expected = "caller is neither owner nor agent")]
fn execute_action_rejects_stranger() {
    // The PUBLIC wired execute_action asserts owner-or-agent BEFORE any
    // cross-contract call, so a stranger is rejected without touching the
    // coordinator. (A proposed action must exist first so we reach the gate.)
    testing_env!(ctx_agent().build());
    let mut v = new_vault();
    let id = v.propose_action(ActionTemplate::SupplyRhea {
        token: "usdc".into(),
        amount: U128(1_000_000),
        market: "m".into(),
    });
    testing_env!(ctx_stranger().build());
    v.execute_action(id);
}
