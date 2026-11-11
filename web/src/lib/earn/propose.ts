// brief -> proposed strategy. Ported & adapted from agent/src/mandate.ts.
//
// The LLM turns the brief into mandate parameters + protocol choices + prose.
// The DETERMINISTIC risk module computes every risk score here — the LLM only
// explains them. Unrealistic/contradictory briefs are REFUSED with a structured
// reason. Asks that reach outside the supported universe (e.g. BTC exposure)
// are NOT silently faked: the model proposes the closest supported allocation
// and is told to be honest about what is / isn't directly supported.

import { CATALOGUE, CATALOGUE_KEYS, type ProtocolCatalogueEntry } from "./catalogue";
import { chatJson, readLlmConfig, type ChatMessage, type LlmConfig } from "./llm";
import { riskLabel, scoreBreakdown, scoreProtocol, type RiskFactor } from "./risk";

// ---------------------------------------------------------------------------
// Output contract (the JSON shape returned to the client).
// ---------------------------------------------------------------------------

export interface MandateShape {
  owner: string;
  target_apy_bps: number;
  max_risk_score: number;
  allowed_protocols: string[];
  allowed_chains: string[];
  max_share_per_protocol_bps: number;
  max_loss_bps: number;
  daily_cap_usdc: string;
  committee_threshold_usdc: string;
}

export interface Allocation {
  label: string; // display name, e.g. "Rhea"
  protocol: string; // catalogue key, e.g. "morpho-sepolia"
  chain: string; // human label, e.g. "Ethereum (Sepolia)"
  weightPct: number; // 0..100
  sourceOfYield: string; // where the yield comes from (prose)
  riskScore: number; // 0..100 — DETERMINISTIC, not from the LLM
  riskLabel: string; // Low / Moderate / Elevated / High
  explanation: string; // LLM-authored, grounded on the deterministic score
  mechanics: string; // how the move executes on-chain (real system)
  riskFactors: RiskFactor[]; // per-factor breakdown behind the score
  category: string; // venue category (lending, LP, delta-neutral, …)
  exposure: string; // asset exposure you take on (stablecoin/near/eth/btc/…)
  keyRisk: string; // the characteristic risk of THIS venue type
}

// The characteristic risk of each venue category, in plain language.
function keyRiskFor(category: string): string {
  const m: Record<string, string> = {
    "USDC lending":
      "Smart-contract and utilization risk; your capital stays in stablecoin terms (no price volatility).",
    "savings rate":
      "Protocol/peg risk only — backed by fees and RWA, with no borrower or oracle dependency.",
    "RWA — T-bills":
      "Off-chain counterparty and custody risk: the Treasuries are held by a real-world issuer.",
    "fixed-rate":
      "The rate is locked to maturity; exiting early means selling at market (duration/rate risk).",
    "delta-neutral":
      "Funding can turn negative and the hedge leans on centralized venues — yield is not guaranteed.",
    "liquid staking":
      "Validator slashing risk, and you carry the underlying asset's price (ETH/NEAR), not a stablecoin.",
    "BTC staking":
      "You hold BTC price exposure, plus staking-protocol (Babylon-style) slashing risk.",
    "BTC yield":
      "BTC price exposure plus strategy/counterparty risk inside the yield engine.",
    "DEX liquidity":
      "Impermanent loss if the pair's price moves, and you take the non-stable asset's exposure.",
    "concentrated LP":
      "Impermanent loss plus active range management — returns are volatile.",
    restaking:
      "Extra slashing surface from the services you help secure; a newer, less battle-tested primitive.",
    "incentivized vault":
      "Most of the APY is token emissions that decay over time; thin audits and a short track record.",
  };
  return (
    m[category] ??
    "Smart-contract risk and any asset-price exposure implied by this venue."
  );
}

export interface ProposedStrategy {
  summary: string;
  caveat?: string; // honest note about unsupported parts of the ask (e.g. BTC)
  expectedApyBps: number;
  riskLevel: string; // headline risk label
  allocations: Allocation[];
  riskBreakdown: string; // one-paragraph plain-language risk summary
  mandate: MandateShape;
}

export type ProposeResult =
  | ({ status: "proposed" } & { strategy: ProposedStrategy })
  | {
      status: "refused";
      reason_code:
        | "UNREALISTIC_APY"
        | "RISK_MANDATE_CONTRADICTION"
        | "UNSUPPORTED_PROTOCOL"
        | "MALFORMED_BRIEF"
        | "LLM_ERROR";
      reason: string;
    };

// ---------------------------------------------------------------------------
// LLM contract — what the model is allowed to return. It NEVER sets a score.
// ---------------------------------------------------------------------------

interface LlmProposal {
  realistic: boolean;
  refusal_reason?: string;
  owner?: string;
  target_apy_bps?: number;
  max_risk_score?: number;
  max_loss_bps?: number;
  daily_cap_usdc?: string;
  // chosen protocol keys + a weight % each (weights should sum to ~100)
  allocations?: Array<{ protocol?: string; weight_pct?: number; explanation?: string }>;
  summary?: string;
  // honest note about any portion of the ask outside the supported universe
  caveat?: string;
}

// Hard, non-LLM guardrails.
const MAX_REALISTIC_APY_BPS = 2500; // 25%
const LOW_RISK_CAP = 25;

function catalogueBrief(): string {
  return CATALOGUE_KEYS.map((k) => {
    const e = CATALOGUE[k]!;
    const live = e.live ? "LIVE" : "roadmap";
    return `- "${k}" — ${e.displayName} · ${e.chainLabel} · ${e.category} · exposure:${e.asset} · ~${(
      e.default_apy_bps / 100
    ).toFixed(1)}% APY · ${live}. ${e.sourceOfYield}`;
  }).join("\n");
}

function systemPrompt(): string {
  return [
    "You are YieldAI's strategy drafter. You convert a user's investment brief",
    "into a PROPOSED on-chain yield strategy. Respond ONLY with a JSON object.",
    "",
    "ALWAYS respond in ENGLISH. Every text field you return (summary, each",
    "allocation explanation, caveat, refusal_reason) MUST be written in English,",
    "even when the user's brief is in French or any other language.",
    "",
    "You do NOT compute risk scores — a separate deterministic module does that.",
    "Your job: read the brief, then DESIGN A STRATEGY that genuinely fits it by",
    "picking a handful of venues from the universe below, assigning each a weight %,",
    "and writing an honest human explanation. Respond ONLY with a JSON object.",
    "",
    "THE YIELD UNIVERSE (each line: key · venue · chain · category · exposure · APY · LIVE/roadmap):",
    catalogueBrief(),
    "",
    "DESIGN DIFFERENT STRATEGIES FOR DIFFERENT BRIEFS — do not default to one answer:",
    "- Read the user's RISK APPETITE: conservative → blue-chip lending / RWA / savings",
    "  (aave, sdai, ondo-usdy, rhea); balanced → add fixed-rate/delta-neutral (pendle,",
    "  ethena-susde) or liquid staking; aggressive → LP, restaking, or incentivized",
    "  vaults (ref-lp, uni-ethusdc, eigenlayer, hyper-usdc).",
    "- Read ASSET-EXPOSURE wishes and HONOR them with the matching `exposure` tag:",
    "  'BTC exposure' → lombard-lbtc / solv-btc; 'ETH' → lido-steth / eigenlayer;",
    "  'NEAR' → linear / meta-pool; 'stablecoin / no volatility' → stay in stablecoin venues.",
    "- Read CHAIN preferences (NEAR, Ethereum, Base, Arbitrum) and target APY.",
    "- DIVERSIFY: typically 2-4 venues across categories, not always the same pair.",
    "  Vary the mix so two different briefs yield visibly different strategies.",
    "",
    "HONESTY ABOUT EXECUTION: only venues marked LIVE (Rhea on NEAR, Morpho on",
    "Ethereum) settle on testnet today; the rest are the broader universe (roadmap).",
    "You MAY still include roadmap venues when they fit the brief — but if you do,",
    "use the `caveat` field to say plainly which part is live today vs. on the roadmap.",
    "Never claim a roadmap venue is already executing.",
    "",
    "REFUSE (realistic=false, give refusal_reason) ONLY for the impossible or",
    "self-contradictory: demanding high APY with zero/near-zero risk (the classic",
    "'40% APY, no risk' ask), or an empty/nonsense brief.",
    "",
    "Weights must sum to about 100.",
    "",
    "JSON shape:",
    "{",
    '  "realistic": boolean,',
    '  "refusal_reason": string (only if realistic=false),',
    '  "owner": string,',
    '  "target_apy_bps": number,',
    '  "max_risk_score": number (0-100),',
    '  "max_loss_bps": number,',
    '  "daily_cap_usdc": string (6-dp USDC integer),',
    '  "allocations": [ { "protocol": "<key from the universe>", "weight_pct": number, "explanation": "<why this fits, grounded, honest>" } ],',
    '  "summary": string (1-2 sentences, plain language),',
    '  "caveat": string (optional — honest note about any part of the ask not directly supported)',
    "}",
  ].join("\n");
}

export function detectUnrealistic(
  targetApyBps: number,
  maxRiskScore: number,
): { reason: string } | null {
  if (targetApyBps > MAX_REALISTIC_APY_BPS && maxRiskScore <= LOW_RISK_CAP) {
    return {
      reason:
        `A target of ${(targetApyBps / 100).toFixed(1)}% APY with a maximum risk ` +
        `score of ${maxRiskScore} is not achievable. Sustainable on-chain yields ` +
        `at that risk level are far lower; such a promise is a hallmark of a scam.`,
    };
  }
  return null;
}

function clampInt(v: number | undefined, lo: number, hi: number, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function normalizeU128(v: string | undefined, fallback: string): string {
  if (typeof v !== "string") return fallback;
  if (!/^\d+$/.test(v.trim())) return fallback;
  return v.trim();
}

function sanitizeExplanation(llmText: string | undefined, entry: ProtocolCatalogueEntry, risk: number): string {
  const base = `Deterministic risk score for ${entry.displayName}: ${risk}/100.`;
  const prose = (llmText ?? "").trim();
  return prose ? `${base} ${prose}` : base;
}

/** Build the structured proposal from a parsed LLM proposal. Shared by propose + refine. */
export function assembleStrategy(parsed: LlmProposal): ProposeResult {
  if (parsed.realistic === false) {
    return {
      status: "refused",
      reason_code: "UNREALISTIC_APY",
      reason:
        parsed.refusal_reason ??
        "The brief could not be satisfied as stated (unrealistic risk/return).",
    };
  }

  const targetApy = clampInt(parsed.target_apy_bps, 0, 100_000, 500);
  const maxRisk = clampInt(parsed.max_risk_score, 0, 100, 60);

  const unrealistic = detectUnrealistic(targetApy, maxRisk);
  if (unrealistic) {
    return { status: "refused", reason_code: "UNREALISTIC_APY", reason: unrealistic.reason };
  }

  // Resolve allocations; reject anything outside the catalogue.
  const requested = (parsed.allocations ?? []).filter((a) => a.protocol);
  const unknown = requested
    .map((a) => a.protocol!)
    .filter((p) => !(p in CATALOGUE));
  if (unknown.length > 0) {
    return {
      status: "refused",
      reason_code: "UNSUPPORTED_PROTOCOL",
      reason: `Requested protocol(s) not in the supported universe: ${unknown.join(", ")}.`,
    };
  }

  // Fall back to the catalogue entries that fit the risk cap if the LLM named none.
  const effective =
    requested.length > 0
      ? requested
      : CATALOGUE_KEYS.filter((n) => scoreProtocol(CATALOGUE[n]!.risk) <= maxRisk)
          .slice(0, 2)
          .map((p) => ({ protocol: p, weight_pct: undefined, explanation: undefined }));

  const kept = effective.filter((a) => scoreProtocol(CATALOGUE[a.protocol!]!.risk) <= maxRisk);
  if (kept.length === 0) {
    return {
      status: "refused",
      reason_code: "RISK_MANDATE_CONTRADICTION",
      reason:
        `No supported protocol has a deterministic risk score at or below the ` +
        `requested cap of ${maxRisk}. Raise the risk ceiling or lower the target APY.`,
    };
  }

  // Normalize weights to sum to 100.
  const rawWeights = kept.map((a) =>
    typeof a.weight_pct === "number" && a.weight_pct > 0 ? a.weight_pct : 1,
  );
  const weightSum = rawWeights.reduce((x, y) => x + y, 0);
  const weights = rawWeights.map((w) => Math.round((w / weightSum) * 100));
  // fix rounding drift so weights total exactly 100
  const drift = 100 - weights.reduce((x, y) => x + y, 0);
  if (weights.length > 0) weights[0] += drift;

  const allocations: Allocation[] = [];
  const allowedProtocols: string[] = [];
  const allowedChains = new Set<string>();
  let blendedApy = 0;

  kept.forEach((a, i) => {
    const key = a.protocol!;
    const entry = CATALOGUE[key]!;
    const risk = scoreProtocol(entry.risk); // DETERMINISTIC
    const w = weights[i]!;
    allowedProtocols.push(key);
    allowedChains.add(entry.chain);
    blendedApy += (entry.default_apy_bps * w) / 100;
    allocations.push({
      label: entry.displayName,
      protocol: key,
      chain: entry.chainLabel,
      weightPct: w,
      sourceOfYield: entry.sourceOfYield,
      riskScore: risk,
      riskLabel: riskLabel(risk),
      explanation: sanitizeExplanation(a.explanation, entry, risk),
      mechanics: entry.mechanics,
      riskFactors: scoreBreakdown(entry.risk),
      category: entry.category,
      exposure: entry.asset,
      keyRisk: keyRiskFor(entry.category),
    });
  });

  const expectedApyBps = Math.round(blendedApy);
  const portfolioRisk = Math.round(
    allocations.reduce((acc, al) => acc + (al.riskScore * al.weightPct) / 100, 0),
  );

  const mandate: MandateShape = {
    owner: parsed.owner?.trim() || "owner.testnet",
    target_apy_bps: targetApy,
    max_risk_score: maxRisk,
    allowed_protocols: allowedProtocols,
    allowed_chains: Array.from(allowedChains),
    max_share_per_protocol_bps: 5000,
    max_loss_bps: clampInt(parsed.max_loss_bps, 0, 10_000, 300),
    daily_cap_usdc: normalizeU128(parsed.daily_cap_usdc, "5000000000"),
    committee_threshold_usdc: "0", // committee PERMANENT (SPEC default)
  };

  const categories = Array.from(new Set(kept.map((a) => CATALOGUE[a.protocol!]!.category)));
  const riskBreakdown =
    `Blended portfolio risk is ${portfolioRisk}/100 (${riskLabel(portfolioRisk)}), ` +
    `under your mandate cap of ${maxRisk}. This mix spans ${categories.join(", ")}; the main ` +
    `risk drivers are smart-contract exposure, oracle dependence where present, and any asset-price ` +
    `exposure you opted into. The on-chain mandate hard-caps risk at ${maxRisk}, limits any single ` +
    `venue to ${mandate.max_share_per_protocol_bps / 100}% of the vault, and bounds ` +
    `loss to ${mandate.max_loss_bps / 100}%.`;

  // Honest live-vs-roadmap note: only Rhea + Morpho settle on testnet today.
  const roadmap = allocations.filter((al) => !CATALOGUE[al.protocol]!.live).map((al) => al.label);
  const liveNote =
    roadmap.length > 0
      ? `Live on-chain execution today settles Rhea (NEAR) and Morpho (Ethereum); ` +
        `${Array.from(new Set(roadmap)).join(", ")} ${roadmap.length === 1 ? "is" : "are"} in the ` +
        `YieldAI strategy universe (execution on the roadmap).`
      : "";
  const llmCaveat = parsed.caveat?.trim();
  const caveat = [llmCaveat, liveNote].filter(Boolean).join(" ") || undefined;

  const strategy: ProposedStrategy = {
    summary:
      parsed.summary?.trim() ||
      `Targeting ~${(expectedApyBps / 100).toFixed(1)}% APY across ${allocations.length} allocation(s) (${categories.join(", ")}), risk-capped at ${maxRisk}/100.`,
    caveat,
    expectedApyBps,
    riskLevel: riskLabel(portfolioRisk),
    allocations,
    riskBreakdown,
    mandate,
  };

  return { status: "proposed", strategy };
}

/** Full propose: validate, call the LLM, assemble. */
export async function proposeStrategy(brief: string, cfg?: LlmConfig): Promise<ProposeResult> {
  if (!brief || brief.trim().length < 3) {
    return {
      status: "refused",
      reason_code: "MALFORMED_BRIEF",
      reason: "The brief is empty or too short to interpret.",
    };
  }

  const config = cfg ?? readLlmConfig();
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt() },
    { role: "user", content: brief },
  ];

  let parsed: LlmProposal;
  try {
    const raw = await chatJson(messages, config, { temperature: 0.2 });
    parsed = JSON.parse(raw) as LlmProposal;
  } catch (err) {
    return {
      status: "refused",
      reason_code: "LLM_ERROR",
      reason: `Could not interpret the brief into a strategy: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  return assembleStrategy(parsed);
}

/** Refine: feed the prior strategy + the user's message back through the LLM. */
export async function refineStrategy(
  brief: string,
  priorStrategy: ProposedStrategy,
  message: string,
  cfg?: LlmConfig,
): Promise<ProposeResult> {
  if (!message || message.trim().length < 2) {
    return {
      status: "refused",
      reason_code: "MALFORMED_BRIEF",
      reason: "The refinement message is empty.",
    };
  }
  const config = cfg ?? readLlmConfig();

  const priorSummary = JSON.stringify({
    summary: priorStrategy.summary,
    expectedApyBps: priorStrategy.expectedApyBps,
    mandate: priorStrategy.mandate,
    allocations: priorStrategy.allocations.map((a) => ({
      protocol: a.protocol,
      weight_pct: a.weightPct,
    })),
  });

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt() },
    { role: "user", content: `Original brief: ${brief}` },
    {
      role: "assistant",
      content: `Here is the current proposal I drafted: ${priorSummary}`,
    },
    {
      role: "user",
      content: `Update the proposal based on this feedback, returning the same JSON shape: ${message}`,
    },
  ];

  let parsed: LlmProposal;
  try {
    const raw = await chatJson(messages, config, { temperature: 0.2 });
    parsed = JSON.parse(raw) as LlmProposal;
  } catch (err) {
    return {
      status: "refused",
      reason_code: "LLM_ERROR",
      reason: `Could not apply the refinement: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  return assembleStrategy(parsed);
}
