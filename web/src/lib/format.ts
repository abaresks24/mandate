// USDC is 6-dp fixed in SPEC; prices are 6-dp fixed too.

export function usdc(raw: string): string {
  const n = Number(raw) / 1e6;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function price6(raw: string): string {
  const n = Number(raw) / 1e6;
  return `$${n.toFixed(4)}`;
}

export function bps(v: number): string {
  return `${(v / 100).toFixed(2)}%`;
}

export function shortHash(h: string | null, head = 10, tail = 6): string {
  if (!h) return "—";
  if (h.length <= head + tail) return h;
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}
