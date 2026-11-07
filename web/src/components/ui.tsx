"use client";

import { ReactNode, useState } from "react";
import {
  Check,
  Copy,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Ban,
  Zap,
  Circle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// Card — glassy, rounded-2xl, subtle border + soft shadow. Optional hover lift.
// ---------------------------------------------------------------------------
export function Card({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/[0.06] bg-panel/60 backdrop-blur-xl shadow-card p-6 transition-all duration-200",
        hover &&
          "hover:border-white/10 hover:shadow-card-hover hover:bg-panel/80 hover:-translate-y-0.5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  sub,
  className,
}: {
  children: ReactNode;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <h2 className="text-xl font-semibold tracking-tight text-white">
        {children}
      </h2>
      {sub && (
        <p className="text-sm leading-relaxed text-zinc-400 max-w-2xl">{sub}</p>
      )}
    </div>
  );
}

type Tone = "near" | "evm" | "ok" | "warn" | "danger" | "muted";

const toneMap: Record<Tone, string> = {
  near: "bg-near/10 text-near border-near/25",
  evm: "bg-evm/10 text-evm border-evm/25",
  ok: "bg-near/10 text-near border-near/25",
  warn: "bg-warn/10 text-warn border-warn/30",
  danger: "bg-danger/10 text-danger border-danger/30",
  muted: "bg-white/[0.04] text-zinc-400 border-white/10",
};

export function Badge({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        toneMap[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

// Status badge with the right icon + color for on-chain lifecycle states.
export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s.includes("slash"))
    return (
      <Badge tone="danger">
        <ShieldAlert className="h-3 w-3" /> Slashed
      </Badge>
    );
  if (s.includes("block"))
    return (
      <Badge tone="danger">
        <Ban className="h-3 w-3" /> Blocked
      </Badge>
    );
  if (s.includes("execut"))
    return (
      <Badge tone="near">
        <Zap className="h-3 w-3" /> Executed
      </Badge>
    );
  if (s.includes("active"))
    return (
      <Badge tone="near">
        <CheckCircle2 className="h-3 w-3" /> Active
      </Badge>
    );
  if (s.includes("unbond"))
    return (
      <Badge tone="warn">
        <Circle className="h-3 w-3" /> Unbonding
      </Badge>
    );
  return <Badge tone="muted">{status}</Badge>;
}

export function Mono({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <code className={cn("font-mono text-xs text-zinc-300 break-all", className)}>
      {children}
    </code>
  );
}

// Copyable monospace value — hash, address, tx. Click to copy with a toast.
export function Copyable({
  value,
  display,
  className,
  label = "Copied to clipboard",
}: {
  value: string;
  display?: ReactNode;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          toast.success(label, { description: value });
          setTimeout(() => setCopied(false), 1400);
        });
      }}
      className={cn(
        "group inline-flex items-center gap-1.5 font-mono text-xs text-zinc-300 hover:text-white transition-colors",
        className
      )}
      title="Copy"
    >
      <span className="break-all">{display ?? value}</span>
      {copied ? (
        <Check className="h-3 w-3 text-near shrink-0" />
      ) : (
        <Copy className="h-3 w-3 text-zinc-600 group-hover:text-zinc-400 shrink-0" />
      )}
    </button>
  );
}

export function Stat({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="text-sm text-zinc-100 mt-1">{value}</div>
    </div>
  );
}

export function Button({
  children,
  onClick,
  tone = "default",
  disabled,
  type = "button",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "default" | "danger" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const tones = {
    default:
      "bg-near text-ink hover:brightness-110 shadow-[0_0_20px_-6px_rgba(0,236,151,0.5)]",
    danger: "bg-danger text-white hover:brightness-110",
    ghost:
      "bg-white/[0.03] border border-white/10 text-zinc-200 hover:bg-white/[0.07] hover:border-white/20",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
        tones[tone],
        className
      )}
    >
      {children}
    </button>
  );
}

export function RiskMeter({ score, max }: { score: number; max?: number }) {
  const pct = Math.min(100, score);
  const tone = score >= 70 ? "bg-danger" : score >= 45 ? "bg-warn" : "bg-near";
  return (
    <div>
      <div className="flex justify-between text-xs text-zinc-500 mb-1.5">
        <span className="uppercase tracking-wider text-[11px] font-medium">
          risk score
        </span>
        <span className="text-zinc-200 font-medium font-mono tabular-nums">
          {score}/100{max != null && ` · ceiling ${max}`}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-700 ease-out",
            tone
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// --- Live-data chrome: skeletons, error banner, truthful source indicator ---

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} aria-hidden />;
}

export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <Card>
      <Skeleton className="h-4 w-1/3 mb-5" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </Card>
  );
}

// Empty state — subtle icon + copy.
export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center">
      {icon && (
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04] text-zinc-500">
          {icon}
        </div>
      )}
      <div className="text-sm font-medium text-zinc-200">{title}</div>
      {children && (
        <div className="text-sm text-zinc-500 mt-1.5 max-w-md mx-auto">
          {children}
        </div>
      )}
    </div>
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
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-zinc-400">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-pulse" />
        loading…
      </span>
    );
  }
  const isLive = source === "live";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        isLive
          ? "border-near/30 text-near bg-near/10"
          : "border-warn/30 text-warn bg-warn/10"
      )}
      title={
        isLive
          ? "Served from the deployed NEAR testnet contracts"
          : "Served from local mock data"
      }
    >
      <span className="relative flex h-1.5 w-1.5">
        {isLive && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-near opacity-60" />
        )}
        <span
          className={cn(
            "relative inline-flex h-1.5 w-1.5 rounded-full",
            isLive ? "bg-near" : "bg-warn"
          )}
        />
      </span>
      {isLive ? "LIVE · testnet" : "mock"}
    </span>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-warn/25 bg-warn/[0.06] px-3.5 py-2.5 text-xs text-warn">
      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      <span>
        Live contract call failed — showing mock fallback.{" "}
        <span className="text-warn/70 font-mono break-all">{message}</span>
      </span>
    </div>
  );
}
