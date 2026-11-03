//! External-contract interfaces the vault talks to, modeled as near-sdk
//! cross-contract traits (`#[ext_contract]`). In unit tests these are not
//! actually dispatched; the vault's execution logic is tested by injecting
//! committee facts directly (see tests), while these traits document the real
//! wiring done in Phase 2 integration.

// The `#[ext_contract]` macro emits the callable `ext_*` modules we use; it also
// leaves the trait name itself (used only as a macro input) flagged as dead. The
// `Rhea` interface is a documented integration point not yet dispatched. Silence
// those specific style warnings without hiding real ones.
#![allow(dead_code)]

use near_sdk::json_types::U128;
use near_sdk::{ext_contract, AccountId};

/// Coordinator contract — the subset the vault needs. Mirrors SPEC.md
/// "Coordinator contract — external interface".
#[ext_contract(ext_coordinator)]
pub trait Coordinator {
    /// Draw a bonded committee for an action; quorum-bond must cover action value.
    fn draw_committee(
        &mut self,
        vault_id: AccountId,
        action_id: String,
        action_value_usdc: U128,
    ) -> Vec<String>;

    /// Current attestation tally for an action.
    fn tally(&self, action_id: String) -> Tally;

    /// Tally PLUS the committee's aggregated attested facts. This is what the
    /// vault's `execute_action` calls so its `on_tally` callback can apply both
    /// the approval threshold and the facts to the mandate rules.
    fn tally_facts(&self, action_id: String) -> TallyWithFacts;
}

/// Mirror of the coordinator's `Tally` return. Kept here so the vault compiles
/// standalone (same shape the coordinator serializes).
#[derive(
    near_sdk::serde::Serialize, near_sdk::serde::Deserialize, Clone, Debug, PartialEq, Default,
)]
#[serde(crate = "near_sdk::serde")]
pub struct Tally {
    pub approvals: u8,
    pub threshold_met: bool,
}

/// Mirror of the coordinator's `TallyFacts` — committee-attested facts the vault
/// feeds to its mandate gate. Same JSON shape the coordinator serializes.
#[derive(
    near_sdk::serde::Serialize, near_sdk::serde::Deserialize, Clone, Debug, PartialEq, Default,
)]
#[serde(crate = "near_sdk::serde")]
pub struct TallyFacts {
    pub observed_slippage_bps: u32,
    pub protocol_paused: bool,
    #[serde(default)]
    pub price_usdc: Option<u64>,
}

/// Mirror of the coordinator's `TallyWithFacts` return of `tally_facts`.
#[derive(
    near_sdk::serde::Serialize, near_sdk::serde::Deserialize, Clone, Debug, PartialEq, Default,
)]
#[serde(crate = "near_sdk::serde")]
pub struct TallyWithFacts {
    pub tally: Tally,
    pub facts: TallyFacts,
}

/// Rhea/Ref — the NEAR DeFi call target for SupplyRhea.
/// (`ref-finance-101.testnet` per SPEC; exact method verified at integration.)
#[ext_contract(ext_rhea)]
pub trait Rhea {
    /// Deposit/supply `amount` of `token` into `market`. Stubbed shape; the real
    /// Ref/Burrow method + gas is wired in Phase 2 (SPEC open J1 item).
    fn supply(&mut self, token: AccountId, amount: U128, market: String);
}

/// Chain Signatures MPC signer — `v1.signer-prod.testnet` per SPEC.
/// The vault requests a secp256k1 signature over the hash of the EVM tx it built.
#[ext_contract(ext_mpc_signer)]
pub trait MpcSigner {
    /// `sign(request)` on the MPC contract. `payload` is the 32-byte hash to sign,
    /// `path` is the derivation path, `key_version` the signer key version.
    fn sign(&mut self, request: SignRequest);
}

/// Argument shape for `v1.signer-prod.testnet::sign`.
#[derive(
    near_sdk::borsh::BorshSerialize,
    near_sdk::borsh::BorshDeserialize,
    near_sdk::serde::Serialize,
    near_sdk::serde::Deserialize,
    Clone,
    Debug,
    PartialEq,
)]
#[borsh(crate = "near_sdk::borsh")]
#[serde(crate = "near_sdk::serde")]
pub struct SignRequest {
    /// 32-byte keccak256 hash of the RLP-encoded EVM tx, hex (no 0x).
    pub payload: Vec<u8>,
    pub path: String,
    pub key_version: u32,
}
