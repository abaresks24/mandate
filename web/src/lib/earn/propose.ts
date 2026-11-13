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
        | "UNACHIEVABLE_GOAL"
        | "ASSET_UNAVAILABLE"
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

// Hard, non-LLM guardrails. These run REGARDLESS of what the LLM returns, so a
// jailbroken or over-eager model cannot talk the product into an impossible promise.
const MAX_REALISTIC_APY_BPS = 2500; // 25% — above this at LOW risk is a scam signal
const ABSOLUTE_MAX_APY_BPS = 8000; // 80% — above this at ANY risk is simply not achievable
const LOW_RISK_CAP = 25;

// What YieldAI actually does — reused in every "that's not possible" message so the
// refusal teaches instead of just saying no.
const WHAT_IT_DOES =
  "YieldAI puts the capital you deposit to work in real on-chain yield markets. It " +
  "grows a deposit at prevailing market rates — it does not create principal, multiply " +
  "your money on demand, or guarantee a fixed future amount.";

/**
 * Catch "goal" briefs that no yield strategy can satisfy: get-rich-quick multipliers
 * ("double my money", "10x", "100x", "moon"), explicit get-rich language, and asking
 * to HOLD millions of units of a crypto asset ("2M BTC", "2 million bitcoin"). This is
 * a deterministic backstop; the LLM is instructed to refuse these too, but this layer
 * cannot be argued with. Kept conservative so a legitimate deposit ("invest 2M in
 * stablecoins") is NOT refused — amount alone is never the trigger.
 */
export function detectUnachievableGoal(brief: string): { reason: string } | null {
  const t = ` ${brief.toLowerCase()} `;

  // Multipliers & get-rich-quick phrasing.
  const multiplier =
    /\b\d{1,4}\s?x\b/.test(t) || // 10x, 100x
    /\bx\s?\d{2,}\b/.test(t) || // x100
    /\b(double|triple|quadruple|moon|to the moon|get rich|getting rich|become rich|millionaire|millionnaire|retire early)\b/.test(
      t,
    ) ||
    /\b(multiply|multipli\w+)\b[\s\S]{0,20}\b(money|capital|funds?|deposit|invest\w*)\b/.test(t);

  // Holding millions/billions of UNITS of a VOLATILE asset ("2M BTC", "2 million eth").
  // Stablecoins are excluded — "2M USDC" is just a $2M deposit, a normal principal.
  const assetUnitsInMillions =
    /\b\d[\d.,]*\s?(m|mm|bn|b)\b[\s\S]{0,6}\b(btc|bitcoin|eth|ether|sol|near)\b/.test(t) ||
    /\b(million|millions|billion|billions|milliard\w*)\b[\s\S]{0,6}\b(btc|bitcoin|eth|ether|sol|near)\b/.test(t);

  if (multiplier || assetUnitsInMillions) {
    return {
      reason:
        `${WHAT_IT_DOES} There is no strategy that turns a deposit into a target like ` +
        `this, multiplies your capital on demand, or makes you rich quickly — anything ` +
        `promising that is a scam. Tell me how much you want to deposit and your risk ` +
        `appetite, and I'll show you the realistic yield on it.`,
    };
  }
  return null;
}

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

function systemPrompt(venues: Venues, assetLock: string | null): string {
  // When exposure is pinned, only show venues of that asset so the model literally
  // cannot pick something that would rotate the user out of their asset.
  const shown: Venues = assetLock
    ? Object.fromEntries(Object.entries(venues).filter(([, v]) => v.asset === assetLock))
    : venues;

  const lockLine = assetLock
    ? [
        "",
        `HARD CONSTRAINT — EXPOSURE LOCK: the user holds ${ASSET_LABEL[assetLock] ?? assetLock} and`,
        `wants yield ON ${ASSET_LABEL[assetLock] ?? assetLock}. EVERY allocation MUST keep`,
        `${ASSET_LABEL[assetLock] ?? assetLock} exposure. Pick ONLY from the venues below (they are`,
        `already filtered to ${ASSET_LABEL[assetLock] ?? assetLock}). NEVER swap into ETH, stablecoins,`,
        `or any other asset to chase yield — staying exposed to the user's asset is the whole point.`,
        "",
      ]
    : [];

  return [
    "You are YieldAI's strategy drafter. You convert a user's investment brief",
    "into a PROPOSED on-chain yield strategy. Respond ONLY with a JSON object.",
    "",
    "ALWAYS respond in ENGLISH. Every text field (summary, each allocation",
    "explanation, caveat, refusal_reason) MUST be in English, even if the brief is",
    "in another language.",
    ...lockLine,
    "",
    "You do NOT compute risk scores — a separate deterministic module does that.",
    "Your job: read the brief, then DESIGN A STRATEGY by picking a handful of",
    "markets from the LIVE universe below, assigning each a weight %, and writing an",
    "honest explanation. Use the EXACT slug key (the quoted string) for each pick.",
    "",
    "THE LIVE MARKET UNIVERSE (slug · protocol · market · chain · category · exposure · APY · TVL · LIVE/roadmap):",
    venueBrief(shown),
    "",
    "DESIGN DIFFERENT STRATEGIES FOR DIFFERENT BRIEFS:",
    "- Match RISK APPETITE: conservative → deep blue-chip lending (Aave, Morpho,",
    "  Compound), savings/RWA (Sky, Ondo); balanced → fixed-rate (Pendle),",
    "  delta-neutral (Ethena), liquid staking; aggressive → LP, restaking, newer",
    "  high-APY markets. Deeper TVL = safer, all else equal.",
    "- HONOR asset-exposure wishes via the `exposure` tag: BTC → BTC venues; ETH →",
    "  ETH staking/restaking; NEAR → NEAR venues; 'no volatility' → stablecoin only.",
    "  CRITICAL: if the user already holds an asset and wants yield ON it, EVERY",
    "  allocation must KEEP that exposure (exposure tag == their asset). Earning yield",
    "  on BTC means staying in BTC-denominated venues — never swap BTC into ETH or",
    "  stablecoins to chase a rate; that would drop the exposure they asked to keep.",
    "- You may pick SEVERAL markets from the same protocol (e.g. two Morpho markets)",
    "  when it fits. Typically 2-5 markets across categories. Vary the mix per brief.",
    "",
    "HONESTY: only venues marked LIVE settle on testnet today (Rhea on NEAR, Morpho",
    "on Ethereum). You MAY include roadmap venues when they fit — if you do, say so",
    "plainly in `caveat`. Never claim a roadmap venue is already executing.",
    "",
    "REFUSE (set realistic=false and write refusal_reason) for briefs no yield strategy",
    "can satisfy. Be honest and firm — do not flatter an impossible ask. Refuse when:",
    "- the target return is unrealistic: anything above ~80% APY, or above ~25% APY while",
    "  also demanding low/zero risk (e.g. '1000% a year', '40% APY with no risk').",
    "- the brief is a get-rich-quick / multiplier goal: 'double my money', '10x', '100x',",
    "  'make me a millionaire', 'moon'. Yield grows a deposit at market rates; it cannot",
    "  multiply capital on demand.",
    "- the brief asks to HOLD an absurd amount of an asset ('I want 2M BTC'). The agent",
    "  only puts the capital the user deposits to work; it does not manufacture principal.",
    "- the brief is empty or nonsense.",
    "In refusal_reason, briefly explain WHAT the agent does (grows a deposit at realistic",
    "market rates) and WHY the ask is impossible, then invite a realistic brief (deposit",
    "size + risk appetite). Never promise a fixed future amount.",
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
  // Above the absolute ceiling, refuse at ANY risk level — no real on-chain market
  // sustains this, so e.g. "1000% a year" is rejected even if risk tolerance is high.
  if (targetApyBps > ABSOLUTE_MAX_APY_BPS) {
    return {
      reason:
        `A target of ${(targetApyBps / 100).toFixed(0)}% APY is not achievable on-chain. ` +
        `${WHAT_IT_DOES} The deepest real markets in its universe pay a small fraction of ` +
        `this; realistic stablecoin yields are low single digits, and even aggressive ` +
        `strategies rarely clear a few tens of percent — with real risk of loss. Anything ` +
        `promising returns like this is a scam.`,
    };
  }
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

// Human labels for the asset tags carried by every venue.
const ASSET_LABEL: Record<string, string> = {
  btc: "BTC",
  eth: "ETH",
  sol: "SOL",
  near: "NEAR",
  stablecoin: "stablecoins",
};

/**
 * Detect the asset the user already HOLDS / wants yield ON, so the strategy keeps
 * that exposure instead of silently swapping it away. "I have a BTC and want yield
 * on it" must stay BTC-denominated — never rotate into ETH or stables.
 *
 * Returns an asset tag (matching Venue.asset) or null when the brief doesn't pin one.
 * Conservative: requires BOTH the asset name AND a holding/yield cue, so an incidental
 * mention ("near zero risk") never locks exposure. If the user names two volatile
 * assets ("BTC and ETH"), we don't force a single lock — they opted into a basket.
 */
export function detectAssetLock(brief: string): string | null {
  const t = ` ${brief.toLowerCase()} `;

  const groups: { tag: string; re: RegExp }[] = [
    { tag: "btc", re: /\b(btc|bitcoin|wbtc|lbtc|cbbtc|tbtc|sbtc)\b/ },
    { tag: "eth", re: /\b(eth|ether|ethereum|weth|steth|wsteth|reth|weeth|eeth)\b/ },
    { tag: "sol", re: /\b(sol|solana|msol|jitosol)\b/ },
    // Bare "near" is a common English word — only lock on unambiguous forms.
    {
      tag: "near",
      re: /\b(stnear|linear)\b|\b(my|mon|ma|mes|des|du|stake|staking|hold|holding)\s+near\b|\bnear\s+(token|staking|exposure|position|holdings?)\b/,
    },
    { tag: "stablecoin", re: /\b(usdc|usdt|dai|usds|stablecoins?|stable|dollars?)\b/ },
  ];

  const found = groups.filter((g) => g.re.test(t)).map((g) => g.tag);
  if (found.length === 0) return null;

  // A holding / "yield on" cue — otherwise a passing mention shouldn't pin exposure.
  const hasCue =
    /\b(i\s*(have|hold|own|'?ve|got)|i've|my|our|mon|ma|mes|j'?ai|j\s+ai|on\s+(my|some|the|this|it)|sur\s+(du|le|la|des|mon|ma|ce|mes)|rendement\s+sur|yield\s+on|earn\s+on|return\s+on|keep|stay|rester|garder|conserver|expos\w+|holding|stack|bag|denominated)\b/.test(
      t,
    );
  if (!hasCue) return null;

  const uniqVolatile = Array.from(new Set(found.filter((f) => f !== "stablecoin")));
  // One volatile asset named with a cue → lock it (the important case: BTC/ETH/…).
  if (uniqVolatile.length === 1) return uniqVolatile[0]!;
  // No volatile asset, only stablecoins → lock stablecoins (no price exposure wanted).
  if (uniqVolatile.length === 0 && found.includes("stablecoin")) return "stablecoin";
  // Several volatile assets named → the user opted into a basket; don't force one.
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
export function assembleStrategy(
  parsed: LlmProposal,
  venues: Venues,
  assetLock: string | null = null,
): ProposeResult {
  // Exposure lock: if the user wants yield on a specific asset, every venue the
  // strategy may touch must be denominated in that asset — no silent rotation.
  if (assetLock) {
    const assetVenues = Object.fromEntries(
      Object.entries(venues).filter(([, v]) => v.asset === assetLock),
    );
    if (Object.keys(assetVenues).length === 0) {
      return {
        status: "refused",
        reason_code: "ASSET_UNAVAILABLE",
        reason:
          `To earn yield on ${ASSET_LABEL[assetLock] ?? assetLock} you must stay exposed to ` +
          `${ASSET_LABEL[assetLock] ?? assetLock} the whole time — rotating into another asset ` +
          `would drop that exposure. Right now the live universe has no ` +
          `${ASSET_LABEL[assetLock] ?? assetLock}-denominated yield market that clears our TVL and ` +
          `rate floors, so there is no honest strategy to propose. Try a different asset, or check ` +
          `back as markets refresh.`,
      };
    }
    venues = assetVenues; // everything below now operates on the locked asset only.
  }

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

  const allRequested = (parsed.allocations ?? []).filter((a) => a.protocol);
  // Under an exposure lock, `venues` is already restricted to the locked asset, so any
  // off-asset pick simply isn't present. Drop those silently and let the fallback fill
  // in from the locked asset's venues — never rotate the user out of their exposure.
  const requested = assetLock
    ? allRequested.filter((a) => a.protocol! in venues)
    : allRequested;
  if (!assetLock) {
    const unknown = requested.map((a) => a.protocol!).filter((p) => !(p in venues));
    if (unknown.length > 0) {
      return {
        status: "refused",
        reason_code: "UNSUPPORTED_PROTOCOL",
        reason: `Requested market(s) not in the live universe: ${unknown.slice(0, 3).join(", ")}.`,
      };
    }
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
  const lockNote = assetLock
    ? `Exposure stays in ${ASSET_LABEL[assetLock] ?? assetLock} throughout — every allocation is ` +
      `${ASSET_LABEL[assetLock] ?? assetLock}-denominated, so you keep full ${ASSET_LABEL[assetLock] ?? assetLock} ` +
      `price exposure while it earns.`
    : "";
  const llmCaveat = parsed.caveat?.trim();
  const caveat = [lockNote, llmCaveat, liveNote].filter(Boolean).join(" ") || undefined;

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

  const goal = detectUnachievableGoal(brief);
  if (goal) {
    return { status: "refused", reason_code: "UNACHIEVABLE_GOAL", reason: goal.reason };
  }

  const config = cfg ?? readLlmConfig();
  const venues = await buildShortlist();
  const assetLock = detectAssetLock(brief);
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(venues, assetLock) },
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

  return assembleStrategy(parsed, venues, assetLock);
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

  const goal = detectUnachievableGoal(message);
  if (goal) {
    return { status: "refused", reason_code: "UNACHIEVABLE_GOAL", reason: goal.reason };
  }

  const config = cfg ?? readLlmConfig();
  const venues = await buildShortlist();
  // The refine message can introduce/override the exposure; otherwise keep the brief's.
  const assetLock = detectAssetLock(message) ?? detectAssetLock(brief);

  const priorSummary = JSON.stringify({
    summary: priorStrategy.summary,
    expectedApyBps: priorStrategy.expectedApyBps,
    mandate: priorStrategy.mandate,
    allocations: priorStrategy.allocations.map((a) => ({ protocol: a.protocol, weight_pct: a.weightPct })),
  });

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(venues, assetLock) },
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

  return assembleStrategy(parsed, venues, assetLock);
}
