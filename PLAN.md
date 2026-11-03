# MANDATE — Detailed Dev Plan

Target: NEAR Hackathon "Build Beyond Boundaries", track `security`. Deadline window nov 1–14 2026.
Thesis: trust-minimized AI money management. Spine = randomly-drawn bonded TEE guardian committee that attests cross-chain facts, bond = insurance (quorum-bond > action-value).

## What this repo delivers (local, buildable, tested) vs what needs credentials
- BUILDABLE NOW (agents): coordinator contract, vault contract, guardian WASM, agent service, web UI, tests, README, demo scripts.
- NEEDS USER CREDENTIALS (ping, cannot do autonomously): testnet account creation + funding, OutLayer worker registration, NEAR AI Cloud API key, actual testnet deploy, mainnet Intents real funds, running the live end-to-end demo.

## Build order = by decreasing risk, with a J6 kill-gate

### Phase 0 — scaffold + spec (DONE by orchestrator)
- [x] repo structure, SPEC.md (shared interface), git + GitHub remote.

### Phase 1 — PARALLEL (independent, build against SPEC.md)
- **T1 Coordinator contract** (Rust/near-sdk): guardian registry + bonds, `draw_committee` (random_seed, bond-weighted, rotation, quorum-bond>value invariant), commit/reveal tally, slashing (FalseAttestation/Equivocation/Unavailability) + challenge deposit/reward, reputation registry. Unit tests for every public method + the invariant.
- **T2 Vault contract** (Rust/near-sdk): factory (in coordinator or standalone), per-mandate sub-account, Mandate storage, `propose_action` with deterministic template+rule validation (fails closed — prompt-injection defense), `execute_action` (commit-reveal verify + apply facts + execute), `emergency_exit` (toward-USDC only), `kill_switch` (owner). Unit tests incl. the "out-of-mandate rejected without committee" path.
- **T3 Guardian WASM** (Rust/wasm32-wasip2, outlayer 0.2): two-call commit/reveal, `view()` NEAR reads, `wasi-http-client` fetch (Pyth + Sepolia RPC), deterministic report, ≤900B output. Local harness that runs it without OutLayer (feed inputs, assert report).
- **T4 Agent service** (TS): brief→mandate via NEAR AI Cloud, DETERMINISTIC risk scoring module (+ unit tests), refusal logic, Agent Market provider client (`start`/`submit`, `aat_` token), MCP stub. Mockable LLM for offline tests.
- **T5 Web UI** (Next.js): mandate proposal + explanation, vault/positions view, committee draw + votes + commit/reveal, slashing demo, kill switch. Talks to contracts via near-api-js; mock data mode so it renders without a live chain.

### Phase 2 — INTEGRATION (after Phase 1, orchestrator-led)
- Wire vault ↔ coordinator (draw/tally/slash calls).
- Wire vault ↔ guardian via OutLayer `request_execution` + yield/resume callback.
- Wire vault ↔ Chain Signatures (`v1.signer-prod.testnet`) to build+sign the Sepolia Morpho tx.
- Wire agent ↔ vault FC key (propose_action), agent ↔ Agent Market.
- End-to-end script on testnet for the contrast demo (Rhea vs Morpho).

### Phase 3 — DEMO + POLISH
- README "do X → see Y" (10 beats, must run on a clean clone; Intents step optional/mock).
- Slashing scenario scripted but REAL on testnet.
- Reputation entry on job close. Agent Market auto-`start`.
- Video + X post + submission.

## J6 KILL-GATE (non-negotiable)
By end of J6 the hero path must run end-to-end on testnet:
`NEAR → propose cross-chain Morpho action → draw_committee → guardian commit via OutLayer → execute via Chain Signatures → reveal → tally`.
If it does NOT run end-to-end: CUT slashing-market generality, reputation, MCP, Agent Market auto-accept down to scripted/stub, and polish the hero path only.

## Scope discipline
- Keep templates (structural prompt-injection defense) AND committee (facts) — complementary.
- Committee permanent (threshold=0) for this low-frequency yield agent.
- Delta-neutral CUT (Hyperliquid testnet not signable via Chain Signatures).
- Privacy = one README line (free via NEAR AI Cloud TEE), NOT a pillar.
- Don't over-claim novelty on vault/reputation (built on known primitives incl. ERC-8004-style).

## Open J1 verifications (need live network / credentials)
- Rhea/Burrow lending testnet contract (else Ref pool deposit).
- Live Morpho Sepolia addresses.
- OutLayer allowed HTTP domains + timeouts from WASM.
- OutLayer WASM hosting stability (issue #32) — use stable gist, pre-warm.
