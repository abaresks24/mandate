# HANDOFF — continue YieldAI from here

> Read this first. It is written for the next developer **and their AI coding
> agent** (Claude Code). It explains what the project is, what is already done
> and deployed, how to run and ship every part, the exact demo runbook, and the
> traps I already hit so you don't repeat them.

YieldAI is a NEAR-hackathon project (track: **AI Security & Defense**): an AI
agent proposes on-chain yield strategies, but its power is **bounded by an
on-chain mandate**, and every cross-chain money move is attested by a
**randomly-drawn committee of bonded guardians running in TEEs** (lie → bond
slashed, and quorum-bond > action-value so lying is never profitable).

- **Live app:** https://yieldai-fi.vercel.app
- **GitHub:** https://github.com/abaresks24/yieldai
- Product README (user-facing): [`README.md`](README.md) · Interface spec:
  [`SPEC.md`](SPEC.md) · End-to-end demo proof: [`docs/DEMO_REPORT.md`](docs/DEMO_REPORT.md)

---

## 1. Status: what works, what's left

**Done and live**
- Full web app (Next.js 14, App Router, TypeScript, Tailwind) deployed on Vercel.
  - Landing (scrollytelling), Docs, and the app: **Overview** (live DefiLlama
    market universe + Morpho-style filters), **Earn** (AI strategy proposal →
    customize deposit amount + allocation weights with live-recomputed APY /
    risk / charts → Launch), Portfolio.
- NEAR testnet contracts deployed: coordinator, a demo vault, registry.
- Guardian committee mechanism: commit-reveal, bond-as-insurance, slashing. One
  guardian is actually SLASHED on-chain; one committee draw is BLOCKED on a 1/3
  minority — both verifiable (see the CLI `guardians` / `committee` commands).
- Real cross-chain proof: a NEAR account signed and **landed a real Ethereum
  Sepolia transaction via Chain Signatures** (MPC), mined, status `0x1`.
- Rust contract tests + TS agent tests pass (`cargo test`, `agent: pnpm test`).
- Dependency-free CLI mirrors the web flow from a terminal.

**Not done / where to take it next** (see §8 for detail)
- The web **Launch** button only *registers the mandate JSON* on-chain (0.01 Ⓝ
  deposit, no token transfer). The full execution path (vault deposit → agent
  proposes a templated action → committee attests → Chain-Signatures executes on
  Sepolia) exists in contracts/scripts but is **not wired to a single UI click**;
  it was demonstrated via scripts. Wiring it end-to-end in the UI is the main
  remaining feature.
- The Sepolia leg in the UI is a **pre-recorded proof** (a real mined tx hash in
  `web/src/lib/near.ts`), not re-triggered live.
- Deposit amount is a USD figure; optional nicety: enter asset units (e.g.
  "0.5 BTC") with a spot-price conversion.

---

## 2. Repo map

```
contracts/        Rust (near-sdk) smart contracts
  coordinator/      guardian registry, bonds, committee draw, attestation tally, slashing
  vault/            per-mandate vault: rules, templated actions, commit-reveal, kill switch
  registry/         the mandate registry the web Launch writes to
guardian/         OutLayer TEE WASM (wasm32-wasip2): attests external facts, commit→reveal
agent/            off-chain TS service: brief→mandate, deterministic risk scoring, market provider
  src/server.ts     HTTP server (POST /brief), default :8787
integration/      Rust integration tests across contracts
web/              the Next.js app (this is what's deployed on Vercel)
  src/app/          routes: / (landing), /docs, /app, /app/earn, /app/portfolio, /api/*
  src/lib/earn/     strategy engine: propose.ts, universe.ts (DefiLlama), risk.ts, llm.ts, apy.ts
  src/lib/near.ts   NEAR config + deployed account IDs + the cross-chain proof constant
  src/components/   UI (StrategyVisuals.tsx = charts; wallet/ = near-wallet-selector)
cli/              node CLI (dependency-free): src/index.js
scripts/          deploy.sh, demo.sh, register-guardians.sh, integration-test.sh
docs/DEMO_REPORT.md   the verifiable end-to-end demo writeup
SPEC.md           the shared interface contract (change signatures HERE first)
```

The whole monorepo is a Cargo workspace (`Cargo.toml` at root) for the Rust side,
plus independent `pnpm` projects under `web/` and `agent/`.

---

## 3. Deployed addresses (NEAR testnet + Sepolia)

Deployer root account: **`mandate-arthur.testnet`**.

| What | Account / value |
|---|---|
| Coordinator contract | `coordinator.mandate-arthur.testnet` |
| Demo vault | `demo.vaults.mandate-arthur.testnet` |
| Mandate registry (web Launch target) | `registry.mandate-arthur.testnet` |
| Demo user | `demo-user.mandate-arthur.testnet` |
| Guardians | `g1`…`g7` (list live with `node cli/src/index.js guardians`; g7 = SLASHED) |
| MPC-derived EVM address | `0x3919100A2079A5447F2514BaF6ABc81e15D179D7` |
| Sepolia proof tx (mined, `0x1`) | `0x363165ff6c712577cd408a658e9e9f4b137ba8d39e03d773af5c71e9ffec4b0a` |

Explorers: [testnet.nearblocks.io](https://testnet.nearblocks.io) ·
[sepolia.etherscan.io](https://sepolia.etherscan.io). These IDs are the defaults
in `web/src/lib/near.ts` (overridable via `NEXT_PUBLIC_*` env).

---

## 4. Secrets & environment — IMPORTANT

**Never commit secrets.** They are gitignored and live only in two places:
- `web/.env.local` and `agent/.env` (both gitignored) for local dev.
- **Vercel project env vars** for production.

The only secret the app needs is the **LLM key** (the risk score is deterministic
and never touches the LLM; the model only *explains* it and drafts text):

| Var | Value | Where |
|---|---|---|
| `LLM_BASE_URL` | `https://api.mistral.ai/v1` | Vercel env + `agent/.env` + `web/.env.local` |
| `LLM_API_KEY`  | the Mistral key (ask Arthur / already set in Vercel) | same — **server-side only, no `NEXT_PUBLIC_` prefix** |
| `LLM_MODEL`    | `ministral-14b-latest` | same |

- The key is read server-side in `web/src/lib/earn/llm.ts` via `process.env`, so
  it is never bundled to the browser. The `/api/propose` and `/api/refine` routes
  are the only callers.
- Any OpenAI-compatible endpoint works (see `agent/.env.example` — NEAR AI Cloud
  is an alternative that adds TEE inference). To swap providers, change the three
  vars, nothing else.
- Do **not** commit the Vercel CLI auth token (`~/Library/Application Support/com.vercel.cli/auth.json`).

---

## 5. Run it locally

**Web** (the main thing):
```bash
cd web
pnpm install
cp .env.example .env.local   # then add LLM_BASE_URL / LLM_API_KEY / LLM_MODEL
pnpm dev                      # http://localhost:3000
pnpm lint && pnpm build       # must both be clean before any deploy
```
Without the LLM vars, browsing works but `/app/earn` proposals return an error.
The Overview market table needs no key (DefiLlama is public).

**CLI** (no install, no key — AI calls go through the live app, reads hit testnet RPC):
```bash
node cli/src/index.js chat                              # interactive propose + refine
node cli/src/index.js propose "5000 USDC, ~8%, low risk"
node cli/src/index.js guardians                         # roster + bonds + slashings
node cli/src/index.js committee a2                      # a draw + tally (BLOCKED on 1/3)
node cli/src/index.js portfolio demo-user.mandate-arthur.testnet
node cli/src/index.js proof                             # the live Sepolia proof
```
API base defaults to `https://yieldai-fi.vercel.app` (override with `--api`).

**Agent service** (optional; the web app has its own server routes, so you rarely need this):
```bash
cd agent && pnpm install && pnpm dev   # POST /brief on :8787
pnpm test                               # vitest
```

**Contracts**:
```bash
cargo build                 # workspace build
cargo test                  # Rust unit + integration tests
```

---

## 6. Deploy

### Web → Vercel (this is what updates the live site)
The Vercel project is **`yieldai`** (its Root Directory is set to `web`). The
repo is linked via `.vercel/project.json`. Deploy from the **repo root**:

```bash
cd /path/to/repo
vercel --prod --yes --archive=tgz
# copy the printed deployment URL, then point the canonical domain at it:
vercel alias set <deployment>.vercel.app yieldai-fi.vercel.app
```
Why `--archive=tgz`: the repo has >15k files and a plain upload is rejected.
Set the `LLM_*` env vars in the Vercel project (Settings → Environment Variables)
or `vercel env add` once; they persist across deploys.

Pushing to `main` also triggers Vercel's Git integration, but the CLI deploy +
explicit alias above is the reliable path we've been using.

### Contracts → NEAR testnet
Needs `near-cli-rs` + a funded testnet account. See `scripts/deploy.sh` (it
builds the wasm and creates the sub-accounts). Run it yourself after
`near account import-account ...`; it does not run in CI. Guardians are
registered by `scripts/register-guardians.sh`.

---

## 7. Demo runbook (what to click / run on the day)

The clickable demo needs **only a NEAR testnet wallet + a little testnet NEAR**
(Meteor or MyNEAR testnet; gas faucet: https://near-faucet.io). **No USDC is
needed** — Launch writes the mandate JSON (0.01 Ⓝ deposit), it does not move
tokens, and the Sepolia proof is already mined.

1. **Open** https://yieldai-fi.vercel.app → scroll the landing (the thesis:
   agent proposes, chain enforces, bonded committee verifies).
2. **Overview** (`/app`): show the live market universe (real DefiLlama APY/TVL),
   the filters, and the honest "testnet-executable vs real-market-on-roadmap" tag.
3. **Earn** (`/app/earn`): type a brief, e.g.
   `J'ai 5000 USDC, je vise ~7%, risque maîtrisé, petite expo BTC ~30%`.
   Show: the proposal, then **edit the Deposit amount** and **drag allocation
   sliders** — APY, risk, donuts, projection and per-allocation $ recompute live
   and always sum to 100%.
4. **Guardrails**: try `I want 10 btc fast` or `1000% APY no risk` → the agent
   **declines** with a clear explanation (deterministic, not LLM-dependent).
5. **Launch**: Connect Wallet (testnet) → Launch → sign → the mandate is
   registered on `registry.mandate-arthur.testnet` (show the tx on nearblocks).
6. **The security story** (CLI or the Launch panel): the SLASHED guardian and the
   BLOCKED 1/3 committee draw, and the **real Sepolia tx**
   (`node cli/src/index.js proof`, or the Etherscan link in the Launch panel).

`scripts/demo.sh` is a scripted 10-beat version of the on-chain mechanism (most
beats are pure NEAR calls; external legs are env-gated and skipped by default).

---

## 8. Known gotchas (things that already bit me)

- **Vercel auto-links to the wrong project.** `vercel` sometimes re-links to a
  shared project named `web` (Arthur's Iris project) and fails with
  `.../web/web does not exist`. Fix: ensure `.vercel/project.json` has
  `"projectName": "yieldai"`, and deploy from the **repo root** (project Root
  Directory is `web`). Do not clobber the `iris-finance` / `web` project.
- **Guardian WASM silently traps** if built without `--cfg near` — all
  `require!`/errors get swallowed. The `.cargo/config.toml` rustflags fix this;
  keep them.
- **DefiLlama universe**: group markets by **(protocol × asset)**, not just
  protocol, or BTC/ETH markets get crowded out by stablecoin ones. `MIN_APY`
  drops ~0% collateral-only markets. Spark's DefiLlama slug is `sparklend`.
- **TS target is sub-ES2015** for the web build: don't iterate `Map.values()` or
  `string.matchAll()` directly — use `Array.from(...)` or a `regex.exec` loop,
  or the build fails on `--downlevelIteration`.
- **Mistral free tier rate-limits (429)** under rapid testing; the API route
  surfaces it as `LLM_ERROR`. Just retry.
- **near-faucet is rate-limited** after ~8 accounts; fund sub-accounts from your
  main account instead.
- The strategy engine forces **English** output and **strips em-dashes** (a style
  choice); keep `stripDashes()` and the prompt style rules if you edit copy.

---

## 9. Conventions for the AI agent continuing this

- Before any deploy: `cd web && pnpm lint && pnpm build` must be clean.
- Keep secrets out of git (see §4). If you add an env var, document it in
  `web/.env.example` and set it in Vercel.
- Commit messages end with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- The deployed contract IDs and the Sepolia proof are the source of truth for the
  demo; don't invent addresses. Market data must stay real (DefiLlama) — never
  hardcode fake APYs.
- `SPEC.md` is the integration contract: if you change a cross-component
  signature, change it there first.

Questions the README/SPEC/DEMO_REPORT don't answer → ask Arthur (repo owner).
