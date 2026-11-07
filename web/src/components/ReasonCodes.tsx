import { ReasonCode } from "@/lib/types";
import { Badge } from "./ui";

const GOOD: ReasonCode[] = [
  "PRICE_OK",
  "SLIPPAGE_OK",
  "PROTOCOL_LIVE",
  "CROSSCHAIN_STATE_OK",
];

export function ReasonCodeBadges({ codes }: { codes: ReasonCode[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {codes.map((c) => (
        <Badge key={c} tone={GOOD.includes(c) ? "ok" : "danger"}>
          <span className="font-mono text-[10px]">{c}</span>
        </Badge>
      ))}
    </div>
  );
}
