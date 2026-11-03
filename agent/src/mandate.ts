// brief -> mandate.
//
// Translates a natural-language brief into a proposed Mandate + up to 2
// allocation options. The DETERMINISTIC risk score is computed here (src/risk.ts);
// the LLM only EXPLAINS it. Unrealistic briefs are REFUSED with a structured
// reason. The LLM client is injected (interface) so tests use a mock.

import type { ChatMessage, LlmClient } from "./llm.js";
import { scoreProtocol } from "./risk.js";
import type {
  AllocationOption,
  BriefResult,
  Mandate,
  MandateRefusal,
  ProtocolRiskInput,
} from "./types.js";

// Catalogue of protocols the agent is allowed to allocate to, with the raw
// facts fed to the DETERMINISTIC risk module. In production these come from a
// data feed; here they are the known MANDATE demo set (see SPEC.md).
export interface ProtocolCatalogueEntry {
  risk: ProtocolRiskInput;
  chain: string;
  /** Template-builder metadata so propose.ts / allocations can be formed. */
  default_apy_bps: number;
  market: string;
  token: string;
}

export const DEFAULT_CATALOGUE: Record<string, ProtocolCatalogueEntry> = {
  rhea: {
    risk: {
      name: "rhea",
      audits: 3,
      tvl_usd: 120_000_000,
      age_days: 900,
      exploit_history: 0,
      oracle_dependency: false,
      yield_source: "lending",
    },
    chain: "near",
    default_apy_bps: 650,
    market: "ref-finance-101.testnet",
    token: "usdc",
  },
  "morpho-sepolia": {
    risk: {
      name: "morpho-sepolia",
      audits: 4,
      tvl_usd: 800_000_000,
      age_days: 700,
      exploit_history: 0,
      oracle_dependency: true,
      yield_source: "lending",
    },
    chain: "ethereum-sepolia",
    default_apy_bps: 900,
    market: "0x0000000000000000000000000000000000000000",
    token: "usdc",
  },
};

/** What the LLM is allowed to return — it NEVER sets risk_score. */
interface LlmProposal {
  realistic: boolean;
  refusal_reason?: string;
  owner?: string;
  target_apy_bps?: number;
  max_risk_score?: number;
  max_loss_bps?: number;
  daily_cap_usdc?: string;
  // chosen protocol names from the catalogue; agent fills risk + templates
  allocation_protocols?: string[];
  // per-protocol human explanation keyed by protocol name
  explanations?: Record<string, string>;
  summary?: string;
}

// Hard, non-LLM guardrails. Any yield promise above this with a low risk cap is
// categorically refused regardless of what the model says.
const MAX_REALISTIC_APY_BPS = 2500; // 25% — anything above is "too good to be true"
const LOW_RISK_CAP = 25; // max_risk_score at/below this is "no risk"

export interface BriefToMandateDeps {
  llm: LlmClient;
  catalogue?: Record<string, ProtocolCatalogueEntry>;
}

function systemPrompt(catalogueNames: string[]): string {
  return [
    "You are MANDATE's mandate drafter. Convert the user's investment brief into a",
    "structured mandate for an on-chain yield agent. Respond ONLY with JSON.",
    "",
    "You do NOT compute risk scores — a separate deterministic module does that.",
    "Your job: choose sane mandate parameters, pick up to 2 allocation protocols",
    "from the allowed catalogue, and write a human explanation for each choice.",
    "",
    `Allowed protocols: ${catalogueNames.join(", ")}.`,
    "",
    "REFUSE (set realistic=false, give refusal_reason) when the brief is",
    "self-contradictory or asks for the impossible, e.g. demands high APY with",
    "zero/near-zero risk (a classic '40% APY, no risk' ask), or requests protocols",
    "outside the catalogue.",
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
    '  "allocation_protocols": string[] (<=2, from the allowed list),',
    '  "explanations": { "<protocol>": "<why this fits the mandate>" },',
    '  "summary": string',
    "}",
  ].join("\n");
}

/** Deterministic pre-check: catch the "too good to be true" ask before we trust the LLM. */
export function detectUnrealistic(
  targetApyBps: number,
  maxRiskScore: number,
): MandateRefusal | null {
  if (targetApyBps > MAX_REALISTIC_APY_BPS && maxRiskScore <= LOW_RISK_CAP) {
    return {
      status: "refused",
      reason_code: "UNREALISTIC_APY",
      reason:
        `A target of ${(targetApyBps / 100).toFixed(1)}% APY with a maximum risk ` +
        `score of ${maxRiskScore} is not achievable. Sustainable on-chain yields ` +
        `at that risk level are far lower; such a promise is a hallmark of a scam.`,
    };
  }
  return null;
}

export async function briefToMandate(
  brief: string,
  deps: BriefToMandateDeps,
): Promise<BriefResult> {
  const catalogue = deps.catalogue ?? DEFAULT_CATALOGUE;
  const names = Object.keys(catalogue);

  if (!brief || brief.trim().length < 3) {
    return {
      status: "refused",
      reason_code: "MALFORMED_BRIEF",
      reason: "The brief is empty or too short to interpret.",
    };
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(names) },
    { role: "user", content: brief },
  ];

  let parsed: LlmProposal;
  try {
    const raw = await deps.llm.chat(messages, { temperature: 0.1 });
    parsed = JSON.parse(raw) as LlmProposal;
  } catch (err) {
    return {
      status: "refused",
      reason_code: "MALFORMED_BRIEF",
      reason: `Could not interpret the brief into a mandate: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  // LLM-signalled refusal.
  if (parsed.realistic === false) {
    return {
      status: "refused",
      reason_code: "UNREALISTIC_APY",
      reason:
        parsed.refusal_reason ??
        "The brief could not be satisfied as stated (unrealistic risk/return).",
    };
  }

  const targetApy = clampInt(parsed.target_apy_bps, 0, 100_000, 0);
  const maxRisk = clampInt(parsed.max_risk_score, 0, 100, 60);

  // Deterministic guardrail wins over the LLM.
  const unrealistic = detectUnrealistic(targetApy, maxRisk);
  if (unrealistic) return unrealistic;

  // Resolve allocation protocols; reject anything outside the catalogue.
  const requested = (parsed.allocation_protocols ?? []).slice(0, 2);
  const unknown = requested.filter((p) => !(p in catalogue));
  if (unknown.length > 0) {
    return {
      status: "refused",
      reason_code: "UNSUPPORTED_PROTOCOL",
      reason: `Requested protocol(s) not in the allowed catalogue: ${unknown.join(", ")}.`,
    };
  }

  // Fall back to all catalogue entries that fit the risk cap if the LLM named none.
  const chosen =
    requested.length > 0
      ? requested
      : names
          .filter((n) => scoreProtocol(catalogue[n]!.risk) <= maxRisk)
          .slice(0, 2);

  const allocations: AllocationOption[] = [];
  const allowedProtocols: string[] = [];
  const allowedChains = new Set<string>();

  for (const name of chosen) {
    const entry = catalogue[name]!;
    // DETERMINISTIC — computed here, never by the LLM.
    const risk = scoreProtocol(entry.risk);
    if (risk > maxRisk) {
      // Skip protocols that breach the mandate's own risk cap.
      continue;
    }
    allowedProtocols.push(name);
    allowedChains.add(entry.chain);
    allocations.push({
      label: name,
      protocol: name,
      risk_score: risk,
      explanation: sanitizeExplanation(parsed.explanations?.[name], name, risk),
      estimated_apy_bps: entry.default_apy_bps,
      template: buildTemplate(name, entry),
    });
  }

  if (allocations.length === 0) {
    return {
      status: "refused",
      reason_code: "RISK_MANDATE_CONTRADICTION",
      reason:
        `No allowed protocol has a deterministic risk score at or below the ` +
        `requested cap of ${maxRisk}. Raise max_risk_score or lower target APY.`,
    };
  }

  const mandate: Mandate = {
    owner: parsed.owner?.trim() || "owner.testnet",
    target_apy_bps: targetApy,
    max_risk_score: maxRisk,
    allowed_protocols: allowedProtocols,
    allowed_chains: [...allowedChains],
    max_share_per_protocol_bps: 5000,
    max_loss_bps: clampInt(parsed.max_loss_bps, 0, 10_000, 300),
    daily_cap_usdc: normalizeU128(parsed.daily_cap_usdc, "5000000000"),
    committee_threshold_usdc: "0", // committee PERMANENT (SPEC default)
  };

  return {
    status: "proposed",
    mandate,
    allocations,
    summary:
      parsed.summary?.trim() ||
      `Proposed mandate targeting ${(targetApy / 100).toFixed(1)}% APY with a ` +
        `risk cap of ${maxRisk} across ${allocations.length} allocation(s).`,
  };
}

function buildTemplate(
  name: string,
  entry: ProtocolCatalogueEntry,
): AllocationOption["template"] {
  if (entry.chain === "near") {
    return {
      kind: "SupplyRhea",
      token: entry.token,
      amount: "1000000000", // 1,000 USDC default unit; vault re-scales within caps
      market: entry.market,
    };
  }
  return {
    kind: "AllocateCrossChain",
    chain: entry.chain,
    protocol: name.replace(/-sepolia$/, ""),
    market: entry.market,
    amount: "1000000000",
    max_slippage_bps: 50,
  };
}

/** The LLM authors prose but must never be able to inject a number as the score. */
function sanitizeExplanation(
  llmText: string | undefined,
  name: string,
  risk: number,
): string {
  const base = `Deterministic risk score for ${name}: ${risk}/100.`;
  const prose = (llmText ?? "").trim();
  return prose ? `${base} ${prose}` : base;
}

function clampInt(
  v: number | undefined,
  lo: number,
  hi: number,
  fallback: number,
): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

function normalizeU128(v: string | undefined, fallback: string): string {
  if (typeof v !== "string") return fallback;
  if (!/^\d+$/.test(v.trim())) return fallback;
  return v.trim();
}
