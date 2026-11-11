// brief -> proposed strategy.
//
// The LLM composes a strategy from a LIVE market universe (real markets from
// DefiLlama across Morpho, Aave, Euler, Fluid, Compound, Spark + savings / RWA /
// staking / BTC / LP / restaking venues). The DETERMINISTIC risk module computes
// every risk score here — the LLM only explains it. Unrealistic/contradictory
// briefs are REFUSED with a structured reason.

import { buildShortlist, type Venue } from "./universe";
import { chatJson, readLlmConfig, type ChatMessage, type LlmConfig } from "./llm";
import { riskLabel, scoreBreakdown, scoreProtocol, type RiskFactor } from "./risk";

type Venues = Record<string, Venue>;

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
  label: string; // protocol display name, e.g. "Morpho"
  protocol: string; // venue slug, e.g. "morpho-blue:steakusdc:ethereum"
  chain: string; // human chain label
  weightPct: number; // 0..100
  sourceOfYield: string;
  riskScore: number; // 0..100 — DETERMINISTIC
  riskLabel: string;
  explanation: string; // LLM-authored, grounded on the deterministic score
  mechanics: string;
  riskFactors: RiskFactor[];
  category: string;
  exposure: string; // asset exposure (stablecoin/eth/btc/near/…)
  keyRisk: string;
  apyBps: number; // the market's current live APY
  apyMarket?: string; // the specific market, e.g. "STEAKUSDC"
}

export interface ProposedStrategy {
  summary: string;
  caveat?: string;
  expectedApyBps: number;
  riskLevel: string;
  allocations: Allocation[];
  riskBreakdown: string;
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

interface LlmProposal {
  realistic: boolean;
  refusal_reason?: string;
  owner?: string;
  target_apy_bps?: number;
  max_risk_score?: number;
  max_loss_bps?: number;
  daily_cap_usdc?: string;
  allocations?: Array<{ protocol?: string; weight_pct?: number; explanation?: string }>;
  summary?: string;
  caveat?: string;
}

// Hard, non-LLM guardrails.
const MAX_REALISTIC_APY_BPS = 2500; // 25%
const LOW_RISK_CAP = 25;

function tvlShort(tvl: number): string {
  return tvl >= 1e9 ? `$${(tvl / 1e9).toFixed(1)}B` : `$${Math.max(1, Math.round(tvl / 1e6))}M`;
}

function venueBrief(venues: Venues): string {
  return Object.values(venues)
    .sort((a, b) => b.tvlUsd - a.tvlUsd)
    .map((v) => {
      const tag = v.live ? "LIVE" : "roadmap";
      return `- "${v.slug}" — ${v.displayName} · ${v.market} · ${v.chainLabel} · ${v.category} · exposure:${v.asset} · ${(v.apyBps / 100).toFixed(1)}% APY · TVL ${tvlShort(v.tvlUsd)} · ${tag}`;
    })
    .join("\n");
}

function systemPrompt(venues: Venues): string {
  return [
    "You are YieldAI's strategy drafter. You convert a user's investment brief",
    "into a PROPOSED on-chain yield strategy. Respond ONLY with a JSON object.",
    "",
    "ALWAYS respond in ENGLISH. Every text field (summary, each allocation",
    "explanation, caveat, refusal_reason) MUST be in English, even if the brief is",
    "in another language.",
    "",
    "You do NOT compute risk scores — a separate deterministic module does that.",
    "Your job: read the brief, then DESIGN A STRATEGY by picking a handful of",
    "markets from the LIVE universe below, assigning each a weight %, and writing an",
    "honest explanation. Use the EXACT slug key (the quoted string) for each pick.",
    "",
    "THE LIVE MARKET UNIVERSE (slug · protocol · market · chain · category · exposure · APY · TVL · LIVE/roadmap):",
    venueBrief(venues),
    "",
    "DESIGN DIFFERENT STRATEGIES FOR DIFFERENT BRIEFS:",
    "- Match RISK APPETITE: conservative → deep blue-chip lending (Aave, Morpho,",
    "  Compound), savings/RWA (Sky, Ondo); balanced → fixed-rate (Pendle),",
    "  delta-neutral (Ethena), liquid staking; aggressive → LP, restaking, newer",
    "  high-APY markets. Deeper TVL = safer, all else equal.",
    "- HONOR asset-exposure wishes via the `exposure` tag: BTC → BTC venues; ETH →",
    "  ETH staking/restaking; NEAR → NEAR venues; 'no volatility' → stablecoin only.",
    "- You may pick SEVERAL markets from the same protocol (e.g. two Morpho markets)",
    "  when it fits. Typically 2-5 markets across categories. Vary the mix per brief.",
    "",
    "HONESTY: only venues marked LIVE settle on testnet today (Rhea on NEAR, Morpho",
    "on Ethereum). You MAY include roadmap venues when they fit — if you do, say so",
    "plainly in `caveat`. Never claim a roadmap venue is already executing.",
    "",
    "REFUSE (realistic=false, give refusal_reason) ONLY for the impossible: high APY",
    "with zero/near-zero risk ('40% APY, no risk'), or an empty/nonsense brief.",
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
    '  "allocations": [ { "protocol": "<exact slug from the universe>", "weight_pct": number, "explanation": "<why this fits, honest>" } ],',
    '  "summary": string (1-2 sentences, plain English),',
    '  "caveat": string (optional — honest note about live vs roadmap)',
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

function sanitizeExplanation(llmText: string | undefined, displayName: string, risk: number): string {
  const base = `Deterministic risk score for ${displayName}: ${risk}/100.`;
  const prose = (llmText ?? "").trim();
  return prose ? `${base} ${prose}` : base;
}

/** Build the structured proposal from a parsed LLM proposal + the live universe. */
export function assembleStrategy(parsed: LlmProposal, venues: Venues): ProposeResult {
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

  const requested = (parsed.allocations ?? []).filter((a) => a.protocol);
  const unknown = requested.map((a) => a.protocol!).filter((p) => !(p in venues));
  if (unknown.length > 0) {
    return {
      status: "refused",
      reason_code: "UNSUPPORTED_PROTOCOL",
      reason: `Requested market(s) not in the live universe: ${unknown.slice(0, 3).join(", ")}.`,
    };
  }

  const effective =
    requested.length > 0
      ? requested
      : Object.keys(venues)
          .filter((k) => scoreProtocol(venues[k]!.risk) <= maxRisk)
          .sort((a, b) => venues[b]!.tvlUsd - venues[a]!.tvlUsd)
          .slice(0, 3)
          .map((p) => ({ protocol: p, weight_pct: undefined, explanation: undefined }));

  const kept = effective.filter((a) => scoreProtocol(venues[a.protocol!]!.risk) <= maxRisk);
  if (kept.length === 0) {
    return {
      status: "refused",
      reason_code: "RISK_MANDATE_CONTRADICTION",
      reason:
        `No market in the live universe has a deterministic risk score at or below ` +
        `the requested cap of ${maxRisk}. Raise the risk ceiling or lower the target.`,
    };
  }

  const rawWeights = kept.map((a) =>
    typeof a.weight_pct === "number" && a.weight_pct > 0 ? a.weight_pct : 1,
  );
  const weightSum = rawWeights.reduce((x, y) => x + y, 0);
  const weights = rawWeights.map((w) => Math.round((w / weightSum) * 100));
  const drift = 100 - weights.reduce((x, y) => x + y, 0);
  if (weights.length > 0) weights[0] += drift;

  const allocations: Allocation[] = [];
  const allowedProtocols = new Set<string>();
  const allowedChains = new Set<string>();
  let blendedApy = 0;

  kept.forEach((a, i) => {
    const v = venues[a.protocol!]!;
    const risk = scoreProtocol(v.risk);
    const w = weights[i]!;
    allowedProtocols.add(v.displayName);
    allowedChains.add(v.chain);
    blendedApy += (v.apyBps * w) / 100;
    allocations.push({
      label: v.displayName,
      protocol: v.slug,
      chain: v.chainLabel,
      weightPct: w,
      sourceOfYield: v.sourceOfYield,
      riskScore: risk,
      riskLabel: riskLabel(risk),
      explanation: sanitizeExplanation(a.explanation, v.displayName, risk),
      mechanics: v.mechanics,
      riskFactors: scoreBreakdown(v.risk),
      category: v.category,
      exposure: v.asset,
      keyRisk: v.keyRisk,
      apyBps: v.apyBps,
      apyMarket: v.market,
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
    allowed_protocols: Array.from(allowedProtocols),
    allowed_chains: Array.from(allowedChains),
    max_share_per_protocol_bps: 5000,
    max_loss_bps: clampInt(parsed.max_loss_bps, 0, 10_000, 300),
    daily_cap_usdc: normalizeU128(parsed.daily_cap_usdc, "5000000000"),
    committee_threshold_usdc: "0",
  };

  const categories = Array.from(new Set(kept.map((a) => venues[a.protocol!]!.category)));
  const riskBreakdown =
    `Blended portfolio risk is ${portfolioRisk}/100 (${riskLabel(portfolioRisk)}), ` +
    `under your mandate cap of ${maxRisk}. This mix spans ${categories.join(", ")}; the main ` +
    `risk drivers are smart-contract exposure, oracle dependence where present, and any asset-price ` +
    `exposure you opted into. The on-chain mandate hard-caps risk at ${maxRisk}, limits any single ` +
    `venue to ${mandate.max_share_per_protocol_bps / 100}% of the vault, and bounds ` +
    `loss to ${mandate.max_loss_bps / 100}%.`;

  const roadmap = Array.from(
    new Set(allocations.filter((al) => !venues[al.protocol]!.live).map((al) => al.label)),
  );
  const liveNote =
    roadmap.length > 0
      ? `Live on-chain execution today settles Rhea (NEAR) and Morpho (Ethereum); ` +
        `${roadmap.join(", ")} ${roadmap.length === 1 ? "is" : "are"} real markets in the ` +
        `YieldAI universe (execution on the roadmap).`
      : "";
  const llmCaveat = parsed.caveat?.trim();
  const caveat = [llmCaveat, liveNote].filter(Boolean).join(" ") || undefined;

  const strategy: ProposedStrategy = {
    summary:
      parsed.summary?.trim() ||
      `Targeting ~${(expectedApyBps / 100).toFixed(1)}% APY across ${allocations.length} market(s) (${categories.join(", ")}), risk-capped at ${maxRisk}/100.`,
    caveat,
    expectedApyBps,
    riskLevel: riskLabel(portfolioRisk),
    allocations,
    riskBreakdown,
    mandate,
  };

  return { status: "proposed", strategy };
}

/** Full propose: build the live universe, validate, call the LLM, assemble. */
export async function proposeStrategy(brief: string, cfg?: LlmConfig): Promise<ProposeResult> {
  if (!brief || brief.trim().length < 3) {
    return { status: "refused", reason_code: "MALFORMED_BRIEF", reason: "The brief is empty or too short to interpret." };
  }

  const config = cfg ?? readLlmConfig();
  const venues = await buildShortlist();
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(venues) },
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
      reason: `Could not interpret the brief into a strategy: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return assembleStrategy(parsed, venues);
}

/** Refine: feed the prior strategy + the user's message back through the LLM. */
export async function refineStrategy(
  brief: string,
  priorStrategy: ProposedStrategy,
  message: string,
  cfg?: LlmConfig,
): Promise<ProposeResult> {
  if (!message || message.trim().length < 2) {
    return { status: "refused", reason_code: "MALFORMED_BRIEF", reason: "The refinement message is empty." };
  }
  const config = cfg ?? readLlmConfig();
  const venues = await buildShortlist();

  const priorSummary = JSON.stringify({
    summary: priorStrategy.summary,
    expectedApyBps: priorStrategy.expectedApyBps,
    mandate: priorStrategy.mandate,
    allocations: priorStrategy.allocations.map((a) => ({ protocol: a.protocol, weight_pct: a.weightPct })),
  });

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(venues) },
    { role: "user", content: `Original brief: ${brief}` },
    { role: "assistant", content: `Here is the current proposal I drafted: ${priorSummary}` },
    { role: "user", content: `Update the proposal based on this feedback, returning the same JSON shape: ${message}` },
  ];

  let parsed: LlmProposal;
  try {
    const raw = await chatJson(messages, config, { temperature: 0.2 });
    parsed = JSON.parse(raw) as LlmProposal;
  } catch (err) {
    return {
      status: "refused",
      reason_code: "LLM_ERROR",
      reason: `Could not apply the refinement: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return assembleStrategy(parsed, venues);
}
