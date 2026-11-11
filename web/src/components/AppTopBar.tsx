"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/button";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";
import { cn } from "@/lib/cn";

const DOCS_URL = "https://github.com/abaresks24/mandate";

const NAV = [
  { href: "/app", label: "Overview" },
  { href: "/app/earn", label: "Earn" },
  { href: "/app/portfolio", label: "Portfolio" },
];

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(href + "/");
}

// In-app top bar: wordmark (-> landing), in-app nav with clear active state,
// Docs + Connect Wallet. No pills, no badges — weight + accent underline.
export function AppTopBar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-paper/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-5 sm:px-8">
        <Link href="/" aria-label="YieldAI home" className="shrink-0">
          <Wordmark />
        </Link>

        <nav aria-label="App" className="flex items-center gap-6">
          {NAV.map((l) => {
            const active = isActive(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "border-b-2 pb-0.5 text-sm transition-colors",
                  active
                    ? "border-near font-semibold text-ink"
                    : "border-transparent text-muted hover:text-ink"
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex"
          >
            <Button variant="ghost">Docs</Button>
          </a>
          <ConnectWallet />
        </div>
      </div>
    </header>
  );
}
