"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOCK_MODE } from "@/lib/near";
import { Logo } from "./Footer";
import { cn } from "@/lib/cn";

// Free navigation — visit any page, any order. No locked journey.
const LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Overview" },
  { href: "/committee", label: "Committee" },
  { href: "/slashing", label: "Slashing" },
  { href: "/guardians", label: "Guardians" },
  { href: "/vault", label: "Vault" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

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
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-ink/70 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 h-16 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Logo className="h-7 w-7" />
          <span className="font-semibold tracking-tight text-[15px] text-white">
            MANDATE
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-1 ml-2"
        >
          {LINKS.map((l) => {
            const active = isActive(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "text-white"
                    : "text-zinc-500 hover:text-zinc-200"
                )}
              >
                {l.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-[3px] h-0.5 rounded-full bg-near shadow-[0_0_12px_-2px_rgba(0,236,151,0.8)]" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <SourcePill />
        </div>
      </div>

      {/* Mobile nav row — same free links, scrollable */}
      <nav
        aria-label="Primary mobile"
        className="md:hidden border-t border-white/[0.06] px-5 sm:px-6 h-11 flex items-center gap-4 overflow-x-auto"
      >
        {LINKS.map((l) => {
          const active = isActive(pathname, l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 text-sm font-medium transition-colors",
                active
                  ? "text-near"
                  : "text-zinc-500 hover:text-zinc-200"
              )}
            >
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
