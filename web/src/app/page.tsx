"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Coins,
  Users,
  GitCompareArrows,
  ShieldAlert,
  FileText,
} from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { Reveal, Stagger, StaggerItem } from "@/components/motion";
import { CROSSCHAIN } from "@/lib/near";

const CARDS = [
  {
    href: "/brief",
    title: "Brief → Proposal",
    body: "A natural-language brief becomes a Mandate + ≤2 allocation options with deterministic risk scores. Watch it refuse an unrealizable brief.",
    icon: FileText,
    tag: "agent",
    tone: "near" as const,
  },
  {
    href: "/vault",
    title: "Vault",
    body: "Live mandate rules and positions from the deployed contract, plus the owner-only kill switch that repatriates everything.",
    icon: Coins,
    tag: "vault · live",
    tone: "near" as const,
  },
  {
    href: "/guardians",
    title: "Guardians",
    body: "The live bonded TEE guardian set (g1…g7). g7 is slashed with a zero bond — read straight off the coordinator.",
    icon: Users,
    tag: "coordinator · live",
    tone: "near" as const,
  },
  {
    href: "/contrast",
    title: "The Contrast",
    body: "Rhea/NEAR = verified by the contract alone. Morpho/Sepolia = committee required, because the contract can't read Sepolia. This is the whole point.",
    icon: GitCompareArrows,
    tag: "thesis",
    tone: "evm" as const,
  },
  {
    href: "/slashing",
    title: "Slashing",
    body: "Corrupt g7 approves a bad action alone off a fake feed. Honest guardians refuse, a2 blocks at 1/3, g7's bond is slashed → challenger rewarded.",
    icon: ShieldAlert,
    tag: "security · live",
    tone: "danger" as const,
  },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-16 sm:gap-20">
      {/* ---------------------------------------------------------------- HERO */}
      <section className="relative">
        <div className="grid-texture absolute -inset-x-6 -top-14 bottom-0 -z-10" aria-hidden />
        <Reveal>
          <Badge tone="warn">NEAR Hackathon · track: security</Badge>
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="mt-6 text-4xl sm:text-6xl font-semibold tracking-tight text-white text-balance leading-[1.05] max-w-4xl">
            Hand your money to an AI agent —{" "}
            <span className="text-near">without trusting it.</span>
          </h1>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mt-6 text-lg leading-relaxed text-zinc-400 max-w-2xl text-pretty">
            An off-chain agent proposes only templated actions. A randomly-drawn,
            bonded TEE guardian committee attests the cross-chain facts the
            contract can&apos;t read. The quorum&apos;s bond exceeds the action value —
            so the bond is insurance. Lie, and you get slashed.
          </p>
        </Reveal>

        {/* live proof chips */}
        <Reveal delay={0.2}>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-near/25 bg-near/[0.07] px-3.5 py-1.5 text-sm text-near">
              <ShieldCheck className="h-4 w-4" />
              Committee a1 · 3/3 verified
            </div>
            <a
              href={CROSSCHAIN.etherscan}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-evm/25 bg-evm/[0.07] px-3.5 py-1.5 text-sm text-evm hover:bg-evm/[0.12] transition-colors"
            >
              <ShieldCheck className="h-4 w-4" />
              Sepolia tx · status 0x1
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.28}>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/committee"
              className="group inline-flex items-center gap-2 rounded-xl bg-near px-5 py-3 text-sm font-semibold text-ink shadow-[0_0_30px_-8px_rgba(0,236,151,0.6)] transition-all hover:brightness-110 active:scale-[0.98]"
            >
              See the committee land 2-of-3
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/contrast"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-zinc-200 transition-all hover:bg-white/[0.07] hover:border-white/20"
            >
              Why a committee at all?
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ------------------------------------------------ COMMITTEE HERO CARD */}
      <Reveal>
        <Link href="/committee" className="block group">
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-panel/60 backdrop-blur-xl shadow-card p-8 sm:p-10 transition-all duration-300 hover:border-evm/40 hover:shadow-card-hover">
            <div
              className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-evm/10 blur-3xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -left-24 -bottom-24 h-72 w-72 rounded-full bg-near/10 blur-3xl"
              aria-hidden
            />
            <div className="relative">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                <Badge tone="evm">the hero screen · coordinator</Badge>
                <span className="inline-flex items-center gap-1 text-sm text-evm group-hover:gap-2 transition-all">
                  Open the committee lifecycle
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white max-w-2xl text-balance">
                The committee lands 2-of-3 — live on testnet.
              </h2>
              <p className="mt-3 text-zinc-400 max-w-3xl leading-relaxed">
                A cross-chain action draws 3 bond-weighted guardians. They{" "}
                <span className="text-white">commit</span> hashes, then{" "}
                <span className="text-white">reveal</span> signed reports —{" "}
                <span className="font-mono text-near">sha256(report) == commit</span>{" "}
                recomputed in your browser. Action{" "}
                <span className="font-mono">a1</span> clears 3/3; action{" "}
                <span className="font-mono">a2</span> stalls at 1/3 and is blocked.
              </p>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <HeroStat
                  label="a1 · clean path"
                  value="3 / 3"
                  note="threshold met"
                  tone="near"
                />
                <HeroStat
                  label="a2 · attack"
                  value="1 / 3"
                  note="blocked"
                  tone="danger"
                />
                <HeroStat
                  label="cross-chain"
                  value="0x1 ✓"
                  note="Sepolia tx mined"
                  tone="evm"
                />
              </div>
            </div>
          </div>
        </Link>
      </Reveal>

      {/* ------------------------------------------------------------ GRID */}
      <section>
        <Reveal>
          <h2 className="text-sm font-medium uppercase tracking-wider text-zinc-500 mb-5">
            Explore the system
          </h2>
        </Reveal>
        <Stagger className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CARDS.map((c) => {
            const Icon = c.icon;
            return (
              <StaggerItem key={c.href}>
                <Link href={c.href} className="block h-full">
                  <Card hover className="h-full flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                          c.tone === "danger"
                            ? "border-danger/25 bg-danger/10 text-danger"
                            : c.tone === "evm"
                            ? "border-evm/25 bg-evm/10 text-evm"
                            : "border-near/25 bg-near/10 text-near"
                        }`}
                      >
                        <Icon className="h-4.5 w-4.5" strokeWidth={2} />
                      </span>
                      <Badge tone={c.tone}>{c.tag}</Badge>
                    </div>
                    <h3 className="font-semibold text-white tracking-tight">
                      {c.title}
                    </h3>
                    <p className="text-sm text-zinc-400 mt-2 leading-relaxed flex-1">
                      {c.body}
                    </p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm text-zinc-500 group-hover:text-zinc-300">
                      Open <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </Card>
                </Link>
              </StaggerItem>
            );
          })}
        </Stagger>
      </section>
    </div>
  );
}

function HeroStat({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone: "near" | "danger" | "evm";
}) {
  const color =
    tone === "near" ? "text-near" : tone === "danger" ? "text-danger" : "text-evm";
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className={`mt-1.5 text-2xl font-semibold font-mono tabular-nums ${color}`}>
        {value}
      </div>
      <div className="text-xs text-zinc-500 mt-0.5">{note}</div>
    </div>
  );
}
