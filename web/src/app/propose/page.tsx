import { Cpu, Eye, EyeOff, Users } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { Reveal } from "@/components/motion";
import { StepHeader, StepNav, Details } from "@/components/journey";

export default function ProposeStep() {
  return (
    <div className="flex flex-col gap-10">
      <Reveal>
        <StepHeader
          n={3}
          kicker="propose an action"
          title="Who can verify an action depends on the chain it touches."
          context="The agent only proposes templated actions. Whether the contract can check it alone — or needs a committee — is the whole point."
        />
      </Reveal>

      {/* HERO — the contrast in ONE glance */}
      <Reveal delay={0.08}>
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="relative overflow-hidden border-near/25 bg-gradient-to-br from-near/[0.05] to-transparent">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-near/25 bg-near/10 text-near">
                <Cpu className="h-5 w-5" />
              </span>
              <div>
                <div className="text-xs text-zinc-500">NEAR · Rhea</div>
                <div className="text-white font-semibold">
                  The contract decides alone
                </div>
              </div>
            </div>
            <Badge tone="near">
              <Eye className="h-3 w-3" /> verified by contract
            </Badge>
          </Card>

          <Card className="relative overflow-hidden border-evm/25 bg-gradient-to-br from-evm/[0.05] to-transparent">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-evm/25 bg-evm/10 text-evm">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <div className="text-xs text-zinc-500">Cross-chain · Morpho / Sepolia</div>
                <div className="text-white font-semibold">
                  The committee is required
                </div>
              </div>
            </div>
            <Badge tone="evm">
              <EyeOff className="h-3 w-3" /> committee required
            </Badge>
          </Card>
        </div>
      </Reveal>

      <Reveal delay={0.14}>
        <Details label="Show why">
          <div className="flex flex-col gap-4 text-sm leading-relaxed text-zinc-300 max-w-2xl">
            <p>
              On NEAR, the Vault contract reads Rhea / Ref state in the{" "}
              <span className="text-white">same transaction</span>. The chain IS
              the source of truth — no committee, no bond, nothing external to
              attest.
            </p>
            <p>
              A NEAR contract <span className="text-white">cannot read Ethereum
              Sepolia</span>. Price, slippage and protocol-liveness are facts it
              cannot see. So a drawn, bonded committee reads Sepolia in a TEE and
              attests — their pooled bond exceeds the action value.
            </p>
            <p className="text-zinc-400 border-t border-white/[0.06] pt-4">
              And the mandate check runs first:{" "}
              <span className="text-white">out-of-mandate actions are rejected
              without ever drawing a committee</span> — guardians are never spent
              on an action that was never allowed.
            </p>
          </div>
        </Details>
      </Reveal>

      <StepNav n={3} />
    </div>
  );
}
