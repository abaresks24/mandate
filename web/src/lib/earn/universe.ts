// The LIVE market universe. Instead of a fixed hand-written list, YieldAI pulls
// real markets from DefiLlama for an allowlist of reputable protocols (Morpho,
// Aave, Euler, Fluid, Compound, Spark, plus savings/RWA/staking/BTC/LP/restaking
// venues), with real APY / TVL per specific market. A protocol like Morpho has
// many markets — we surface the top ones and name each. On any failure we fall
// back to the static catalogue so the flow never breaks.

import { fetchPools, type LlamaPool } from "./apy";
import { CATALOGUE } from "./catalogue";
import type { ProtocolRiskInput, YieldSource } from "./risk";

export interface Venue {
  slug: string; // LLM-facing key, e.g. "morpho-blue:steakusdc:ethereum"
  displayName: string; // protocol, e.g. "Morpho"
  market: string; // specific market symbol, e.g. "STEAKUSDC"
  chain: string; // canonical chain id for the mandate
  chainLabel: string;
  asset: string; // stablecoin / eth / btc / near / sol / basket
  category: string;
  apyBps: number;
  tvlUsd: number;
  risk: ProtocolRiskInput;
  sourceOfYield: string;
  mechanics: string;
  keyRisk: string;
  live: boolean; // executable on testnet today (Rhea, Morpho)
}

// Per-protocol baseline for the DETERMINISTIC risk score. The market's live TVL
// is layered on top; audits/age/exploit history/oracle are protocol-level facts.
interface Proto {
  name: string;
  audits: number;
  age_days: number;
  exploit_history: number;
  oracle: boolean;
  ys: YieldSource;
  category: string;
  live?: boolean;
}

const PROTO: Record<string, Proto> = {
  // ─ Lending (many markets each) ─
  "aave-v3": { name: "Aave v3", audits: 5, age_days: 1600, exploit_history: 0, oracle: true, ys: "lending", category: "lending" },
  "morpho-blue": { name: "Morpho", audits: 4, age_days: 800, exploit_history: 0, oracle: true, ys: "lending", category: "lending", live: true },
  "euler-v2": { name: "Euler v2", audits: 3, age_days: 450, exploit_history: 1, oracle: true, ys: "lending", category: "lending" },
  "fluid-lending": { name: "Fluid", audits: 3, age_days: 520, exploit_history: 0, oracle: true, ys: "lending", category: "lending" },
  "aave-v4": { name: "Aave v4", audits: 4, age_days: 200, exploit_history: 0, oracle: true, ys: "lending", category: "lending" },
  "compound-v3": { name: "Compound v3", audits: 5, age_days: 1400, exploit_history: 0, oracle: true, ys: "lending", category: "lending" },
  sparklend: { name: "Spark", audits: 4, age_days: 700, exploit_history: 0, oracle: true, ys: "lending", category: "lending" },
  maple: { name: "Maple", audits: 3, age_days: 1000, exploit_history: 0, oracle: false, ys: "lending", category: "institutional lending" },
  gearbox: { name: "Gearbox", audits: 3, age_days: 700, exploit_history: 0, oracle: true, ys: "derivatives", category: "leveraged yield" },
  // NEAR lending
  "rhea-lend": { name: "Rhea", audits: 3, age_days: 900, exploit_history: 0, oracle: false, ys: "lending", category: "lending", live: true },
  burrow: { name: "Burrow", audits: 2, age_days: 900, exploit_history: 0, oracle: true, ys: "lending", category: "lending" },
  // ─ Savings / RWA / yield stablecoins ─
  "sky-lending": { name: "Sky Savings", audits: 5, age_days: 1200, exploit_history: 0, oracle: false, ys: "lending", category: "savings rate" },
  usual: { name: "Usual", audits: 3, age_days: 420, exploit_history: 0, oracle: true, ys: "lending", category: "yield stablecoin" },
  "ondo-finance": { name: "Ondo", audits: 3, age_days: 520, exploit_history: 0, oracle: false, ys: "lending", category: "RWA — T-bills" },
  "ondo-yield-assets": { name: "Ondo", audits: 3, age_days: 520, exploit_history: 0, oracle: false, ys: "lending", category: "RWA — T-bills" },
  // ─ Fixed-rate / delta-neutral ─
  "pendle-v2": { name: "Pendle", audits: 4, age_days: 900, exploit_history: 0, oracle: true, ys: "derivatives", category: "fixed-rate" },
  "ethena-usde": { name: "Ethena", audits: 4, age_days: 450, exploit_history: 0, oracle: true, ys: "derivatives", category: "delta-neutral" },
  resolv: { name: "Resolv", audits: 2, age_days: 320, exploit_history: 0, oracle: true, ys: "derivatives", category: "delta-neutral" },
  // ─ Liquid staking ─
  lido: { name: "Lido", audits: 5, age_days: 1500, exploit_history: 0, oracle: false, ys: "staking", category: "liquid staking" },
  "rocket-pool": { name: "Rocket Pool", audits: 4, age_days: 1200, exploit_history: 0, oracle: false, ys: "staking", category: "liquid staking" },
  "meta-pool": { name: "Meta Pool", audits: 2, age_days: 1000, exploit_history: 0, oracle: false, ys: "staking", category: "liquid staking" },
  linear: { name: "LiNEAR", audits: 2, age_days: 800, exploit_history: 0, oracle: false, ys: "staking", category: "liquid staking" },
  // ─ BTC yield ─
  "lombard-lbtc": { name: "Lombard", audits: 3, age_days: 300, exploit_history: 0, oracle: true, ys: "staking", category: "BTC staking" },
  "solv-protocol": { name: "Solv", audits: 2, age_days: 260, exploit_history: 0, oracle: true, ys: "derivatives", category: "BTC yield" },
  // ─ Restaking ─
  eigenlayer: { name: "EigenLayer", audits: 3, age_days: 450, exploit_history: 0, oracle: false, ys: "derivatives", category: "restaking" },
  "ether.fi": { name: "ether.fi", audits: 3, age_days: 500, exploit_history: 0, oracle: false, ys: "staking", category: "restaking" },
  // ─ DEX liquidity ─
  "uniswap-v3": { name: "Uniswap v3", audits: 5, age_days: 1300, exploit_history: 0, oracle: false, ys: "lp", category: "DEX liquidity" },
  "curve-dex": { name: "Curve", audits: 5, age_days: 1600, exploit_history: 1, oracle: false, ys: "lp", category: "DEX liquidity" },
  "rhea-dex": { name: "Rhea DEX", audits: 3, age_days: 900, exploit_history: 0, oracle: false, ys: "lp", category: "DEX liquidity" },
};

const CHAIN_LABEL: Record<string, string> = {
  Ethereum: "Ethereum",
  Base: "Base",
  Arbitrum: "Arbitrum",
  Optimism: "Optimism",
  Near: "NEAR",
};
const CANON_CHAIN: Record<string, string> = {
  Ethereum: "ethereum",
  Base: "base",
  Arbitrum: "arbitrum",
  Optimism: "optimism",
  Near: "near",
};

const MIN_TVL = 5_000_000; // ignore dust / near-dead markets
const MIN_APY = 0.3; // drop ~0% collateral-only markets (not a yield strategy)
const MAX_APY = 150; // clamp transient LP spikes
// Top-N markets per (PROTOCOL × ASSET). Grouping by asset too — not just protocol —
// guarantees each asset (BTC, ETH, stablecoin, …) gets real coverage, instead of a
// multi-asset protocol's deepest (usually stablecoin) markets crowding out its BTC ones.
const PER_PROTOCOL_ASSET = 3;

// Classify a SINGLE token into its asset family (or null if unrecognized).
function classifyLeg(token: string): string | null {
  const s = token.toUpperCase();
  const stable = ["USDC", "USDT", "DAI", "USDS", "SUSDE", "USDE", "USDY", "USD0", "GHO", "FRAX", "PYUSD", "USDL", "SDAI", "USR", "USUAL", "USD"];
  if (stable.some((t) => s.includes(t))) return "stablecoin";
  if (/BTC/.test(s)) return "btc"; // WBTC, LBTC, CBBTC, TBTC, SBTC, …
  if (/STNEAR|LINEAR|NEAR/.test(s)) return "near";
  if (/WSTETH|STETH|WEETH|EETH|RETH|WETH|ETH/.test(s)) return "eth";
  if (/SOL|MSOL|JITOSOL/.test(s)) return "sol";
  return null;
}

// An LP pair is only "pure" exposure to an asset when BOTH legs are that asset
// (WBTC-TBTC = BTC). A mixed pair (WBTC-WETH) is a BASKET — holding it is NOT full
// BTC exposure, so it must never satisfy a "stay in BTC" lock.
function inferAsset(symbol: string): string {
  const legs = symbol.split(/[-/_ ]+/).filter(Boolean);
  if (legs.length <= 1) return classifyLeg(symbol) ?? "basket";
  const classes = new Set(legs.map(classifyLeg));
  if (classes.has(null)) return "basket"; // an unrecognized leg → treat as mixed
  return classes.size === 1 ? (classes.values().next().value as string) : "basket";
}

function sourceOfYieldFor(cat: string, name: string): string {
  switch (cat) {
    case "lending": return `Lenders earn the variable interest borrowers pay on ${name}'s money market. Your capital stays in the supplied asset.`;
    case "savings rate": return "A protocol savings rate backed by fees and RWA — no borrower or oracle dependency.";
    case "yield stablecoin": return "A yield-bearing stablecoin; yield comes from the protocol's backing strategy.";
    case "RWA — T-bills": return "Backed by short-term US Treasuries; the yield is the T-bill rate (off-chain custody).";
    case "fixed-rate": return "A fixed-rate position (Pendle PT) that locks yield to maturity.";
    case "delta-neutral": return "A delta-neutral basis trade: staking yield plus perp funding.";
    case "liquid staking": return "Liquid-staking rewards, denominated in the staked asset.";
    case "BTC staking": return "Liquid-staked BTC — real BTC exposure that also earns a staking yield.";
    case "BTC yield": return "A yield-bearing BTC vault blending staking and basis strategies.";
    case "restaking": return "Restaking rewards from securing additional services, on top of staking.";
    case "DEX liquidity": return "Swap fees and incentives from providing liquidity to this pool.";
    default: return "On-chain yield for this venue.";
  }
}

function keyRiskFor(cat: string): string {
  const m: Record<string, string> = {
    lending: "Smart-contract and utilization risk; your capital stays in the supplied asset.",
    "savings rate": "Protocol/peg risk only — backed by fees and RWA, no borrower or oracle dependency.",
    "yield stablecoin": "Peg and backing-strategy risk for the stablecoin.",
    "RWA — T-bills": "Off-chain counterparty and custody risk: the Treasuries are held by a real-world issuer.",
    "fixed-rate": "The rate is locked to maturity; exiting early means selling at market (duration risk).",
    "delta-neutral": "Funding can turn negative and the hedge leans on centralized venues.",
    "liquid staking": "Validator slashing risk, and you carry the underlying asset's price (ETH/NEAR).",
    "BTC staking": "You hold BTC price exposure, plus staking-protocol slashing risk.",
    "BTC yield": "BTC price exposure plus strategy/counterparty risk in the yield engine.",
    restaking: "Extra slashing surface from the services you help secure; a newer primitive.",
    "DEX liquidity": "Impermanent loss if the pair moves; you take the non-stable asset's exposure.",
    "institutional lending": "Counterparty/credit risk — you lend to vetted institutions; a default hits principal.",
    "leveraged yield": "Leverage amplifies both yield and loss; liquidation risk if the position moves.",
  };
  return m[cat] ?? "Smart-contract risk and any asset-price exposure implied by this venue.";
}

function slugify(project: string, symbol: string, chain: string): string {
  return `${project}:${symbol}:${CANON_CHAIN[chain] ?? chain}`.toLowerCase().replace(/[^a-z0-9:_-]/g, "");
}

function venueFromPool(p: LlamaPool): Venue | null {
  const proto = PROTO[p.project];
  if (!proto) return null;
  if (!CHAIN_LABEL[p.chain]) return null;
  if ((p.tvlUsd ?? 0) < MIN_TVL) return null;
  const apy = p.apy;
  if (typeof apy !== "number" || apy < MIN_APY || apy > MAX_APY) return null;

  const asset = inferAsset(p.symbol);
  return {
    slug: slugify(p.project, p.symbol, p.chain),
    displayName: proto.name,
    market: p.symbol,
    chain: CANON_CHAIN[p.chain] ?? p.chain.toLowerCase(),
    chainLabel: CHAIN_LABEL[p.chain]!,
    asset,
    category: proto.category,
    apyBps: Math.round(apy * 100),
    tvlUsd: p.tvlUsd ?? 0,
    risk: {
      name: p.project,
      audits: proto.audits,
      tvl_usd: p.tvlUsd ?? 0,
      age_days: proto.age_days,
      exploit_history: proto.exploit_history,
      oracle_dependency: proto.oracle,
      yield_source: proto.ys,
    },
    sourceOfYield: sourceOfYieldFor(proto.category, proto.name),
    mechanics: proto.live
      ? "Live on testnet today (NEAR-native for Rhea, Chain Signatures for Morpho on Ethereum)."
      : "A real market in the YieldAI universe; on-chain execution for this venue is on the roadmap.",
    keyRisk: keyRiskFor(proto.category),
    live: !!proto.live,
  };
}

/**
 * The shortlist the LLM composes from: real markets from DefiLlama, deduped to
 * the top markets per (protocol, asset, chain), capped for a manageable menu.
 * Keyed by slug. Falls back to the static catalogue if DefiLlama is unavailable.
 */
export async function buildShortlist(): Promise<Record<string, Venue>> {
  let pools: LlamaPool[];
  try {
    pools = await fetchPools();
  } catch {
    return fallbackFromCatalogue();
  }

  const venues = pools.map(venueFromPool).filter((v): v is Venue => v !== null);
  if (venues.length < 6) return fallbackFromCatalogue();

  // Top-N markets PER (PROTOCOL × ASSET), so every allowlisted protocol is
  // represented AND every asset it serves gets coverage — a BTC holder sees real
  // BTC markets, not just a protocol's deepest (usually stablecoin) pools.
  const byGroup = new Map<string, Venue[]>();
  for (const v of venues) {
    const k = `${v.displayName}|${v.asset}`;
    (byGroup.get(k) ?? byGroup.set(k, []).get(k)!).push(v);
  }

  const out: Record<string, Venue> = {};
  for (const arr of Array.from(byGroup.values())) {
    arr.sort((a, b) => b.tvlUsd - a.tvlUsd);
    const seen = new Set<string>();
    let n = 0;
    for (const v of arr) {
      const mk = `${v.market}|${v.chain}`;
      if (seen.has(mk)) continue; // dedup identical market symbols
      seen.add(mk);
      out[v.slug] = v;
      if (++n >= PER_PROTOCOL_ASSET) break;
    }
  }
  return out;
}

// Static fallback so propose() never breaks when DefiLlama is down.
function fallbackFromCatalogue(): Record<string, Venue> {
  const out: Record<string, Venue> = {};
  for (const [key, e] of Object.entries(CATALOGUE)) {
    out[key] = {
      slug: key,
      displayName: e.displayName,
      market: e.token.toUpperCase(),
      chain: e.chain,
      chainLabel: e.chainLabel,
      asset: e.asset,
      category: e.category,
      apyBps: e.default_apy_bps,
      tvlUsd: e.risk.tvl_usd,
      risk: e.risk,
      sourceOfYield: e.sourceOfYield,
      mechanics: e.mechanics,
      keyRisk: keyRiskFor(e.category),
      live: e.live,
    };
  }
  return out;
}
