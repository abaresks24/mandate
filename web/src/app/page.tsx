import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/button";
import { Wordmark } from "@/components/brand";

const REPO = "https://github.com/abaresks24/yieldai";

export default function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />

      {/* HERO — explicitly fills the viewport so nothing below peeks on arrival */}
      <section className="flex min-h-[calc(100svh-4rem)] items-center">
        <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
          <h1 className="display max-w-4xl text-5xl font-semibold leading-[1.03] text-ink sm:text-6xl lg:text-7xl">
            Earn yield you can
            <br />
            actually trust.
          </h1>

          <p className="mt-8 max-w-xl text-lg leading-relaxed text-muted sm:text-xl">
            An AI agent manages it — and you never have to trust the agent.
            Its power is bounded on-chain, and every risky move is checked by
            bonded guardians.
          </p>

          <div className="mt-12 flex flex-wrap items-center gap-4">
            <Link href="/app">
              <Button variant="primary" size="lg">
                Launch app →
              </Button>
            </Link>
            <Link href="/docs">
              <Button variant="secondary" size="lg">
                Read the docs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* (a) WHAT IT IS */}
      <section className="border-t border-hairline bg-mist">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
          <p className="mb-6 text-sm font-medium uppercase tracking-wider text-muted">
            What it is
          </p>
          <h2 className="display max-w-3xl text-3xl font-semibold leading-tight text-ink sm:text-4xl">
            An AI yield agent whose power is bounded on-chain.
          </h2>
          <div className="mt-14 grid gap-10 sm:grid-cols-3">
            <Supporting
              title="It can only act within your rules"
              body="The mandate lives on-chain. Out-of-bounds actions are rejected by the contract — not by a promise."
            />
            <Supporting
              title="Every risky move is checked"
              body="A randomly-drawn committee of bonded guardians verifies the facts the contract can't see before capital moves."
            />
            <Supporting
              title="Your funds stay yours"
              body="The agent never holds custody. You keep a kill switch that unwinds everything on demand."
            />
          </div>
        </div>
      </section>

      {/* (b) HOW IT WORKS */}
      <section className="border-t border-hairline">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
          <p className="mb-6 text-sm font-medium uppercase tracking-wider text-muted">
            How it works
          </p>
          <h2 className="display max-w-2xl text-3xl font-semibold leading-tight text-ink sm:text-4xl">
            Four steps. No blind trust at any of them.
          </h2>

          <ol className="mt-16 divide-y divide-hairline border-y border-hairline">
            <Step
              n="01"
              title="Tell it what you want"
              body="Describe your goal in plain language — an amount, a target yield, a risk appetite."
            />
            <Step
              n="02"
              title="The AI proposes a strategy"
              body="It drafts a plan that must fit inside your on-chain mandate. Anything outside the rules is refused before it ever runs."
            />
            <Step
              n="03"
              title="A guardian committee verifies every cross-chain move"
              body="Bonded guardians attest remote facts in a TEE. Their pooled bond exceeds the value at stake — lie and the bond is slashed. Bond is insurance."
            />
            <Step
              n="04"
              title="You keep a kill switch"
              body="At any moment you can halt the agent and unwind positions back to stablecoins. Control never leaves you."
            />
          </ol>
        </div>
      </section>

      {/* (c) WHY IT'S SAFE / BUILT ON NEAR */}
      <section className="border-t border-hairline bg-mist">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
          <p className="mb-6 text-sm font-medium uppercase tracking-wider text-muted">
            Why it&rsquo;s safe
          </p>
          <h2 className="display max-w-2xl text-3xl font-semibold leading-tight text-ink sm:text-4xl">
            Safety is a property of the system, not a policy.
          </h2>

          <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
            <Pillar
              title="On-chain mandate"
              body="The rules the agent must honor live in the contract."
            />
            <Pillar
              title="TEE-attested guardians"
              body="Guardians run verified code in trusted enclaves."
            />
            <Pillar
              title="Bond as insurance"
              body="Quorum bond exceeds the value at risk on every action."
            />
            <Pillar
              title="Kill switch"
              body="Owner can unwind to stablecoins at any time."
            />
          </div>

          <p className="mt-10 max-w-2xl text-base leading-relaxed text-muted">
            Built on NEAR. Live on testnet today — and it has already landed a
            real cross-chain transaction on Ethereum via Chain Signatures, no
            bridge involved.
          </p>
        </div>
      </section>

      {/* (d) CLOSING CTA */}
      <section className="border-t border-hairline">
        <div className="mx-auto max-w-6xl px-5 py-28 text-center sm:px-8 sm:py-36">
          <h2 className="display mx-auto max-w-3xl text-4xl font-semibold leading-[1.05] text-ink sm:text-5xl lg:text-6xl">
            Put an agent to work. Keep the control.
          </h2>
          <div className="mt-12 flex justify-center">
            <Link href="/app">
              <Button variant="primary" size="lg">
                Launch app →
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-hairline bg-mist">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2">
            <Wordmark />
            <span className="text-sm text-muted">· Built on NEAR</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted">
            <Link href="/docs" className="rounded-sm transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20">
              Docs
            </Link>
            <a
              href={REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20"
            >
              GitHub
            </a>
            <Link href="/app" className="rounded-sm transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/20">
              Launch app
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Supporting({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-base leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="grid gap-4 py-8 sm:grid-cols-[auto_1fr] sm:gap-10">
      <span className="font-mono text-sm tabular-nums text-near">{n}</span>
      <div className="max-w-2xl">
        <h3 className="text-xl font-semibold text-ink">{title}</h3>
        <p className="mt-2 text-base leading-relaxed text-muted">{body}</p>
      </div>
    </li>
  );
}

function Pillar({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-paper p-6">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}
