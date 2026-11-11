# YieldAI — End-to-End Demo Report

A fresh user journey run on **NEAR testnet** (+ the protocol mechanism, live and
on-chain). Every link below is independently verifiable.

Networks: NEAR testnet · Ethereum Sepolia. Explorers:
[nearblocks.io (testnet)](https://testnet.nearblocks.io) ·
[sepolia.etherscan.io](https://sepolia.etherscan.io).

---

## 1. A brand-new user wallet (created + funded today)

- **Account:** `demo-user.mandate-arthur.testnet` — created fresh, funded 2 Ⓝ.
- **Creation tx:** https://testnet.nearblocks.io/txns/3s7xoDc1KjeNa1k1XZhPEZxWzEja17nqic7DL3wURtmE

## 2. The user asks the AI for a strategy (plain language → proposal)

Command (runs Mistral server-side via the live API; no key needed locally):

```
$ node cli/src/index.js propose "J'ai 3000 USDC, je vise 7% avec un risque maîtrisé, et un petit appétit pour le cross-chain"
```

Result — **7.25% expected APY · risk Low**:

| Weight | Strategy | Chain | Risk | Source of yield |
|---|---|---|---|---|
| 70% | Rhea | NEAR | 13/100 | Borrowers' variable interest on a USDC money market (no oracle dependency) |
| 30% | Morpho | Ethereum (Sepolia) | 13/100 | USDC supplied to a Morpho market; oracle-dependent, scored accordingly |

> ⚠ Honest caveat returned by the agent: "This strategy remains entirely in USDC lending. For direct exposure to other assets like BTC you would need to manage that separately." — it never invents an unsupported market.

The deterministic risk scores are computed in code (the LLM only explains them).
The proposal maps to an on-chain **mandate**: target 7.00%, max risk 30,
protocols [rhea, morpho-sepolia], chains [near, ethereum-sepolia].

## 3. The user registers the mandate ON-CHAIN (wallet-signed)

```
$ node cli/src/index.js register "…same brief…" --account demo-user.mandate-arthur.testnet
```

- **`register_mandate` tx (signed by the user's own key):**
  https://testnet.nearblocks.io/txns/qLu4oLBAYtnmQRhtvdPrHRC4cxVVnzZCe9oic8rh7Ci
- Contract: `registry.mandate-arthur.testnet` · method `register_mandate` · 0.01 Ⓝ attached.

**Read it back (anyone, no account):**

```
$ node cli/src/index.js portfolio demo-user.mandate-arthur.testnet
  Your registered mandate
    target 7.00% · max risk 30 · protocols [rhea, morpho-sepolia]
```

On-chain registered-mandate count is now **2** (`view_count`).

---

## 4. The protocol mechanism — live and on-chain

These were executed during the build and are **permanently recorded + live-queryable**.
Run the reads yourself; they hit testnet RPC directly.

### Guardians (bonds = insurance) — `coordinator.mandate-arthur.testnet`
```
$ node cli/src/index.js guardians
  g1  g2-marthur.testnet          3.00 Ⓝ  Active
  g2  g3-marthur.testnet          3.00 Ⓝ  Active
  g3  g4-marthur.testnet          3.00 Ⓝ  Active
  g4  g5-marthur.testnet          2.00 Ⓝ  Active
  g5  g1-marthur.testnet          3.00 Ⓝ  Active
  g6  g6.mandate-arthur.testnet   3.00 Ⓝ  Active
  g7  g7.mandate-arthur.testnet   0.00 Ⓝ  SLASHED
```

### Committee decisions (commit→reveal→tally, verified on-chain)
```
$ node cli/src/index.js committee a1      # clean cross-chain action
  drawn:  g5, g1, g2        tally: 3 approvals  THRESHOLD MET
$ node cli/src/index.js committee a2      # manipulated action
  drawn:  g7, g4, g3        tally: 1 approvals  BLOCKED
```
- `a1`: a cross-chain Morpho allocation — committee drew 3 bond-weighted guardians,
  each committed `sha256(report)` then revealed; the contract verified the hashes
  on-chain; 3/3 → executed.
- `a2`: a manipulated action — the corrupt guardian **g7** lied, the two honest
  guardians refused, tally 1/3 → **blocked**. A `FalseAttestation` challenge then
  **slashed g7's 3 Ⓝ bond to 0** and paid the challenger 1.6 Ⓝ.

### Cross-chain landing (NEAR → Chain Signatures → Ethereum Sepolia)
```
$ node cli/src/index.js proof
  committee-gated MPC address:  0x3919100A2079A5447F2514BaF6ABc81e15D179D7
  Sepolia tx (status 0x1):      0x363165ff…4b0a
```
- **Sepolia tx (mined, status 0x1):**
  https://sepolia.etherscan.io/tx/0x363165ff6c712577cd408a658e9e9f4b137ba8d39e03d773af5c71e9ffec4b0a
- A NEAR account, gated by the bonded guardian committee, controls an Ethereum
  address via MPC and made it transact.

---

## 5. Deployed contracts (all live on testnet)

| Contract | Account | Explorer |
|---|---|---|
| Coordinator (registry/bonds/committee/slashing) | `coordinator.mandate-arthur.testnet` | https://testnet.nearblocks.io/address/coordinator.mandate-arthur.testnet |
| Vault (per-mandate, demo) | `demo.vaults.mandate-arthur.testnet` | https://testnet.nearblocks.io/address/demo.vaults.mandate-arthur.testnet |
| Mandate Registry | `registry.mandate-arthur.testnet` | https://testnet.nearblocks.io/address/registry.mandate-arthur.testnet |

Web app: https://yieldai.vercel.app · Repo: https://github.com/abaresks24/yieldai

---

## What is freshly executed today vs. permanently recorded

- **Fresh today (new txs above):** a brand-new user wallet, an AI strategy
  proposal, and a wallet-signed on-chain mandate registration.
- **Executed during the build, permanently on-chain + live-verifiable now:** the
  committee commit/reveal/tally, the slashing of a corrupt guardian, and the
  cross-chain Sepolia landing. (Re-running a fresh committee cycle on the demo
  vault is blocked only by the guardian-rotation rule + testnet faucet limits,
  not by any missing capability — the state above proves it ran.)
- **Documented next step (not yet from the browser):** funding + deploying the
  per-mandate vault from a connected wallet. The full vault lifecycle is proven
  via the `scripts/` + CLI path; the registry step is the real wallet-signed
  on-chain commitment users make today.

## Reproduce the whole thing yourself

```bash
node cli/src/index.js propose "5000 USDC, around 8%, low risk"
node cli/src/index.js guardians
node cli/src/index.js committee a2
node cli/src/index.js proof
node cli/src/index.js portfolio demo-user.mandate-arthur.testnet
```
