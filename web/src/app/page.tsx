import Link from "next/link";
import { Badge, Card } from "@/components/ui";

const CARDS = [
  {
    href: "/brief",
    title: "Brief → Proposal",
    body: "Natural-language brief becomes a Mandate + ≤2 allocation options with deterministic risk scores. Watch it REFUSE an unrealizable brief.",
    tone: "near" as const,
    tag: "agent",
  },
  {
    href: "/vault",
    title: "Vault",
    body: "Live mandate rules + positions from the deployed contract, and the owner-only kill switch that repatriates everything.",
    tone: "near" as const,
    tag: "vault · live",
  },
  {
    href: "/guardians",
    title: "Guardians",
    body: "The live bonded TEE guardian set (g1…g7). g7 is slashed with a zero bond — read straight off the coordinator.",
    tone: "near" as const,
    tag: "coordinator · live",
  },
  {
    href: "/contrast",
    title: "The Contrast",
    body: "Rhea/NEAR = verified by contract alone. Morpho/Sepolia = committee required because the contract can't read Sepolia. This is the whole point.",
    tone: "evm" as const,
    tag: "thesis",
  },
  {
    href: "/slashing",
    title: "Slashing",
    body: "Corrupt g7 approves a bad action alone off a fake feed. Honest guardians refuse, a2 blocks at 1/3, g7's bond is slashed → challenger rewarded.",
    tone: "danger" as const,
    tag: "security · live",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-8">
      <section>
        <Badge tone="warn">NEAR Hackathon · track: security</Badge>
        <h1 className="text-3xl sm:text-4xl font-bold text-white mt-4 max-w-3xl leading-tight">
          Trust-minimized AI money management.
        </h1>
        <p className="text-slate-400 mt-3 max-w-2xl">
          An off-chain agent proposes only{" "}
          <span className="text-slate-200">templated actions</span> (structural
          prompt-injection defense). A{" "}
          <span className="text-near">randomly-drawn bonded TEE guardian committee</span>{" "}
          attests cross-chain facts the contract cannot read itself. The
          quorum&apos;s bond exceeds the action value — so the{" "}
          <span className="text-slate-200">bond is insurance</span>. Lie, and you
          get slashed.
        </p>
      </section>

      {/* Committee hero — the visual centerpiece */}
      <Link href="/committee" className="block group">
        <Card className="animate-rise border-evm/40 bg-gradient-to-br from-evm/10 to-near/5 hover:border-evm/60 transition cursor-pointer">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <Badge tone="evm">the hero screen · coordinator</Badge>
            <span className="text-xs text-evm group-hover:underline">
              Open the committee lifecycle →
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white">
            The committee lands 2-of-3 — live on testnet
          </h2>
          <p className="text-slate-400 mt-2 max-w-3xl">
            A cross-chain action draws 3 bond-weighted guardians. They{" "}
            <span className="text-white">commit</span> hashes, then{" "}
            <span className="text-white">reveal</span> signed reports —{" "}
            <span className="font-mono text-near">sha256(report)==commit</span>{" "}
            recomputed in your browser. Action <span className="font-mono">a1</span>{" "}
            clears 3/3; action <span className="font-mono">a2</span> stalls at
            1/3 and is{" "}
            <span className="text-danger font-semibold">BLOCKED</span>.
          </p>
          <div className="flex gap-6 mt-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">
                a1 · clean path
              </div>
              <div className="text-lg font-semibold text-ok mt-0.5">
                3 / 3 · threshold met
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">
                a2 · attack
              </div>
              <div className="text-lg font-semibold text-danger mt-0.5">
                1 / 3 · ⛔ blocked
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">
                cross-chain
              </div>
              <div className="text-lg font-semibold text-evm mt-0.5">
                Sepolia tx 0x1 ✓
              </div>
            </div>
          </div>
        </Card>
      </Link>

      <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className="h-full hover:border-near/40 transition cursor-pointer">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white">{c.title}</h3>
                <Badge tone={c.tone}>{c.tag}</Badge>
              </div>
              <p className="text-sm text-slate-400">{c.body}</p>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
