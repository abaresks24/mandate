//! MANDATE Guardian — pure, host-testable core.
//!
//! This crate is split into:
//!   * `lib.rs` (this file) — ALL deterministic logic: SPEC types, canonical
//!     JSON, the sha256 commit, the decision rules and report building. It
//!     depends only on serde/serde_json/sha2/hex and compiles & tests on the
//!     host. The real I/O (NEAR view, HTTP price fetch) is abstracted behind
//!     the [`FactProvider`] trait so tests inject mocks.
//!   * `main.rs` — the thin `wasm32-wasip2` glue: reads OutLayer `input_data`
//!     from stdin, implements `FactProvider` with `wasi-http-client` + a NEAR
//!     JSON-RPC `query`, and writes the output to stdout.
//!
//! Determinism contract: for the same inputs + the same read block the report
//! is byte-identical, so a slasher can re-run the guardian and re-derive the
//! commit hash. Nothing here reads a clock or RNG.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

// ============================================================================
// Thresholds (fixed constants => part of the deterministic rule set)
// ============================================================================

/// USDC is 6-dp fixed point. $1.00 == 1_000_000.
pub const USDC_ONE: i64 = 1_000_000;

/// A price this far from the $1 peg (in bps) trips DEPEG / PRICE_DEVIATION.
pub const PRICE_DEVIATION_BPS: i64 = 100; // 1%

/// Observed slippage above this (bps) rejects the action (SLIPPAGE_HIGH).
pub const SLIPPAGE_MAX_BPS: u32 = 100; // 1%

// ============================================================================
// SPEC types
// ============================================================================

/// `request_execution.input_data` for the guardian.
///
/// `reveal` distinguishes the two calls of the commit/reveal flow:
///   * absent / false  -> first call  -> returns `{ phase:"commit", commit_hash }`
///   * true            -> second call -> returns `{ phase:"reveal", report }`
#[derive(Debug, Clone, Deserialize)]
pub struct GuardianInput {
    pub action_id: String,
    pub template: ActionTemplate,
    pub vault_id: String,
    pub coordinator_rpc: String,
    #[serde(default)]
    pub reveal: bool,
}

/// The only action kinds the agent may propose (SPEC §ActionTemplate).
/// `#[serde(tag = "kind")]` matches the SPEC's `{ "kind": "...", ... }` shape.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum ActionTemplate {
    SupplyRhea {
        token: String,
        amount: String,
        market: String,
    },
    WithdrawToUsdc {
        protocol: String,
    },
    AllocateCrossChain {
        chain: String,
        protocol: String,
        market: String,
        amount: String,
        max_slippage_bps: u32,
    },
    EmergencyExit {
        reason_code: String,
    },
}

/// Fixed reason-code enum (SPEC §ReasonCode). Serialized as the SCREAMING_CASE
/// string the contract/UI switch on.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ReasonCode {
    PriceOk,
    PriceDeviation,
    SlippageOk,
    SlippageHigh,
    ProtocolLive,
    ProtocolPaused,
    Depeg,
    OracleStale,
    CrosschainStateOk,
    CrosschainStateBad,
    DataUnavailable,
}

/// The attested facts block (SPEC §GuardianReport.facts).
/// `price_usdc` is a 6-dp fixed-point decimal string on the target chain at
/// `price_block`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Facts {
    pub price_usdc: String,
    pub price_block: u64,
    pub observed_slippage_bps: u32,
    pub protocol_paused: bool,
}

/// A fact source. `verifiable` marks cryptographically-verifiable sources
/// (e.g. a Pyth signed update) whose payload a slasher can re-check.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Source {
    pub name: String,
    pub verifiable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub payload_ref: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub endpoint: Option<String>,
}

/// The guardian's report (SPEC §GuardianReport). Revealed after execution.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GuardianReport {
    pub action_id: String,
    pub approve: bool,
    pub reason_codes: Vec<ReasonCode>,
    pub facts: Facts,
    pub sources: Vec<Source>,
}

// ============================================================================
// Raw facts gathered from the outside world (what the FactProvider returns)
// ============================================================================

/// The minimal facts a provider must gather. Everything derived from these
/// (deviation, slippage verdict, reason codes, approve) is pure.
#[derive(Debug, Clone)]
pub struct GatheredFacts {
    /// Price on the target chain, 6-dp fixed point (e.g. 1_000_900 == $1.0009).
    pub price_usdc: i64,
    /// Block / slot the price was read at (determinism anchor).
    pub price_block: u64,
    /// Slippage observed against the template's expectation, in bps.
    pub observed_slippage_bps: u32,
    /// Whether the target protocol/market is paused.
    pub protocol_paused: bool,
    /// Sources consulted, in a stable order.
    pub sources: Vec<Source>,
}

/// Abstraction over the real OutLayer/WASI calls. The wasm binary implements
/// this with `wasi-http-client` + NEAR JSON-RPC; tests implement it with
/// canned data. Must be deterministic for a fixed input+block.
pub trait FactProvider {
    fn gather(&self, input: &GuardianInput) -> Result<GatheredFacts, String>;
}

// ============================================================================
// Canonical JSON (stable key order) + sha256 commit
// ============================================================================

/// Serialize `value` to canonical JSON: object keys sorted lexicographically,
/// no insignificant whitespace. serde_json already emits array order as-is and
/// no whitespace in `to_vec`; the only non-determinism it could introduce is
/// map key order, which we fix by walking the `Value` tree and re-sorting.
pub fn canonical_json<T: Serialize>(value: &T) -> Result<Vec<u8>, String> {
    let v = serde_json::to_value(value).map_err(|e| format!("to_value: {e}"))?;
    let canon = canonicalize(v);
    serde_json::to_vec(&canon).map_err(|e| format!("to_vec: {e}"))
}

/// Recursively re-emit a `Value` with every object's keys sorted. serde_json's
/// `Value::Object` is a `BTreeMap` by default (feature `preserve_order` off),
/// so it is already sorted — but we sort explicitly so the guarantee does not
/// silently depend on a serde_json feature flag chosen elsewhere in the tree.
fn canonicalize(v: serde_json::Value) -> serde_json::Value {
    use serde_json::Value;
    match v {
        Value::Object(map) => {
            let mut entries: Vec<(String, Value)> =
                map.into_iter().map(|(k, val)| (k, canonicalize(val))).collect();
            entries.sort_by(|a, b| a.0.cmp(&b.0));
            let mut out = serde_json::Map::new();
            for (k, val) in entries {
                out.insert(k, val);
            }
            Value::Object(out)
        }
        Value::Array(arr) => Value::Array(arr.into_iter().map(canonicalize).collect()),
        other => other,
    }
}

/// `commit = sha256(canonical_json(report))`, lowercase hex (SPEC §commit).
pub fn commit_hash(report: &GuardianReport) -> Result<String, String> {
    let bytes = canonical_json(report)?;
    let digest = Sha256::digest(&bytes);
    Ok(hex::encode(digest))
}

// ============================================================================
// Decision logic (pure) + report building
// ============================================================================

/// Absolute deviation from the $1 peg, in bps, from a 6-dp price.
pub fn deviation_bps(price_usdc: i64) -> i64 {
    let diff = (price_usdc - USDC_ONE).abs();
    // bps = diff / peg * 10_000
    (diff * 10_000) / USDC_ONE
}

/// Build the deterministic report from gathered facts + the input. This is the
/// single source of truth for `approve` and `reason_codes`; the wasm glue only
/// feeds it facts.
pub fn build_report(input: &GuardianInput, facts: &GatheredFacts) -> GuardianReport {
    let mut reason_codes: Vec<ReasonCode> = Vec::new();
    let mut approve = true;

    // --- Price / peg check ---
    let dev = deviation_bps(facts.price_usdc);
    if dev > PRICE_DEVIATION_BPS {
        // A large peg deviation is a depeg; both codes are informative.
        reason_codes.push(ReasonCode::PriceDeviation);
        reason_codes.push(ReasonCode::Depeg);
        approve = false;
    } else {
        reason_codes.push(ReasonCode::PriceOk);
    }

    // --- Slippage check (the key cross-chain guard) ---
    if facts.observed_slippage_bps > SLIPPAGE_MAX_BPS {
        reason_codes.push(ReasonCode::SlippageHigh);
        approve = false;
    } else {
        reason_codes.push(ReasonCode::SlippageOk);
    }

    // --- Protocol liveness ---
    if facts.protocol_paused {
        reason_codes.push(ReasonCode::ProtocolPaused);
        approve = false;
    } else {
        reason_codes.push(ReasonCode::ProtocolLive);
    }

    // --- Cross-chain state sanity (only meaningful for the cross-chain kind) ---
    if let ActionTemplate::AllocateCrossChain {
        max_slippage_bps, ..
    } = &input.template
    {
        // The template carries the caller's own slippage ceiling; honour the
        // tighter of it and our global guard.
        if facts.observed_slippage_bps > *max_slippage_bps {
            // already flagged SlippageHigh above if over the global; make sure
            // it is flagged even when the template ceiling is tighter.
            if !reason_codes.contains(&ReasonCode::SlippageHigh) {
                reason_codes.push(ReasonCode::SlippageHigh);
            }
            approve = false;
        }
        if approve && !facts.protocol_paused && dev <= PRICE_DEVIATION_BPS {
            reason_codes.push(ReasonCode::CrosschainStateOk);
        } else {
            reason_codes.push(ReasonCode::CrosschainStateBad);
        }
    }

    GuardianReport {
        action_id: input.action_id.clone(),
        approve,
        reason_codes,
        facts: Facts {
            price_usdc: facts.price_usdc.to_string(),
            price_block: facts.price_block,
            observed_slippage_bps: facts.observed_slippage_bps,
            protocol_paused: facts.protocol_paused,
        },
        sources: facts.sources.clone(),
    }
}

/// A report built when facts cannot be gathered: fail-closed (approve=false)
/// with a single DATA_UNAVAILABLE code, still deterministic.
pub fn unavailable_report(input: &GuardianInput) -> GuardianReport {
    GuardianReport {
        action_id: input.action_id.clone(),
        approve: false,
        reason_codes: vec![ReasonCode::DataUnavailable],
        facts: Facts {
            price_usdc: "0".to_string(),
            price_block: 0,
            observed_slippage_bps: 0,
            protocol_paused: false,
        },
        sources: vec![],
    }
}

// ============================================================================
// Top-level flow (pure, parameterised over a FactProvider)
// ============================================================================

/// Output of a single guardian invocation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "phase", rename_all = "lowercase")]
pub enum GuardianOutput {
    /// First call: only the hash is published (plaintext hidden by the TEE).
    Commit { commit_hash: String },
    /// Second call: the full plaintext report, re-hashable to the commit.
    Reveal { report: GuardianReport },
}

/// Run one invocation of the commit/reveal flow.
///
/// Both phases gather the *same* facts and build the *same* report; the commit
/// phase returns only its hash, the reveal phase returns the plaintext. Because
/// the report is deterministic for a fixed input+block, the two phases agree.
pub fn run<P: FactProvider>(provider: &P, input: &GuardianInput) -> GuardianOutput {
    let report = match provider.gather(input) {
        Ok(facts) => build_report(input, &facts),
        Err(_) => unavailable_report(input),
    };

    if input.reveal {
        GuardianOutput::Reveal { report }
    } else {
        // `commit_hash` can only fail on a serde error, which cannot happen for
        // our concrete types; fall back to hashing an empty string defensively.
        let hash = commit_hash(&report).unwrap_or_default();
        GuardianOutput::Commit { commit_hash: hash }
    }
}

/// Serialize a [`GuardianOutput`] to canonical JSON bytes (what goes on the
/// wire). Canonical so the commit payload is itself reproducible.
pub fn serialize_output(out: &GuardianOutput) -> Result<Vec<u8>, String> {
    canonical_json(out)
}

// ============================================================================
// Tests (host; run with `cargo test -p guardian`)
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    /// Mock provider: returns exactly the facts it was constructed with.
    struct MockProvider {
        facts: GatheredFacts,
    }

    impl FactProvider for MockProvider {
        fn gather(&self, _input: &GuardianInput) -> Result<GatheredFacts, String> {
            Ok(self.facts.clone())
        }
    }

    struct FailingProvider;
    impl FactProvider for FailingProvider {
        fn gather(&self, _input: &GuardianInput) -> Result<GatheredFacts, String> {
            Err("network down".into())
        }
    }

    fn cross_chain_input() -> GuardianInput {
        GuardianInput {
            action_id: "v12-a7".into(),
            template: ActionTemplate::AllocateCrossChain {
                chain: "ethereum-sepolia".into(),
                protocol: "morpho".into(),
                market: "0xabc".into(),
                amount: "1000000000".into(),
                max_slippage_bps: 50,
            },
            vault_id: "v12.vaults.deployer.testnet".into(),
            coordinator_rpc: "https://test.rpc.fastnear.com".into(),
            reveal: false,
        }
    }

    fn healthy_facts() -> GatheredFacts {
        GatheredFacts {
            price_usdc: 1_000_900, // $1.0009 -> 9 bps deviation, under 100
            price_block: 1_234_567,
            observed_slippage_bps: 12,
            protocol_paused: false,
            sources: vec![
                Source {
                    name: "pyth".into(),
                    verifiable: true,
                    payload_ref: Some("0xdeadbeef".into()),
                    endpoint: None,
                },
                Source {
                    name: "rpc-sepolia".into(),
                    verifiable: false,
                    payload_ref: None,
                    endpoint: Some("https://sepolia.example".into()),
                },
            ],
        }
    }

    // (a) commit_hash == sha256(canonical_json(reveal.report))
    #[test]
    fn commit_matches_reveal() {
        let provider = MockProvider { facts: healthy_facts() };

        let mut commit_input = cross_chain_input();
        commit_input.reveal = false;
        let commit_out = run(&provider, &commit_input);

        let mut reveal_input = cross_chain_input();
        reveal_input.reveal = true;
        let reveal_out = run(&provider, &reveal_input);

        let commit = match commit_out {
            GuardianOutput::Commit { commit_hash } => commit_hash,
            _ => panic!("expected commit phase"),
        };
        let report = match reveal_out {
            GuardianOutput::Reveal { report } => report,
            _ => panic!("expected reveal phase"),
        };

        let rehash = commit_hash(&report).unwrap();
        assert_eq!(commit, rehash, "commit must equal sha256 of revealed report");
        assert_eq!(commit.len(), 64, "sha256 hex is 64 chars");
    }

    // (b) determinism: same input twice -> byte-identical output
    #[test]
    fn deterministic() {
        let provider = MockProvider { facts: healthy_facts() };
        let input = cross_chain_input();

        let a = serialize_output(&run(&provider, &input)).unwrap();
        let b = serialize_output(&run(&provider, &input)).unwrap();
        assert_eq!(a, b, "same input+facts must yield identical bytes");

        // And the reveal report itself is byte-identical.
        let mut ri = cross_chain_input();
        ri.reveal = true;
        let ra = serialize_output(&run(&provider, &ri)).unwrap();
        let rb = serialize_output(&run(&provider, &ri)).unwrap();
        assert_eq!(ra, rb);
    }

    // (c) output <= 900 bytes for both phases
    #[test]
    fn output_within_900_bytes() {
        let provider = MockProvider { facts: healthy_facts() };

        let mut ci = cross_chain_input();
        ci.reveal = false;
        let commit_len = serialize_output(&run(&provider, &ci)).unwrap().len();
        assert!(commit_len <= 900, "commit output {commit_len} > 900 bytes");

        let mut ri = cross_chain_input();
        ri.reveal = true;
        let reveal_len = serialize_output(&run(&provider, &ri)).unwrap().len();
        assert!(reveal_len <= 900, "reveal output {reveal_len} > 900 bytes");
    }

    // (d) approve=false when slippage exceeds the threshold
    #[test]
    fn rejects_high_slippage() {
        let mut facts = healthy_facts();
        facts.observed_slippage_bps = 150; // > SLIPPAGE_MAX_BPS (100) and > template 50
        let provider = MockProvider { facts };

        let mut ri = cross_chain_input();
        ri.reveal = true;
        let report = match run(&provider, &ri) {
            GuardianOutput::Reveal { report } => report,
            _ => unreachable!(),
        };
        assert!(!report.approve, "high slippage must reject");
        assert!(report.reason_codes.contains(&ReasonCode::SlippageHigh));
        assert!(report.reason_codes.contains(&ReasonCode::CrosschainStateBad));
    }

    // extra: template ceiling tighter than global guard still rejects
    #[test]
    fn rejects_slippage_over_template_ceiling() {
        let mut facts = healthy_facts();
        facts.observed_slippage_bps = 80; // under global 100, over template 50
        let provider = MockProvider { facts };
        let mut ri = cross_chain_input();
        ri.reveal = true;
        let report = match run(&provider, &ri) {
            GuardianOutput::Reveal { report } => report,
            _ => unreachable!(),
        };
        assert!(!report.approve, "over template ceiling must reject");
        assert!(report.reason_codes.contains(&ReasonCode::SlippageHigh));
    }

    // extra: depeg rejects
    #[test]
    fn rejects_depeg() {
        let mut facts = healthy_facts();
        facts.price_usdc = 970_000; // $0.97 -> 300 bps -> depeg
        let provider = MockProvider { facts };
        let mut ri = cross_chain_input();
        ri.reveal = true;
        let report = match run(&provider, &ri) {
            GuardianOutput::Reveal { report } => report,
            _ => unreachable!(),
        };
        assert!(!report.approve);
        assert!(report.reason_codes.contains(&ReasonCode::Depeg));
        assert!(report.reason_codes.contains(&ReasonCode::PriceDeviation));
    }

    // extra: paused protocol rejects
    #[test]
    fn rejects_paused() {
        let mut facts = healthy_facts();
        facts.protocol_paused = true;
        let provider = MockProvider { facts };
        let mut ri = cross_chain_input();
        ri.reveal = true;
        let report = match run(&provider, &ri) {
            GuardianOutput::Reveal { report } => report,
            _ => unreachable!(),
        };
        assert!(!report.approve);
        assert!(report.reason_codes.contains(&ReasonCode::ProtocolPaused));
    }

    // extra: happy path approves
    #[test]
    fn approves_healthy() {
        let provider = MockProvider { facts: healthy_facts() };
        let mut ri = cross_chain_input();
        ri.reveal = true;
        let report = match run(&provider, &ri) {
            GuardianOutput::Reveal { report } => report,
            _ => unreachable!(),
        };
        assert!(report.approve);
        assert!(report.reason_codes.contains(&ReasonCode::PriceOk));
        assert!(report.reason_codes.contains(&ReasonCode::SlippageOk));
        assert!(report.reason_codes.contains(&ReasonCode::ProtocolLive));
        assert!(report.reason_codes.contains(&ReasonCode::CrosschainStateOk));
    }

    // extra: failing provider -> fail-closed DATA_UNAVAILABLE
    #[test]
    fn fails_closed_on_provider_error() {
        let provider = FailingProvider;
        let mut ri = cross_chain_input();
        ri.reveal = true;
        let report = match run(&provider, &ri) {
            GuardianOutput::Reveal { report } => report,
            _ => unreachable!(),
        };
        assert!(!report.approve);
        assert_eq!(report.reason_codes, vec![ReasonCode::DataUnavailable]);
    }

    // extra: canonical json is key-order stable regardless of input order
    #[test]
    fn canonical_json_is_sorted() {
        let a: serde_json::Value = serde_json::json!({ "b": 1, "a": 2, "c": { "z": 1, "y": 2 } });
        let bytes = canonical_json(&a).unwrap();
        let s = String::from_utf8(bytes).unwrap();
        assert_eq!(s, r#"{"a":2,"b":1,"c":{"y":2,"z":1}}"#);
    }

    // extra: reason codes serialize as the SPEC's SCREAMING_CASE strings
    #[test]
    fn reason_code_wire_format() {
        let s = serde_json::to_string(&ReasonCode::CrosschainStateOk).unwrap();
        assert_eq!(s, "\"CROSSCHAIN_STATE_OK\"");
        let s = serde_json::to_string(&ReasonCode::SlippageHigh).unwrap();
        assert_eq!(s, "\"SLIPPAGE_HIGH\"");
    }
}
