"use client";

import {
  Badge,
  Card,
  CardSkeleton,
  ErrorBanner,
  LiveIndicator,
  Mono,
  SectionTitle,
  Stat,
} from "@/components/ui";
import { shortHash, usdc, yoctoToNear } from "@/lib/format";
import { live } from "@/lib/near";
import { useLive } from "@/lib/useLive";
import type { GuardianRow } from "@/lib/types";

const MOCK_GUARDIANS: GuardianRow[] = ["g1", "g2", "g3", "g4", "g5", "g6", "g7"].map(
  (id) => ({
    id,
    account: `${id}.mandate-arthur.testnet`,
    wasm_url: "",
    wasm_sha256: "1cae595d0eb333dde74740d4ddadf72074d2f3e6ac73211b17d61dc884c72109",
    bond: id === "g7" ? "0" : "3000000000000000000000000",
    status: id === "g7" ? "Slashed" : "Active",
    last_drawn_vault: id === "g6" ? null : "demo.vaults.mandate-arthur.testnet",
    unbond_ready_at: null,
    bond_usdc: id === "g7" ? "0" : "15000000",
  })
);

export default function GuardiansPage() {
  const g = useLive<GuardianRow[]>(() => live.allGuardians(), MOCK_GUARDIANS, []);
  const rows = g.data ?? MOCK_GUARDIANS;

  const active = rows.filter((r) => r.status === "Active").length;
  const slashed = rows.filter((r) => r.status === "Slashed").length;
  const totalBond = rows.reduce((s, r) => s + Number(r.bond_usdc), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <SectionTitle sub="The registered bonded TEE guardian set. Committees are drawn bond-weighted from the active guardians; a slashed guardian has zero bond and is excluded.">
          Guardians — the bonded set
        </SectionTitle>
        <LiveIndicator source={g.source} loading={g.loading} />
      </div>

      {g.error && <ErrorBanner message={g.error} />}

      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <Stat label="active guardians" value={<span className="text-ok">{active}</span>} />
        </Card>
        <Card>
          <Stat label="slashed" value={<span className="text-danger">{slashed}</span>} />
        </Card>
        <Card>
          <Stat
            label="total bond (insurance pool)"
            value={<span className="text-near">{usdc(String(totalBond))}</span>}
          />
        </Card>
      </div>

      {g.loading ? (
        <CardSkeleton rows={5} />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((r, i) => {
            const isSlashed = r.status === "Slashed";
            return (
              <Card
                key={r.id}
                className={`animate-rise ${
                  isSlashed ? "border-danger/50 bg-danger/5" : ""
                }`}
                >
                <div
                  className="flex items-center justify-between"
                  style={{ animationDelay: `${(i % 3) * 80}ms` }}
                >
                  <div>
                    <div className="font-mono text-xs text-slate-400">{r.id}</div>
                    <div className="text-sm text-white">
                      {r.account.split(".")[0]}
                    </div>
                  </div>
                  {isSlashed ? (
                    <Badge tone="danger">SLASHED</Badge>
                  ) : r.last_drawn_vault ? (
                    <Badge tone="near">Active</Badge>
                  ) : (
                    <Badge tone="muted">Active · idle</Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Stat
                    label="bond"
                    value={
                      <span className={isSlashed ? "text-danger" : "text-near"}>
                        {yoctoToNear(r.bond)} Ⓝ
                      </span>
                    }
                  />
                  <Stat label="bond (usdc)" value={usdc(r.bond_usdc)} />
                </div>
                <div className="mt-3">
                  <div className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                    wasm sha256 (verifiable TEE image)
                  </div>
                  <Mono>{shortHash(r.wasm_sha256, 14, 10)}</Mono>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
