// Hand-rolled SVG charts for the strategy breakdown — kept dependency-free and
// styled to the clear-institutional DA (ink + one green accent + neutral ramp).

// A restrained, cohesive palette: the accent green for the largest slice, then a
// neutral ramp. Distinct enough to read, calm enough to stay editorial.
// Bright cold-blue palette, tuned to read on the dark-blue sheet.
export const SERIES = [
  "#7FB2E0", // sky
  "#A9C8E8", // light steel
  "#5B9BD5", // mid
  "#C7DEF2", // pale
  "#4E8BC2", // steel
  "#6AA0CF", // blue
  "#8FD3C9", // soft teal
  "#B9D4EC", // very pale
];

export interface Slice {
  label: string;
  value: number; // any positive magnitude; normalized internally
  sub?: string; // optional secondary line in the legend
}

function toPct(slices: Slice[]): { label: string; pct: number; sub?: string }[] {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0) || 1;
  return slices.map((s) => ({ label: s.label, sub: s.sub, pct: (Math.max(0, s.value) / total) * 100 }));
}

/** Donut chart with an inline legend. */
export function Donut({
  title,
  slices,
  center,
}: {
  title: string;
  slices: Slice[];
  center?: string;
}) {
  const data = toPct(slices);
  const size = 132;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div>
      <div className="label mb-3">{title}</div>
      <div className="flex items-center gap-5">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2C4C6B" strokeWidth={stroke} />
            {data.map((d, i) => {
              const len = (d.pct / 100) * c;
              const el = (
                <circle
                  key={d.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={SERIES[i % SERIES.length]}
                  strokeWidth={stroke}
                  strokeDasharray={`${len} ${c - len}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })}
          </g>
          {center && (
            <text
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-ink font-mono text-sm font-semibold"
            >
              {center}
            </text>
          )}
        </svg>

        <ul className="flex flex-col gap-1.5 text-sm">
          {data.map((d, i) => (
            <li key={d.label} className="flex items-baseline gap-2">
              <span
                className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ backgroundColor: SERIES[i % SERIES.length] }}
                aria-hidden
              />
              <span className="text-ink">{d.label}</span>
              {d.sub && <span className="text-xs text-muted">{d.sub}</span>}
              <span className="num ml-auto pl-3 text-muted">{d.pct.toFixed(0)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Projected value curve: compounding `principal` monthly at `apyBps` over `months`. */
export function GrowthCurve({
  apyBps,
  principal = 10000,
  months = 12,
}: {
  apyBps: number;
  principal?: number;
  months?: number;
}) {
  const rate = apyBps / 10000;
  const monthly = Math.pow(1 + rate, 1 / 12) - 1;
  const pts: number[] = [];
  let v = principal;
  pts.push(v);
  for (let i = 0; i < months; i++) {
    v *= 1 + monthly;
    pts.push(v);
  }
  const end = pts[pts.length - 1]!;
  const gain = end - principal;

  const w = 520;
  const h = 150;
  const padL = 8;
  const padR = 8;
  const padT = 10;
  const padB = 18;
  const min = principal;
  const max = end;
  const span = max - min || 1;
  const x = (i: number) => padL + (i / months) * (w - padL - padR);
  const y = (val: number) => padT + (1 - (val - min) / span) * (h - padT - padB);

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  const area = `${line} L${x(months).toFixed(1)},${(h - padB).toFixed(1)} L${x(0).toFixed(1)},${(h - padB).toFixed(1)} Z`;

  const fmt = (n: number) =>
    "$" + Math.round(n).toLocaleString("en-US");

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <div className="label">Projected value · {fmt(principal)} over 12 months</div>
        <div className="text-sm text-muted">
          <span className="num text-ink">{fmt(end)}</span>{" "}
          <span className="num text-[color:#5BC0A8]">+{fmt(gain)}</span>
        </div>
      </div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full">
        <line x1={padL} y1={h - padB} x2={w - padR} y2={h - padB} stroke="#2C4C6B" strokeWidth="1" />
        <path d={area} fill="#7FB2E0" opacity="0.08" />
        <path d={line} fill="none" stroke="#7FB2E0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={x(months)} cy={y(end)} r="3" fill="#7FB2E0" />
      </svg>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>now</span>
        <span>12 months</span>
      </div>
    </div>
  );
}

/** Horizontal APY bars per allocation — makes the contribution to yield legible. */
export function ApyBars({
  items,
}: {
  items: { label: string; apyBps: number; weightPct: number }[];
}) {
  const maxApy = Math.max(1, ...items.map((i) => i.apyBps));
  return (
    <div>
      <div className="label mb-3">APY by allocation</div>
      <ul className="flex flex-col gap-3">
        {items.map((it, i) => (
          <li key={it.label + i} className="flex items-center gap-3 text-sm">
            <span className="w-28 shrink-0 truncate text-ink">{it.label}</span>
            <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-mist">
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${(it.apyBps / maxApy) * 100}%`, backgroundColor: SERIES[i % SERIES.length] }}
              />
            </span>
            <span className="num w-14 shrink-0 text-right text-ink">{(it.apyBps / 100).toFixed(2)}%</span>
            <span className="num w-10 shrink-0 text-right text-muted">{it.weightPct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
