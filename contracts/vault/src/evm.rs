//! EVM transaction construction for `AllocateCrossChain`.
//!
//! The vault — NOT the agent — builds the EVM tx from the validated template,
//! then requests a signature from Chain Signatures (`v1.signer-prod.testnet`).
//! This keeps raw calldata out of the agent's hands (prompt-injection defense):
//! the agent only ever supplies the structured template fields.
//!
//! The RLP encoding + keccak256 of a real EIP-1559 Sepolia tx is a DOCUMENTED
//! STUB here (Phase 2 integration wires a real RLP/keccak lib). The *shape* of
//! what gets built — target market, calldata selector, amount — is fully
//! derived from mandate-validated fields, so the mandate-rule gating is real.

use near_sdk::json_types::U128;

/// A structured, ready-to-sign EVM call. Everything here is derived from the
/// validated `AllocateCrossChain` template; the agent cannot inject arbitrary
/// `to`/`data`.
#[derive(near_sdk::serde::Serialize, near_sdk::serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub struct EvmTx {
    /// Target contract (the Morpho market address from the template).
    pub to: String,
    /// Chain id (Ethereum Sepolia = 11155111).
    pub chain_id: u64,
    /// ABI-encoded calldata (selector + args). STUB: in integration this is the
    /// real Morpho `supply`/`supplyCollateral` encoding.
    pub data: String,
    /// Value in wei (0 for ERC-20 supply flows).
    pub value: String,
    /// Amount being allocated, in USDC 6-dp (carried for logging/attestation).
    pub amount_usdc: U128,
}

/// Ethereum Sepolia chain id.
pub const SEPOLIA_CHAIN_ID: u64 = 11_155_111;

/// Build the EVM tx for a cross-chain allocation. Pure function of the
/// mandate-validated template fields.
///
/// `market` is the destination contract address (validated upstream to live on
/// an allowed chain/protocol); `amount` is the USDC notional.
pub fn build_allocate_tx(market: &str, amount: U128) -> EvmTx {
    // DOCUMENTED STUB: real impl ABI-encodes the Morpho supply call and later
    // RLP-encodes + keccak256-hashes the full EIP-1559 tx for the signer payload.
    // The deterministic selector below marks the intended Morpho `supply(...)`.
    let calldata = format!("0x617ba037{:0>64x}", amount.0); // 0x617ba037 = supply(...) placeholder selector
    EvmTx {
        to: market.to_string(),
        chain_id: SEPOLIA_CHAIN_ID,
        data: calldata,
        value: "0".to_string(),
        amount_usdc: amount,
    }
}

/// Compute the 32-byte signer payload for an `EvmTx`.
///
/// DOCUMENTED STUB: real impl is `keccak256(rlp_encode(eip1559_fields))`. Here we
/// return a deterministic 32-byte digest so the signing request is well-formed
/// and tests are reproducible, without pulling an RLP/keccak dependency into the
/// contract wasm before integration.
pub fn signer_payload(tx: &EvmTx) -> Vec<u8> {
    use near_sdk::env::sha256;
    let preimage = format!("{}|{}|{}|{}", tx.chain_id, tx.to, tx.data, tx.value);
    sha256(preimage.as_bytes())
}
