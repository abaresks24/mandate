// The YieldAI strategy universe. Risk facts here feed the DETERMINISTIC risk
// module — the LLM never sees or sets a score, it only picks from this menu and
// explains the number the module produces.
//
// Honesty: `live: true` entries (Rhea on NEAR, Morpho on Ethereum) are what the
// vault executes on testnet today (NEAR-native + Chain Signatures). The rest are
// the broader universe the agent allocates across; their on-chain execution is
// on the roadmap. The proposer surfaces this distinction in a caveat when a
// non-live venue is used — it never pretends a roadmap venue is already settling.

import type { ProtocolRiskInput } from "./risk";

export type AssetClass = "stablecoin" | "near" | "eth" | "btc" | "sol" | "basket";

export interface ProtocolCatalogueEntry {
  key: string;
  displayName: string;
  risk: ProtocolRiskInput;
  chain: string; // on-chain canonical id used by the mandate
  chainLabel: string; // human label for the table
  asset: AssetClass; // what asset the yield is denominated in / exposed to
  category: string; // short category label (lending, liquid staking, LP, …)
  default_apy_bps: number;
  market: string;
  token: string;
  live: boolean; // executed on testnet today vs. roadmap venue
  /** Where the yield actually comes from, in plain language. */
  sourceOfYield: string;
  /** How a move to this venue is executed. */
  mechanics: string;
}

function e(x: ProtocolCatalogueEntry): ProtocolCatalogueEntry {
  return x;
}

export const CATALOGUE: Record<string, ProtocolCatalogueEntry> = {
  // ─── Stablecoin lending (low risk, the backbone) ───
  rhea: e({
    key: "rhea", displayName: "Rhea", chain: "near", chainLabel: "NEAR",
    asset: "stablecoin", category: "USDC lending", default_apy_bps: 650,
    market: "ref-finance-101.testnet", token: "usdc", live: true,
    risk: { name: "rhea", audits: 3, tvl_usd: 120_000_000, age_days: 900, exploit_history: 0, oracle_dependency: false, yield_source: "lending" },
    sourceOfYield: "Borrowers pay variable interest on a USDC money market on NEAR. Your USDC is lent out; their interest is your yield. No price-oracle dependency.",
    mechanics: "Live on testnet. Supplied natively on NEAR from the vault's own account — no bridge.",
  }),
  "morpho-sepolia": e({
    key: "morpho-sepolia", displayName: "Morpho", chain: "ethereum-sepolia", chainLabel: "Ethereum",
    asset: "stablecoin", category: "USDC lending", default_apy_bps: 900,
    market: "0x0000000000000000000000000000000000000000", token: "usdc", live: true,
    risk: { name: "morpho-sepolia", audits: 4, tvl_usd: 800_000_000, age_days: 700, exploit_history: 0, oracle_dependency: true, yield_source: "lending" },
    sourceOfYield: "USDC supplied to an isolated Morpho lending market on Ethereum; borrowers pay interest. Higher yield, but depends on an external price oracle (an extra risk factor).",
    mechanics: "Live on testnet. Executed cross-chain from NEAR: the vault signs the Ethereum tx via Chain Signatures (MPC) — no bridge, no wrapped key.",
  }),
  aave: e({
    key: "aave", displayName: "Aave v3", chain: "ethereum", chainLabel: "Ethereum",
    asset: "stablecoin", category: "USDC lending", default_apy_bps: 520,
    market: "aave-v3-usdc", token: "usdc", live: false,
    risk: { name: "aave", audits: 5, tvl_usd: 12_000_000_000, age_days: 1600, exploit_history: 0, oracle_dependency: true, yield_source: "lending" },
    sourceOfYield: "The deepest blue-chip money market. USDC lent to overcollateralized borrowers; utilization sets the rate. Among the lowest smart-contract risk in DeFi.",
    mechanics: "Cross-chain supply via Chain Signatures (roadmap venue).",
  }),
  "aave-base": e({
    key: "aave-base", displayName: "Aave v3", chain: "base", chainLabel: "Base",
    asset: "stablecoin", category: "USDC lending", default_apy_bps: 600,
    market: "aave-v3-base-usdc", token: "usdc", live: false,
    risk: { name: "aave-base", audits: 5, tvl_usd: 1_500_000_000, age_days: 500, exploit_history: 0, oracle_dependency: true, yield_source: "lending" },
    sourceOfYield: "Aave v3 on Base — same mechanics as mainnet, often a slightly higher USDC rate thanks to L2 incentives.",
    mechanics: "Cross-chain supply to Base via Chain Signatures (roadmap venue).",
  }),
  fluid: e({
    key: "fluid", displayName: "Fluid", chain: "ethereum", chainLabel: "Ethereum",
    asset: "stablecoin", category: "USDC lending", default_apy_bps: 780,
    market: "fluid-usdc", token: "usdc", live: false,
    risk: { name: "fluid", audits: 3, tvl_usd: 900_000_000, age_days: 450, exploit_history: 0, oracle_dependency: true, yield_source: "lending" },
    sourceOfYield: "A capital-efficient lending market; smart collateral routes idle liquidity, lifting the USDC supply rate above vanilla Aave.",
    mechanics: "Cross-chain supply via Chain Signatures (roadmap venue).",
  }),

  // ─── Stablecoin — RWA / fixed / savings (low–moderate) ───
  sdai: e({
    key: "sdai", displayName: "Sky Savings", chain: "ethereum", chainLabel: "Ethereum",
    asset: "stablecoin", category: "savings rate", default_apy_bps: 700,
    market: "sdai", token: "dai", live: false,
    risk: { name: "sdai", audits: 5, tvl_usd: 2_000_000_000, age_days: 1200, exploit_history: 0, oracle_dependency: false, yield_source: "lending" },
    sourceOfYield: "The Sky (ex-MakerDAO) savings rate — yield paid from protocol fees and RWA/T-bill backing. No oracle, no borrower risk.",
    mechanics: "Deposit into the savings module (roadmap venue).",
  }),
  "ondo-usdy": e({
    key: "ondo-usdy", displayName: "Ondo USDY", chain: "ethereum", chainLabel: "Ethereum",
    asset: "stablecoin", category: "RWA — T-bills", default_apy_bps: 480,
    market: "usdy", token: "usdy", live: false,
    risk: { name: "ondo-usdy", audits: 3, tvl_usd: 600_000_000, age_days: 500, exploit_history: 0, oracle_dependency: false, yield_source: "lending" },
    sourceOfYield: "A tokenized note backed by short-term US Treasuries + bank deposits. Yield is the T-bill rate. Off-chain custody is the trade-off (RWA counterparty risk).",
    mechanics: "Mint/hold the RWA token (roadmap venue).",
  }),
  pendle: e({
    key: "pendle", displayName: "Pendle (fixed)", chain: "ethereum", chainLabel: "Ethereum",
    asset: "stablecoin", category: "fixed-rate", default_apy_bps: 1100,
    market: "pendle-pt-usdc", token: "usdc", live: false,
    risk: { name: "pendle", audits: 4, tvl_usd: 3_000_000_000, age_days: 900, exploit_history: 0, oracle_dependency: true, yield_source: "derivatives" },
    sourceOfYield: "Buy a Principal Token to LOCK a fixed USDC yield to maturity — you sell the variable part for a known rate. Rate risk if you exit early.",
    mechanics: "Buy PT on Pendle, hold to maturity (roadmap venue).",
  }),
  "ethena-susde": e({
    key: "ethena-susde", displayName: "Ethena sUSDe", chain: "ethereum", chainLabel: "Ethereum",
    asset: "stablecoin", category: "delta-neutral", default_apy_bps: 1500,
    market: "susde", token: "usde", live: false,
    risk: { name: "ethena-susde", audits: 4, tvl_usd: 3_500_000_000, age_days: 420, exploit_history: 0, oracle_dependency: true, yield_source: "derivatives" },
    sourceOfYield: "A delta-neutral basis trade: long staked-ETH, short ETH perps. Yield = staking + funding. Higher APY, but funding can turn negative and it leans on CEX hedges.",
    mechanics: "Hold sUSDe (roadmap venue). Carries derivatives/funding risk.",
  }),

  // ─── Liquid staking (moderate; NEAR / ETH exposure) ───
  linear: e({
    key: "linear", displayName: "LiNEAR", chain: "near", chainLabel: "NEAR",
    asset: "near", category: "liquid staking", default_apy_bps: 850,
    market: "linear-protocol.near", token: "near", live: false,
    risk: { name: "linear", audits: 2, tvl_usd: 90_000_000, age_days: 800, exploit_history: 0, oracle_dependency: false, yield_source: "staking" },
    sourceOfYield: "Liquid-stake NEAR for stNEAR: earn NEAR validator rewards and stay liquid. Yield is in NEAR — so you take NEAR price exposure.",
    mechanics: "Stake via the liquid-staking contract on NEAR (roadmap venue).",
  }),
  "meta-pool": e({
    key: "meta-pool", displayName: "Meta Pool", chain: "near", chainLabel: "NEAR",
    asset: "near", category: "liquid staking", default_apy_bps: 880,
    market: "meta-pool.near", token: "near", live: false,
    risk: { name: "meta-pool", audits: 2, tvl_usd: 70_000_000, age_days: 1000, exploit_history: 0, oracle_dependency: false, yield_source: "staking" },
    sourceOfYield: "NEAR liquid staking with instant-unstake liquidity. Validator rewards, denominated in NEAR.",
    mechanics: "Stake via Meta Pool on NEAR (roadmap venue).",
  }),
  "lido-steth": e({
    key: "lido-steth", displayName: "Lido (stETH)", chain: "ethereum", chainLabel: "Ethereum",
    asset: "eth", category: "liquid staking", default_apy_bps: 340,
    market: "steth", token: "eth", live: false,
    risk: { name: "lido-steth", audits: 5, tvl_usd: 25_000_000_000, age_days: 1500, exploit_history: 0, oracle_dependency: false, yield_source: "staking" },
    sourceOfYield: "Liquid-stake ETH for stETH — Ethereum validator rewards. The yield (and principal) is in ETH, so you hold ETH price exposure.",
    mechanics: "Stake via Lido (roadmap venue).",
  }),

  // ─── BTC yield (BTC exposure; moderate–elevated) ───
  "lombard-lbtc": e({
    key: "lombard-lbtc", displayName: "Lombard LBTC", chain: "ethereum", chainLabel: "Ethereum",
    asset: "btc", category: "BTC staking", default_apy_bps: 420,
    market: "lbtc", token: "btc", live: false,
    risk: { name: "lombard-lbtc", audits: 3, tvl_usd: 1_500_000_000, age_days: 300, exploit_history: 0, oracle_dependency: true, yield_source: "staking" },
    sourceOfYield: "Liquid-staked BTC (via Babylon) — real BTC exposure that also earns a staking yield. Yield and principal are in BTC.",
    mechanics: "Hold LBTC (roadmap venue). Gives genuine BTC exposure.",
  }),
  "solv-btc": e({
    key: "solv-btc", displayName: "Solv BTC", chain: "ethereum", chainLabel: "Ethereum",
    asset: "btc", category: "BTC yield", default_apy_bps: 560,
    market: "solvbtc", token: "btc", live: false,
    risk: { name: "solv-btc", audits: 2, tvl_usd: 700_000_000, age_days: 260, exploit_history: 0, oracle_dependency: true, yield_source: "derivatives" },
    sourceOfYield: "A yield-bearing BTC vault blending staking + basis strategies. More BTC yield, more moving parts (counterparty + strategy risk).",
    mechanics: "Hold SolvBTC (roadmap venue).",
  }),

  // ─── DEX liquidity (elevated; impermanent loss) ───
  "ref-lp": e({
    key: "ref-lp", displayName: "Ref USDC-NEAR LP", chain: "near", chainLabel: "NEAR",
    asset: "basket", category: "DEX liquidity", default_apy_bps: 1800,
    market: "ref-pool-usdc-near", token: "lp", live: false,
    risk: { name: "ref-lp", audits: 3, tvl_usd: 40_000_000, age_days: 900, exploit_history: 0, oracle_dependency: false, yield_source: "lp" },
    sourceOfYield: "Provide USDC-NEAR liquidity on Ref; earn swap fees + incentives. High APY, but you take NEAR exposure and impermanent loss if the price moves.",
    mechanics: "Add liquidity to the Ref AMM pool on NEAR (roadmap venue).",
  }),
  "uni-ethusdc": e({
    key: "uni-ethusdc", displayName: "Uniswap v3 ETH-USDC", chain: "ethereum", chainLabel: "Ethereum",
    asset: "basket", category: "concentrated LP", default_apy_bps: 1600,
    market: "univ3-eth-usdc", token: "lp", live: false,
    risk: { name: "uni-ethusdc", audits: 5, tvl_usd: 4_000_000_000, age_days: 1300, exploit_history: 0, oracle_dependency: false, yield_source: "lp" },
    sourceOfYield: "Concentrated ETH-USDC liquidity — fees are high but impermanent loss and range management make returns volatile.",
    mechanics: "Provide a concentrated range on Uniswap v3 (roadmap venue).",
  }),

  // ─── Restaking (elevated; newer) ───
  eigenlayer: e({
    key: "eigenlayer", displayName: "EigenLayer", chain: "ethereum", chainLabel: "Ethereum",
    asset: "eth", category: "restaking", default_apy_bps: 900,
    market: "eigen-restake", token: "eth", live: false,
    risk: { name: "eigenlayer", audits: 3, tvl_usd: 11_000_000_000, age_days: 420, exploit_history: 0, oracle_dependency: false, yield_source: "derivatives" },
    sourceOfYield: "Restake ETH to secure additional services (AVSs) on top of staking rewards. Extra yield, extra slashing surface — a newer, riskier primitive.",
    mechanics: "Restake stETH into EigenLayer (roadmap venue).",
  }),

  // ─── High-yield / newer farm (high) ───
  "hyper-usdc": e({
    key: "hyper-usdc", displayName: "HyperVault USDC", chain: "arbitrum", chainLabel: "Arbitrum",
    asset: "stablecoin", category: "incentivized vault", default_apy_bps: 2200,
    market: "hypervault-usdc", token: "usdc", live: false,
    risk: { name: "hyper-usdc", audits: 1, tvl_usd: 25_000_000, age_days: 90, exploit_history: 0, oracle_dependency: true, yield_source: "algorithmic" },
    sourceOfYield: "A newer incentivized USDC vault on Arbitrum — most of the APY is token emissions, which decay. High headline yield, thin audits, short track record.",
    mechanics: "Deposit into the incentivized vault (roadmap venue). Highest risk tier.",
  }),
};

export const CATALOGUE_KEYS = Object.keys(CATALOGUE);
