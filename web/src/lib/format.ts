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

// yoctoNEAR (1e24) u128 string -> human NEAR string, trimmed.
export function yoctoToNear(yocto: string, dp = 2): string {
  const n = Number(yocto) / 1e24;
  return n.toLocaleString("en-US", { maximumFractionDigits: dp });
}

// Browser SubtleCrypto sha256 over a UTF-8 string -> lowercase hex.
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Canonical JSON (sorted keys) so sha256 is reproducible across callers.
export function canonicalJson(value: unknown): string {
  const seen = new WeakSet();
  const norm = (v: unknown): unknown => {
    if (v && typeof v === "object") {
      if (seen.has(v as object)) return v;
      seen.add(v as object);
      if (Array.isArray(v)) return v.map(norm);
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = norm((v as Record<string, unknown>)[k]);
          return acc;
        }, {});
    }
    return v;
  };
  return JSON.stringify(norm(value));
}
