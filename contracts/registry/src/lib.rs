//! MANDATE — Mandate Registry.
//!
//! A tiny standalone contract so a user can, from their own NEAR wallet, sign a
//! transaction that records the AI-proposed mandate they chose, on-chain, under
//! their own account. This is the wallet-signed "Launch" step: it is a real,
//! user-authored on-chain commitment. Funding + deploying the per-mandate vault
//! (proven via the deploy scripts / CLI) is the next step in the full product.
//!
//! The mandate is stored as the canonical JSON string (same shape as the Vault's
//! `Mandate`) so the registry stays decoupled from the vault's Rust types and
//! the web app can round-trip it verbatim.

use near_sdk::store::IterableMap;
use near_sdk::{env, near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault};

/// Minimum deposit to cover state storage for one registered mandate (~1KB).
const MIN_STORAGE: NearToken = NearToken::from_millinear(10); // 0.01 NEAR

#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
enum StorageKey {
    Mandates,
}

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct RegisteredMandate {
    pub owner: AccountId,
    /// Canonical Mandate JSON (same shape as the Vault's `Mandate`).
    pub mandate_json: String,
    /// Short human label for the chosen strategy (e.g. "USDC 8% low risk").
    pub label: String,
    /// Block timestamp (ns) of the latest registration.
    pub registered_at_ns: u64,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Registry {
    owner: AccountId,
    mandates: IterableMap<AccountId, RegisteredMandate>,
}

#[near]
impl Registry {
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            owner,
            mandates: IterableMap::new(StorageKey::Mandates),
        }
    }

    /// Register (or replace) the caller's mandate. Wallet-signed by the user.
    #[payable]
    pub fn register_mandate(&mut self, mandate_json: String, label: String) {
        require!(
            env::attached_deposit() >= MIN_STORAGE,
            "attach at least 0.01 NEAR to cover storage"
        );
        require!(mandate_json.len() <= 4096, "mandate_json too large");
        let who = env::predecessor_account_id();
        let rec = RegisteredMandate {
            owner: who.clone(),
            mandate_json,
            label,
            registered_at_ns: env::block_timestamp(),
        };
        let first = self.mandates.insert(who.clone(), rec).is_none();
        env::log_str(&format!(
            "mandate {} for {}",
            if first { "registered" } else { "updated" },
            who
        ));
    }

    /// Read a given account's registered mandate, if any.
    pub fn view_my_mandate(&self, account: AccountId) -> Option<RegisteredMandate> {
        self.mandates.get(&account).cloned()
    }

    /// How many distinct accounts have registered a mandate (for the Overview).
    pub fn view_count(&self) -> u32 {
        self.mandates.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    fn ctx(who: AccountId, deposit: NearToken) -> VMContextBuilder {
        let mut b = VMContextBuilder::new();
        b.predecessor_account_id(who).attached_deposit(deposit);
        b
    }

    #[test]
    fn register_then_read() {
        testing_env!(ctx(accounts(0), NearToken::from_near(0)).build());
        let mut r = Registry::new(accounts(0));
        testing_env!(ctx(accounts(1), NearToken::from_millinear(10)).build());
        r.register_mandate("{\"target_apy_bps\":800}".into(), "USDC 8% low".into());
        let got = r.view_my_mandate(accounts(1)).unwrap();
        assert_eq!(got.owner, accounts(1));
        assert_eq!(got.label, "USDC 8% low");
        assert_eq!(r.view_count(), 1);
    }

    #[test]
    #[should_panic(expected = "attach at least 0.01 NEAR")]
    fn rejects_no_deposit() {
        testing_env!(ctx(accounts(0), NearToken::from_near(0)).build());
        let mut r = Registry::new(accounts(0));
        testing_env!(ctx(accounts(1), NearToken::from_near(0)).build());
        r.register_mandate("{}".into(), "x".into());
    }

    #[test]
    fn update_overwrites() {
        testing_env!(ctx(accounts(0), NearToken::from_near(0)).build());
        let mut r = Registry::new(accounts(0));
        testing_env!(ctx(accounts(1), NearToken::from_millinear(10)).build());
        r.register_mandate("{\"a\":1}".into(), "v1".into());
        r.register_mandate("{\"a\":2}".into(), "v2".into());
        assert_eq!(r.view_my_mandate(accounts(1)).unwrap().label, "v2");
        assert_eq!(r.view_count(), 1);
    }
}
