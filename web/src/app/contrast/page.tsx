import Link from "next/link";
import { Badge, Card, Mono, SectionTitle, Stat } from "@/components/ui";
import { CrossChainProof } from "@/components/CrossChainProof";
import { PageHeader } from "@/components/PageHeader";
import { Reveal } from "@/components/motion";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Users,
  Cpu,
} from "lucide-react";

export default function ContrastPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={<Badge tone="evm">thesis</Badge>}
        title="The Contrast"
        sub="The whole point. Same vault, same agent, same mandate — but WHO can verify an action depends on the chain it touches."
      />

      <Reveal>
        <div className="grid md:grid-cols-2 gap-4">
          {/* NEAR / Rhea */}
          <Card className="relative overflow-hidden border-near/25 bg-gradient-to-br from-near/[0.05] to-transparent">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <Badge tone="near">NEAR testnet</Badge>
              <Badge tone="near">
                <Eye className="h-3 w-3" /> verified by contract alone
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-near/25 bg-near/10 text-near">
                <Cpu className="h-5 w-5" />
              </span>
              <h3 className="text-white font-semibold text-lg tracking-tight">
                SupplyRhea (USDC)
              </h3>
            </div>
            <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
              The Vault contract reads Rhea / Ref state on NEAR in the same
              transaction. There is nothing external to attest — the chain IS the
              source of truth. No committee, no bond, no guardians drawn.
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 mt-5 pt-5 border-t border-white/[0.06]">
              <Stat label="chain" value={<Mono>near</Mono>} />
              <Stat
                label="committee"
                value={<span className="text-zinc-500">none</span>}
              />
              <Stat label="verifier" value={<Mono>contract-alone</Mono>} />
              <Stat
                label="phase"
                value={
                  <Badge tone="ok">
                    <CheckCircle2 className="h-3 w-3" /> executes in-tx
                  </Badge>
                }
              />
            </div>
          </Card>

          {/* Morpho / Sepolia */}
          <Card className="relative overflow-hidden border-evm/25 bg-gradient-to-br from-evm/[0.05] to-transparent">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <Badge tone="evm">Ethereum Sepolia · via Chain Signatures</Badge>
              <Badge tone="evm">
                <EyeOff className="h-3 w-3" /> committee required
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-evm/25 bg-evm/10 text-evm">
                <Users className="h-5 w-5" />
              </span>
              <h3 className="text-white font-semibold text-lg tracking-tight">
                AllocateCrossChain (Morpho)
              </h3>
            </div>
            <p className="text-sm text-zinc-400 mt-3 leading-relaxed">
              A NEAR contract CANNOT read Ethereum Sepolia state. Price, slippage
              and protocol-liveness are facts it cannot see. So a randomly-drawn
              bonded committee reads Sepolia in a TEE and attests — and their
              pooled bond exceeds the action value, acting as insurance.
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 mt-5 pt-5 border-t border-white/[0.06]">
              <Stat label="live action" value={<Mono>a1 · executed 3/3</Mono>} />
              <Stat label="blocked action" value={<Mono>a2 · 1/3 blocked</Mono>} />
              <Stat label="committee" value="3 guardians · 2-of-3" />
              <Stat label="verifier" value={<Mono>committee-required</Mono>} />
            </div>
            <Link
              href="/committee"
              className="inline-flex items-center gap-1.5 mt-5 text-sm text-evm hover:gap-2.5 transition-all"
            >
              See the commit→reveal lifecycle
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Card>
        </div>
      </Reveal>

      <Reveal>
        <CrossChainProof />
      </Reveal>

      {/* thesis table */}
      <Reveal>
        <Card>
          <SectionTitle className="mb-5">Demo thesis</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-white/[0.06]">
                  <th className="py-2.5 pr-4 font-medium text-[11px] uppercase tracking-wider">
                    Action
                  </th>
                  <th className="py-2.5 pr-4 font-medium text-[11px] uppercase tracking-wider">
                    Chain
                  </th>
                  <th className="py-2.5 font-medium text-[11px] uppercase tracking-wider">
                    Who verifies
                  </th>
                </tr>
              </thead>
              <tbody className="text-zinc-200">
                <tr className="border-b border-white/[0.04]">
                  <td className="py-3 pr-4">SupplyRhea (USDC)</td>
                  <td className="py-3 pr-4 text-zinc-400">NEAR testnet</td>
                  <td className="py-3">
                    <Badge tone="near">
                      <Eye className="h-3 w-3" /> contract alone (reads state)
                    </Badge>
                  </td>
                </tr>
                <tr>
                  <td className="py-3 pr-4">AllocateCrossChain (Morpho)</td>
                  <td className="py-3 pr-4 text-zinc-400">
                    Ethereum Sepolia via Chain Signatures
                  </td>
                  <td className="py-3">
                    <Badge tone="evm">
                      <Users className="h-3 w-3" /> committee required (can&apos;t
                      read Sepolia)
                    </Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
