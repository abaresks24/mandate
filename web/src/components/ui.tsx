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
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
