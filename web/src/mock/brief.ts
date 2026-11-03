import { BriefProposal } from "@/lib/types";
import { MANDATE } from "./mandate";

// Deterministic risk scoring lives in the agent service (TS). The LLM only
// explains. These mock proposals mirror that contract's output shape.

const REALISTIC: BriefProposal = {
  refused: false,
  mandate: MANDATE,
  explanation:
    "Brief parsed as: moderate yield, capital-preservation bias, happy to go cross-chain if the risk budget allows. Target 8% APY with a 60/100 risk ceiling. Two allocation options proposed below; both stay inside the mandate rules.",
  options: [
    {
      id: "opt-rhea",
      label: "Conservative — Rhea USDC supply (NEAR only)",
      template: {
        kind: "SupplyRhea",
        token: "usdc",
        amount: "3000000000",
        market: "ref-finance-101.testnet",
      },
      expected_apy_bps: 740,
      risk_score: 28,
      risk_explanation:
        "Low risk. Native NEAR market the vault contract can read directly — no committee needed. Mature protocol, no cross-chain hop, single oracle dependency.",
      risk_factors: [
        { factor: "Audits", weight: -8, note: "2 audits, bug bounty live" },
        { factor: "TVL", weight: -6, note: "deep testnet + mainnet liquidity" },
        { factor: "Age", weight: -4, note: "> 2y in production" },
        { factor: "Exploit history", weight: 4, note: "1 minor historical incident" },
        { factor: "Oracle dependency", weight: 6, note: "single price feed" },
        { factor: "Yield source", weight: 36, note: "lending demand, variable" },
      ],
    },
    {
      id: "opt-morpho",
      label: "Balanced — Morpho USDC on Sepolia (cross-chain)",
      template: {
        kind: "AllocateCrossChain",
        chain: "ethereum-sepolia",
        protocol: "morpho",
        market: "0x3a85b...c21",
        amount: "2000000000",
        max_slippage_bps: 50,
      },
      expected_apy_bps: 910,
      risk_score: 44,
      risk_explanation:
        "Moderate risk. Higher yield, but the funds leave NEAR via Chain Signatures and the vault contract CANNOT read Sepolia state — so a drawn guardian committee must attest price/slippage/liveness before execution. The cross-chain hop and bridge-of-trust add risk weight.",
      risk_factors: [
        { factor: "Audits", weight: -7, note: "multiple audits (Morpho Blue)" },
        { factor: "TVL", weight: -5, note: "large mainnet TVL, thin on Sepolia" },
        { factor: "Age", weight: -3, note: "established protocol" },
        { factor: "Exploit history", weight: 3, note: "no core exploit" },
        { factor: "Oracle dependency", weight: 8, note: "Pyth + market oracle" },
        { factor: "Cross-chain", weight: 18, note: "Chain Signatures + unreadable remote state" },
        { factor: "Yield source", weight: 30, note: "isolated lending market" },
      ],
    },
  ],
};

const REFUSAL: BriefProposal = {
  refused: true,
  refusal_reason:
    "Refusing this brief. A 40% APY with 'no risk' is not realizable on the allowed protocols. The deterministic risk model floors any 40%-target allocation at a risk score of 90+/100 (leverage loops, unaudited venues, or depeg-exposed assets), which exceeds every sane mandate ceiling. The agent will not propose a Mandate it cannot honor. Lower the target to <= 12% APY or raise the risk ceiling and I'll propose real options.",
  options: [],
};

export function mockBrief(brief: string): BriefProposal {
  const t = brief.toLowerCase();
  const asksHighYield = /\b(40|45|50|60|100)\s*%/.test(t) || t.includes("40%");
  const asksNoRisk =
    t.includes("no risk") ||
    t.includes("risk-free") ||
    t.includes("riskless") ||
    t.includes("sans risque") ||
    t.includes("guaranteed");
  if (asksHighYield && asksNoRisk) return REFUSAL;
  if (asksHighYield) return REFUSAL;
  return REALISTIC;
}

export const EXAMPLE_GOOD =
  "Grow my USDC conservatively, target around 8% APY, keep risk moderate, cross-chain is fine if it's worth it.";
export const EXAMPLE_BAD = "I want 40% APY with no risk.";
