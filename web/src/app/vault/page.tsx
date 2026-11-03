"use client";

import { useState } from "react";
import { vault } from "@/lib/near";
import { MANDATE, POSITIONS } from "@/mock/mandate";
import {
  Badge,
  Button,
  Card,
  Mono,
  RiskMeter,
  SectionTitle,
  Stat,
} from "@/components/ui";
import { bps, usdc } from "@/lib/format";

export default function VaultPage() {
  const m = MANDATE;
  const positions = POSITIONS;
  const total = positions.reduce((s, p) => s + Number(p.amount_usdc), 0);

  const [killed, setKilled] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function doKill() {
    await vault.kill_switch(); // mock no-op; real signer in Phase 2
    setKilled(true);
    setConfirming(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <SectionTitle sub="One NEAR sub-account per mandate, owned by the user.">
          Vault — demo.vaults.mandate.testnet
        </SectionTitle>
        <Badge tone="near">{usdc(String(total))} under management</Badge>
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
        <Card>
          <SectionTitle>Positions</SectionTitle>
          <div className="flex flex-col gap-3">
            {positions.map((p, i) => (
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
                    <RiskMeter score={p.risk_score} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle>Mandate rules</SectionTitle>
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
            propose_action validates these deterministically BEFORE touching the
            committee — fails closed. Out-of-mandate templates are rejected
            without ever drawing guardians (prompt-injection defense).
          </p>
        </Card>
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
