"use client";

import { CommitteeView } from "@/components/CommitteeView";
import {
  Badge,
  Card,
  ErrorBanner,
  LiveIndicator,
  Mono,
  SectionTitle,
  Skeleton,
  Stat,
} from "@/components/ui";
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

export default function SlashingPage() {
  const g7 = useLive<GuardianHistory>(
    () => live.guardianHistory("g7"),
    MOCK_G7_HISTORY,
    []
  );
  const h = g7.data ?? MOCK_G7_HISTORY;
  const slashed = h.info.status === "Slashed";

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle sub="Action a2: a corrupt guardian approves a bad cross-chain action alone, off a non-verifiable feed. The two honest guardians refuse, the action is blocked at 1-of-3, and the liar is slashed — all read live from the coordinator.">
        Slashing demo — action a2
      </SectionTitle>

      <Card className="border-danger/40 bg-danger/5">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <Badge tone="danger">attack</Badge>
          <span className="text-white font-semibold">
            Guardian g7 reports a fabricated USDC depeg and approves alone
          </span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-2">
          <Stat
            label="g7 claims (non-verifiable feed)"
            value={
              <span className="text-danger">
                USDC = {price6("915000")} @ block 7421990
              </span>
            }
          />
          <Stat
            label="honest guardians read (verifiable Pyth)"
            value={
              <span className="text-ok">
                USDC = {price6("1000015")} @ block 7421990
              </span>
            }
          />
        </div>
        <p className="text-sm text-slate-400 mt-3">
          The liar&apos;s only source is a non-verifiable custom endpoint. The
          two honest guardians read the SAME block from a verifiable Pyth signed
          update. Because reports are deterministic for a given block, anyone
          can re-derive the truth — the false attestation is provable.
        </p>
      </Card>

      <div>
        <SectionTitle>Committee outcome — action blocked (live 1/3)</SectionTitle>
        <CommitteeView actionId="a2" template="AllocateCrossChain · Morpho" />
      </div>

      <Card>
        <div className="flex items-center justify-between mb-1">
          <SectionTitle sub="A fault proof re-derives g7's report from the same block + signed update; mismatch slashes g7's full bond and rewards the challenger.">
            Fault proof → slashing (on-chain outcome)
          </SectionTitle>
          <LiveIndicator source={g7.source} loading={g7.loading} />
        </div>

        {g7.error && <ErrorBanner message={g7.error} />}

        {g7.loading ? (
          <div className="grid sm:grid-cols-3 gap-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : (
          <div className="grid sm:grid-cols-3 gap-4">
            <Card className="bg-danger/5 border-danger/40">
              <Stat
                label="guardian"
                value={
                  <span className="inline-flex items-center gap-2">
                    {h.guardian_id}{" "}
                    {slashed ? (
                      <Badge tone="danger">SLASHED</Badge>
                    ) : (
                      <Badge tone="ok">{h.info.status}</Badge>
                    )}
                  </span>
                }
              />
              <div className="mt-2 text-2xl font-semibold text-danger">
                −{yoctoToNear(h.total_slashed)} Ⓝ
              </div>
              <div className="text-xs text-slate-500">
                full bond slashed · remaining bond {yoctoToNear(h.info.bond)} Ⓝ
              </div>
            </Card>
            <Card className="bg-ok/5 border-ok/40">
              <Stat label="challenger" value={<Badge tone="ok">REWARDED</Badge>} />
              <div className="mt-2 text-2xl font-semibold text-ok">
                +1.6 Ⓝ
              </div>
              <div className="text-xs text-slate-500">
                deposit refunded + reward
              </div>
            </Card>
            <Card>
              <Stat
                label="guardian record"
                value={
                  <span className="text-slate-300 text-sm">
                    {h.draws} draw · {h.reveals} reveal · {h.slashes} slash
                  </span>
                }
              />
              <div className="mt-2 text-sm text-slate-300">
                action <Mono>a2</Mono> stayed{" "}
                <span className="text-danger font-semibold">BLOCKED</span>. User
                funds never moved on a lie.
              </div>
            </Card>
          </div>
        )}

        <div className="mt-5">
          <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
            fault proof (re-derivable)
          </div>
          <pre className="rounded-lg bg-ink border border-edge p-3 text-xs text-slate-300 overflow-x-auto">
{JSON.stringify(
  {
    action_id: "a2",
    guardian_id: "g7",
    fault: "FalseAttestation",
    claimed_price_usdc: "915000",
    verifiable_price_usdc: "1000015",
    price_block: 7421990,
    pyth_update_ref: "0x9ad0…signed-update",
    note: "re-derivable: same block + same signed Pyth update yields $1.00, not $0.915",
  },
  null,
  2
)}
          </pre>
        </div>
      </Card>
    </div>
  );
}
