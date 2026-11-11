"use client";

import Link from "next/link";
import { Wordmark } from "@/components/brand";
import { Button } from "@/components/button";
import { ConnectWallet } from "@/components/wallet/ConnectWallet";

const DOCS_URL = "https://github.com/abaresks24/yieldai";

// Landing top bar: wordmark left, Docs + Connect Wallet right.
export function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-paper/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center px-5 sm:px-8">
        <Link href="/" aria-label="YieldAI home">
          <Wordmark />
        </Link>
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost">Docs</Button>
          </a>
          <ConnectWallet />
        </div>
      </div>
    </header>
  );
}
