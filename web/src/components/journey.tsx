"use client";

import { ReactNode, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { motion } from "./motion";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// PageIntro — nav-neutral page header: optional kicker, ONE H1, ONE sentence.
// (Replaces the old StepHeader — no step numbers, no forced order.)
// ---------------------------------------------------------------------------
export function PageIntro({
  title,
  context,
  kicker,
}: {
  title: ReactNode;
  context: ReactNode;
  kicker?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      {kicker ? (
        <div className="text-[11px] font-medium uppercase tracking-wider text-near">
          {kicker}
        </div>
      ) : null}
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
