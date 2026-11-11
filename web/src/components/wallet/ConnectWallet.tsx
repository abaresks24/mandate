"use client";

import { useState } from "react";
import { Button } from "@/components/button";
import { useWallet } from "./WalletProvider";
import { cn } from "@/lib/cn";

function truncate(id: string) {
  if (id.length <= 18) return id;
  return `${id.slice(0, 8)}…${id.slice(-8)}`;
}

export function ConnectWallet({ className }: { className?: string }) {
  const { accountId, connecting, signIn, signOut } = useWallet();
  const [open, setOpen] = useState(false);

  if (accountId) {
    return (
      <div className={cn("relative", className)}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg border border-hairline px-3 py-2 text-sm font-medium text-ink transition-colors hover:border-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-near" aria-hidden />
          <span className="font-mono text-[13px] tabular-nums">{truncate(accountId)}</span>
        </button>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
              aria-hidden
            />
            <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-lg border border-hairline bg-paper p-1 shadow-sm">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  signOut();
                }}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-ink hover:bg-mist transition-colors"
              >
                Disconnect
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <Button
      variant="primary"
      onClick={signIn}
      disabled={connecting}
      className={className}
    >
      {connecting ? "Connecting…" : "Connect Wallet"}
    </Button>
  );
}
