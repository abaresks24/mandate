#!/usr/bin/env bash
# MANDATE — the 10-beat demo runner.
#
# The thesis in one run: everything on-chain is decided by the contract; the one
# irreducibly-external fact (Sepolia state) is attested by a randomly-drawn
# bonded TEE committee, and the bond is insurance (quorum-bond > action-value).
#
# ---------------------------------------------------------------------------
# What needs live services vs what runs offline
# ---------------------------------------------------------------------------
# Beats 1,3,5,6,7,8,9,10 are pure NEAR contract calls — fully runnable on testnet.
# Beats that touch EXTERNAL services are gated by env flags and SKIPPED by default
# so the script runs partially without those credentials:
#   SKIP_AI=1        beat 1  brief->mandate via NEAR AI Cloud (needs NEAR_AI_API_KEY).
#                    Skipped => uses the canned mandate from deploy.sh.
#   SKIP_INTENTS=1   beat 2  the USDC deposit via NEAR Intents 1-Click.
#                    Intents is MAINNET-ONLY (SPEC) => DEFAULT SKIP; uses a mock
#                    deposit (direct testnet USDC transfer / recorded idle balance).
#   SKIP_OUTLAYER=1  beats 5/6 guardian execution via OutLayer request_execution.
#                    Skipped => commit/reveal are posted manually to the coordinator
#                    with a locally-run guardian report (see guardian/ local harness),
#                    which is enough to show the committee + tally + slash flow.
#
# Set RUN_LIVE=1 to clear all three skips (requires every credential below).
#
# Required env (from deploy.sh output):
#   COORDINATOR, DEMO_VAULT, NEAR_ACCOUNT, NETWORK (default testnet)
# For the cross-chain beat:
#   MORPHO_MARKET   Morpho market address on Sepolia (verify at docs.morpho.org/addresses)
#
# This script does NOT run in the build env (no near-cli). Run after deploy.sh +
# register-guardians.sh.

set -euo pipefail

NETWORK="${NETWORK:-testnet}"
: "${COORDINATOR:?run deploy.sh first and export COORDINATOR}"
: "${DEMO_VAULT:?run deploy.sh first and export DEMO_VAULT}"
: "${NEAR_ACCOUNT:?export NEAR_ACCOUNT}"
MORPHO_MARKET="${MORPHO_MARKET:-0x0000000000000000000000000000000000000000}"

if [[ "${RUN_LIVE:-0}" == "1" ]]; then
  SKIP_AI=0; SKIP_INTENTS=0; SKIP_OUTLAYER=0
else
  SKIP_AI="${SKIP_AI:-1}"
  SKIP_INTENTS="${SKIP_INTENTS:-1}"   # Intents is mainnet-only => default mock
  SKIP_OUTLAYER="${SKIP_OUTLAYER:-1}"
fi

call()  { near contract call-function as-transaction "$1" "$2" json-args "$3" \
            prepaid-gas "${5:-30 Tgas}" attached-deposit "${4:-0 NEAR}" \
            sign-as "${6:-$NEAR_ACCOUNT}" network-config "$NETWORK" sign-with-keychain send; }
view()  { near contract call-function as-read-only "$1" "$2" json-args "$3" \
            network-config "$NETWORK" now; }
beat()  { echo; echo "================ BEAT $1 ================"; echo "$2"; }

# ---------------------------------------------------------------------------
beat 1 "Propose a mandate from a natural-language brief (agent + NEAR AI Cloud)."
if [[ "$SKIP_AI" == "1" ]]; then
  echo "[SKIP_AI] Using the canned mandate baked into the demo vault at deploy time."
  echo "          (Live path: POST /brief to the agent service, which calls NEAR AI"
  echo "           Cloud and REFUSES unrealistic briefs like '40% no risk'.)"
else
  echo "Hitting the agent service /brief (NEAR_AI_API_KEY must be set in agent/.env)."
  curl -sS -X POST "${AGENT_URL:-http://localhost:8787}/brief" \
    -H 'content-type: application/json' \
    -d '{"brief":"grow my 5k USDC at low risk, prefer blue-chip lending"}' | tee /tmp/mandate.json
  echo
  echo "Try the refusal: a '40% APY no risk' brief must be rejected by the agent."
fi

# ---------------------------------------------------------------------------
beat 2 "Deposit USDC into the vault."
if [[ "$SKIP_INTENTS" == "1" ]]; then
  echo "[SKIP_INTENTS] NEAR Intents 1-Click is MAINNET-ONLY (SPEC). Mocking the deposit:"
  echo "  the vault records idle USDC directly (testnet has no Intents endpoint)."
  # Mock deposit: in the demo we treat idle_usdc as seeded; a real testnet path
  # would ft_transfer_call a testnet USDC into the vault. Shown for the record:
  echo "  (real testnet alt) near contract call-function as-transaction <USDC> ft_transfer_call ..."
else
  echo "Live: build a NEAR Intents 1-Click deposit quote and submit it (mainnet)."
fi

# ---------------------------------------------------------------------------
beat 3 "Agent proposes a NEAR-native Rhea supply (CONTRACT-ONLY verification)."
echo "This is in-mandate and on NEAR, so the contract reads state itself — NO committee."
call "$DEMO_VAULT" propose_action \
  '{"template":{"kind":"SupplyRhea","token":"usdc","amount":"1000000000","market":"ref-finance-101.testnet"}}'
echo "Observe: an ActionId is returned; propose_action validated protocol/chain/cap deterministically."

# ---------------------------------------------------------------------------
beat 4 "Prompt-injection / out-of-mandate proposal is REJECTED without any committee."
echo "A disallowed protocol must fail CLOSED inside propose_action (structural defense)."
set +e
call "$DEMO_VAULT" propose_action \
  '{"template":{"kind":"AllocateCrossChain","chain":"ethereum-sepolia","protocol":"EVIL","market":"'"$MORPHO_MARKET"'","amount":"1000000000","max_slippage_bps":50}}'
echo "Observe: the call PANICS (protocol not in allowed_protocols). No guardian was ever contacted."
set -e

# ---------------------------------------------------------------------------
beat 5 "Agent proposes a cross-chain Morpho allocation (COMMITTEE REQUIRED)."
echo "The NEAR contract cannot read Sepolia, so a bonded committee must attest the facts."
ACTION=$(call "$DEMO_VAULT" propose_action \
  '{"template":{"kind":"AllocateCrossChain","chain":"ethereum-sepolia","protocol":"morpho","market":"'"$MORPHO_MARKET"'","amount":"1000000000","max_slippage_bps":50}}')
echo "Returned: $ACTION  (export ACTION_ID=<id> for the next beats)"
: "${ACTION_ID:?set ACTION_ID to the id printed above before continuing}"

echo "Draw the committee (bond-weighted, random_seed, quorum-bond MUST cover action value):"
view "$COORDINATOR" draw_committee \
  '{"vault_id":"'"$DEMO_VAULT"'","action_id":"'"$ACTION_ID"'","action_value_usdc":"1000000000"}' || \
  echo "If this returns QuorumBondTooLow, raise guardian bonds in register-guardians.sh."

if [[ "$SKIP_OUTLAYER" == "1" ]]; then
  echo "[SKIP_OUTLAYER] Not calling OutLayer request_execution. Instead post an HONEST"
  echo "  commit/reveal from a locally-run guardian report (guardian/ local harness)."
  echo "  commit = sha256(canonical_json(report)); then reveal the same report."
  # Example manual commit/reveal (values come from the local guardian harness):
  echo "  call $COORDINATOR submit_commit  {action_id, guardian_id, commit_hash, outlayer_proof}"
  echo "  call $COORDINATOR reveal_report  {action_id, guardian_id, report_json}"
else
  echo "Live: vault requests OutLayer execution (WASM pinned by url+sha256), TEE commits,"
  echo "      yield/resume callback lands the commit, then reveal."
fi

echo "Tally the attestations:"
view "$COORDINATOR" tally '{"action_id":"'"$ACTION_ID"'"}'
echo "If threshold_met, execute: the vault builds the EVM tx (RLP+keccak, evm.rs) and"
echo "requests a Chain Signatures secp256k1 signature (v1.signer-prod.testnet) for Sepolia."
call "$DEMO_VAULT" execute_action '{"action_id":"'"$ACTION_ID"'"}' '0 NEAR' '100 Tgas'

# ---------------------------------------------------------------------------
beat 6 "A CORRUPT guardian's attestation is blocked by commit-reveal."
echo "A revealed report whose sha256 != the earlier commit is rejected by reveal_report."
echo "(Deterministic report: same inputs+block => same bytes, so a lie is provable.)"
set +e
call "$COORDINATOR" reveal_report \
  '{"action_id":"'"$ACTION_ID"'","guardian_id":"'"${BAD_GUARDIAN:-g5}"'","report_json":"{\"approve\":true,\"tampered\":true}"}'
echo "Observe: PANIC — reveal does not match the committed hash."
set -e

# ---------------------------------------------------------------------------
beat 7 "Slash the corrupt guardian — bond pays the user (bond = insurance)."
echo "Open a challenge (payable: challenger deposit), proving the fault, then resolve."
call "$COORDINATOR" open_challenge \
  '{"action_id":"'"$ACTION_ID"'","guardian_id":"'"${BAD_GUARDIAN:-g5}"'","fault":"FalseAttestation","proof_json":"{...}"}' \
  '1 NEAR'
echo "Resolve the challenge (slashes bond if proven, rewards challenger):"
call "$COORDINATOR" resolve_challenge '{"challenge_id":"'"${CHALLENGE_ID:-c1}"'"}'
echo "Observe: guardian bond slashed; challenger rewarded; slashed remainder covers the user."

# ---------------------------------------------------------------------------
beat 8 "Reputation records the outcome on job close."
call "$COORDINATOR" record_outcome \
  '{"vault_id":"'"$DEMO_VAULT"'","outcome":{"action_id":"'"$ACTION_ID"'","realized_apy_bps":780,"loss_bps":0,"on_time":true}}'
view "$COORDINATOR" view_reputation '{"agent_id":"'"$NEAR_ACCOUNT"'"}'

# ---------------------------------------------------------------------------
beat 9 "Agent-triggered emergency exit can ONLY move funds toward USDC/home."
echo "A de-risking direction is allowed; anything else fails closed."
call "$DEMO_VAULT" emergency_exit '{}'
echo "Observe: positions unwound toward USDC; the agent cannot move funds outward here."

# ---------------------------------------------------------------------------
beat 10 "Owner KILL SWITCH repatriates everything to the owner account."
echo "Only the owner key may call this (not the agent, not a guardian)."
call "$DEMO_VAULT" kill_switch '{}' '0 NEAR' '100 Tgas'
view "$DEMO_VAULT" view_positions '{}'
echo
echo "==> Demo complete. On-chain decided the on-chain facts; the committee attested"
echo "    the one Sepolia fact it couldn't; the bond made the user whole on fault."
