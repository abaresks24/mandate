"use client";

import { CommitteeView } from "@/components/CommitteeView";
import {
  Badge,
  Card,
  ErrorBanner,
  LiveIndicator,
  SectionTitle,
  Skeleton,
  Stat,
  StatusBadge,
  Copyable,
} from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { Reveal } from "@/components/motion";
import { price6, yoctoToNear } from "@/lib/format";
import { live } from "@/lib/near";
import { useLive } from "@/lib/useLive";
import type { GuardianHistory } from "@/lib/types";
import {
  ShieldAlert,
  Ban,
  TrendingDown,
  Award,
  FileWarning,
  ArrowDown,
} from "lucide-react";

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

export default function SlashingPage() {
  const g7 = useLive<GuardianHistory>(
    () => live.guardianHistory("g7"),
    MOCK_G7_HISTORY,
    []
  );
  const h = g7.data ?? MOCK_G7_HISTORY;
  const slashed = h.info.status === "Slashed";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={
          <Badge tone="danger">
            <ShieldAlert className="h-3 w-3" /> security · the drama
          </Badge>
        }
        title="Slashing — a corrupt guardian loses its bond"
        sub="Action a2: a corrupt guardian approves a bad cross-chain action alone, off a non-verifiable feed. The two honest guardians refuse, the action is blocked at 1-of-3, and the liar is slashed — all read live from the coordinator."
      />

      {/* the attack */}
      <Reveal>
        <Card className="relative overflow-hidden border-danger/30 bg-gradient-to-br from-danger/[0.06] to-transparent">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-danger/10 blur-3xl"
            aria-hidden
          />
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-4 flex-wrap">
              <Badge tone="danger">attack</Badge>
              <span className="text-white font-semibold">
                Guardian g7 reports a fabricated USDC depeg and approves alone.
              </span>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-danger/25 bg-danger/[0.05] p-4">
                <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5">
                  g7 claims · non-verifiable feed
                </div>
                <div className="text-lg font-mono font-semibold text-danger">
                  USDC = {price6("915000")}
                </div>
                <div className="text-xs text-zinc-500 mt-1 font-mono">
                  @ block 7421990
                </div>
              </div>
              <div className="rounded-xl border border-near/20 bg-near/[0.05] p-4">
                <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 mb-1.5">
                  honest guardians read · verifiable Pyth
                </div>
                <div className="text-lg font-mono font-semibold text-near">
                  USDC = {price6("1000015")}
                </div>
                <div className="text-xs text-zinc-500 mt-1 font-mono">
                  @ block 7421990
                </div>
              </div>
            </div>
            <p className="text-sm text-zinc-400 mt-4 leading-relaxed">
              The liar&apos;s only source is a non-verifiable custom endpoint. The
              two honest guardians read the SAME block from a verifiable Pyth
              signed update. Because reports are deterministic for a given block,
              anyone can re-derive the truth — the false attestation is provable.
            </p>
          </div>
        </Card>
      </Reveal>

      {/* committee outcome */}
      <div className="flex flex-col gap-4">
        <SectionTitle sub="The same commit→reveal lifecycle, now with a liar in the committee. Reveal the reports to watch it stall at 1/3.">
          Committee outcome — blocked at 1/3
        </SectionTitle>
        <CommitteeView actionId="a2" template="AllocateCrossChain · Morpho" />
      </div>

      {/* fault proof → slashing */}
      <Reveal>
        <Card>
          <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
            <SectionTitle sub="A fault proof re-derives g7's report from the same block + signed update; mismatch slashes g7's full bond and rewards the challenger.">
              Fault proof → slashing
            </SectionTitle>
            <LiveIndicator source={g7.source} loading={g7.loading} />
          </div>

          {g7.error && (
            <div className="mb-4">
              <ErrorBanner message={g7.error} />
            </div>
          )}

          {g7.loading ? (
            <div className="grid sm:grid-cols-3 gap-4">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-danger/30 bg-danger/[0.04] p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-2 text-sm text-zinc-300">
                    <TrendingDown className="h-4 w-4 text-danger" />
                    <span className="font-mono">{h.guardian_id}</span>
                  </span>
                  {slashed ? (
                    <StatusBadge status="Slashed" />
                  ) : (
                    <Badge tone="ok">{h.info.status}</Badge>
                  )}
                </div>
                <div className="text-3xl font-semibold text-danger font-mono tabular-nums">
                  −{yoctoToNear(h.total_slashed)} Ⓝ
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  full bond slashed · remaining {yoctoToNear(h.info.bond)} Ⓝ
                </div>
              </div>

              <div className="rounded-2xl border border-near/25 bg-near/[0.04] p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-2 text-sm text-zinc-300">
                    <Award className="h-4 w-4 text-near" />
                    challenger
                  </span>
                  <Badge tone="ok">REWARDED</Badge>
                </div>
                <div className="text-3xl font-semibold text-near font-mono tabular-nums">
                  +1.6 Ⓝ
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  deposit refunded + reward
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-panel/50 p-5">
                <Stat
                  label="guardian record"
                  value={
                    <span className="font-mono text-zinc-300">
                      {h.draws} draw · {h.reveals} reveal · {h.slashes} slash
                    </span>
                  }
                />
                <div className="mt-3 flex items-center gap-2 text-sm text-zinc-300">
                  action <span className="font-mono text-zinc-400">a2</span> stayed
                  <span className="inline-flex items-center gap-1 text-danger font-semibold">
                    <Ban className="h-3.5 w-3.5" /> BLOCKED
                  </span>
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  User funds never moved on a lie.
                </div>
              </div>
            </div>
          )}

          {/* arrow + fault proof JSON */}
          <div className="flex items-center justify-center my-5 text-zinc-600">
            <ArrowDown className="h-5 w-5" />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileWarning className="h-3.5 w-3.5 text-zinc-500" />
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                fault proof · re-derivable
              </span>
            </div>
            <div className="rounded-xl bg-ink border border-white/[0.06] p-4 overflow-x-auto">
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
                          ? "text-near"
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
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
