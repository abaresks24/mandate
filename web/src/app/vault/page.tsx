"use client";

import { useState } from "react";
import { toast } from "sonner";
import { live, NEAR_CONFIG, vault } from "@/lib/near";
import { useLive } from "@/lib/useLive";
import { MANDATE } from "@/mock/mandate";
import {
  Badge,
  Button,
  Card,
  CardSkeleton,
  EmptyState,
  ErrorBanner,
  LiveIndicator,
  Copyable,
  RiskMeter,
  SectionTitle,
  Stat,
} from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { Reveal } from "@/components/motion";
import { bps, usdc } from "@/lib/format";
import type { Mandate, PositionsLive } from "@/lib/types";
import { Inbox, Power, ShieldAlert } from "lucide-react";

const MOCK_POSITIONS: PositionsLive = {
  positions: [
    {
      protocol: "rhea",
      chain: "near",
      token: "usdc",
      amount_usdc: "3000000000",
      apy_bps: 740,
      risk_score: 28,
    },
    {
      protocol: "morpho",
      chain: "ethereum-sepolia",
      token: "usdc",
      amount_usdc: "2000000000",
      apy_bps: 910,
      risk_score: 44,
    },
  ],
  idle_usdc: "0",
  total_usdc: "5000000000",
};

export default function VaultPage() {
  const mandate = useLive<Mandate>(() => live.mandate(), MANDATE, []);
  const positions = useLive<PositionsLive>(
    () => live.positions(),
    MOCK_POSITIONS,
    []
  );

  const m = mandate.data ?? MANDATE;
  const pos = positions.data ?? MOCK_POSITIONS;
  const total = Number(pos.total_usdc);

  const [killed, setKilled] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function doKill() {
    await vault.kill_switch(); // mock no-op; real signer in Phase 2
    setKilled(true);
    setConfirming(false);
    toast.success("Kill switch triggered", {
      description: "All funds are being repatriated to the owner.",
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={
          <span className="font-mono text-xs text-zinc-500">
            {NEAR_CONFIG.vaultId}
          </span>
        }
        title="Vault"
        sub="One NEAR sub-account per mandate, owned by the user. Live mandate rules and positions, plus the owner-only kill switch."
        actions={
          <div className="flex items-center gap-2">
            <LiveIndicator source={mandate.source} loading={mandate.loading} />
            <Badge tone="near">{usdc(String(total))} AUM</Badge>
          </div>
        }
      />

      {killed && (
        <Reveal>
          <Card className="border-danger/35 bg-danger/[0.05]">
            <Badge tone="danger">
              <ShieldAlert className="h-3 w-3" /> KILL SWITCH TRIGGERED
            </Badge>
            <p className="text-sm text-zinc-300 mt-3 leading-relaxed">
              kill_switch() called by owner. All positions are being repatriated
              to the owner account. The agent&apos;s function-call key can no
              longer move funds.
            </p>
          </Card>
        </Reveal>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {/* positions */}
        {positions.loading ? (
          <CardSkeleton rows={2} />
        ) : (
          <Reveal>
            <Card>
              <div className="flex items-center justify-between mb-5">
                <SectionTitle>Positions</SectionTitle>
                <LiveIndicator
                  source={positions.source}
                  loading={positions.loading}
                />
              </div>
              {positions.error && (
                <div className="mb-4">
                  <ErrorBanner message={positions.error} />
                </div>
              )}
              {pos.positions.length === 0 ? (
                <EmptyState icon={<Inbox className="h-5 w-5" />} title="No open positions on-chain">
                  <span className="text-zinc-200">{usdc(pos.idle_usdc)} idle</span>
                  {" "}— the agent has proposed actions (a1 executed, a2 blocked)
                  but this demo vault holds capital idle. The mandate is live.
                </EmptyState>
              ) : (
                <div className="flex flex-col gap-3">
                  {pos.positions.map((p, i) => (
                    <div
                      key={i}
                      className={`rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-opacity ${
                        killed ? "opacity-40" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="text-white font-medium capitalize">
                            {p.protocol}
                          </span>
                          <Badge tone={p.chain === "near" ? "near" : "evm"}>
                            {p.chain}
                          </Badge>
                        </div>
                        <span className="text-white font-mono font-semibold">
                          {usdc(p.amount_usdc)}
                        </span>
                      </div>
                      <div className="flex gap-6 items-end mt-3">
                        <Stat
                          label="APY"
                          value={<span className="font-mono text-near">{bps(p.apy_bps)}</span>}
                        />
                        <div className="flex-1 max-w-[240px]">
                          <RiskMeter score={p.risk_score} max={m.max_risk_score} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </Reveal>
        )}

        {/* mandate */}
        {mandate.loading ? (
          <CardSkeleton rows={4} />
        ) : (
          <Reveal delay={0.06}>
            <Card>
              <div className="flex items-center justify-between mb-5">
                <SectionTitle>Mandate rules</SectionTitle>
                <LiveIndicator
                  source={mandate.source}
                  loading={mandate.loading}
                />
              </div>
              {mandate.error && (
                <div className="mb-4">
                  <ErrorBanner message={mandate.error} />
                </div>
              )}
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4">
                <Stat label="owner" value={<Copyable value={m.owner} />} />
                <Stat
                  label="target APY"
                  value={<span className="font-mono">{bps(m.target_apy_bps)}</span>}
                />
                <Stat
                  label="max risk score"
                  value={<span className="font-mono">{m.max_risk_score}/100</span>}
                />
                <Stat
                  label="max loss"
                  value={<span className="font-mono">{bps(m.max_loss_bps)}</span>}
                />
                <Stat
                  label="max share / protocol"
                  value={
                    <span className="font-mono">
                      {bps(m.max_share_per_protocol_bps)}
                    </span>
                  }
                />
                <Stat
                  label="daily cap"
                  value={<span className="font-mono">{usdc(m.daily_cap_usdc)}</span>}
                />
                <Stat
                  label="allowed protocols"
                  value={m.allowed_protocols.join(", ")}
                />
                <Stat label="allowed chains" value={m.allowed_chains.join(", ")} />
                <Stat
                  label="committee"
                  value={
                    m.committee_threshold_usdc === "0" ? (
                      <Badge tone="evm">permanent</Badge>
                    ) : (
                      <span className="font-mono">
                        {usdc(m.committee_threshold_usdc)}
                      </span>
                    )
                  }
                />
              </div>
              <p className="text-xs text-zinc-500 mt-5 leading-relaxed border-t border-white/[0.06] pt-4">
                propose_action validates these deterministically BEFORE touching
                the committee — fails closed. Out-of-mandate templates are
                rejected without ever drawing guardians (prompt-injection
                defense).
              </p>
            </Card>
          </Reveal>
        )}
      </div>

      {/* kill switch */}
      <Reveal>
        <Card className="border-danger/25">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-danger/25 bg-danger/10 text-danger shrink-0">
                <Power className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-white">Kill switch</h3>
                <p className="text-sm text-zinc-400 mt-0.5 max-w-md leading-relaxed">
                  Owner only. Repatriates everything to the owner account,
                  overriding the agent.
                </p>
              </div>
            </div>
            {!confirming ? (
              <Button
                tone="danger"
                onClick={() => setConfirming(true)}
                disabled={killed}
              >
                {killed ? "Funds repatriated" : "Trigger kill switch"}
              </Button>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-zinc-300">
                  Repatriate ALL funds to the owner now?
                </span>
                <Button tone="danger" onClick={doKill}>
                  Confirm
                </Button>
                <Button tone="ghost" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
