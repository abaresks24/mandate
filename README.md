# YieldAI

**Confie ton argent à un agent IA — sans lui faire confiance.**
*Hand your money to an AI agent — without trusting it.*

An AI yield agent whose power is bounded on-chain, whose every cross-chain money
action must be attested by a **randomly-drawn committee of bonded guardians
running in TEEs**, with bonds slashed on provable fault. Built for the NEAR
Hackathon "Build Beyond Boundaries" (track: AI Security & Defense).

**Live demo:** https://yieldai.vercel.app (reads the live testnet
contracts) · **Repo:** https://github.com/abaresks24/yieldai

## Use it from your terminal (CLI)

The protocol is usable programmatically — same AI proposal + on-chain pipeline, from a shell. No install, no API key (AI calls go through the live endpoint; reads hit testnet RPC directly):

```bash
node cli/src/index.js propose "5000 USDC, around 8%, low risk"   # AI-proposed strategy + risk breakdown
node cli/src/index.js guardians                                  # guardian roster, bonds, slashings (g7 = SLASHED)
node cli/src/index.js committee a2                               # a committee draw + tally (a2 = 1/3, BLOCKED)
node cli/src/index.js portfolio <account.testnet>               # a user's on-chain mandate + demo vault
node cli/src/index.js proof                                      # the live cross-chain Sepolia proof
node cli/src/index.js register "USDC ~7%" --account you.testnet  # propose + sign register_mandate (needs near-cli-rs)
```

`register` signs a real on-chain `register_mandate` transaction via your `near-cli-rs` keychain. Everything else is read-only and needs no account.

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

---

## ✅ Live on NEAR testnet + Ethereum Sepolia (verify it yourself)

Everything below is deployed and was executed on real networks — not a sandbox,
not a mock.

### Deployed contracts

| Contract | Account |
|---|---|
| Coordinator | `coordinator.mandate-arthur.testnet` |
| Vault (demo) | `demo.vaults.mandate-arthur.testnet` |
| Guardians | `g1..g5-marthur.testnet`, `g6/g7.mandate-arthur.testnet` (7 registered, bonded) |
| Guardian WASM | [`res/guardian.wasm`](./res/guardian.wasm), sha256 `1cae595d0eb333dde74740d4ddadf72074d2f3e6ac73211b17d61dc884c72109` |

```bash
# Read live on-chain state (no wallet needed):
near contract call-function as-read-only demo.vaults.mandate-arthur.testnet view_mandate json-args '{}' network-config testnet now
near contract call-function as-read-only coordinator.mandate-arthur.testnet view_committee json-args '{"action_id":"a1"}' network-config testnet now
near contract call-function as-read-only coordinator.mandate-arthur.testnet tally json-args '{"action_id":"a2"}' network-config testnet now   # 1/3, blocked
near contract call-function as-read-only coordinator.mandate-arthur.testnet view_guardian json-args '{"guardian_id":"g7"}' network-config testnet now   # Slashed
```

### The full hero path, executed on-chain

| Step | On-chain result |
|---|---|
| Brief → mandate (live LLM) | realistic brief → proposed mandate + risk explanation; **"40% APY, no risk" → refused** (`UNREALISTIC_APY`) |
| Out-of-mandate action (prompt-injection) | **rejected by the vault, committee never contacted** |
| Valid cross-chain Morpho action | ActionId `a1` created |
| Committee draw | `a1 → [g5,g1,g2]`, bond-weighted + rotation, quorum-bond>value invariant enforced |
| Commit → reveal | 3 commits, 3 reveals; `sha256(report)` verified **on-chain** |
| Tally | `a1` **3/3 met** → `execute_action` **Executed** (facts applied, EVM tx built via real RLP+keccak, Chain Signatures MPC sign requested) |
| Slashing | corrupt `g7` lies → honest `g4,g3` refuse → `a2` tally **1/3 BLOCKED** → `FalseAttestation` challenge → **g7 bond slashed, challenger paid 1.6 NEAR** |
| Kill switch | **everything repatriated to owner** |
| **Cross-chain landing** | **MPC-signed tx mined on Ethereum Sepolia, status `0x1`** |

**Cross-chain proof:** the committee-gated MPC address
`0x3919100A2079A5447F2514BaF6ABc81e15D179D7` sent
[tx `0x363165ff…4b0a`](https://sepolia.etherscan.io/tx/0x363165ff6c712577cd408a658e9e9f4b137ba8d39e03d773af5c71e9ffec4b0a)
on Sepolia. A NEAR account, gated by a bonded randomly-drawn guardian committee,
controls an address on another chain via MPC and makes it transact. *(This
landing tx is a self-send proving the pipeline; a funded Morpho supply would
additionally need Sepolia USDC + a live market — Sepolia's post-EOL archive
tooling made sourcing one impractical.)*

---

## Architecture

```
            brief (NL)
               │
         ┌─────▼──────┐   proposes ONLY templated actions
         │   AGENT    │   (ActionTemplate enum), never raw calldata
         │ (TS, LLM   │   risk score = deterministic TS; LLM only explains
         │  provider) │   LLM = NEAR AI Cloud (TEE) or any OpenAI-compatible (Mistral)
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
- `agent` — brief→mandate service (deterministic risk scoring; LLM only explains), Agent Market provider.
- `web` — demo UI; reads live on-chain state by default (`NEXT_PUBLIC_MOCK=1` for an offline mock mode).

## Tech

NEAR (sub-accounts, function-call keys, `random_seed`, yield/resume),
**Chain Signatures**, **OutLayer** (TEE WASM), NEAR Intents 1-Click, Rhea/Ref,
**Morpho (Sepolia)**, NEAR AI Agent Market. The LLM is **any OpenAI-compatible
provider**: **NEAR AI Cloud** (adds TEE inference / brief privacy) or **Mistral**
(used in the live demo). The LLM is deliberately *out* of the money-critical path.

---

## Run it OFFLINE (clean clone, NO credentials)

AI judges can see the core work on a fresh clone with zero secrets:

```bash
# Contracts: unit + integration tests (incl. real RLP/keccak KATs + near-workspaces sandbox e2e).
cargo test -p coordinator -p vault -p guardian     # 73 tests
cargo test -p integration                          # 2 sandbox e2e (spins up a real neard)
cargo check --target wasm32-unknown-unknown        # contracts build to wasm

# Agent: deterministic risk scoring + refusal logic (LLM mocked in tests).
cd agent && pnpm install && pnpm test              # 27 tests

# Web UI (reads live testnet by default; mock mode here needs no chain):
cd web && pnpm install && NEXT_PUBLIC_MOCK=1 pnpm dev   # http://localhost:3000
```

### RLP / keccak known-answer vectors (proven in `contracts/vault/src/evm.rs`)

| Vector | Input | Expected |
|---|---|---|
| keccak256 empty | `""` | `c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470` |
| keccak256 "abc" | `"abc"` | `4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45` |
| RLP string / list / uint | `"dog"` / `["cat","dog"]` / `1024` / `0` | `83646f67` / `c88363617483646f67` / `820400` / `80` |
| **EIP-1559 unsigned tx** | chainId 11155111, nonce 0, prio 1 gwei, maxFee 20 gwei, gas 100000, to `0x1111…1111`, value 0, data `0x617ba037` | keccak256 = `dd9c9192c0c310eddd20b2eaa00bc243f9b22d19fb134256c9f621d5ead798e3` |

Cross-checked against an independent Python RLP encoder + pycryptodome keccak256.
`signer_payload(tx) = keccak256(0x02 ‖ rlp(unsigned_eip1559_fields))` is exactly
what `v1.signer-prod.testnet` signs with secp256k1 for Sepolia.

---

## Reproduce the deployment (testnet)

```bash
export NEAR_ACCOUNT=you.testnet                 # funded testnet account (near-cli-rs)
export AGENT_FC_PUBKEY=ed25519:...              # agent public key (see agent/.env.example)
scripts/deploy.sh                               # coordinator + demo vault → prints COORDINATOR / DEMO_VAULT

export COORDINATOR=... GUARDIAN_WASM_URL=... GUARDIAN_WASM_SHA=... G1=.. G2=.. G3=.. G4=.. G5=..
scripts/register-guardians.sh                   # bonded guardians (bond = insurance)

export DEMO_VAULT=... MORPHO_MARKET=0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb
scripts/demo.sh                                 # the 10 beats (external beats skippable: SKIP_AI/SKIP_INTENTS/SKIP_OUTLAYER)
```

Credentials each step needs: a funded testnet account + `near-cli-rs`; the wasm
targets (`rustup target add wasm32-unknown-unknown wasm32-wasip2`); an LLM key in
`agent/.env` (`LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL` — NEAR AI Cloud or Mistral)
for the live brief; OutLayer is free on testnet (no signup); Chain Signatures is a
free public testnet service. NEAR Intents is mainnet-only, so the deposit beat is
mocked in the repo demo.

## Test it (do X → see Y): the 10-beat walkthrough

| # | Do | See |
|---|---|---|
| 1 | **Propose a mandate** from a brief (`POST /brief`, live LLM). | A Mandate + ≤2 options + explanation; a "40% APY, no risk" brief is **refused** (`UNREALISTIC_APY`). |
| 2 | **Deposit USDC** into the vault. | Idle USDC recorded. *(Intents is mainnet-only ⇒ mocked in-repo.)* |
| 3 | **Propose a Rhea supply** (NEAR-native). | ActionId after deterministic checks; executes with **NO committee** — the contract reads NEAR state itself. |
| 4 | **Propose an out-of-mandate action**. | `propose_action` **fails closed**. No guardian contacted — the structural prompt-injection defense. |
| 5 | **Propose a Morpho allocation** (cross-chain). | `draw_committee` → bond-weighted random quorum (errors `QuorumBondTooLow` if under-bonded); 3 guardians commit→reveal; `tally`; `execute_action` builds the EVM tx + requests a Chain Signatures signature. |
| 6 | **A corrupt guardian tampers its report.** | `reveal_report` **fails** — `sha256(report) ≠ commit`. Deterministic reports make a lie provable. |
| 7 | **Slash the corrupt guardian** (`open_challenge` → `resolve_challenge`). | Bond **slashed**; challenger rewarded; the remainder covers the user. Bond = insurance. |
| 8 | **Record the outcome** (`record_outcome`). | `view_reputation` shows the agent's measured track record. |
| 9 | **Agent emergency exit** (`emergency_exit`). | Positions unwound **toward USDC only**; any other direction fails closed. |
| 10 | **Owner kill switch** (`kill_switch`). | Everything repatriated. **Only** the owner key — not the agent, not a guardian. |

> Hero path (the J6 kill-gate), beats 3–7: `NEAR → propose cross-chain action →
> draw_committee → guardian commit via OutLayer → reveal → tally → execute via
> Chain Signatures → Sepolia`.

## Known limits (honest)

- Decentralization is at the **guardian layer** (bonds, diverse implementations,
  diverse data sources), not the TEE infrastructure (trust in OutLayer measures +
  Intel TDX). `random_seed` is slightly biasable by the block producer.
- `FalseAttestation` adjudication compares the revealed fact vs the challenger's
  fact; full signed-source verification is a documented stub. Equivocation and
  unavailability are fully on-chain decidable.
- The agent's kill-switch *write* path from the web UI needs a browser wallet
  signer (Phase 2); the kill switch itself is proven live via CLI.

See [SPEC.md](./SPEC.md) for the on-chain interface spec and
[docs/DEMO_REPORT.md](./docs/DEMO_REPORT.md) for an end-to-end run with tx links.
