"use client";

import { live } from "@/lib/near";
import { useLive } from "@/lib/useLive";
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
import { shortHash, usdc, yoctoToNear } from "@/lib/format";
import type { GuardianRow } from "@/lib/types";

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

export default function GuardiansPage() {
  const g = useLive<GuardianRow[]>(() => live.allGuardians(), MOCK_GUARDIANS, []);
  const rows = g.data ?? MOCK_GUARDIANS;
  const totalBond = rows.reduce((s, r) => s + Number(r.bond_usdc), 0);

  return (
    <div className="flex flex-col gap-14">
      <Reveal>
        <PageIntro
          kicker="The guardians"
          title="A bonded set of seven. The bond is the insurance."
          context="Guardians stake a bond to be drawable. When a committee is drawn, their pooled bond exceeds the action value — so a lie is always covered. g7 lied and was slashed to zero."
        />
      </Reveal>

      {/* The insurance pool is the headline number */}
      <Reveal delay={0.06}>
        <div>
          <Label>pooled bond · insurance</Label>
          <div className="flex items-baseline gap-3 mt-2">
            <span className="text-5xl sm:text-6xl font-semibold font-mono tabular-nums text-white tracking-tight">
              {usdc(String(totalBond))}
            </span>
            <LiveIndicator source={g.source} loading={g.loading} />
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="border-t border-edge pt-10">
          <Label className="mb-5">guardian set</Label>
          {g.error && (
            <div className="mb-5">
              <ErrorBanner message={g.error} />
            </div>
          )}
          {g.loading ? (
            <div className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-edge">
              {rows.map((r) => {
                const isSlashed = r.status === "Slashed";
                return (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3.5"
                  >
                    <div className="flex items-center gap-2.5 w-28">
                      <Dot tone={isSlashed ? "danger" : "near"} />
                      <span className="font-mono text-sm text-white">
                        {r.id}
                      </span>
                      <span
                        className={
                          "text-xs " +
                          (isSlashed ? "text-danger" : "text-zinc-500")
                        }
                      >
                        {isSlashed ? "slashed" : "active"}
                      </span>
                    </div>
                    <span
                      className={
                        "font-mono text-sm " +
                        (isSlashed ? "text-danger" : "text-zinc-300")
                      }
                    >
                      {yoctoToNear(r.bond)} Ⓝ · {usdc(r.bond_usdc)}
                    </span>
                    <div className="ml-auto">
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
      </Reveal>

      <Reveal delay={0.14}>
        <Details label="Why the bond is insurance">
          <p className="text-sm leading-relaxed text-zinc-300 max-w-2xl">
            Each guardian runs attested code in a TEE (the{" "}
            <span className="font-mono text-zinc-200">wasm_sha256</span> is
            verifiable), so no operator can tamper with what it reports. On top of
            that, the quorum&apos;s pooled bond is required to exceed the action
            value. A false attestation is re-derivable from the same signed feed —
            so the liar is slashed and the loss is covered. g7&apos;s bond went to
            zero the moment it lied.
          </p>
        </Details>
      </Reveal>

    </div>
  );
}
