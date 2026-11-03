# MANDATE — Shared Interface Spec (the integration contract)

Every component builds against THIS file. If you need to change a signature, change it here first.

## Glossary
- **Coordinator** — one global NEAR contract: guardian registry, bonds, committee draw, attestation tally, slashing, reputation. Account: `coordinator.<deployer>.testnet`.
- **Vault** — one NEAR sub-account per mandate, owned by the user: holds funds, mandate rules, templated actions, commit-reveal verification, kill switch. Account: `<id>.vaults.<deployer>.testnet`.
- **Guardian** — OutLayer WASM (wasm32-wasip2) run in TEE; attests external facts, returns a commit hash then a revealed report.
- **Agent** — off-chain TS service: brief→mandate via NEAR AI Cloud, deterministic risk scoring, Agent Market provider, proposes templated actions.

## Core data types (canonical JSON; Rust mirrors with serde)

### Mandate
```json
{
  "owner": "alice.testnet",
  "target_apy_bps": 800,
  "max_risk_score": 60,
  "allowed_protocols": ["rhea", "morpho-sepolia"],
  "allowed_chains": ["near", "ethereum-sepolia"],
  "max_share_per_protocol_bps": 5000,
  "max_loss_bps": 300,
  "daily_cap_usdc": "5000000000",
  "committee_threshold_usdc": "0"
}
```
`committee_threshold_usdc = 0` → committee is PERMANENT (every external/cross-chain action attested). Threshold kept in the type for flexibility but default 0.

### ActionTemplate (the only things the agent may propose)
```json
{ "kind": "SupplyRhea",      "token": "usdc", "amount": "1000000000", "market": "ref-...testnet" }
{ "kind": "WithdrawToUsdc",  "protocol": "rhea" }
{ "kind": "AllocateCrossChain", "chain": "ethereum-sepolia", "protocol": "morpho", "market": "0x...", "amount": "1000000000", "max_slippage_bps": 50 }
{ "kind": "EmergencyExit",   "reason_code": "DEPEG" }
```
Agent CANNOT construct arbitrary calldata. For cross-chain, the vault builds the EVM tx from the template and signs via Chain Signatures.

### GuardianReport (what the guardian computes in TEE; revealed after execution)
```json
{
  "action_id": "v12-a7",
  "approve": true,
  "reason_codes": ["PRICE_OK","SLIPPAGE_OK","PROTOCOL_LIVE"],
  "facts": {
    "price_usdc": "1000900",            // 6-dp fixed, price on target chain at read block
    "price_block": 1234567,
    "observed_slippage_bps": 12,
    "protocol_paused": false
  },
  "sources": [
    { "name":"pyth", "verifiable":true,  "payload_ref":"0x<signed-update-hash>" },
    { "name":"rpc-sepolia", "verifiable":false, "endpoint":"https://..." }
  ]
}
```
- `commit = sha256(canonical_json(report))` — published at decision time (hides plaintext from everyone incl. the operator; TEE guarantees the operator can't peek).
- The plaintext `report` is revealed after execution; anyone can recompute sha256 and must match the commit.
- `reason_codes` are from the fixed enum below so the contract/UI can act on them.

### ReasonCode enum (fixed)
`PRICE_OK, PRICE_DEVIATION, SLIPPAGE_OK, SLIPPAGE_HIGH, PROTOCOL_LIVE, PROTOCOL_PAUSED, DEPEG, ORACLE_STALE, CROSSCHAIN_STATE_OK, CROSSCHAIN_STATE_BAD, DATA_UNAVAILABLE`

## Coordinator contract — external interface
```
// registry + bonds
register_guardian(wasm_url: String, wasm_sha256: String) -> GuardianId   // payable: bond in NEAR
top_up_bond()                                                            // payable
request_unbond(guardian_id)                                              // starts unbonding delay
view_guardian(guardian_id) -> GuardianInfo

// committee draw (called by a vault when an action needs attestation)
draw_committee(vault_id, action_id, action_value_usdc) -> [GuardianId; 3]
// uses env::random_seed(), bond-weighted, rotation (no guardian twice in a row for same vault).
// INVARIANT: sum(bond of drawn quorum) >= action_value_usdc, else returns Err(QuorumBondTooLow) -> vault splits or refuses.

// attestation lifecycle (committee commits, then reveals)
submit_commit(action_id, guardian_id, commit_hash: String, outlayer_proof: Bytes)
reveal_report(action_id, guardian_id, report_json: String)   // contract checks sha256(report)==commit
tally(action_id) -> Tally { approvals: u8, threshold_met: bool }

// slashing
open_challenge(action_id, guardian_id, fault: FaultKind, proof_json: String)  // payable: challenger deposit
resolve_challenge(challenge_id)   // slashes if proven; rewards challenger; else refunds
// FaultKind: FalseAttestation | Equivocation | Unavailability

// reputation (measured outcomes, appended by vault on job close)
record_outcome(vault_id, OutcomeRecord)
view_reputation(agent_id) -> ReputationSummary
view_guardian_history(guardian_id) -> GuardianHistory
```

## Vault contract — external interface
```
new(owner, mandate: Mandate, coordinator: AccountId, agent_fc_key)
propose_action(template: ActionTemplate) -> ActionId      // only callable by agent FC key; validates template is allowed+within deterministic rules BEFORE touching committee
// deterministic checks here: protocol allowed, chain allowed, amount<=daily cap, share<=max_share. Fails closed (prompt-injection demo).
execute_action(action_id)   // after tally.threshold_met: applies committee facts to mandate rules, then executes (Rhea call OR Chain Signatures EVM tx). Verifies reveal matches commit.
emergency_exit()            // agent may trigger; can ONLY move funds toward USDC/home
kill_switch()               // owner only: repatriate everything to owner account
view_positions() -> Positions
view_action(action_id) -> ActionState
```

## Guardian WASM — entry + behavior
- Built for `wasm32-wasip2`, crate `outlayer = "0.2"`.
- Input (from `request_execution.input_data`): `{ action_id, template, vault_id, coordinator_rpc }`.
- Reads NEAR state via a JSON-RPC `query` (request_type `call_function`) over `wasi-http-client` — NOTE: the outlayer SDK has NO `near::rpc::view()` host fn (corrected after T3 verified docs.rs); only `storage`/`env`/`vrf` modules exist. Entrypoint is `fn main()` with stdin/stdout via `outlayer::env::input()/output()`. Fetches external facts via `wasi-http-client` (prefer cryptographically verifiable sources: Pyth Hermes signed updates, Sepolia RPC with block number).
- Output ≤ ~900 bytes: `{ phase:"commit", commit_hash }` on first call; `{ phase:"reveal", report }` on reveal call. (Two-call flow; keep each under the yield/resume ~1KB payload limit.)
- Deterministic: same inputs + same block → same report (so slashers can re-derive).

## Agent service — behavior
- `POST /brief` → NEAR AI Cloud (OpenAI-compatible, base `https://cloud-api.near.ai/v1`, model pulled from `/v1/models`) → proposes a Mandate + ≤2 allocation options with explanation; REFUSES unrealistic ("40% no risk").
- Risk score is DETERMINISTIC (audits, TVL, age, exploit history, oracle dependency, yield source) computed in TS, not by the LLM; LLM only explains it.
- Agent Market: register as provider (self-hosted, `aat_` token), poll `GET /v1/agents/me/assignments`, accept via `POST /v1/assignments/{id}/start` (NOT `accept`), deliver via `POST /v1/assignments/{id}/submit`. MCP endpoint `https://market.near.ai/mcp`.
- Holds only a function-call key scoped to its vault; proposes templates, never raw tx.

## Verified external facts (do not re-derive from memory)
- OutLayer: `request_execution(source:{WasmUrl:{url,hash,build_target:"wasm32-wasip2"}}, input_data, limits, secrets)`; result via NEAR yield/resume `.then()`. NO `worker.outlayer.near` contract (workers are off-chain TDX nodes). NO `estimate_execution_cost` — budget via `X-Compute-Limit` header + auto refund. Limits: `max_execution_seconds` default 60/max 180. Testnet instability (issue #32) → host WASM on a stable gist, pre-warm the version.
- Chain Signatures: MPC signer `v1.signer-prod.testnet`, default EVM target Sepolia, signs standard secp256k1 EVM txs.
- Morpho: usable WETH/USDC market on **Ethereum Sepolia** (Base Sepolia is bare). Verify live addresses on https://docs.morpho.org/morpho/addresses/ at build.
- Rhea/Ref testnet: exchange `ref-finance-101.testnet`; verify Burrow lending testnet J1, else use Ref pool deposit.
- NEAR Intents 1-Click: MAINNET ONLY (no testnet) → make the deposit step optional/mockable for the repo demo.

## Demo thesis (the contrast table)
| Action | Chain | Who verifies |
|---|---|---|
| SupplyRhea (USDC) | NEAR testnet | contract alone (reads state) |
| AllocateCrossChain (Morpho) | Ethereum Sepolia via Chain Signatures | committee required (contract can't read Sepolia) |
