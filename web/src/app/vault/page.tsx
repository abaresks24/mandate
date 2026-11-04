"use client";

import { useState } from "react";
import { live, NEAR_CONFIG, vault } from "@/lib/near";
import { useLive } from "@/lib/useLive";
import { MANDATE } from "@/mock/mandate";
import {
  Badge,
  Button,
  Card,
  CardSkeleton,
  ErrorBanner,
  LiveIndicator,
  Mono,
  RiskMeter,
  SectionTitle,
  Stat,
} from "@/components/ui";
import { bps, usdc } from "@/lib/format";
import type { Mandate, PositionsLive } from "@/lib/types";

const MOCK_POSITIONS: PositionsLive = {
  positions: [
    { protocol: "rhea", chain: "near", token: "usdc", amount_usdc: "3000000000", apy_bps: 740, risk_score: 28 },
    { protocol: "morpho", chain: "ethereum-sepolia", token: "usdc", amount_usdc: "2000000000", apy_bps: 910, risk_score: 44 },
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
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionTitle sub="One NEAR sub-account per mandate, owned by the user.">
          Vault — {NEAR_CONFIG.vaultId}
        </SectionTitle>
        <div className="flex items-center gap-2">
          <LiveIndicator source={mandate.source} loading={mandate.loading} />
          <Badge tone="near">{usdc(String(total))} under management</Badge>
        </div>
      </div>

      {killed && (
        <Card className="border-danger/50 bg-danger/5">
          <Badge tone="danger">KILL SWITCH TRIGGERED</Badge>
          <p className="text-sm text-slate-300 mt-2">
            kill_switch() called by owner. All positions are being repatriated
            to the owner account. The agent&apos;s function-call key can no
            longer move funds.
          </p>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {positions.loading ? (
          <CardSkeleton rows={2} />
        ) : (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <SectionTitle>Positions</SectionTitle>
              <LiveIndicator
                source={positions.source}
                loading={positions.loading}
              />
            </div>
            {positions.error && <ErrorBanner message={positions.error} />}
            {pos.positions.length === 0 ? (
              <div className="rounded-lg border border-edge bg-ink/40 p-4 text-sm text-slate-400">
                No open positions on-chain.{" "}
                <span className="text-slate-200">
                  {usdc(pos.idle_usdc)} idle
                </span>{" "}
                — the agent has proposed actions (a1 executed, a2 blocked) but
                this demo vault holds capital idle. The mandate below is live.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {pos.positions.map((p, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border border-edge p-3 ${
                      killed ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium capitalize">
                          {p.protocol}
                        </span>
                        <Badge tone={p.chain === "near" ? "near" : "evm"}>
                          {p.chain}
                        </Badge>
                      </div>
                      <span className="text-white font-mono">
                        {usdc(p.amount_usdc)}
                      </span>
                    </div>
                    <div className="flex gap-6 mt-2">
                      <Stat label="APY" value={bps(p.apy_bps)} />
                      <div className="flex-1 max-w-[220px]">
                        <RiskMeter score={p.risk_score} max={m.max_risk_score} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {mandate.loading ? (
          <CardSkeleton rows={4} />
        ) : (
          <Card>
            <div className="flex items-center justify-between mb-4">
              <SectionTitle>Mandate rules</SectionTitle>
              <LiveIndicator source={mandate.source} loading={mandate.loading} />
            </div>
            {mandate.error && <ErrorBanner message={mandate.error} />}
            <div className="grid sm:grid-cols-2 gap-4">
              <Stat label="owner" value={<Mono>{m.owner}</Mono>} />
              <Stat label="target APY" value={bps(m.target_apy_bps)} />
              <Stat label="max risk score" value={`${m.max_risk_score}/100`} />
              <Stat label="max loss" value={bps(m.max_loss_bps)} />
              <Stat
                label="max share / protocol"
                value={bps(m.max_share_per_protocol_bps)}
              />
              <Stat label="daily cap" value={usdc(m.daily_cap_usdc)} />
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
                    usdc(m.committee_threshold_usdc)
                  )
                }
              />
            </div>
            <p className="text-xs text-slate-500 mt-4">
              propose_action validates these deterministically BEFORE touching
              the committee — fails closed. Out-of-mandate templates are
              rejected without ever drawing guardians (prompt-injection
              defense).
            </p>
          </Card>
        )}
      </div>

      <Card className="border-danger/30">
        <SectionTitle sub="Owner only. Repatriates everything to the owner account, overriding the agent.">
          Kill switch
        </SectionTitle>
        {!confirming ? (
          <Button tone="danger" onClick={() => setConfirming(true)} disabled={killed}>
            {killed ? "Funds repatriated" : "Trigger kill switch"}
          </Button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-300">
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
      </Card>
    </div>
  );
}
