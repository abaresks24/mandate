// The live Launch engine: each step is one real on-chain action on NEAR testnet /
// Ethereum Sepolia. The client drives the steps in order (so the UI timeline is
// live and no single serverless call has to hold the whole flow).
//
//   arm → guardrail → supply (NEAR-native, contract-verified) → propose (cross-chain)
//   → draw → commit → tamper → reveal → execute → broadcast
//
// Trust model, stated plainly: the guardian OPERATOR code runs on this server and
// signs with each guardian's own NEAR account (not inside a TEE in this web flow).
// What the chain enforces regardless: committee draw + bond invariant, commit==
// sha256(reveal), 2-of-3 tally, the mandate gate, and that the agent key can only
// call propose/execute-type methods.

import "server-only";
import {
  asAgent,
  asGuardian,
  asOwner,
  call,
  keys,
  nearblocksTx,
  TGAS,
  view,
  type TxResult,
} from "./chain";
import { attest, canonicalJson, sha256Hex, type CrossChainTemplate } from "./guardian";
import {
  assembleSignedTx,
  deriveEvmAddress,
  parseMpcSignature,
  recoverAddress,
  sepolia,
  unsignedPayload,
  VAULT_PATH,
  type VaultEvmTx,
} from "./evm";
import { bytesToHex } from "@noble/hashes/utils";

// Testnet slice: the committee invariant (quorum bond >= value) caps what a demo
// bond can insure, so on-chain legs move a small notional, scaled by weight.
export const SLICE_USDC = 20_000_000n; // 20 USDC, 6 dp
export const SEPOLIA_DEMO_MARKET = "0x000000000000000000000000000000000000dEaD";
export const MPC_ROOT_KEY =
  "secp256k1:4NfTiv3UsGahebgTaHyD9vF8KYKMBnfd6kh94mK6xv8fGBiJB8TBtFMP5WWXz6B89Ac1fbpzPwAvoyQebemHFwx3";
const MIN_ETH_WEI = 2_000_000_000_000_000n; // 0.002 ETH is plenty for one 21k-gas tx

export interface MandateIn {
  target_apy_bps: number;
  max_risk_score: number;
  allowed_protocols: string[];
  allowed_chains: string[];
  max_share_per_protocol_bps: number;
  max_loss_bps: number;
}
export interface LaunchCtx {
  mandate: MandateIn;
  /** weights by catalogue-ish label, e.g. {"Rhea":70,"Morpho":30}; only live venues execute */
  weights: Record<string, number>;
  supplyId?: string;
  crossId?: string;
  coordId?: string;
  committee?: string[];
  reports?: Record<string, { report_json: string; commit_hash: string; guardian_account: string }>;
  sigReady?: boolean;
  evmAddress?: string;
}

export interface StepTx {
  label: string;
  hash: string;
  url: string;
  failure?: string;
}
export interface StepResult {
  ok: boolean;
  title: string;
  detail: string;
  txs: StepTx[];
  ctx: LaunchCtx;
  /** extra structured data for the UI (committee, report facts, eth tx…) */
  data?: Record<string, unknown>;
  /** set when the step can't proceed for a reason the user must fix (e.g. fund Sepolia) */
  blocker?: { code: string; message: string; address?: string };
}

const tx = (label: string, r: TxResult): StepTx => ({
  label,
  hash: r.hash,
  url: r.hash ? nearblocksTx(r.hash) : "",
  failure: r.failure,
});
const vaultId = () => keys().vault;
const coordId = () => keys().coordinator;

// ---- mandate mapping: user strategy -> what the vault can execute on testnet ----
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export function liveLegs(weights: Record<string, number>) {
  let rhea = 0;
  let morpho = 0;
  for (const [k, w] of Object.entries(weights)) {
    const n = norm(k);
    if (n === "rhea") rhea += w;
    else if (n.startsWith("morpho")) morpho += w;
  }
  const total = rhea + morpho;
  if (total <= 0) return { rhea: 0n, morpho: 0n };
  const r = (SLICE_USDC * BigInt(Math.round((rhea / total) * 1000))) / 1000n;
  return { rhea: r, morpho: SLICE_USDC - r };
}

function vaultMandate(ctx: LaunchCtx) {
  const legs = liveLegs(ctx.weights);
  const protocols: string[] = [];
  if (legs.rhea > 0n) protocols.push("rhea");
  if (legs.morpho > 0n) protocols.push("morpho-sepolia");
  const chains = ["near", ...(legs.morpho > 0n ? ["ethereum-sepolia"] : [])];
  const maxLegBps = Number(((legs.rhea > legs.morpho ? legs.rhea : legs.morpho) * 10_000n) / SLICE_USDC);
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));
  return {
    owner: keys().deployer.account,
    target_apy_bps: clamp(ctx.mandate.target_apy_bps, 0, 5000),
    max_risk_score: clamp(ctx.mandate.max_risk_score, 0, 100),
    allowed_protocols: protocols,
    allowed_chains: chains,
    // The slice only contains live venues, so shares are computed over the slice.
    max_share_per_protocol_bps: Math.min(10_000, Math.max(clamp(ctx.mandate.max_share_per_protocol_bps, 0, 10_000), maxLegBps)),
    max_loss_bps: clamp(ctx.mandate.max_loss_bps, 0, 5000),
    daily_cap_usdc: "50000000",
    committee_threshold_usdc: "0",
  };
}

export async function evmAddress() {
  return deriveEvmAddress(MPC_ROOT_KEY, vaultId(), VAULT_PATH).address;
}

// =====================================================================
// 1. arm — re-arm the vault with the user's mandate, record the deposit,
//          set fresh Sepolia nonce/fees.
// =====================================================================
export async function arm(ctx: LaunchCtx): Promise<StepResult> {
  const legs = liveLegs(ctx.weights);
  if (legs.rhea === 0n && legs.morpho === 0n)
    return {
      ok: false, title: "Arm the vault", txs: [], ctx,
      detail: "This allocation has no venue that settles on testnet today (Rhea on NEAR, Morpho on Sepolia).",
    };

  const address = await evmAddress();
  ctx.evmAddress = address;
  if (legs.morpho > 0n && process.env.LAUNCH_SKIP_ETH_CHECK !== "1") {
    const bal = await sepolia.balanceWei(address);
    if (bal < MIN_ETH_WEI)
      return {
        ok: false, title: "Arm the vault", txs: [], ctx,
        detail: "The vault's Chain Signatures address needs a little Sepolia ETH for gas.",
        blocker: { code: "NEEDS_SEPOLIA_ETH", message: "Send ≥ 0.005 Sepolia ETH to this address, then retry.", address },
      };
  }

  const owner = await asOwner();
  const txs: StepTx[] = [];
  const mandate = vaultMandate(ctx);
  txs.push(tx("update_mandate", await call(owner, vaultId(), "update_mandate", { mandate })));

  // Fresh ledger for every launch: owner repatriates anything left from a previous
  // run (kill_switch), then records exactly one testnet slice as the deposit.
  const pos = await view<{ idle_usdc: string; total_usdc: string }>(vaultId(), "view_positions");
  if (BigInt(pos.total_usdc) > 0n) txs.push(tx("kill_switch (reset ledger)", await call(owner, vaultId(), "kill_switch", {})));
  txs.push(tx("deposit_usdc", await call(owner, vaultId(), "deposit_usdc", { amount: SLICE_USDC.toString() })));

  if (legs.morpho > 0n) {
    const [nonce, gasPrice] = await Promise.all([sepolia.nonce(address), sepolia.gasPriceWei()]);
    const maxFee = gasPrice * 3n + 2_000_000_000n;
    const agent = await asAgent();
    txs.push(tx("set_evm_params", await call(agent, vaultId(), "set_evm_params", {
      params: { nonce, max_fee_per_gas: maxFee.toString(), max_priority_fee_per_gas: "1000000000", gas_limit: 60_000 },
    })));
  }
  const bad = txs.find((t) => t.failure);
  return {
    ok: !bad, ctx, txs, title: "Arm the vault",
    detail: bad ? `Failed: ${bad.label}: ${bad.failure}` :
      `Mandate written to the vault. Testnet slice: ${Number(SLICE_USDC) / 1e6} USDC recorded as idle. Agent may only act inside the mandate.`,
    data: { mandate, evmAddress: address, legs: { rhea: legs.rhea.toString(), morpho: legs.morpho.toString() } },
  };
}

// =====================================================================
// 2. guardrail — a prompt-injected / out-of-mandate proposal fails CLOSED
//    inside propose_action, before any guardian is contacted.
// =====================================================================
export async function guardrail(ctx: LaunchCtx): Promise<StepResult> {
  const agent = await asAgent();
  const r = await call(agent, vaultId(), "propose_action", {
    template: {
      kind: "AllocateCrossChain", chain: "ethereum-sepolia", protocol: "EVIL-PROTOCOL",
      market: SEPOLIA_DEMO_MARKET, amount: "1000000", max_slippage_bps: 50,
    },
  });
  const rejected = !!r.failure;
  const reason = r.failure?.match(/(protocol not in allowed_protocols|chain not in allowed_chains|[a-z_ ]+exceeds[a-z_ ]+)/i)?.[0] ?? r.failure ?? "";
  return {
    ok: rejected, ctx, txs: [tx("propose_action (out of mandate)", r)],
    title: "Out-of-mandate proposal",
    detail: rejected
      ? `Rejected on-chain: “${reason}”. No committee was ever contacted.`
      : "Unexpected: the vault accepted an out-of-mandate action.",
  };
}

// =====================================================================
// 3. supply — NEAR-native leg: contract-verified, no committee.
// =====================================================================
export async function supply(ctx: LaunchCtx): Promise<StepResult> {
  const legs = liveLegs(ctx.weights);
  if (legs.rhea === 0n)
    return { ok: true, ctx, txs: [], title: "Rhea supply (NEAR)", detail: "No Rhea allocation in this strategy, skipped." };
  const agent = await asAgent();
  const p = await call(agent, vaultId(), "propose_action", {
    template: { kind: "SupplyRhea", token: "usdc", amount: legs.rhea.toString(), market: "ref-finance-101.testnet" },
  });
  if (p.failure) return { ok: false, ctx, txs: [tx("propose_action", p)], title: "Rhea supply (NEAR)", detail: `Proposal rejected: ${p.failure}` };
  const actions = await recentActionId();
  ctx.supplyId = actions;
  const e = await call(agent, vaultId(), "execute_action", { action_id: ctx.supplyId }, { gas: TGAS(100) });
  const st = await view<{ status: string; note: string | null }>(vaultId(), "view_action", { action_id: ctx.supplyId });
  return {
    ok: !e.failure && st.status === "Executed", ctx,
    txs: [tx("propose_action", p), tx("execute_action", e)],
    title: "Rhea supply (NEAR)",
    detail: `${Number(legs.rhea) / 1e6} USDC. Verified by the vault contract itself, no committee needed. Status: ${st.status}.`,
    data: { actionId: ctx.supplyId, note: st.note },
  };
}

/** Highest action id the vault has minted ("a<N>"), found by probing views. */
async function recentActionId(): Promise<string> {
  let n = 1;
  let last = "a1";
  // action ids are dense: a1, a2, ... ; probe upward (cheap views).
  for (; n < 200; n++) {
    const a = await view<unknown>(vaultId(), "view_action", { action_id: `a${n}` });
    if (!a) break;
    last = `a${n}`;
  }
  return last;
}

// =====================================================================
// 4. propose — the cross-chain Morpho leg (needs the committee)
// =====================================================================
export async function propose(ctx: LaunchCtx): Promise<StepResult> {
  const legs = liveLegs(ctx.weights);
  if (legs.morpho === 0n)
    return { ok: true, ctx, txs: [], title: "Cross-chain proposal", detail: "No Morpho allocation in this strategy, skipped." };
  const agent = await asAgent();
  const p = await call(agent, vaultId(), "propose_action", {
    template: {
      kind: "AllocateCrossChain", chain: "ethereum-sepolia", protocol: "morpho-sepolia",
      market: SEPOLIA_DEMO_MARKET, amount: legs.morpho.toString(), max_slippage_bps: 50,
    },
  });
  if (p.failure) return { ok: false, ctx, txs: [tx("propose_action", p)], title: "Cross-chain proposal", detail: `Proposal rejected: ${p.failure}` };
  ctx.crossId = await recentActionId();
  ctx.coordId = await view<string>(vaultId(), "view_coord_action_id", { action_id: ctx.crossId });
  return {
    ok: true, ctx, txs: [tx("propose_action", p)], title: "Cross-chain proposal",
    detail: `Allocate ${Number(legs.morpho) / 1e6} USDC to Morpho on Ethereum Sepolia. The contract cannot read Sepolia, so a bonded committee must attest it.`,
    data: { actionId: ctx.crossId, coordinatorActionId: ctx.coordId },
  };
}

// =====================================================================
// 5. draw — bond-weighted random committee, quorum bond must cover value
// =====================================================================
export async function draw(ctx: LaunchCtx): Promise<StepResult> {
  if (!ctx.crossId) return { ok: true, ctx, txs: [], title: "Committee draw", detail: "No cross-chain leg, no committee needed." };
  const agent = await asAgent();
  const r = await call(agent, vaultId(), "request_committee", { action_id: ctx.crossId }, { gas: TGAS(100) });
  // The draw settles in a follow-up receipt on the coordinator: poll for it.
  let committee: string[] | null = null;
  for (let i = 0; i < 10 && !committee && !r.failure; i++) {
    committee = await view<string[] | null>(coordId(), "view_committee", { action_id: ctx.coordId });
    if (!committee) await new Promise((res) => setTimeout(res, 1500));
  }
  if (r.failure || !committee)
    return { ok: false, ctx, txs: [tx("request_committee", r)], title: "Committee draw", detail: `Draw failed: ${r.failure ?? "no committee recorded"}` };
  ctx.committee = committee;
  const rows = await Promise.all(
    committee.map(async (id) => {
      const g = await view<{ account: string; bond: string }>(coordId(), "view_guardian", { guardian_id: id });
      return { id, account: g.account, bondNear: Number(BigInt(g.bond) / 10n ** 20n) / 10_000 };
    }),
  );
  return {
    ok: true, ctx, txs: [tx("request_committee", r)], title: "Committee draw",
    detail: `Drawn at random, weighted by bond: ${committee.join(", ")}. Quorum bond ${rows.reduce((a, g) => a + g.bondNear, 0)} Ⓝ covers the action value.`,
    data: { committee: rows },
  };
}

// =====================================================================
// 6. commit — each guardian gathers facts and publishes sha256(report) only
// =====================================================================
export async function commit(ctx: LaunchCtx): Promise<StepResult> {
  if (!ctx.committee || !ctx.coordId || !ctx.crossId) return { ok: true, ctx, txs: [], title: "Guardians commit", detail: "Nothing to attest." };
  const legs = liveLegs(ctx.weights);
  const template: CrossChainTemplate = {
    kind: "AllocateCrossChain", chain: "ethereum-sepolia", protocol: "morpho-sepolia",
    market: SEPOLIA_DEMO_MARKET, amount: legs.morpho.toString(), max_slippage_bps: 50,
  };
  ctx.reports = {};
  const out = await Promise.all(
    ctx.committee.map(async (gid) => {
      const g = await view<{ account: string }>(coordId(), "view_guardian", { guardian_id: gid });
      const a = await attest(ctx.coordId!, template);
      const acc = await asGuardian(g.account);
      const r = await call(acc, coordId(), "submit_commit", {
        action_id: ctx.coordId, guardian_id: gid, commit_hash: a.commit_hash, outlayer_proof: "AA==",
      });
      ctx.reports![gid] = { report_json: a.report_json, commit_hash: a.commit_hash, guardian_account: g.account };
      return { gid, a, r };
    }),
  );
  const bad = out.find((o) => o.r.failure);
  return {
    ok: !bad, ctx, title: "Guardians commit",
    txs: out.map((o) => tx(`submit_commit ${o.gid}`, o.r)),
    detail: bad ? `Commit failed: ${bad.r.failure}` : "Each guardian read Sepolia (block-pinned) and published only a hash. The report itself stays hidden until reveal.",
    data: {
      commits: out.map((o) => ({ guardian: o.gid, commit: o.a.commit_hash, approve: o.a.report.approve, block: o.a.report.facts.price_block })),
    },
  };
}

// =====================================================================
// 7. tamper — a guardian tries to reveal different bytes than it committed
// =====================================================================
export async function tamper(ctx: LaunchCtx): Promise<StepResult> {
  if (!ctx.committee || !ctx.reports) return { ok: true, ctx, txs: [], title: "Lying guardian blocked", detail: "No committee." };
  const gid = ctx.committee[0]!;
  const rep = ctx.reports[gid]!;
  const forged = JSON.parse(rep.report_json);
  forged.approve = true;
  forged.facts.observed_slippage_bps = 0;
  forged.facts.protocol_paused = false;
  forged.reason_codes = ["PRICE_OK", "SLIPPAGE_OK", "PROTOCOL_LIVE", "CROSSCHAIN_STATE_OK", "TAMPERED"];
  const forgedJson = canonicalJson(forged);
  const acc = await asGuardian(rep.guardian_account);
  const r = await call(acc, coordId(), "reveal_report", { action_id: ctx.coordId, guardian_id: gid, report_json: forgedJson });
  const blocked = !!r.failure && /sha256 mismatch|does not match/i.test(r.failure);
  return {
    ok: blocked, ctx, txs: [tx(`reveal_report ${gid} (forged)`, r)], title: "Lying guardian blocked",
    detail: blocked
      ? `${gid} tried to reveal a different report than it committed. The coordinator recomputed sha256 and rejected it: a lie is provable on-chain.`
      : "Unexpected: forged reveal was not rejected.",
    data: { forgedHash: sha256Hex(forgedJson), committedHash: rep.commit_hash },
  };
}

// =====================================================================
// 8. reveal — honest reveals, hashes verified on-chain, tally 2-of-3
// =====================================================================
export async function reveal(ctx: LaunchCtx): Promise<StepResult> {
  if (!ctx.committee || !ctx.reports) return { ok: true, ctx, txs: [], title: "Guardians reveal", detail: "Nothing to reveal." };
  const out = await Promise.all(
    ctx.committee.map(async (gid) => {
      const rep = ctx.reports![gid]!;
      const acc = await asGuardian(rep.guardian_account);
      return { gid, r: await call(acc, coordId(), "reveal_report", { action_id: ctx.coordId, guardian_id: gid, report_json: rep.report_json }) };
    }),
  );
  const tally = await view<{ approvals: number; threshold_met: boolean }>(coordId(), "tally", { action_id: ctx.coordId });
  const bad = out.find((o) => o.r.failure);
  return {
    ok: !bad && tally.threshold_met, ctx, title: "Guardians reveal",
    txs: out.map((o) => tx(`reveal_report ${o.gid}`, o.r)),
    detail: bad ? `Reveal failed: ${bad.r.failure}` : `${tally.approvals}/3 approvals. Threshold ${tally.threshold_met ? "MET" : "NOT met"}.`,
    data: { tally },
  };
}

// =====================================================================
// 9. execute — vault asks the coordinator for tally+facts, applies the facts
//    to the mandate, builds the EVM tx and requests the MPC signature.
// =====================================================================
export async function execute(ctx: LaunchCtx): Promise<StepResult> {
  if (!ctx.crossId) return { ok: true, ctx, txs: [], title: "Execute", detail: "No cross-chain leg." };
  const agent = await asAgent();
  const r = await call(agent, vaultId(), "execute_action", { action_id: ctx.crossId }, { gas: TGAS(300) });
  const st = await view<{ status: string; note: string | null }>(vaultId(), "view_action", { action_id: ctx.crossId });
  // The MPC signature arrives asynchronously (yield/resume): poll the vault.
  let sig: string | null = null;
  for (let i = 0; i < 12 && !sig; i++) {
    sig = await view<string | null>(vaultId(), "view_signature", { action_id: ctx.crossId });
    if (!sig) await new Promise((res) => setTimeout(res, 2000));
  }
  ctx.sigReady = !!sig;
  return {
    ok: !r.failure && st.status === "Executed" && !!sig, ctx, txs: [tx("execute_action", r)],
    title: "Execute with Chain Signatures",
    detail: st.status !== "Executed"
      ? `Vault status: ${st.status}${st.note ? ` (${st.note})` : ""}`
      : sig ? "Facts applied to the mandate, EVM tx built by the vault, MPC signature received." : "Executed, but the MPC signature has not arrived yet; retry the broadcast in a few seconds.",
    data: { status: st.status, note: st.note },
  };
}

// =====================================================================
// 10. broadcast — assemble the signed tx and land it on Sepolia
// =====================================================================
export async function broadcast(ctx: LaunchCtx): Promise<StepResult> {
  if (!ctx.crossId) return { ok: true, ctx, txs: [], title: "Land on Sepolia", detail: "No cross-chain leg." };
  const [txJson, sigJson, lastReq] = await Promise.all([
    view<string | null>(vaultId(), "view_evm_tx", { action_id: ctx.crossId }),
    view<string | null>(vaultId(), "view_signature", { action_id: ctx.crossId }),
    view<{ payload: number[] } | null>(vaultId(), "view_last_sign_request", {}),
  ]);
  if (!txJson || !sigJson) return { ok: false, ctx, txs: [], title: "Land on Sepolia", detail: "The MPC signature is not available yet." };
  const evmTx = JSON.parse(txJson) as VaultEvmTx;
  const payload = unsignedPayload(evmTx);
  const signedPayload = lastReq ? bytesToHex(Uint8Array.from(lastReq.payload)) : payload;
  if (payload !== signedPayload) return { ok: false, ctx, txs: [], title: "Land on Sepolia", detail: "Rebuilt tx hash differs from what the vault signed; refusing to broadcast." };
  const sig = parseMpcSignature(sigJson);
  const address = await evmAddress();
  const signer = recoverAddress(payload, sig);
  if (signer.toLowerCase() !== address.toLowerCase())
    return { ok: false, ctx, txs: [], title: "Land on Sepolia", detail: `Signature recovers ${signer}, expected ${address}.` };
  const raw = assembleSignedTx(evmTx, sig);
  let hash: string;
  try {
    hash = await sepolia.sendRaw(raw);
  } catch (e) {
    return { ok: false, ctx, txs: [], title: "Land on Sepolia", detail: `Sepolia rejected the tx: ${e instanceof Error ? e.message : e}` };
  }
  let receipt = null;
  for (let i = 0; i < 20 && !receipt; i++) {
    receipt = await sepolia.receipt(hash);
    if (!receipt) await new Promise((res) => setTimeout(res, 3000));
  }
  const status = receipt?.status === "0x1";
  return {
    ok: !!receipt && status, ctx, txs: [], title: "Land on Sepolia",
    detail: receipt ? `Mined in block ${parseInt(receipt.blockNumber, 16)}, status ${receipt.status}.` : "Broadcast; waiting for inclusion.",
    data: { ethTx: hash, etherscan: `https://sepolia.etherscan.io/tx/${hash}`, from: address, status: receipt?.status ?? null },
  };
}

export const STEPS = { arm, guardrail, supply, propose, draw, commit, tamper, reveal, execute, broadcast } as const;
export type StepName = keyof typeof STEPS;
