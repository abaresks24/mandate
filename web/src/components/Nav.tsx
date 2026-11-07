"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { MOCK_MODE } from "@/lib/near";
import { Logo } from "./Footer";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/brief", label: "Brief" },
  { href: "/vault", label: "Vault" },
  { href: "/guardians", label: "Guardians" },
  { href: "/committee", label: "Committee" },
  { href: "/contrast", label: "Contrast" },
  { href: "/slashing", label: "Slashing" },
];

function SourcePill() {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        MOCK_MODE
          ? "border-warn/30 text-warn bg-warn/10"
          : "border-near/30 text-near bg-near/10"
      )}
      title={
        MOCK_MODE
          ? "Serving local mock data"
          : "Reading live from NEAR testnet contracts"
      }
    >
      <span className="relative flex h-1.5 w-1.5">
        {!MOCK_MODE && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-near opacity-60" />
        )}
        <span
          className={cn(
            "relative inline-flex h-1.5 w-1.5 rounded-full",
            MOCK_MODE ? "bg-warn" : "bg-near"
          )}
        />
      </span>
      {MOCK_MODE ? "MOCK" : "LIVE"}
    </span>
  );
}

export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? path === "/" : path.startsWith(href);

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-ink/70 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 h-16 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Logo className="h-7 w-7" />
          <span className="font-semibold tracking-tight text-[15px] text-white">
            MANDATE
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-0.5 mx-auto">
          {LINKS.map((l) => {
            const active = isActive(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "relative rounded-lg px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "text-white"
                    : "text-zinc-400 hover:text-zinc-100"
                )}
              >
                {active && (
                  <span className="absolute inset-0 rounded-lg bg-white/[0.06]" />
                )}
                <span className="relative">{l.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 ml-auto md:ml-0">
          <SourcePill />
          <button
            className="md:hidden text-zinc-400 hover:text-white"
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="md:hidden border-t border-white/[0.06] bg-ink/95 backdrop-blur-xl px-5 py-3 flex flex-col gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={cn(
                "rounded-lg px-3 py-2 text-sm transition-colors",
                isActive(l.href)
                  ? "bg-white/[0.06] text-white"
                  : "text-zinc-400 hover:text-zinc-100"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
