"use client";

import { ReactNode, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// Card — a single flat bordered surface. Reserve for at most ONE genuinely
// card-like thing per page; most structure should be whitespace + dividers.
// No glass, no backdrop-blur, no soft shadow.
// ---------------------------------------------------------------------------
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-edge bg-surface p-6",
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

// ---------------------------------------------------------------------------
// Label — small, uppercase-tracked, muted section label. Replaces card walls.
// ---------------------------------------------------------------------------
export function Label({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-[11px] font-medium uppercase tracking-wider text-zinc-500",
        className
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dot — the ONLY coloured signal glyph. A 6px dot before a word. Use only for
// the single most important live / verified / slashed state.
// ---------------------------------------------------------------------------
type DotTone = "near" | "danger" | "warn" | "muted" | "evm";
const dotColor: Record<DotTone, string> = {
  near: "bg-near",
  danger: "bg-danger",
  warn: "bg-warn",
  evm: "bg-evm",
  muted: "bg-zinc-500",
};

export function Dot({
  tone = "muted",
  className,
}: {
  tone?: DotTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full shrink-0",
        dotColor[tone],
        className
      )}
      aria-hidden
    />
  );
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
    default: "bg-near text-ink hover:brightness-110",
    danger: "bg-danger text-white hover:brightness-110",
    ghost:
      "border border-edge text-zinc-200 hover:border-zinc-600 hover:text-white",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
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
          className={cn("h-full rounded-full transition-[width] duration-700 ease-out", tone)}
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
    <div className="rounded-xl border border-edge bg-surface p-6">
      <Skeleton className="h-4 w-1/3 mb-5" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

// Empty state — subtle, flat.
export function EmptyState({
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="border-t border-edge pt-6">
      <div className="text-sm font-medium text-zinc-200">{title}</div>
      {children && (
        <div className="text-sm text-zinc-500 mt-1.5 max-w-md">{children}</div>
      )}
    </div>
  );
}

// LIVE vs mock — small plain text with ONE small dot. No pill, no ping.
// Truthful per the actual data source.
export function LiveIndicator({
  source,
  loading,
}: {
  source: "live" | "mock";
  loading?: boolean;
}) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
        <Dot tone="muted" />
        loading
      </span>
    );
  }
  const isLive = source === "live";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        isLive ? "text-zinc-300" : "text-zinc-500"
      )}
      title={
        isLive
          ? "Served from the deployed NEAR testnet contracts"
          : "Served from local mock data"
      }
    >
      <Dot tone={isLive ? "near" : "warn"} />
      {isLive ? "live · testnet" : "mock data"}
    </span>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-warn">
      <Dot tone="warn" className="mt-1" />
      <span>
        Live contract call failed — showing mock fallback.{" "}
        <span className="text-warn/70 font-mono break-all">{message}</span>
      </span>
    </p>
  );
}
