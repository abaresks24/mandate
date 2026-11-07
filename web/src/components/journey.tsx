"use client";

import { ReactNode, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { motion } from "./motion";
import { PATH } from "./Nav";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// PageIntro — editorial page header: a quiet kicker, a confident H1, a
// one-line standfirst. Left-aligned reading flow, generous margins.
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
    <div className="flex flex-col gap-4 border-b border-edge pb-10">
      {kicker ? (
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
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
// Details — collapsed-by-default disclosure. Flat: a thin top rule + a plain
// toggle row, no card box. Progressive disclosure for secondary detail.
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
    <div className="border-t border-edge">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group flex w-full items-center gap-2 py-4 text-left"
      >
        <ChevronDown
          className={cn(
            "h-4 w-4 text-zinc-600 transition-transform duration-300 group-hover:text-zinc-400",
            open && "rotate-180"
          )}
        />
        <span className="text-sm text-zinc-400 group-hover:text-zinc-200 transition-colors">
          {label}
        </span>
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
            <div className="pb-6 pt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NextLink — one quiet, understated "Next → <page>" at the bottom of a page,
// following the recommended order. Suggestive, not a locked stepper. The user
// can ignore it and use the nav.
// ---------------------------------------------------------------------------
export function NextLink({ current }: { current: string }) {
  const i = PATH.findIndex((p) => p.href === current);
  const next = i >= 0 && i < PATH.length - 1 ? PATH[i + 1] : null;
  if (!next) return null;
  return (
    <div className="border-t border-edge pt-8 mt-2">
      <Link
        href={next.href}
        className="group inline-flex items-baseline gap-2 text-sm text-zinc-500 hover:text-white transition-colors"
      >
        <span className="text-zinc-600">Next</span>
        <span className="text-zinc-300 group-hover:text-white">
          {next.label}
        </span>
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </Link>
    </div>
  );
}
