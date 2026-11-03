#!/usr/bin/env bash
# MANDATE — Phase 2 integration test runner.
#
# 1. Builds the coordinator + vault contracts to wasm (release).
# 2. Runs the near-workspaces sandbox integration tests in `integration/`.
#
# The sandbox tests deploy the real wasms into a local `neard` binary that
# near-workspaces downloads on first run. If that download is blocked in your
# environment the tests will fail to START a sandbox; the wasms + the fully
# written tests are still produced, and the Phase 1 unit tests still pass. Set
# NEAR_SANDBOX_BIN_PATH to a prebuilt `neard` to skip the download.

set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Building contracts to wasm (release)…"
if command -v cargo-near >/dev/null 2>&1; then
  cargo near build non-reproducible-wasm --manifest-path contracts/coordinator/Cargo.toml || true
  cargo near build non-reproducible-wasm --manifest-path contracts/vault/Cargo.toml || true
fi
# Always produce the plain cargo wasms the tests read from target/…/release.
cargo build --target wasm32-unknown-unknown --release -p coordinator -p vault

echo "==> wasm artifacts:"
ls -la target/wasm32-unknown-unknown/release/coordinator.wasm \
       target/wasm32-unknown-unknown/release/vault.wasm

echo "==> Compiling integration tests (no run)…"
cargo test -p integration --no-run

echo "==> Running sandbox integration tests…"
echo "    (first run downloads a neard sandbox binary; set NEAR_SANDBOX_BIN_PATH to skip)"
cargo test -p integration -- --nocapture
