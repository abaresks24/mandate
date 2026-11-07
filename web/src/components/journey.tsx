"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, ChevronDown } from "lucide-react";
import { motion } from "./motion";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// The 6-step guided journey. ONE source of truth for order, routes, labels.
// ---------------------------------------------------------------------------
export interface Step {
  n: number;
  href: string;
  label: string; // rail label
  next?: string; // named "where am I going" for the Next button
}

export const STEPS: Step[] = [
  { n: 1, href: "/", label: "The problem", next: "Set a mandate" },
  { n: 2, href: "/mandate", label: "Set a mandate", next: "Propose an action" },
  { n: 3, href: "/propose", label: "Propose an action", next: "The committee decides" },
  { n: 4, href: "/committee", label: "The committee decides", next: "When a guardian lies" },
  { n: 5, href: "/slashing", label: "When a guardian lies", next: "You stay in control" },
  { n: 6, href: "/control", label: "You stay in control" },
];

export function stepFor(pathname: string): Step {
  const exact = STEPS.find((s) => s.href === pathname);
  if (exact) return exact;
  const prefix = STEPS.filter((s) => s.href !== "/").find((s) =>
    pathname.startsWith(s.href)
  );
  return prefix ?? STEPS[0];
}

// ---------------------------------------------------------------------------
// Left progress rail (desktop) — the persistent "where am I" anchor.
// ---------------------------------------------------------------------------
export function ProgressRail() {
  const path = usePathname();
  const current = stepFor(path).n;

  return (
    <nav
      aria-label="Journey steps"
      className="hidden lg:flex flex-col gap-1 sticky top-24 self-start"
    >
      <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-600 mb-3 pl-3">
        Step {current} / 6
      </div>
      {STEPS.map((s) => {
        const active = s.n === current;
        const done = s.n < current;
        return (
          <Link
            key={s.href}
            href={s.href}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
              active
                ? "bg-white/[0.06]"
                : "hover:bg-white/[0.03]"
            )}
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-mono font-semibold transition-colors",
                active
                  ? "border-near/40 bg-near/15 text-near"
                  : done
                  ? "border-near/20 bg-near/5 text-near/70"
                  : "border-white/10 bg-white/[0.02] text-zinc-500"
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : s.n}
            </span>
            <span
              className={cn(
                "text-sm transition-colors",
                active
                  ? "text-white font-medium"
                  : "text-zinc-500 group-hover:text-zinc-300"
              )}
            >
              {s.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Compact top stepper (mobile) — dots + current label.
// ---------------------------------------------------------------------------
export function MobileStepper() {
  const path = usePathname();
  const current = stepFor(path).n;
  const step = STEPS[current - 1];

  return (
    <div className="lg:hidden flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-panel/50 backdrop-blur-xl px-4 py-3 mb-6">
      <div className="flex items-center gap-1.5">
        {STEPS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            aria-label={`Step ${s.n}: ${s.label}`}
            className={cn(
              "h-2 rounded-full transition-all",
              s.n === current
                ? "w-6 bg-near"
                : s.n < current
                ? "w-2 bg-near/40"
                : "w-2 bg-white/10"
            )}
          />
        ))}
      </div>
      <div className="text-xs text-zinc-400 truncate">
        <span className="font-mono text-zinc-600">{current}/6 · </span>
        <span className="text-zinc-200">{step.label}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step header — kicker, ONE H1, ONE context sentence.
// ---------------------------------------------------------------------------
export function StepHeader({
  n,
  title,
  context,
  kicker,
}: {
  n: number;
  title: ReactNode;
  context: ReactNode;
  kicker?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-near">
        Step {n} / 6{kicker ? <span className="text-zinc-600"> · {kicker}</span> : null}
      </div>
      <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-white text-balance leading-[1.08] max-w-3xl">
        {title}
      </h1>
      <p className="text-[15px] sm:text-base leading-relaxed text-zinc-400 max-w-2xl text-pretty">
        {context}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Details — collapsed-by-default disclosure. "Only expand if the user asks."
// ---------------------------------------------------------------------------
export function Details({
  label = "Show how it works",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span className="text-sm font-medium text-zinc-300">{label}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-zinc-500 transition-transform duration-300",
            open && "rotate-180"
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.06] px-5 py-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bottom nav bar — "← Back" + primary "Next: <named step> →".
// ---------------------------------------------------------------------------
export function StepNav({ n }: { n: number }) {
  const prev = STEPS[n - 2];
  const cur = STEPS[n - 1];
  const next = STEPS[n];

  return (
    <div className="flex items-center justify-between gap-4 border-t border-white/[0.06] pt-6 mt-2">
      {prev ? (
        <Link
          href={prev.href}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-zinc-300 transition-all hover:bg-white/[0.07] hover:border-white/20"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      ) : (
        <span />
      )}
      {next && cur.next ? (
        <Link
          href={next.href}
          className="group inline-flex items-center gap-2 rounded-xl bg-near px-5 py-2.5 text-sm font-semibold text-ink shadow-[0_0_30px_-8px_rgba(0,236,151,0.6)] transition-all hover:brightness-110 active:scale-[0.98]"
        >
          Next: {cur.next}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : (
        <span className="text-sm text-zinc-500">End of the journey</span>
      )}
    </div>
  );
}
