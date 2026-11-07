"use client";

import Link from "next/link";
import { MOCK_MODE } from "@/lib/near";
import { Logo } from "./Footer";
import { cn } from "@/lib/cn";

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
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-ink/70 backdrop-blur-xl">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 h-16 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Logo className="h-7 w-7" />
          <span className="font-semibold tracking-tight text-[15px] text-white">
            MANDATE
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <SourcePill />
        </div>
      </div>
    </header>
  );
}
