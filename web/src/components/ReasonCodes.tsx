import { ReasonCode } from "@/lib/types";
import { cn } from "@/lib/cn";

const GOOD: ReasonCode[] = [
  "PRICE_OK",
  "SLIPPAGE_OK",
  "PROTOCOL_LIVE",
  "CROSSCHAIN_STATE_OK",
];

export function ReasonCodes({ codes }: { codes: ReasonCode[] }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px]">
      {codes.map((c) => (
        <span
          key={c}
          className={cn(GOOD.includes(c) ? "text-zinc-400" : "text-danger")}
        >
          {c}
        </span>
      ))}
    </div>
  );
}
