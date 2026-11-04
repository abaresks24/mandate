import { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-edge bg-panel/70 backdrop-blur p-5 ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  sub,
}: {
  children: ReactNode;
  sub?: string;
}) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold text-white">{children}</h2>
      {sub && <p className="text-sm text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

type Tone = "near" | "evm" | "ok" | "warn" | "danger" | "muted";

const toneMap: Record<Tone, string> = {
  near: "bg-near/15 text-near border-near/40",
  evm: "bg-evm/15 text-evm border-evm/40",
  ok: "bg-ok/15 text-ok border-ok/40",
  warn: "bg-warn/15 text-warn border-warn/40",
  danger: "bg-danger/15 text-danger border-danger/40",
  muted: "bg-slate-500/10 text-slate-300 border-slate-500/30",
};

export function Badge({
  children,
  tone = "muted",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${toneMap[tone]}`}
    >
      {children}
    </span>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return (
    <code className="font-mono text-xs text-slate-300 break-all">{children}</code>
  );
}

export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="text-sm text-slate-100 mt-0.5">{value}</div>
    </div>
  );
}

export function Button({
  children,
  onClick,
  tone = "default",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "default" | "danger" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const tones = {
    default: "bg-near text-ink hover:bg-near/90",
    danger: "bg-danger text-white hover:bg-danger/90",
    ghost: "bg-transparent border border-edge text-slate-200 hover:bg-edge/40",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

export function RiskMeter({ score, max }: { score: number; max?: number }) {
  const pct = Math.min(100, score);
  const tone =
    score >= 70 ? "bg-danger" : score >= 45 ? "bg-warn" : "bg-ok";
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>risk score</span>
        <span className="text-slate-200 font-medium">
          {score}/100{max != null && ` · ceiling ${max}`}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-edge overflow-hidden">
        <div
          className={`h-full ${tone} transition-[width] duration-700 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// --- Live-data chrome: skeletons, error banner, truthful source indicator ---

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-edge/60 ${className}`}
      aria-hidden
    />
  );
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card>
      <Skeleton className="h-4 w-1/3 mb-4" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </Card>
  );
}

// LIVE (green, pulsing) vs mock (amber). Truthful per the actual data source.
export function LiveIndicator({
  source,
  loading,
}: {
  source: "live" | "mock";
  loading?: boolean;
}) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-edge px-2.5 py-0.5 text-xs text-slate-400">
        <span className="h-2 w-2 rounded-full bg-slate-500 animate-pulse" />
        loading…
      </span>
    );
  }
  const live = source === "live";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        live
          ? "border-ok/40 text-ok bg-ok/10"
          : "border-warn/40 text-warn bg-warn/10"
      }`}
      title={
        live
          ? "Served from the deployed NEAR testnet contracts"
          : "Served from local mock data"
      }
    >
      <span
        className={`h-2 w-2 rounded-full ${
          live ? "bg-ok animate-pulse" : "bg-warn"
        }`}
      />
      {live ? "LIVE · testnet" : "mock"}
    </span>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-warn/40 bg-warn/5 px-3 py-2 text-xs text-warn">
      Live contract call failed — showing mock fallback.{" "}
      <span className="text-warn/70 font-mono">{message}</span>
    </div>
  );
}
