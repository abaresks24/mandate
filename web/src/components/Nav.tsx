"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOCK_MODE } from "@/lib/near";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/brief", label: "Brief → Proposal" },
  { href: "/vault", label: "Vault" },
  { href: "/committee", label: "Committee" },
  { href: "/contrast", label: "The Contrast" },
  { href: "/slashing", label: "Slashing" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="border-b border-edge bg-ink/80 backdrop-blur sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-near font-bold tracking-tight text-lg">
            MANDATE
          </span>
          <span className="text-xs text-slate-500 hidden sm:inline">
            trust-minimized AI money management
          </span>
        </Link>
        <nav className="flex gap-1 ml-auto overflow-x-auto">
          {LINKS.map((l) => {
            const active =
              l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition ${
                  active
                    ? "bg-near/15 text-near"
                    : "text-slate-400 hover:text-slate-200 hover:bg-edge/40"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <span
          className={`text-xs rounded-full border px-2 py-0.5 ${
            MOCK_MODE
              ? "border-warn/40 text-warn bg-warn/10"
              : "border-ok/40 text-ok bg-ok/10"
          }`}
        >
          {MOCK_MODE ? "MOCK DATA" : "LIVE"}
        </span>
      </div>
    </header>
  );
}
