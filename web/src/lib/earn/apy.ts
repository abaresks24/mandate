// Live APYs for the strategy universe, from the DefiLlama Yields API (free,
// public). Each catalogue venue maps to a real pool; we take the current APY of
// the highest-TVL matching pool. Cached in-memory (~10 min) so a propose call is
// cheap. On any miss/failure we fall back to the catalogue's representative rate.
//
// This replaces the old fixed per-venue rates: "Morpho" is now the live Morpho
// USDC rate, not a hardcoded 5%.

interface LlamaPool {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number | null;
  apy: number | null; // total APY in % (base + rewards)
  apyBase: number | null;
}

// catalogue key -> how to find its pool on DefiLlama.
// project is matched by substring (tolerant to slug variants); chain is exact;
// symbol is matched by substring (uppercased).
const MATCH: Record<string, { project: string; chain: string; symbol: string }> = {
  rhea: { project: "rhea-lend", chain: "Near", symbol: "USDC" },
  // Our live venue is Morpho on Sepolia (testnet, no market rate); use the real
  // mainnet Morpho USDC rate as the representative live number.
  "morpho-sepolia": { project: "morpho-blue", chain: "Ethereum", symbol: "USDC" },
  aave: { project: "aave-v3", chain: "Ethereum", symbol: "USDC" },
  "aave-base": { project: "aave-v3", chain: "Base", symbol: "USDC" },
  fluid: { project: "fluid-lending", chain: "Ethereum", symbol: "USDC" },
  sdai: { project: "sky-lending", chain: "Ethereum", symbol: "SDAI" },
  "ondo-usdy": { project: "ondo", chain: "Ethereum", symbol: "USDY" },
  pendle: { project: "pendle", chain: "Ethereum", symbol: "USDC" },
  "ethena-susde": { project: "ethena", chain: "Ethereum", symbol: "SUSDE" },
  linear: { project: "linear", chain: "Near", symbol: "NEAR" },
  "meta-pool": { project: "meta-pool", chain: "Near", symbol: "NEAR" },
  "lido-steth": { project: "lido", chain: "Ethereum", symbol: "STETH" },
  "lombard-lbtc": { project: "lombard", chain: "Ethereum", symbol: "LBTC" },
  "solv-btc": { project: "solv", chain: "Ethereum", symbol: "BTC" },
  "ref-lp": { project: "rhea-dex", chain: "Near", symbol: "USDC" },
  "uni-ethusdc": { project: "uniswap-v3", chain: "Ethereum", symbol: "USDC-WETH" },
  eigenlayer: { project: "eigenlayer", chain: "Ethereum", symbol: "STETH" },
  // "hyper-usdc" is illustrative (no real pool) -> falls back to the catalogue rate.
};

const TTL_MS = 10 * 60 * 1000;
let cache: { at: number; pools: LlamaPool[] } | null = null;

async function fetchPools(): Promise<LlamaPool[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.pools;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch("https://yields.llama.fi/pools", { signal: ctrl.signal });
    const body = (await res.json()) as { data: LlamaPool[] };
    cache = { at: Date.now(), pools: body.data ?? [] };
    return cache.pools;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Current APY (in bps) for every mapped venue. Keys without a live match are
 * omitted — the caller falls back to the catalogue's default_apy_bps.
 */
export async function getLiveApyBps(): Promise<Record<string, number>> {
  let pools: LlamaPool[];
  try {
    pools = await fetchPools();
  } catch {
    return {}; // network/timeout → caller uses catalogue fallbacks
  }

  const out: Record<string, number> = {};
  for (const [key, m] of Object.entries(MATCH)) {
    const sym = m.symbol.toUpperCase();
    const proj = m.project.toLowerCase();
    const matches = pools.filter(
      (p) =>
        p.chain === m.chain &&
        p.project.toLowerCase().includes(proj) &&
        p.symbol?.toUpperCase().includes(sym) &&
        typeof p.apy === "number",
    );
    if (matches.length === 0) continue;
    matches.sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0));
    const apy = matches[0]!.apy as number;
    // sanity clamp: ignore absurd outliers (> 200% is almost always a transient LP spike)
    if (apy > 0 && apy <= 200) out[key] = Math.round(apy * 100);
  }
  return out;
}
