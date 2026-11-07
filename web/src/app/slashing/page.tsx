"use client";

import { CommitteeSummary, CommitteeView } from "@/components/CommitteeView";
import {
  Copyable,
  Dot,
  ErrorBanner,
  Label,
  LiveIndicator,
  Skeleton,
} from "@/components/ui";
import { Reveal } from "@/components/motion";
import { PageIntro, Details } from "@/components/journey";
import { price6, yoctoToNear } from "@/lib/format";
import { live } from "@/lib/near";
import { useLive } from "@/lib/useLive";
import type { GuardianHistory } from "@/lib/types";

const MOCK_G7_HISTORY: GuardianHistory = {
  guardian_id: "g7",
  info: {
    id: "g7",
    account: "g7.mandate-arthur.testnet",
    wasm_url: "",
    wasm_sha256: "mock",
    bond: "0",
    status: "Slashed",
    last_drawn_vault: "demo.vaults.mandate-arthur.testnet",
    unbond_ready_at: null,
  },
  draws: 1,
  reveals: 1,
  slashes: 1,
  total_slashed: "3000000000000000000000000",
};

const FAULT_PROOF = {
  action_id: "a2",
  guardian_id: "g7",
  fault: "FalseAttestation",
  claimed_price_usdc: "915000",
  verifiable_price_usdc: "1000015",
  price_block: 7421990,
  pyth_update_ref: "0x9ad0…signed-update",
  note: "re-derivable: same block + same signed Pyth update yields $1.00, not $0.915",
};

export default function SlashingStep() {
  const g7 = useLive<GuardianHistory>(
    () => live.guardianHistory("g7"),
    MOCK_G7_HISTORY,
    []
  );
  const h = g7.data ?? MOCK_G7_HISTORY;
  const slashed = h.info.status === "Slashed";

  return (
    <div className="flex flex-col gap-14">
      <Reveal>
        <PageIntro
          kicker="When a guardian lies"
          title="A lie is blocked — and it costs the liar its bond."
          context="Guardian g7 approves a bad action alone, off a fabricated feed. The honest guardians refuse, the action stalls at 1 of 3, and g7 is slashed."
        />
      </Reveal>

      {/* The two live outcomes — the tally and the slash loss */}
      <div className="grid md:grid-cols-2 gap-x-10 gap-y-10">
        <Reveal delay={0.06}>
          <CommitteeSummary actionId="a2" />
        </Reveal>

        <Reveal delay={0.1}>
          <div className="md:border-l md:border-edge md:pl-10">
            {g7.loading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-2">
                  <Label>guardian {h.guardian_id} · slashed</Label>
                  <LiveIndicator source={g7.source} loading={g7.loading} />
                </div>
                <div className="text-5xl sm:text-6xl font-semibold text-danger font-mono tabular-nums tracking-tight">
                  −{yoctoToNear(h.total_slashed)} Ⓝ
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Dot tone={slashed ? "danger" : "near"} />
                  <span className={slashed ? "text-danger" : "text-near"}>
                    {slashed ? "slashed" : h.info.status.toLowerCase()}
                  </span>
                  <span className="text-zinc-500">
                    · full bond slashed · challenger rewarded
                  </span>
                </div>
              </div>
            )}
          </div>
        </Reveal>
      </div>

      {g7.error && (
        <Reveal>
          <ErrorBanner message={g7.error} />
        </Reveal>
      )}

      <Reveal delay={0.14}>
        <Details label="Show the lie, the honest readings, and the fault proof">
          {/* liar vs honest — two columns, no boxes */}
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6 mb-8">
            <div>
              <Label className="mb-1.5">g7 claims · non-verifiable feed</Label>
              <div className="text-lg font-mono font-semibold text-danger">
                USDC = {price6("915000")}
              </div>
              <div className="text-xs text-zinc-500 mt-1 font-mono">
                @ block 7421990
              </div>
            </div>
            <div className="sm:border-l sm:border-edge sm:pl-8">
              <Label className="mb-1.5">
                honest guardians read · verifiable Pyth
              </Label>
              <div className="text-lg font-mono font-semibold text-near">
                USDC = {price6("1000015")}
              </div>
              <div className="text-xs text-zinc-500 mt-1 font-mono">
                @ block 7421990
              </div>
            </div>
          </div>

          <p className="text-sm text-zinc-400 leading-relaxed mb-8 max-w-2xl">
            Reports are deterministic for a given block, so anyone can re-derive the
            truth from the same signed Pyth update — the false attestation is
            provable. g7&apos;s record: {h.draws} draw · {h.reveals} reveal ·{" "}
            {h.slashes} slash. Action a2 stayed{" "}
            <span className="text-danger">blocked</span> — user funds never moved on
            a lie.
          </p>

          {/* fault proof JSON — one bordered surface */}
          <Label className="mb-2">fault proof · re-derivable</Label>
          <div className="rounded-xl bg-ink border border-edge p-4 overflow-x-auto">
            <pre className="font-mono text-xs leading-relaxed text-zinc-300">
              <span className="text-zinc-600">{"{"}</span>
              {Object.entries(FAULT_PROOF).map(([k, v]) => (
                <div key={k} className="pl-4">
                  <span className="text-evm">&quot;{k}&quot;</span>
                  <span className="text-zinc-600">: </span>
                  <span
                    className={
                      k === "fault"
                        ? "text-danger"
                        : typeof v === "number"
                        ? "text-zinc-200"
                        : "text-zinc-200"
                    }
                  >
                    {typeof v === "string" ? `"${v}"` : String(v)}
                  </span>
                  <span className="text-zinc-600">,</span>
                </div>
              ))}
              <span className="text-zinc-600">{"}"}</span>
            </pre>
          </div>
          <div className="mt-2 text-xs text-zinc-500 flex items-center gap-2">
            pyth update ref:{" "}
            <Copyable
              value="0x9ad0...signed-update"
              display="0x9ad0…signed-update"
              label="Ref copied"
            />
          </div>

          {/* the full committee lifecycle for a2 */}
          <div className="mt-8 border-t border-edge pt-8">
            <p className="text-sm text-zinc-400 leading-relaxed mb-5 max-w-2xl">
              The same commit → reveal lifecycle, now with a liar in the committee.
              Reveal the reports to watch it stall at 1 / 3.
            </p>
            <CommitteeView actionId="a2" template="AllocateCrossChain · Morpho" />
          </div>
        </Details>
      </Reveal>

    </div>
  );
}
