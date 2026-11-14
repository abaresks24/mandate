#!/usr/bin/env node
// YieldAI CLI — use the protocol from your terminal.
//
// Thin client over the already-deployed infrastructure:
//   • AI strategy proposals  -> the live /api/propose + /api/refine endpoints
//     (Mistral runs server-side; no API key needed on your machine)
//   • on-chain reads         -> NEAR testnet JSON-RPC (no deps, no account needed)
//   • register (write)       -> shells out to near-cli-rs (your keychain signs)
//
// Design mirrors the thesis: the protocol is programmatically usable by an
// agent or a human — the same proposal/verification pipeline, from a terminal.

import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline";

const API = process.env.MANDATE_API ?? "https://yieldai-fi.vercel.app";
const RPC = process.env.NEAR_RPC ?? "https://test.rpc.fastnear.com";
const REGISTRY = process.env.MANDATE_REGISTRY ?? "registry.mandate-arthur.testnet";
const COORDINATOR = process.env.MANDATE_COORDINATOR ?? "coordinator.mandate-arthur.testnet";
const VAULT = process.env.MANDATE_VAULT ?? "demo.vaults.mandate-arthur.testnet";
const SEPOLIA_TX =
  "0x363165ff6c712577cd408a658e9e9f4b137ba8d39e03d773af5c71e9ffec4b0a";
const MPC_ADDR = "0x3919100A2079A5447F2514BaF6ABc81e15D179D7";

// ---- tiny ANSI helpers (no deps) ----
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s) => c("1", s);
const dim = (s) => c("2", s);
const green = (s) => c("32", s);
const red = (s) => c("31", s);
const cyan = (s) => c("36", s);
const yellow = (s) => c("33", s);
const h = (s) => "\n" + bold(s) + "\n" + dim("─".repeat(Math.min(s.length, 48)));

function die(msg) {
  console.error(red("error: ") + msg);
  process.exit(1);
}

async function postJson(path, body) {
  let res;
  try {
    res = await fetch(API + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    die(`could not reach ${API}${path} (${e.message})`);
  }
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    die(`bad response from ${path}: ${text.slice(0, 200)}`);
  }
  return json;
}

// NEAR testnet read-only view call via JSON-RPC.
async function view(accountId, method, args = {}) {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "query",
      params: {
        request_type: "call_function",
        finality: "final",
        account_id: accountId,
        method_name: method,
        args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
      },
    }),
  }).then((r) => r.json());
  if (res.error) die(`RPC ${method}: ${res.error.data ?? res.error.message}`);
  if (res.result?.error) die(`view ${method}: ${res.result.error}`);
  const raw = Buffer.from(res.result.result).toString("utf8");
  return raw === "null" ? null : JSON.parse(raw);
}

const pct = (bps) => (typeof bps === "number" ? (bps / 100).toFixed(2) + "%" : "—");
const near = (yocto) =>
  yocto ? (Number(BigInt(yocto) / 10n ** 18n) / 1e6).toFixed(2) + " Ⓝ" : "—";

// ---- strategy rendering ----
function printStrategy(data) {
  if (data.status === "refused") {
    console.log(h("Strategy — REFUSED"));
    console.log(red(data.reason_code));
    console.log(data.reason);
    return;
  }
  const s = data.strategy;
  if (!s) die("unexpected response: " + JSON.stringify(data).slice(0, 200));
  console.log(h("Proposed strategy"));
  console.log(`${bold(green(pct(s.expectedApyBps)))} expected APY   ${dim("· risk")} ${s.riskLevel ?? "—"}`);
  console.log(s.summary ?? "");
  console.log(bold("\nAllocation"));
  for (const a of s.allocations ?? []) {
    console.log(
      `  ${String(a.weightPct).padStart(3)}%  ${a.label.padEnd(20)} ${dim(a.chain)}  ` +
        `${dim("risk")} ${a.riskScore}/100`
    );
    if (a.sourceOfYield) console.log(dim(`        yield: ${a.sourceOfYield}`));
  }
  if (s.caveat) console.log(yellow("\n⚠  " + s.caveat));
  const m = s.mandate;
  if (m) {
    console.log(dim(`\non-chain mandate: target ${pct(m.target_apy_bps)}, max risk ${m.max_risk_score}, ` +
      `protocols [${(m.allowed_protocols ?? []).join(", ")}], chains [${(m.allowed_chains ?? []).join(", ")}]`));
  }
  return s;
}

// ---- commands ----
async function cmdPropose(brief) {
  if (!brief) die('usage: mandate propose "<brief>"');
  const data = await postJson("/api/propose", { brief });
  printStrategy(data);
}

async function cmdRefine(brief, message) {
  if (!brief || !message) die('usage: mandate refine "<brief>" "<refinement>"');
  const prior = await postJson("/api/propose", { brief });
  const data = await postJson("/api/refine", {
    brief,
    priorStrategy: prior.strategy ?? null,
    message,
  });
  printStrategy(data);
}

// Sign register_mandate for an already-proposed strategy. Returns true on success.
// Does not exit the process (so it is safe to call from the interactive chat).
function signRegister(s, account) {
  const mandate_json = JSON.stringify(s.mandate ?? {});
  const label = (s.summary ?? "mandate").slice(0, 60);
  console.log(h("Register on-chain (wallet-signed)"));
  console.log(dim(`signing register_mandate on ${REGISTRY} as ${account} (0.01 Ⓝ)…`));
  const args = JSON.stringify({ mandate_json, label });
  const r = spawnSync(
    "near",
    [
      "contract", "call-function", "as-transaction", REGISTRY, "register_mandate",
      "json-args", args,
      "prepaid-gas", "30 Tgas", "attached-deposit", "0.01 NEAR",
      "sign-as", account, "network-config", "testnet", "sign-with-keychain", "send",
    ],
    { stdio: "inherit" }
  );
  if (r.error && r.error.code === "ENOENT") {
    console.log(red("near-cli-rs not found. Install it: cargo install near-cli-rs"));
    return false;
  }
  if (r.status !== 0) {
    console.log(red("registration transaction failed"));
    return false;
  }
  console.log(green("\n✓ mandate registered on-chain"));
  console.log(dim(`read it back: mandate portfolio ${account}`));
  return true;
}

async function cmdRegister(brief, account) {
  if (!brief || !account)
    die('usage: mandate register "<brief>" --account <id.testnet>');
  console.log(dim("proposing strategy…"));
  const s = printStrategy(await postJson("/api/propose", { brief }));
  if (!s) die("cannot register a refused/invalid strategy");
  signRegister(s, account);
}

// Per-allocation detail (where the yield comes from, the venue's key risk).
function printDetail(s) {
  console.log(h("Strategy detail"));
  for (const a of s.allocations ?? []) {
    const mkt = a.apyMarket ? `${a.apyMarket} market (live)` : "indicative";
    console.log(`${bold(a.label)} ${dim("· " + a.chain)} · ${a.category} · exposure:${a.exposure}`);
    console.log(`  ${green((a.apyBps / 100).toFixed(2) + "%")} APY ${dim("(" + mkt + ")")} · risk ${a.riskScore}/100`);
    if (a.sourceOfYield) console.log(dim(`  yield: ${a.sourceOfYield}`));
    if (a.keyRisk) console.log(dim(`  key risk: ${a.keyRisk}`));
  }
  if (s.riskBreakdown) console.log(dim(`\n${s.riskBreakdown}`));
}

// Interactive session: propose, then talk about the strategy in the terminal.
async function cmdChat(initialBrief) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let closed = false;
  rl.on("close", () => { closed = true; });
  // Returns null when stdin is closed (EOF / piped input ends) — treated as quit.
  const ask = (q) =>
    new Promise((res) => {
      if (closed) return res(null);
      try { rl.question(q, res); } catch { res(null); }
    });
  console.log(h("YieldAI — interactive"));
  console.log(dim("Describe what you want, then refine in plain language."));
  console.log(dim("Commands: learn · register <account.testnet> · new · quit"));

  let brief = (initialBrief || "").trim();
  if (!brief) {
    const b = await ask(bold("\nWhat do you want? "));
    brief = (b ?? "").trim();
  }
  if (!brief) { rl.close(); return; }

  console.log(dim("\nproposing…"));
  let s = printStrategy(await postJson("/api/propose", { brief }));

  for (;;) {
    const raw = await ask(bold("\n› "));
    if (raw == null) break; // stdin closed
    const line = raw.trim();
    if (!line) continue;
    const [cmd, ...rest] = line.split(/\s+/);
    const lc = cmd.toLowerCase();

    if (["quit", "exit", "q"].includes(lc)) break;
    if (lc === "help") {
      console.log(dim("refine in plain language · learn · register <account.testnet> · new · quit"));
      continue;
    }
    if (lc === "learn") {
      if (s) printDetail(s);
      else console.log(red("no strategy yet"));
      continue;
    }
    if (lc === "new") {
      const nbRaw = await ask(bold("New brief: "));
      if (nbRaw == null) break;
      const nb = nbRaw.trim();
      if (!nb) continue;
      brief = nb;
      console.log(dim("proposing…"));
      s = printStrategy(await postJson("/api/propose", { brief }));
      continue;
    }
    if (lc === "register") {
      const account = rest[0];
      if (!account) { console.log(red("usage: register <account.testnet>")); continue; }
      if (!s) { console.log(red("no strategy to register")); continue; }
      signRegister(s, account);
      continue;
    }

    // anything else = a refinement message
    console.log(dim("refining…"));
    const r = await postJson("/api/refine", { brief, priorStrategy: s ?? null, message: line });
    s = printStrategy(r) ?? s;
  }

  rl.close();
  console.log(dim("\nbye."));
}

async function cmdPortfolio(account) {
  if (!account) die("usage: mandate portfolio <account.testnet>");
  console.log(h(`Portfolio — ${account}`));
  const rec = await view(REGISTRY, "view_my_mandate", { account });
  if (rec) {
    let m = {};
    try { m = JSON.parse(rec.mandate_json); } catch {}
    console.log(bold("Your registered mandate"));
    console.log(`  ${rec.label}`);
    console.log(dim(`  target ${pct(m.target_apy_bps)} · max risk ${m.max_risk_score ?? "—"} · ` +
      `protocols [${(m.allowed_protocols ?? []).join(", ")}]`));
  } else {
    console.log(dim("no mandate registered under this account yet."));
    console.log(dim('propose + register one:  mandate register "…" --account ' + account));
  }
  const pos = await view(VAULT, "view_positions", {});
  if (pos) {
    console.log(bold("\nDemo vault positions"));
    console.log(dim(`  total ${pos.total_usdc ?? 0} (6dp) · idle ${pos.idle_usdc ?? 0} · ` +
      `${(pos.positions ?? []).length} active`));
  }
}

async function cmdGuardians() {
  console.log(h("Guardians — " + COORDINATOR));
  for (let i = 1; i <= 7; i++) {
    const g = await view(COORDINATOR, "view_guardian", { guardian_id: "g" + i });
    if (!g) continue;
    const status = g.status === "Slashed" ? red("SLASHED") : green(g.status);
    console.log(`  g${i}  ${dim(g.account.padEnd(26))} ${near(g.bond).padStart(9)}  ${status}`);
  }
}

async function cmdCommittee(action) {
  action = action || "a1";
  console.log(h(`Committee — action ${action}`));
  const committee = await view(COORDINATOR, "view_committee", { action_id: action });
  const tally = await view(COORDINATOR, "tally", { action_id: action });
  console.log(`  drawn:  ${committee ? committee.join(", ") : "—"}`);
  if (tally) {
    const ok = tally.threshold_met ? green("THRESHOLD MET") : red("BLOCKED");
    console.log(`  tally:  ${tally.approvals} approvals  ${ok}`);
  }
}

async function cmdProof() {
  console.log(h("Cross-chain proof"));
  console.log(`  committee-gated MPC address:  ${cyan(MPC_ADDR)}`);
  console.log(`  Sepolia tx (status 0x1):      ${cyan(SEPOLIA_TX)}`);
  console.log(dim(`  https://sepolia.etherscan.io/tx/${SEPOLIA_TX}`));
  const count = await view(REGISTRY, "view_count", {});
  console.log(dim(`\n  mandates registered on-chain: ${count ?? 0}`));
}

function help() {
  console.log(`${bold("YieldAI")} — use the protocol from your terminal

${bold("Talk to it")} ${dim("(interactive — propose, then refine in the terminal)")}
  mandate chat ["<brief>"]                  start an interactive session; refine by typing

${bold("AI strategy")} ${dim("(one-shot, via the live API — no key needed)")}
  mandate propose "<brief>"                 propose a strategy for a plain-language brief
  mandate refine  "<brief>" "<change>"      refine a proposal once
  mandate register "<brief>" --account <id> propose + sign register_mandate (needs near-cli-rs)

${bold("On-chain reads")} ${dim("(NEAR testnet, no account needed)")}
  mandate portfolio <account>               a user's registered mandate + demo vault state
  mandate guardians                         the guardian roster + bonds + slashings
  mandate committee [a1|a2]                 a committee draw + tally (a1 passed, a2 blocked)
  mandate proof                             the live cross-chain Sepolia proof

${dim("env: MANDATE_API, NEAR_RPC, MANDATE_REGISTRY/COORDINATOR/VAULT")}
`);
}

// ---- arg parsing ----
const argv = process.argv.slice(2);
const cmd = argv[0];
const rest = argv.slice(1);
const accIdx = rest.indexOf("--account");
const account = accIdx >= 0 ? rest[accIdx + 1] : undefined;
const positional = rest.filter((a, i) => a !== "--account" && rest[i - 1] !== "--account");

const run = {
  chat: () => cmdChat(positional[0]),
  propose: () => cmdPropose(positional[0]),
  refine: () => cmdRefine(positional[0], positional[1]),
  register: () => cmdRegister(positional[0], account),
  portfolio: () => cmdPortfolio(positional[0]),
  guardians: () => cmdGuardians(),
  committee: () => cmdCommittee(positional[0]),
  proof: () => cmdProof(),
  help: () => help(),
  undefined: () => help(),
};

(run[cmd] ?? (() => die(`unknown command "${cmd}" — try: mandate help`)))()
  .catch?.((e) => die(e.message));
