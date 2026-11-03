#!/usr/bin/env bash
# MANDATE — deploy the coordinator + a demo vault to NEAR testnet.
#
# Prereqs:
#   - near-cli-rs installed            (https://github.com/near/near-cli-rs)
#   - rustup target add wasm32-unknown-unknown
#   - a funded testnet account you control (NEAR_ACCOUNT), logged in:
#         near account import-account using-web-wallet network-config testnet
#
# Required env vars:
#   NEAR_ACCOUNT   your testnet root account, e.g. mandate.testnet  (pays for everything)
#   NETWORK        defaults to testnet
#
# Derived accounts (created by this script as sub-accounts of NEAR_ACCOUNT):
#   coordinator.$NEAR_ACCOUNT          the global coordinator contract
#   vaults.$NEAR_ACCOUNT               the vaults factory namespace (plain account)
#   demo.vaults.$NEAR_ACCOUNT          one demo vault instance
#
# This script does NOT run here (near-cli is not installed in the build env).
# Run it yourself after logging in. It is idempotent-ish: re-running after a
# partial failure may need you to delete the half-created sub-accounts first.

set -euo pipefail

NETWORK="${NETWORK:-testnet}"
: "${NEAR_ACCOUNT:?set NEAR_ACCOUNT to your funded testnet account, e.g. mandate.testnet}"

COORDINATOR="coordinator.${NEAR_ACCOUNT}"
VAULTS_NS="vaults.${NEAR_ACCOUNT}"
DEMO_VAULT="demo.${VAULTS_NS}"

# Agent FC key + agent account: the vault's new() needs the agent's PUBLIC key.
# Generate a dedicated key for the agent (see agent/.env.example AGENT_FC_KEY).
: "${AGENT_FC_PUBKEY:?set AGENT_FC_PUBKEY to the agent public key, ed25519:...}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Building contracts (release, wasm32-unknown-unknown)"
( cd "$ROOT" && cargo build -p coordinator --release --target wasm32-unknown-unknown )
( cd "$ROOT" && cargo build -p vault       --release --target wasm32-unknown-unknown )

COORD_WASM="$ROOT/target/wasm32-unknown-unknown/release/coordinator.wasm"
VAULT_WASM="$ROOT/target/wasm32-unknown-unknown/release/vault.wasm"
test -f "$COORD_WASM"
test -f "$VAULT_WASM"

echo "==> 1. Create + deploy coordinator ($COORDINATOR)"
near account create-account fund-myself "$COORDINATOR" '10 NEAR' \
  autogenerate-new-keypair save-to-keychain \
  sign-as "$NEAR_ACCOUNT" network-config "$NETWORK" sign-with-keychain send

near contract deploy "$COORDINATOR" \
  use-file "$COORD_WASM" \
  with-init-call new json-args "{\"owner\": \"$NEAR_ACCOUNT\"}" \
  prepaid-gas '100 Tgas' attached-deposit '0 NEAR' \
  network-config "$NETWORK" sign-with-keychain send

echo "==> 2. Create the vaults factory namespace account ($VAULTS_NS)"
near account create-account fund-myself "$VAULTS_NS" '5 NEAR' \
  autogenerate-new-keypair save-to-keychain \
  sign-as "$NEAR_ACCOUNT" network-config "$NETWORK" sign-with-keychain send

echo "==> 3. Create + deploy a demo vault ($DEMO_VAULT)"
near account create-account fund-myself "$DEMO_VAULT" '5 NEAR' \
  autogenerate-new-keypair save-to-keychain \
  sign-as "$VAULTS_NS" network-config "$NETWORK" sign-with-keychain send

# Mandate: committee PERMANENT (threshold 0). See SPEC.md "Mandate".
MANDATE_JSON=$(cat <<JSON
{
  "owner": "$NEAR_ACCOUNT",
  "target_apy_bps": 800,
  "max_risk_score": 60,
  "allowed_protocols": ["rhea", "morpho"],
  "allowed_chains": ["near", "ethereum-sepolia"],
  "max_share_per_protocol_bps": 5000,
  "max_loss_bps": 300,
  "daily_cap_usdc": "5000000000",
  "committee_threshold_usdc": "0"
}
JSON
)

INIT_ARGS=$(cat <<JSON
{
  "owner": "$NEAR_ACCOUNT",
  "mandate": $MANDATE_JSON,
  "coordinator": "$COORDINATOR",
  "agent_fc_key": "$AGENT_FC_PUBKEY"
}
JSON
)

near contract deploy "$DEMO_VAULT" \
  use-file "$VAULT_WASM" \
  with-init-call new json-args "$INIT_ARGS" \
  prepaid-gas '100 Tgas' attached-deposit '0 NEAR' \
  network-config "$NETWORK" sign-with-keychain send

echo
echo "==> Done."
echo "    COORDINATOR = $COORDINATOR"
echo "    DEMO_VAULT  = $DEMO_VAULT"
echo
echo "Next: scripts/register-guardians.sh to populate the bonded committee."
echo "Export these for demo.sh:"
echo "    export COORDINATOR=$COORDINATOR DEMO_VAULT=$DEMO_VAULT NEAR_ACCOUNT=$NEAR_ACCOUNT"
