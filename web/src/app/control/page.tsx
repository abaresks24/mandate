"use client";

import { useState } from "react";
import { toast } from "sonner";
import { live, vault } from "@/lib/near";
import { useLive } from "@/lib/useLive";
import { MANDATE } from "@/mock/mandate";
import {
  Badge,
  Button,
  Card,
  CardSkeleton,
  Copyable,
  ErrorBanner,
  LiveIndicator,
  RiskMeter,
  Stat,
  StatusBadge,
} from "@/components/ui";
import { CrossChainProof } from "@/components/CrossChainProof";
import { Reveal } from "@/components/motion";
import { StepHeader, StepNav, Details } from "@/components/journey";
import { bps, shortHash, usdc, yoctoToNear } from "@/lib/format";
import type { GuardianRow, Mandate, PositionsLive } from "@/lib/types";
import { Cpu, Power, ShieldAlert } from "lucide-react";

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

const MOCK_GUARDIANS: GuardianRow[] = [
  "g1",
  "g2",
  "g3",
  "g4",
  "g5",
  "g6",
  "g7",
].map((id) => ({
  id,
  account: `${id}.mandate-arthur.testnet`,
  wasm_url: "",
  wasm_sha256:
    "1cae595d0eb333dde74740d4ddadf72074d2f3e6ac73211b17d61dc884c72109",
  bond: id === "g7" ? "0" : "3000000000000000000000000",
  status: id === "g7" ? "Slashed" : "Active",
  last_drawn_vault: id === "g6" ? null : "demo.vaults.mandate-arthur.testnet",
  unbond_ready_at: null,
  bond_usdc: id === "g7" ? "0" : "15000000",
}));

export default function ControlStep() {
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
    <div className="flex flex-col gap-10">
      <Reveal>
        <StepHeader
          n={6}
          kicker="you stay in control"
          title="One button repatriates everything to you."
          context="The agent only ever holds a scoped function-call key. You hold the owner key — and the kill switch overrides the agent at any moment."
        />
      </Reveal>

      {/* HERO — kill switch + cross-chain proof */}
      <Reveal delay={0.08}>
        <Card className="border-danger/25">
          {killed ? (
            <div className="flex flex-col gap-2">
              <Badge tone="danger">
                <ShieldAlert className="h-3 w-3" /> KILL SWITCH TRIGGERED
              </Badge>
              <p className="text-sm text-zinc-300 mt-2 leading-relaxed max-w-xl">
                kill_switch() called by owner. All positions are being repatriated
                to the owner account. The agent&apos;s function-call key can no
                longer move funds.
              </p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-danger/25 bg-danger/10 text-danger shrink-0">
                  <Power className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Kill switch
                  </h3>
                  <p className="text-sm text-zinc-400 mt-0.5 max-w-md leading-relaxed">
                    Owner only. Returns all funds to the owner account, overriding
                    the agent.
                  </p>
                </div>
              </div>
              {!confirming ? (
                <Button tone="danger" onClick={() => setConfirming(true)}>
                  Trigger kill switch
                </Button>
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-zinc-300">
                    Repatriate ALL funds now?
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
          )}
        </Card>
      </Reveal>

      <Reveal delay={0.12}>
        <CrossChainProof />
      </Reveal>

      <Reveal delay={0.16}>
        <Details label="Show guardians, positions, and mandate (reference)">
          <GuardiansRoster />
          <div className="mt-6 border-t border-white/[0.06] pt-6">
            <VaultReference killed={killed} />
          </div>
        </Details>
      </Reveal>

      <StepNav n={6} />
    </div>
  );
}

function GuardiansRoster() {
  const g = useLive<GuardianRow[]>(() => live.allGuardians(), MOCK_GUARDIANS, []);
  const rows = g.data ?? MOCK_GUARDIANS;
  const totalBond = rows.reduce((s, r) => s + Number(r.bond_usdc), 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          guardian set · bonds = insurance pool {usdc(String(totalBond))}
        </span>
        <LiveIndicator source={g.source} loading={g.loading} />
      </div>
      {g.error && (
        <div className="mb-4">
          <ErrorBanner message={g.error} />
        </div>
      )}
      {g.loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} rows={2} />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {rows.map((r) => {
            const isSlashed = r.status === "Slashed";
            return (
              <div
                key={r.id}
                className={
                  "rounded-xl border p-4 " +
                  (isSlashed
                    ? "border-danger/35 bg-danger/[0.04]"
                    : "border-white/[0.06] bg-white/[0.02]")
                }
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={
                      "flex h-8 w-8 items-center justify-center rounded-lg border font-mono text-xs font-semibold " +
                      (isSlashed
                        ? "border-danger/30 bg-danger/10 text-danger"
                        : "border-near/25 bg-near/10 text-near")
                    }
                  >
                    {r.id}
                  </span>
                  {isSlashed ? (
                    <StatusBadge status="Slashed" />
                  ) : (
                    <StatusBadge status="Active" />
                  )}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">bond</span>
                  <span
                    className={
                      "font-mono " + (isSlashed ? "text-danger" : "text-near")
                    }
                  >
                    {yoctoToNear(r.bond)} Ⓝ · {usdc(r.bond_usdc)}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <Cpu className="h-3 w-3 text-zinc-600 shrink-0" />
                  <Copyable
                    value={r.wasm_sha256}
                    display={shortHash(r.wasm_sha256, 10, 6)}
                    label="wasm hash copied"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function VaultReference({ killed }: { killed: boolean }) {
  const mandate = useLive<Mandate>(() => live.mandate(), MANDATE, []);
  const positions = useLive<PositionsLive>(
    () => live.positions(),
    MOCK_POSITIONS,
    []
  );
  const m = mandate.data ?? MANDATE;
  const pos = positions.data ?? MOCK_POSITIONS;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          vault · {usdc(pos.total_usdc)} AUM
        </span>
        <LiveIndicator source={positions.source} loading={positions.loading} />
      </div>
      {positions.error && (
        <div className="mb-4">
          <ErrorBanner message={positions.error} />
        </div>
      )}
      <div className="flex flex-col gap-3">
        {pos.positions.map((p, i) => (
          <div
            key={i}
            className={
              "rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 " +
              (killed ? "opacity-40" : "")
            }
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
                value={
                  <span className="font-mono text-near">{bps(p.apy_bps)}</span>
                }
              />
              <div className="flex-1 max-w-[240px]">
                <RiskMeter score={p.risk_score} max={m.max_risk_score} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-zinc-500 mt-4 leading-relaxed">
        Target {bps(m.target_apy_bps)} · risk ceiling {m.max_risk_score}/100 ·
        allowed: {m.allowed_protocols.join(", ")}. Every rule is enforced by the
        contract before any committee is drawn.
      </p>
    </div>
  );
}
