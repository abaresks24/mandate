import { NEAR_CONFIG } from "@/lib/near";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.06] mt-8">
      <div className="max-w-6xl mx-auto px-5 sm:px-6 py-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <Logo className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-tight text-zinc-300">
            MANDATE
          </span>
          <span className="text-xs text-zinc-600">· NEAR Hackathon · track: security</span>
        </div>
        <p className="text-xs text-zinc-600 leading-relaxed max-w-md sm:text-right">
          Reads live from{" "}
          <span className="font-mono text-zinc-500">{NEAR_CONFIG.coordinatorId}</span>{" "}
          +{" "}
          <span className="font-mono text-zinc-500">{NEAR_CONFIG.vaultId}</span>.
          Set <span className="font-mono text-zinc-500">NEXT_PUBLIC_MOCK=1</span>{" "}
          for the offline mock.
        </p>
      </div>
    </footer>
  );
}

export function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#0c0c0f" />
      <rect
        width="31"
        height="31"
        x="0.5"
        y="0.5"
        rx="7.5"
        fill="none"
        stroke="rgba(255,255,255,0.08)"
      />
      <path
        d="M8 23V11l5 7 5-7v12"
        fill="none"
        stroke="#00EC97"
        strokeWidth="2.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="24" cy="11" r="2.4" fill="#818cf8" />
    </svg>
  );
}
