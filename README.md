# MANDATE

**Confie ton argent à un agent IA — sans lui faire confiance.**

An AI yield agent whose power is bounded on-chain, whose every cross-chain money action must be attested by a randomly-drawn committee of bonded guardians running in TEEs, with bonds slashed on provable fault. Built for the NEAR Hackathon "Build Beyond Boundaries" (track: AI Security & Defense).

> Status: 🚧 under active construction. See [PLAN.md](./PLAN.md) and [SPEC.md](./SPEC.md).

## The thesis
Everything verifiable on-chain is decided by the contract. The only thing left to the guardian committee is the irreducibly external fact (cross-chain state, off-chain price/slippage). There, **the TEE proves the right code ran; the bond proves it received the right data.** The quorum bond must exceed the action value, so it is also **insurance**: if the committee is wrong, the slashed bond makes the user whole.

## The contrast that explains the whole design
| Action | Chain | Who verifies |
|---|---|---|
| Supply USDC on Rhea | NEAR | the contract alone (it reads the state) |
| Allocate into Morpho | Ethereum Sepolia via Chain Signatures | the committee (the NEAR contract cannot read Sepolia) |

## Components
- `contracts/coordinator` — guardian registry, bonds, committee draw, attestation tally, slashing, reputation.
- `contracts/vault` — per-mandate user-owned vault: mandate rules, templated actions, commit-reveal, kill switch.
- `guardian` — OutLayer WASM (TEE) that attests external facts via commit-reveal.
- `agent` — brief→mandate service (NEAR AI Cloud, deterministic risk scoring), Agent Market provider.
- `web` — demo UI.

## Tech
NEAR (sub-accounts, function-call keys, `random_seed`, yield/resume), **Chain Signatures**, **OutLayer** (TEE WASM), **NEAR AI Cloud**, NEAR Intents 1-Click, Rhea/Ref, **Morpho (Sepolia)**, NEAR AI Agent Market.

## Test it (do X → see Y)
_Filled in during Phase 3. Each step runs on a clean clone; the Intents deposit step is optional/mockable._
