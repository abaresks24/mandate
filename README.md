# MANDATE

**Confie ton argent à un agent IA — sans lui faire confiance.**
*Hand your money to an AI agent — without trusting it.*

An AI yield agent whose power is bounded on-chain, whose every cross-chain money
action must be attested by a **randomly-drawn committee of bonded guardians
running in TEEs**, with bonds slashed on provable fault. Built for the NEAR
Hackathon "Build Beyond Boundaries" (track: AI Security & Defense).

## The thesis

Everything verifiable on-chain is decided by the contract. The only thing left
to the guardian committee is the **irreducibly external fact** (cross-chain
state, off-chain price/slippage). There:

> **The TEE proves the right code ran; the bond proves it received the right data.**

The quorum bond must exceed the action value, so the bond is also **insurance**:
if the committee is wrong, the slashed bond makes the user whole.

The vault (templated actions, kill switch) and the reputation registry are built
on **known primitives** (function-call keys, ERC-8004-style reputation). The
novelty is the combination that sits between them: a **randomly-drawn bonded TEE
committee as a fact oracle, with bond-as-insurance (quorum-bond > action-value)**.

## The contrast that explains the whole design

| Action | Chain | Who verifies |
|---|---|---|
| Supply USDC on Rhea | NEAR | the contract alone (it reads the state) |
| Allocate into Morpho | Ethereum Sepolia via Chain Signatures | the committee (the NEAR contract cannot read Sepolia) |

## Architecture

```
            brief (NL)
               │
         ┌─────▼──────┐   proposes ONLY templated actions
         │   AGENT    │   (ActionTemplate enum), never raw calldata
         │ (TS, NEAR  │   risk score = deterministic TS; LLM only explains
         │  AI Cloud) │
         └─────┬──────┘
               │ propose_action  (scoped function-call key)
         ┌─────▼───────────────────────────────┐
         │  VAULT  (per-mandate NEAR sub-acct)  │
         │  • deterministic rule gate (fail-    │   out-of-mandate ⇒ rejected here,
         │    closed: prompt-injection defense) │   NO committee ever contacted
         │  • commit-reveal verify + kill switch│
         └───┬───────────────────────────┬──────┘
             │ NEAR-native (Rhea)         │ cross-chain (Morpho / Sepolia)
             │ contract reads state       │ contract CANNOT read Sepolia
             │                            │
             │                     draw_committee (bond-weighted, random_seed,
             │                     quorum-bond ≥ action-value)
             │                   ┌────────▼─────────┐
             │                   │   COORDINATOR    │  registry • bonds •
             │                   │   (NEAR contract)│  tally • slashing • reputation
             │                   └────────┬─────────┘
             │                            │ request_execution (yield/resume)
             │                   ┌────────▼─────────┐  3× guardian
             │                   │  GUARDIANS       │  commit = sha256(report)
             │                   │  (OutLayer TEE   │  then reveal; deterministic
             │                   │   WASM, wasip2)  │  so a lie is provable → slash
             │                   └────────┬─────────┘
             │                            │ facts (price/slippage/paused)
         ┌───▼────────────────────────────▼──────┐
         │  execute_action: apply facts to rules, │
         │  then execute:                         │
         │   • Rhea call (NEAR), OR               │
         │   • build EVM tx (RLP+keccak, evm.rs)  │──► Chain Signatures
         │     + Chain Signatures secp256k1 sig   │    (v1.signer-prod.testnet)
         └────────────────────────────────────────┘    → Sepolia
```

## Components

- `contracts/coordinator` — guardian registry, bonds, committee draw, attestation tally, slashing, reputation.
- `contracts/vault` — per-mandate user-owned vault: mandate rules, templated actions, commit-reveal, kill switch, and the **real RLP+keccak256 EIP-1559 tx builder** (`src/evm.rs`) for the Chain Signatures payload.
- `guardian` — OutLayer WASM (TEE) that attests external facts via commit-reveal.
- `agent` — brief→mandate service (NEAR AI Cloud, deterministic risk scoring), Agent Market provider.
- `web` — demo UI (runs in mock mode with no chain).

## Tech

NEAR (sub-accounts, function-call keys, `random_seed`, yield/resume),
**Chain Signatures**, **OutLayer** (TEE WASM), **NEAR AI Cloud**,
NEAR Intents 1-Click, Rhea/Ref, **Morpho (Sepolia)**, NEAR AI Agent Market.

---

## Run it OFFLINE in mock mode (clean clone, NO credentials)

AI judges can see the whole thing work on a fresh clone with zero secrets:

```bash
# 1. Contracts: unit + integration tests (includes the real RLP/keccak KATs).
cargo test -p vault          # 40 tests incl. 14 evm RLP/keccak known-answer vectors
cargo test -p coordinator    # draw/tally/slash/quorum-bond invariant
cargo check --target wasm32-unknown-unknown   # both contracts build to wasm

# 2. Agent: deterministic risk scoring + refusal logic, mocked LLM.
cd agent && pnpm install && pnpm test

# 3. Web UI in mock mode (renders every screen with no live chain).
cd web && pnpm install && NEXT_PUBLIC_MOCK=1 pnpm dev   # http://localhost:3000
```

The `evm.rs` tests prove the EVM encoding is correct, not assumed — see
**RLP/keccak known-answer vectors** below.

### RLP / keccak known-answer vectors (proven in `contracts/vault/src/evm.rs`)

| Vector | Input | Expected |
|---|---|---|
| keccak256 empty | `""` | `c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470` |
| keccak256 "abc" | `"abc"` | `4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45` |
| RLP string | `"dog"` | `83646f67` |
| RLP list | `["cat","dog"]` | `c88363617483646f67` |
| RLP uint | `1024` | `820400` |
| RLP uint | `0` | `80` (empty string, not `00`) |
| RLP long string | 56×`'a'` | `b838…` (long-form length prefix) |
| **EIP-1559 unsigned tx** | chainId 11155111, nonce 0, prio 1 gwei, maxFee 20 gwei, gas 100000, to `0x1111…1111`, value 0, data `0x617ba037`, accessList `[]` | RLP `02f083aa36a780843b9aca008504a817c800830186a094 1111…1111 80 84617ba037 c0`; **keccak256 = `dd9c9192c0c310eddd20b2eaa00bc243f9b22d19fb134256c9f621d5ead798e3`** |

The `keccak256("")` vector matches the canonical Ethereum value; the EIP-1559 tx
hash was cross-checked against an independent Python RLP encoder + pycryptodome
keccak256. `signer_payload(tx) = keccak256(0x02 ‖ rlp(unsigned_eip1559_fields))`
is exactly what `v1.signer-prod.testnet` signs with secp256k1 for Sepolia.

---

## CREDENTIALS PREREQUISITES (for the live testnet demo)

| Need | For | How |
|---|---|---|
| Funded NEAR **testnet account** | deploy, vault sub-accounts, guardian bonds | `near account import-account using-web-wallet network-config testnet`; fund at the testnet faucet. Export as `NEAR_ACCOUNT`. |
| **near-cli-rs** | all scripts | https://github.com/near/near-cli-rs |
| `wasm32-unknown-unknown` + `wasm32-wasip2` targets | build contracts + guardian | `rustup target add wasm32-unknown-unknown wasm32-wasip2` |
| **OutLayer worker + stable WASM host** | beats 5/6 live attestation | host `guardian.wasm` on a public gist, pin its raw URL + sha256 (see `scripts/register-guardians.sh`); testnet workers are flaky (issue #32) → pre-warm. |
| **NEAR AI Cloud** API key | beat 1 live brief→mandate | set `NEAR_AI_API_KEY` in `agent/.env` (base `https://cloud-api.near.ai/v1`). |
| NEAR AI Agent Market `aat_` token | agent as provider | `MARKET_AAT_TOKEN` in `agent/.env`. |
| (optional) **mainnet** funds + NEAR Intents | beat 2 real deposit | Intents 1-Click is **mainnet-only** → the repo demo mocks this step. |

### Deploy + demo (testnet)

```bash
export NEAR_ACCOUNT=you.testnet
export AGENT_FC_PUBKEY=ed25519:...        # agent's public key (see agent/.env.example)

scripts/deploy.sh                          # coordinator + demo vault
#   → prints COORDINATOR / DEMO_VAULT; export them.

export GUARDIAN_WASM_URL=... GUARDIAN_WASM_SHA=... G1=.. G2=.. G3=.. G4=.. G5=..
scripts/register-guardians.sh              # 5 bonded guardians (bond = insurance)

export COORDINATOR=... DEMO_VAULT=... MORPHO_MARKET=0x...   # verify at docs.morpho.org/addresses
scripts/demo.sh                            # the 10 beats below
```

---

## Live on NEAR testnet (deployed + verifiable)

| Contract | Account | State |
|---|---|---|
| Coordinator | `coordinator.mandate-arthur.testnet` | 5 guardians registered, 14 NEAR bonded |
| Vault (demo) | `demo.vaults.mandate-arthur.testnet` | initialized, permanent-committee mandate |
| Guardians | `g1..g5-marthur.testnet` | Active, bonds 3/3/3/2/3 NEAR |
| Guardian WASM | [`res/guardian.wasm`](./res/guardian.wasm) | sha256 `1cae595d0eb333dde74740d4ddadf72074d2f3e6ac73211b17d61dc884c72109` |

Verify yourself:
```bash
near contract call-function as-read-only demo.vaults.mandate-arthur.testnet view_mandate json-args '{}' network-config testnet now
near contract call-function as-read-only coordinator.mandate-arthur.testnet view_guardian json-args '{"guardian_id":"g1"}' network-config testnet now
```

## Test it (do X → see Y): the 10-beat walkthrough

Each beat is a command → an observation. Beats touching external services are
**skippable** (`SKIP_AI` / `SKIP_INTENTS` / `SKIP_OUTLAYER`), default-skipped so
`scripts/demo.sh` runs partially offline; `RUN_LIVE=1` clears all skips.

| # | Do | See |
|---|---|---|
| 1 | **Propose a mandate** from a brief (agent + NEAR AI Cloud). `POST /brief`. | A Mandate + ≤2 options + explanation. A "40% APY, no risk" brief is **refused**. *(`SKIP_AI` ⇒ canned mandate baked at deploy.)* |
| 2 | **Deposit USDC** into the vault. | Idle USDC recorded. *(Intents is mainnet-only ⇒ `SKIP_INTENTS` default mocks it.)* |
| 3 | **Propose a Rhea supply** (`SupplyRhea`, NEAR-native). | `propose_action` returns an ActionId after deterministic checks; executes with **NO committee** — the contract reads NEAR state itself. |
| 4 | **Propose an out-of-mandate action** (disallowed protocol). | `propose_action` **PANICS / fails closed**. No guardian is ever contacted — the structural prompt-injection defense. |
| 5 | **Propose a Morpho allocation** (`AllocateCrossChain`, Sepolia). | ActionId returned; `draw_committee` returns a bond-weighted random quorum (and errors `QuorumBondTooLow` if the summed bond can't cover the value). 3 guardians commit→reveal; `tally.threshold_met`; `execute_action` builds the EVM tx (real RLP+keccak) and requests a Chain Signatures signature. *(`SKIP_OUTLAYER` ⇒ manual commit/reveal from the local guardian harness.)* |
| 6 | **A corrupt guardian reveals a tampered report.** | `reveal_report` **PANICS** — `sha256(report) ≠ committed hash`. The report is deterministic, so a lie is provable. |
| 7 | **Slash the corrupt guardian** (`open_challenge` → `resolve_challenge`). | Bond **slashed**; challenger rewarded; the slashed remainder covers the user. Bond = insurance. |
| 8 | **Record the outcome** on job close (`record_outcome`). | `view_reputation` shows the agent's measured track record (realized APY, loss, timeliness). |
| 9 | **Agent emergency exit** (`emergency_exit`). | Positions unwound **toward USDC only**; any non-de-risking direction fails closed. |
| 10 | **Owner kill switch** (`kill_switch`). | Everything repatriated to the owner. **Only** the owner key — not the agent, not a guardian. |

> The hero path (J6 kill-gate): `NEAR → propose cross-chain Morpho action →
> draw_committee → guardian commit via OutLayer → execute via Chain Signatures →
> reveal → tally` is beats 3–7.

## Status

Phase 1 complete (all components build + test green). Phase 2 wires the live
cross-contract + OutLayer + Chain Signatures calls; the `evm.rs` RLP/keccak tx
builder (the Chain Signatures payload) is now **real and tested**, not a stub.
See [PLAN.md](./PLAN.md) and [SPEC.md](./SPEC.md).
