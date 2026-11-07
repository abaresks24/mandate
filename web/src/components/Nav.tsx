"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOCK_MODE } from "@/lib/near";
import { Logo } from "./Footer";
import { Dot } from "./ui";
import { cn } from "@/lib/cn";

// Free navigation — visit any page, any order. Presented as an ORDERED path
// (01–05) so left-to-right reads as the story; nothing is locked.
export const PATH: { href: string; label: string }[] = [
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

function num(i: number) {
  return String(i + 1).padStart(2, "0");
}

function SourceIndicator() {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        MOCK_MODE ? "text-zinc-500" : "text-zinc-300"
      )}
      title={
        MOCK_MODE
          ? "Serving local mock data"
          : "Reading live from NEAR testnet contracts"
      }
    >
      <Dot tone={MOCK_MODE ? "warn" : "near"} />
      {MOCK_MODE ? "mock data" : "live · testnet"}
    </span>
  );
}

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-edge bg-ink/90 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 h-16 flex items-center gap-7">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Logo className="h-7 w-7" />
          <span className="font-semibold tracking-tight text-[15px] text-white">
            MANDATE
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-5 ml-2"
        >
          {PATH.map((l, i) => {
            const active = isActive(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group inline-flex items-baseline gap-1.5 text-sm transition-colors",
                  active
                    ? "text-white font-medium"
                    : "text-zinc-500 hover:text-zinc-200"
                )}
              >
                <span
                  className={cn(
                    "font-mono text-[11px] tabular-nums",
                    active ? "text-near" : "text-zinc-600"
                  )}
                >
                  {num(i)}
                </span>
                <span
                  className={cn(
                    "border-b-2 pb-0.5 transition-colors",
                    active
                      ? "border-near"
                      : "border-transparent group-hover:border-zinc-700"
                  )}
                >
                  {l.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center">
          <SourceIndicator />
        </div>
      </div>

      {/* Mobile — same ordered path, scrollable */}
      <nav
        aria-label="Primary mobile"
        className="md:hidden border-t border-edge px-5 sm:px-6 h-11 flex items-center gap-4 overflow-x-auto"
      >
        {PATH.map((l, i) => {
          const active = isActive(pathname, l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 inline-flex items-baseline gap-1 text-sm transition-colors",
                active ? "text-white font-medium" : "text-zinc-500 hover:text-zinc-200"
              )}
            >
              <span
                className={cn(
                  "font-mono text-[10px] tabular-nums",
                  active ? "text-near" : "text-zinc-600"
                )}
              >
                {num(i)}
              </span>
              {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
