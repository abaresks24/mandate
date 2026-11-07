"use client";

import {
  Badge,
  Card,
  CardSkeleton,
  ErrorBanner,
  LiveIndicator,
  Copyable,
  Stat,
  StatusBadge,
} from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import { Reveal, Stagger, StaggerItem, CountUp } from "@/components/motion";
import { shortHash, usdc, yoctoToNear } from "@/lib/format";
import { live } from "@/lib/near";
import { useLive } from "@/lib/useLive";
import type { GuardianRow } from "@/lib/types";
import { ShieldCheck, ShieldAlert, Coins, Cpu } from "lucide-react";

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

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone: "near" | "danger" | "evm";
}) {
  const ring =
    tone === "danger"
      ? "border-danger/25 bg-danger/10 text-danger"
      : tone === "evm"
      ? "border-evm/25 bg-evm/10 text-evm"
      : "border-near/25 bg-near/10 text-near";
  return (
    <Card className="flex items-center gap-4">
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-xl border ${ring}`}
      >
        {icon}
      </span>
      <div>
        <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
          {label}
        </div>
        <div className="text-2xl font-semibold text-white mt-0.5">{value}</div>
      </div>
    </Card>
  );
}

export default function GuardiansPage() {
  const g = useLive<GuardianRow[]>(() => live.allGuardians(), MOCK_GUARDIANS, []);
  const rows = g.data ?? MOCK_GUARDIANS;

  const active = rows.filter((r) => r.status === "Active").length;
  const slashed = rows.filter((r) => r.status === "Slashed").length;
  const totalBond = rows.reduce((s, r) => s + Number(r.bond_usdc), 0);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<Badge tone="near">coordinator · live</Badge>}
        title="Guardians — the bonded set"
        sub="The registered bonded TEE guardian set. Committees are drawn bond-weighted from the active guardians; a slashed guardian has a zero bond and is excluded. The pooled bond is the insurance behind every cross-chain action."
        actions={<LiveIndicator source={g.source} loading={g.loading} />}
      />

      {g.error && <ErrorBanner message={g.error} />}

      <Reveal>
        <div className="grid sm:grid-cols-3 gap-4">
          <SummaryCard
            icon={<ShieldCheck className="h-5 w-5" />}
            label="active guardians"
            value={<CountUp value={active} className="text-near" />}
            tone="near"
          />
          <SummaryCard
            icon={<ShieldAlert className="h-5 w-5" />}
            label="slashed"
            value={<CountUp value={slashed} className="text-danger" />}
            tone="danger"
          />
          <SummaryCard
            icon={<Coins className="h-5 w-5" />}
            label="total bond · insurance pool"
            value={
              <span className="text-near font-mono text-xl">
                {usdc(String(totalBond))}
              </span>
            }
            tone="evm"
          />
        </div>
      </Reveal>

      {g.loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} rows={3} />
          ))}
        </div>
      ) : (
        <Stagger className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((r) => {
            const isSlashed = r.status === "Slashed";
            return (
              <StaggerItem key={r.id}>
                <Card
                  hover={!isSlashed}
                  className={
                    isSlashed ? "border-danger/35 bg-danger/[0.04]" : ""
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl border font-mono text-xs font-semibold ${
                          isSlashed
                            ? "border-danger/30 bg-danger/10 text-danger"
                            : "border-near/25 bg-near/10 text-near"
                        }`}
                      >
                        {r.id}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-white">
                          {r.account.split(".")[0]}
                        </div>
                        <div className="text-xs text-zinc-500">guardian</div>
                      </div>
                    </div>
                    {isSlashed ? (
                      <StatusBadge status="Slashed" />
                    ) : r.last_drawn_vault ? (
                      <StatusBadge status="Active" />
                    ) : (
                      <Badge tone="muted">Active · idle</Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-5">
                    <Stat
                      label="bond"
                      value={
                        <span
                          className={`font-mono ${
                            isSlashed ? "text-danger" : "text-near"
                          }`}
                        >
                          {yoctoToNear(r.bond)} Ⓝ
                        </span>
                      }
                    />
                    <Stat
                      label="bond (usdc)"
                      value={<span className="font-mono">{usdc(r.bond_usdc)}</span>}
                    />
                  </div>

                  <div className="mt-5 pt-4 border-t border-white/[0.06]">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Cpu className="h-3 w-3 text-zinc-500" />
                      <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                        wasm sha256 · verifiable TEE image
                      </span>
                    </div>
                    <Copyable
                      value={r.wasm_sha256}
                      display={shortHash(r.wasm_sha256, 14, 10)}
                      label="wasm hash copied"
                    />
                  </div>
                </Card>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </div>
  );
}
