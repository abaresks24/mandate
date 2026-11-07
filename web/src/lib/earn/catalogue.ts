// The protocol universe MANDATE actually supports. Ported from
// agent/src/mandate.ts DEFAULT_CATALOGUE. Risk facts here feed the
// DETERMINISTIC risk module — the LLM never sees or sets a score.

import type { ProtocolRiskInput } from "./risk";

export interface ProtocolCatalogueEntry {
  key: string;
  displayName: string;
  risk: ProtocolRiskInput;
  chain: string; // on-chain canonical id used by the mandate
  chainLabel: string; // human label for the table
  default_apy_bps: number;
  market: string;
  token: string;
  /** Where the yield actually comes from, in plain language. */
  sourceOfYield: string;
  /** How a move to this protocol is executed by the real system. */
  mechanics: string;
}

export const CATALOGUE: Record<string, ProtocolCatalogueEntry> = {
  rhea: {
    key: "rhea",
    displayName: "Rhea",
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
    chainLabel: "NEAR",
    default_apy_bps: 650,
    market: "ref-finance-101.testnet",
    token: "usdc",
    sourceOfYield:
      "Borrowers pay variable interest to supply a USDC money market on NEAR. Your USDC is lent out; the interest borrowers pay is the yield. No price-oracle dependency.",
    mechanics:
      "Executed natively on NEAR via a SupplyRhea action — the vault supplies USDC directly from its own NEAR account, no bridge involved.",
  },
  "morpho-sepolia": {
    key: "morpho-sepolia",
    displayName: "Morpho",
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
    chainLabel: "Ethereum (Sepolia)",
    default_apy_bps: 900,
    market: "0x0000000000000000000000000000000000000000",
    token: "usdc",
    sourceOfYield:
      "USDC supplied to a Morpho lending market on Ethereum; borrowers pay interest. Higher potential yield, but the market relies on an external price oracle (an extra risk factor in the score).",
    mechanics:
      "Executed cross-chain from NEAR: the vault signs the Ethereum transaction via Chain Signatures (MPC) — no bridge, no wrapped key. The NEAR account controls the EVM address directly.",
  },
};

export const CATALOGUE_KEYS = Object.keys(CATALOGUE);
