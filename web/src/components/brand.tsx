// YieldAI wordmark for the CLEAR INSTITUTIONAL shell.
// The logo is the "yield" mark; the product name is YieldAI.

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/yield-logo.png"
        alt="Yield"
        className="h-[18px] w-auto select-none"
        draggable={false}
      />
      <span className="ml-[2px] text-[17px] font-bold leading-none tracking-tight text-ink">
        AI
      </span>
    </span>
  );
}
