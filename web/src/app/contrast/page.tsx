import Link from "next/link";
import { Badge, Card, Mono, SectionTitle, Stat } from "@/components/ui";
import { CrossChainProof } from "@/components/CrossChainProof";

export default function ContrastPage() {
  return (
    <div className="flex flex-col gap-6">
      <SectionTitle sub="The whole point. Same vault, same agent, same mandate — but WHO can verify an action depends on the chain.">
        The Contrast
      </SectionTitle>

      <div className="grid md:grid-cols-2 gap-4">
        {/* NEAR / Rhea */}
        <Card className="border-near/40">
          <div className="flex items-center justify-between mb-3">
            <Badge tone="near">NEAR testnet</Badge>
            <Badge tone="near">verified by contract alone</Badge>
          </div>
          <h3 className="text-white font-semibold text-lg">SupplyRhea (USDC)</h3>
          <p className="text-sm text-slate-400 mt-2">
            The Vault contract reads Rhea/Ref state on NEAR in the same
            transaction. There is nothing external to attest — the chain IS the
            source of truth. No committee, no bond, no guardians drawn.
          </p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <Stat label="chain" value={<Mono>near</Mono>} />
            <Stat label="committee" value={<span className="text-slate-500">none</span>} />
            <Stat label="verifier" value="contract-alone" />
            <Stat label="phase" value={<Badge tone="ok">executes in-tx</Badge>} />
          </div>
          <p className="text-xs text-slate-500 mt-4">
            Executed by the Vault contract directly — it reads Rhea/Ref state on
            NEAR in the same transaction, so no external attestation is needed.
          </p>
        </Card>

        {/* Morpho / Sepolia */}
        <Card className="border-evm/40">
          <div className="flex items-center justify-between mb-3">
            <Badge tone="evm">Ethereum Sepolia · via Chain Signatures</Badge>
            <Badge tone="evm">committee required</Badge>
          </div>
          <h3 className="text-white font-semibold text-lg">
            AllocateCrossChain (Morpho)
          </h3>
          <p className="text-sm text-slate-400 mt-2">
            A NEAR contract CANNOT read Ethereum Sepolia state. Price, slippage
            and protocol-liveness are facts it cannot see. So a randomly-drawn
            bonded committee reads Sepolia in a TEE and attests — and their
            pooled bond exceeds the action value, acting as insurance.
          </p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <Stat label="live action" value={<Mono>a1 · executed 3/3</Mono>} />
            <Stat label="blocked action" value={<Mono>a2 · 1/3 blocked</Mono>} />
            <Stat label="committee" value="3 guardians · 2-of-3" />
            <Stat label="verifier" value="committee-required" />
          </div>
          <Link
            href="/committee"
            className="inline-block mt-4 text-sm text-evm hover:underline"
          >
            See the commit→reveal lifecycle →
          </Link>
        </Card>
      </div>

      <CrossChainProof />

      <Card>
        <SectionTitle>Demo thesis table</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-edge">
                <th className="py-2 pr-4 font-medium">Action</th>
                <th className="py-2 pr-4 font-medium">Chain</th>
                <th className="py-2 font-medium">Who verifies</th>
              </tr>
            </thead>
            <tbody className="text-slate-200">
              <tr className="border-b border-edge/60">
                <td className="py-2 pr-4">SupplyRhea (USDC)</td>
                <td className="py-2 pr-4">NEAR testnet</td>
                <td className="py-2">
                  <Badge tone="near">contract alone (reads state)</Badge>
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4">AllocateCrossChain (Morpho)</td>
                <td className="py-2 pr-4">
                  Ethereum Sepolia via Chain Signatures
                </td>
                <td className="py-2">
                  <Badge tone="evm">
                    committee required (contract can&apos;t read Sepolia)
                  </Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
