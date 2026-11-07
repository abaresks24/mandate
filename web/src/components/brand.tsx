// Light-theme wordmark + logo glyph for the CLEAR INSTITUTIONAL shell.

export function LogoGlyph({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="7" fill="#0A0A0A" />
      <path
        d="M8 23V11l5 7 5-7v12"
        fill="none"
        stroke="#00EC97"
        strokeWidth="2.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoGlyph className="h-6 w-6" />
      <span className="font-semibold tracking-tight text-[15px] text-ink">
        MANDATE
      </span>
    </span>
  );
}
