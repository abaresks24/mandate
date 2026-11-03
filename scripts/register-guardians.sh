#!/usr/bin/env bash
# MANDATE — register 5 bonded guardians in the coordinator.
#
# Each guardian is an OutLayer WASM (wasm32-wasip2) that the coordinator pins by
# (wasm_url, wasm_sha256). register_guardian is #[payable]: the attached deposit
# is the guardian's BOND. Bond = insurance: draw_committee only succeeds if the
# drawn quorum's summed bond covers the action's USD value, so bigger bonds = more
# draw weight AND more coverage.
#
# ---------------------------------------------------------------------------
# WHY A GIST (SPEC: OutLayer testnet instability, issue #32)
# ---------------------------------------------------------------------------
# OutLayer testnet workers fetch the WASM by URL at execution time and verify its
# sha256 against what the coordinator stored. Testnet workers are flaky about
# re-fetching, so we host the guardian WASM at a STABLE raw-gist URL and pre-warm
# it (run one throwaway request_execution) before the demo. Steps:
#
#   1. Build the guardian for wasm32-wasip2:
#        cargo build -p guardian --release --target wasm32-wasip2
#      -> target/wasm32-wasip2/release/guardian.wasm
#
#   2. Compute its sha256 (this exact value is what the coordinator pins):
#        shasum -a 256 target/wasm32-wasip2/release/guardian.wasm   # macOS
#        sha256sum     target/wasm32-wasip2/release/guardian.wasm   # linux
#
#   3. Create a PUBLIC gist with the wasm as a file and copy the RAW url:
#        gh gist create --public target/wasm32-wasip2/release/guardian.wasm
#      then open the gist, click "Raw" on guardian.wasm, copy that URL. The raw
#      URL is version-pinned (contains a commit sha) — paste it as GUARDIAN_WASM_URL
#      so the pinned sha256 never drifts.
#
#   4. Pre-warm once before demoing (optional but recommended per issue #32).
#
# All 5 guardians can point at the SAME wasm_url+sha256 (same code; different
# accounts/bonds/TEE instances) — that is the normal committee topology.
#
# ---------------------------------------------------------------------------
# Required env vars
# ---------------------------------------------------------------------------
#   COORDINATOR         coordinator account (from deploy.sh)
#   NETWORK             defaults to testnet
#   GUARDIAN_WASM_URL   stable RAW gist URL to guardian.wasm
#   GUARDIAN_WASM_SHA   its sha256 (hex, from step 2)
#   G1..G5              five testnet accounts you control to act AS each guardian
#                       (each must be funded enough to attach its bond)
# Optional:
#   BONDS               space-separated bonds, default "3 3 3 2 2" (NEAR).
#                       Sum (13 NEAR) must exceed the demo Morpho action value so
#                       draw_committee's quorum-bond invariant passes.
#
# Does NOT run in the build env (no near-cli). Run after deploy.sh.

set -euo pipefail

NETWORK="${NETWORK:-testnet}"
: "${COORDINATOR:?set COORDINATOR (see deploy.sh output)}"
: "${GUARDIAN_WASM_URL:?set GUARDIAN_WASM_URL to the stable raw-gist URL}"
: "${GUARDIAN_WASM_SHA:?set GUARDIAN_WASM_SHA to the wasm sha256}"
: "${G1:?set G1..G5 to five testnet accounts you control}"
: "${G2:?}"; : "${G3:?}"; : "${G4:?}"; : "${G5:?}"

read -r -a GUARDIANS <<< "$G1 $G2 $G3 $G4 $G5"
read -r -a BOND_LIST <<< "${BONDS:-3 3 3 2 2}"

for i in "${!GUARDIANS[@]}"; do
  G="${GUARDIANS[$i]}"
  BOND="${BOND_LIST[$i]:-2}"
  echo "==> Registering guardian $((i+1)): $G  (bond ${BOND} NEAR)"
  near contract call-function as-transaction "$COORDINATOR" register_guardian \
    json-args "{\"wasm_url\": \"$GUARDIAN_WASM_URL\", \"wasm_sha256\": \"$GUARDIAN_WASM_SHA\"}" \
    prepaid-gas '30 Tgas' attached-deposit "${BOND} NEAR" \
    sign-as "$G" network-config "$NETWORK" sign-with-keychain send
done

echo
echo "==> Registered ${#GUARDIANS[@]} guardians. Verify:"
echo "    near contract call-function as-read-only $COORDINATOR view_guardian \\"
echo "      json-args '{\"guardian_id\": \"<id>\"}' network-config $NETWORK now"
