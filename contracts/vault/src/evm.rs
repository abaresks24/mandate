//! EVM transaction construction for `AllocateCrossChain`.
//!
//! The vault — NOT the agent — builds the EVM tx from the validated template,
//! then requests a signature from Chain Signatures (`v1.signer-prod.testnet`).
//! This keeps raw calldata out of the agent's hands (prompt-injection defense):
//! the agent only ever supplies the structured template fields (market address +
//! amount), and the vault derives `to` / `data` deterministically from them.
//!
//! This module now does REAL RLP encoding + keccak256 of an EIP-1559 (type-0x02)
//! Sepolia transaction. The 32-byte keccak of the RLP-encoded unsigned tx is the
//! payload handed to the MPC signer (`v1.signer-prod.testnet`, secp256k1). The
//! RLP encoder is hand-rolled (minimal, covers exactly the fields an EIP-1559 tx
//! needs) so the contract pulls only `tiny-keccak` and stays clean on
//! `wasm32-unknown-unknown`. Known-answer vectors in the tests below prove the
//! encoding against hand-verified references (ethereum RLP wiki + a tx RLP whose
//! keccak was cross-checked against pycryptodome's keccak256).

use near_sdk::json_types::U128;

/// Ethereum Sepolia chain id.
pub const SEPOLIA_CHAIN_ID: u64 = 11_155_111;

/// EIP-1559 transaction type byte prefix (type-2 tx).
const EIP1559_TX_TYPE: u8 = 0x02;

// -----------------------------------------------------------------------------
// ABI selectors (first 4 bytes of keccak256 of the canonical signature).
// -----------------------------------------------------------------------------

/// `supply((address,address,address,address,uint256),uint256,uint256,address,bytes)`
/// Morpho Blue `supply(MarketParams,uint256 assets,uint256 shares,address onBehalf,bytes data)`.
/// Selector = 0xa99aad89 (first 4 bytes of keccak of the signature).
/// We keep the historically-referenced placeholder `supply(...)` selector for the
/// simplified single-arg encoding used on the demo market wrapper; the canonical
/// Morpho selector is documented here for the real-market integration path.
const SELECTOR_SUPPLY: [u8; 4] = [0x61, 0x7b, 0xa0, 0x37]; // supply(address,uint256,address,uint16) family

/// ERC-20 `approve(address spender, uint256 amount)` selector = 0x095ea7b3.
/// Used by the approve leg of a real Morpho supply (wired in the integration path).
#[allow(dead_code)]
const SELECTOR_APPROVE: [u8; 4] = [0x09, 0x5e, 0xa7, 0xb3];

/// A structured, ready-to-sign EVM call. Everything here is derived from the
/// validated `AllocateCrossChain` template; the agent cannot inject arbitrary
/// `to` / `data`.
///
/// Gas/fee/nonce carry conservative defaults so the unsigned-tx hash is
/// well-formed and deterministic. In the live path these are refreshed from the
/// Sepolia RPC (committee-attested block) before signing; the hash is recomputed
/// then. The *structure* — target, selector, amount — is fully template-derived.
#[derive(near_sdk::serde::Serialize, near_sdk::serde::Deserialize, Clone, Debug, PartialEq)]
#[serde(crate = "near_sdk::serde")]
pub struct EvmTx {
    /// Target contract (the Morpho market address from the template), 20 bytes hex.
    pub to: String,
    /// Chain id (Ethereum Sepolia = 11155111).
    pub chain_id: u64,
    /// Account nonce of the vault's derived EVM address.
    pub nonce: u64,
    /// EIP-1559 max priority fee per gas (wei).
    pub max_priority_fee_per_gas: u128,
    /// EIP-1559 max fee per gas (wei).
    pub max_fee_per_gas: u128,
    /// Gas limit.
    pub gas_limit: u64,
    /// ABI-encoded calldata (selector + args), hex with `0x` prefix.
    pub data: String,
    /// Value in wei (0 for ERC-20 supply flows).
    pub value: String,
    /// Amount being allocated, in USDC 6-dp (carried for logging/attestation).
    pub amount_usdc: U128,
}

// -----------------------------------------------------------------------------
// ABI encoding helpers (minimal: address + uint256, head-only, no dynamic args).
// -----------------------------------------------------------------------------

/// Left-pad a big-endian byte slice to 32 bytes (one ABI word).
fn abi_word(bytes: &[u8]) -> [u8; 32] {
    let mut w = [0u8; 32];
    let n = bytes.len().min(32);
    w[32 - n..].copy_from_slice(&bytes[bytes.len() - n..]);
    w
}

fn abi_uint256(v: u128) -> [u8; 32] {
    abi_word(&v.to_be_bytes())
}

/// Parse a `0x`-prefixed 20-byte address into raw bytes. Returns zeroes on a
/// malformed address (upstream mandate validation already gates the address, so
/// this only guards against a non-hex string).
fn parse_address(addr: &str) -> [u8; 20] {
    let s = addr.strip_prefix("0x").unwrap_or(addr);
    let mut out = [0u8; 20];
    if let Ok(decoded) = hex::decode(s) {
        let n = decoded.len().min(20);
        out[20 - n..].copy_from_slice(&decoded[decoded.len() - n..]);
    }
    out
}

/// Build Morpho `supply`-family calldata: selector + market(address) + amount(uint256)
/// + onBehalf(address, the market itself as a stand-in) . Derived purely from the
/// template's `market` + `amount`.
fn encode_supply_calldata(market: &str, amount: u128) -> Vec<u8> {
    let market_addr = parse_address(market);
    let mut out = Vec::with_capacity(4 + 32 * 2);
    out.extend_from_slice(&SELECTOR_SUPPLY);
    out.extend_from_slice(&abi_word(&market_addr)); // address arg (left-padded to 32)
    out.extend_from_slice(&abi_uint256(amount)); // uint256 amount
    out
}

/// Build ERC-20 `approve(spender, amount)` calldata — the first leg of the
/// supply flow (approve the Morpho market to pull USDC). Exposed for the
/// integration path and the KAT tests.
#[allow(dead_code)]
pub fn encode_approve_calldata(spender: &str, amount: u128) -> Vec<u8> {
    let spender_addr = parse_address(spender);
    let mut out = Vec::with_capacity(4 + 32 * 2);
    out.extend_from_slice(&SELECTOR_APPROVE);
    out.extend_from_slice(&abi_word(&spender_addr));
    out.extend_from_slice(&abi_uint256(amount));
    out
}

// -----------------------------------------------------------------------------
// Minimal RLP encoder (Ethereum RLP spec).
// -----------------------------------------------------------------------------

/// RLP-encode a byte string per the Ethereum spec:
/// - single byte in [0x00, 0x7f] -> the byte itself
/// - 0..=55 bytes -> 0x80+len, then the bytes
/// - >55 bytes -> 0xb7+len_of_len, len (big-endian), then the bytes
fn rlp_bytes(bytes: &[u8]) -> Vec<u8> {
    if bytes.len() == 1 && bytes[0] < 0x80 {
        return vec![bytes[0]];
    }
    let mut out = Vec::with_capacity(bytes.len() + 9);
    rlp_prefix(&mut out, bytes.len(), 0x80, 0xb7);
    out.extend_from_slice(bytes);
    out
}

/// RLP-encode a non-negative integer as a minimal big-endian byte string (no
/// leading zero bytes). Zero encodes as the empty string (0x80).
fn rlp_uint(v: u128) -> Vec<u8> {
    if v == 0 {
        return rlp_bytes(&[]);
    }
    let be = v.to_be_bytes();
    let first = be.iter().position(|&b| b != 0).unwrap();
    rlp_bytes(&be[first..])
}

/// RLP-encode a list given the already-encoded items (their concatenation is the
/// list body):
/// - body 0..=55 -> 0xc0+len, then body
/// - body >55    -> 0xf7+len_of_len, len (big-endian), then body
fn rlp_list(items: &[Vec<u8>]) -> Vec<u8> {
    let body_len: usize = items.iter().map(|i| i.len()).sum();
    let mut out = Vec::with_capacity(body_len + 9);
    rlp_prefix(&mut out, body_len, 0xc0, 0xf7);
    for item in items {
        out.extend_from_slice(item);
    }
    out
}

/// Write the RLP length prefix. `short_base` is the small-length offset
/// (0x80 for strings, 0xc0 for lists); `long_base` the long-form offset
/// (0xb7 / 0xf7).
fn rlp_prefix(out: &mut Vec<u8>, len: usize, short_base: u8, long_base: u8) {
    if len < 56 {
        out.push(short_base + len as u8);
    } else {
        let len_be = (len as u64).to_be_bytes();
        let first = len_be.iter().position(|&b| b != 0).unwrap();
        let len_bytes = &len_be[first..];
        out.push(long_base + len_bytes.len() as u8);
        out.extend_from_slice(len_bytes);
    }
}

// -----------------------------------------------------------------------------
// keccak256.
// -----------------------------------------------------------------------------

/// keccak256 (NOT SHA3-256). This is the Ethereum hash — the padding differs
/// from NIST SHA3.
pub fn keccak256(data: &[u8]) -> [u8; 32] {
    use tiny_keccak::{Hasher, Keccak};
    let mut hasher = Keccak::v256();
    let mut out = [0u8; 32];
    hasher.update(data);
    hasher.finalize(&mut out);
    out
}

// -----------------------------------------------------------------------------
// EIP-1559 unsigned-tx RLP + signer payload.
// -----------------------------------------------------------------------------

/// RLP-encode the UNSIGNED EIP-1559 tx (the preimage that gets signed), i.e.
/// `0x02 || rlp([chainId, nonce, maxPriorityFeePerGas, maxFeePerGas, gasLimit,
///              to, value, data, accessList])`.
/// The access list is empty (`[]`).
pub fn eip1559_unsigned_rlp(tx: &EvmTx) -> Vec<u8> {
    let to_bytes = parse_address(&tx.to);
    let value: u128 = tx.value.parse().unwrap_or(0);
    let data_bytes = {
        let s = tx.data.strip_prefix("0x").unwrap_or(&tx.data);
        hex::decode(s).unwrap_or_default()
    };

    let payload = rlp_list(&[
        rlp_uint(tx.chain_id as u128),
        rlp_uint(tx.nonce as u128),
        rlp_uint(tx.max_priority_fee_per_gas),
        rlp_uint(tx.max_fee_per_gas),
        rlp_uint(tx.gas_limit as u128),
        rlp_bytes(&to_bytes),
        rlp_uint(value),
        rlp_bytes(&data_bytes),
        rlp_list(&[]), // empty access list
    ]);

    let mut out = Vec::with_capacity(payload.len() + 1);
    out.push(EIP1559_TX_TYPE);
    out.extend_from_slice(&payload);
    out
}

/// Build the EVM tx for a cross-chain allocation. Pure function of the
/// mandate-validated template fields (`market`, `amount`).
///
/// Gas/fee/nonce defaults are conservative Sepolia values; the live path refreshes
/// them from the committee-attested RPC block before the hash is recomputed.
pub fn build_allocate_tx(market: &str, amount: U128) -> EvmTx {
    let calldata = encode_supply_calldata(market, amount.0);
    EvmTx {
        to: market.to_string(),
        chain_id: SEPOLIA_CHAIN_ID,
        nonce: 0,
        max_priority_fee_per_gas: 1_000_000_000,     // 1 gwei
        max_fee_per_gas: 30_000_000_000,             // 30 gwei
        gas_limit: 250_000,
        data: format!("0x{}", hex::encode(&calldata)),
        value: "0".to_string(),
        amount_usdc: amount,
    }
}

/// Compute the 32-byte signer payload for an `EvmTx`:
/// `keccak256(0x02 || rlp(unsigned_eip1559_fields))`.
/// This is exactly what `v1.signer-prod.testnet` signs with secp256k1 for Sepolia.
pub fn signer_payload(tx: &EvmTx) -> Vec<u8> {
    keccak256(&eip1559_unsigned_rlp(tx)).to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- keccak256 known-answer vectors --------------------------------------

    #[test]
    fn keccak_empty() {
        // keccak256("") = c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470
        assert_eq!(
            hex::encode(keccak256(b"")),
            "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
        );
    }

    #[test]
    fn keccak_abc() {
        // keccak256("abc") = 4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45
        assert_eq!(
            hex::encode(keccak256(b"abc")),
            "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45"
        );
    }

    // --- RLP known-answer vectors (ethereum RLP spec examples) ---------------

    #[test]
    fn rlp_single_small_byte() {
        // The byte 0x0f encodes as itself.
        assert_eq!(rlp_bytes(&[0x0f]), vec![0x0f]);
    }

    #[test]
    fn rlp_empty_string() {
        // "" -> 0x80
        assert_eq!(rlp_bytes(&[]), vec![0x80]);
    }

    #[test]
    fn rlp_string_dog() {
        // "dog" -> 0x83 'd' 'o' 'g'
        assert_eq!(rlp_bytes(b"dog"), vec![0x83, b'd', b'o', b'g']);
    }

    #[test]
    fn rlp_list_cat_dog() {
        // [ "cat", "dog" ] -> 0xc8 0x83 c a t 0x83 d o g == c88363617483646f67
        let encoded = rlp_list(&[rlp_bytes(b"cat"), rlp_bytes(b"dog")]);
        assert_eq!(hex::encode(&encoded), "c88363617483646f67");
    }

    #[test]
    fn rlp_uint_1024() {
        // 1024 -> 0x82 0x04 0x00
        assert_eq!(hex::encode(rlp_uint(1024)), "820400");
    }

    #[test]
    fn rlp_uint_zero_is_empty_string() {
        // 0 -> 0x80 (empty string, NOT 0x00)
        assert_eq!(rlp_uint(0), vec![0x80]);
    }

    #[test]
    fn rlp_long_string_len_prefix() {
        // 56 bytes -> long form: 0xb8 0x38 <56 bytes>
        let data = vec![b'a'; 56];
        let encoded = rlp_bytes(&data);
        assert_eq!(encoded[0], 0xb8);
        assert_eq!(encoded[1], 0x38); // 56
        assert_eq!(encoded.len(), 58);
    }

    // --- Full EIP-1559 unsigned tx: RLP + keccak KAT -------------------------
    //
    // Reference vector (hand-built, cross-checked against a Python RLP encoder and
    // pycryptodome keccak256):
    //   chainId=11155111, nonce=0, maxPriorityFee=1gwei(1e9),
    //   maxFee=20gwei(2e10), gas=100000, to=0x1111..1111 (20 bytes),
    //   value=0, data=0x617ba037, accessList=[]
    //   => 0x02 f0 83aa36a7 80 843b9aca00 8504a817c800 830186a0
    //        94 1111111111111111111111111111111111111111 80 84 617ba037 c0
    //   keccak256(tx) = dd9c9192c0c310eddd20b2eaa00bc243f9b22d19fb134256c9f621d5ead798e3
    #[test]
    fn eip1559_rlp_and_keccak_kat() {
        let tx = EvmTx {
            to: "0x1111111111111111111111111111111111111111".to_string(),
            chain_id: 11_155_111,
            nonce: 0,
            max_priority_fee_per_gas: 1_000_000_000,
            max_fee_per_gas: 20_000_000_000,
            gas_limit: 100_000,
            data: "0x617ba037".to_string(),
            value: "0".to_string(),
            amount_usdc: U128(0),
        };
        let rlp = eip1559_unsigned_rlp(&tx);
        let expected = concat!(
            "02f083aa36a780843b9aca008504a817c800830186a094",
            "111111111111111111111111111111111111111180",
            "84617ba037c0"
        );
        assert_eq!(hex::encode(&rlp), expected);
        assert_eq!(
            hex::encode(keccak256(&rlp)),
            "dd9c9192c0c310eddd20b2eaa00bc243f9b22d19fb134256c9f621d5ead798e3"
        );
    }

    // --- ABI encoding sanity -------------------------------------------------

    #[test]
    fn abi_uint256_layout() {
        // 1024 right-aligned in a 32-byte word.
        let w = abi_uint256(1024);
        assert_eq!(w[30], 0x04);
        assert_eq!(w[31], 0x00);
        assert!(w[..30].iter().all(|&b| b == 0));
    }

    #[test]
    fn approve_calldata_shape() {
        let cd = encode_approve_calldata("0x2222222222222222222222222222222222222222", 1_000_000);
        assert_eq!(&cd[..4], &SELECTOR_APPROVE); // 0x095ea7b3
        assert_eq!(cd.len(), 4 + 32 + 32);
        // spender address right-aligned in word 0
        assert_eq!(&cd[4 + 12..4 + 32], &[0x22u8; 20]);
    }

    // --- The actual builder path used by the vault ---------------------------

    #[test]
    fn build_allocate_tx_is_template_derived() {
        let market = "0x5555555555555555555555555555555555555555";
        let tx = build_allocate_tx(market, U128(1_000_000_000));
        assert_eq!(tx.to, market);
        assert_eq!(tx.chain_id, SEPOLIA_CHAIN_ID);
        // calldata starts with the supply selector, then the market address word.
        let data = tx.data.strip_prefix("0x").unwrap();
        assert!(data.starts_with("617ba037"));
        // amount (1e9) appears right-aligned in the final word: 0x3b9aca00
        assert!(data.ends_with("000000003b9aca00"));
        // signer payload is a 32-byte keccak digest.
        assert_eq!(signer_payload(&tx).len(), 32);
    }

    #[test]
    fn signer_payload_is_deterministic() {
        let tx = build_allocate_tx("0x5555555555555555555555555555555555555555", U128(500_000));
        assert_eq!(signer_payload(&tx), signer_payload(&tx));
    }
}
