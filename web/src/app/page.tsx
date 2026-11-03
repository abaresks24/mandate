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
    body: "Positions, mandate rules, and the owner-only kill switch that repatriates everything.",
    tone: "near" as const,
    tag: "vault contract",
  },
  {
    href: "/committee",
    title: "Committee (hero)",
    body: "A cross-chain action: 3 randomly-drawn bonded guardians, commit hashes → revealed reports with facts + reason codes → 2-of-3 tally.",
    tone: "evm" as const,
    tag: "coordinator",
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
    body: "A corrupt guardian lies about a price. The honest two refuse, the action is blocked, a fault proof is submitted → bond slashed → challenger rewarded.",
    tone: "danger" as const,
    tag: "security",
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
