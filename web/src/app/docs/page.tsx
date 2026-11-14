import type { Metadata } from "next";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";

export const metadata: Metadata = {
  title: "Docs, YieldAI",
  description:
    "How YieldAI works: an on-chain mandate, a bonded guardian committee, bond-as-insurance, cross-chain via Chain Signatures, and an AI that composes strategies you can verify.",
};

const NAV: { id: string; label: string }[] = [
  { id: "intro", label: "Introduction" },
  { id: "how", label: "How it works" },
  { id: "mandate", label: "The mandate" },
  { id: "committee", label: "The guardian committee" },
  { id: "slashing", label: "Slashing & insurance" },
  { id: "crosschain", label: "Cross-chain" },
  { id: "strategies", label: "Strategies & APYs" },
  { id: "earn", label: "The Earn flow" },
  { id: "cli", label: "CLI" },
  { id: "deployment", label: "Live deployment" },
  { id: "limits", label: "Security & limits" },
];

const REPO = "https://github.com/abaresks24/yieldai";

export default function Docs() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />

      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="surface-card grid gap-12 px-6 py-10 sm:px-10 sm:py-12 lg:grid-cols-[200px_1fr] lg:gap-16">
          {/* TOC */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <p className="label mb-4">Documentation</p>
            <nav className="flex flex-col gap-2 text-sm">
              {NAV.map((n) => (
                <a
                  key={n.id}
                  href={`#${n.id}`}
                  className="focusable text-muted transition-colors hover:text-ink"
                >
                  {n.label}
                </a>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <article className="max-w-2xl">
            <header className="mb-14">
              <h1 className="page-h1">YieldAI documentation</h1>
              <p className="mt-3 text-lg leading-relaxed text-muted">
                An AI agent that manages your yield, and that you never have to
                trust. Its power is bounded on-chain, every risky move is checked
                by a bonded guardian committee, and the bond is insurance.
              </p>
            </header>

            <Section id="intro" label="01" title="Introduction">
              <P>
                YieldAI lets you hand capital to an AI agent for on-chain yield
                without trusting the agent. Three things make that safe, and none
                of them is a promise:
              </P>
              <Ul
                items={[
                  <>
                    <B>A mandate the agent cannot break.</B> Your rules (target
                    yield, risk ceiling, allowed venues, caps) live in a contract.
                    Out-of-bounds actions are rejected by the contract, not by
                    good faith.
                  </>,
                  <>
                    <B>A committee that checks reality.</B> Every risky move is
                    verified by a randomly-drawn committee of bonded guardians
                    running in TEEs, they attest the facts the contract can&rsquo;t
                    see (cross-chain state, prices) before capital moves.
                  </>,
                  <>
                    <B>Bond as insurance.</B> The committee&rsquo;s pooled bond
                    exceeds the value at stake. If they&rsquo;re wrong, the slashed
                    bond makes you whole. Lying is never profitable.
                  </>,
                ]}
              />
              <P>
                The guiding line: <Em>the TEE proves the right code ran; the bond
                proves it received the right data.</Em> Everything verifiable
                on-chain is decided by the contract; the committee only attests
                the irreducibly external fact.
              </P>
            </Section>

            <Section id="how" label="02" title="How it works">
              <Ol
                items={[
                  <>
                    <B>Tell it what you want.</B> Describe your goal in plain
                    language, an amount, a target yield, a risk appetite, an asset
                    exposure.
                  </>,
                  <>
                    <B>The AI proposes a strategy.</B> It composes an allocation
                    from the supported venue universe and fits it inside an
                    on-chain mandate. Anything outside the rules is refused before
                    it runs.
                  </>,
                  <>
                    <B>The committee verifies every cross-chain move.</B> Bonded
                    guardians attest the facts in a TEE; the contract decides.
                  </>,
                  <>
                    <B>You keep a kill switch.</B> At any moment you halt the agent
                    and unwind positions back to stablecoins. Custody never leaves
                    you.
                  </>,
                ]}
              />
            </Section>

            <Section id="mandate" label="03" title="The mandate">
              <P>
                A mandate is an on-chain policy that bounds the agent. It stores
                the target APY, maximum risk score, allowed protocols and chains,
                the maximum share per venue, the maximum tolerated loss, and daily
                caps. The agent holds only a function-call key scoped to the vault
                and can propose nothing but <Em>templated actions</Em>, never
                arbitrary calldata.
              </P>
              <P>
                Deterministic rules are checked by the contract itself and{" "}
                <B>fail closed</B>: an out-of-mandate proposal is rejected on the
                spot, without ever consulting the committee. That is the
                structural defense against a hallucinating or prompt-injected
                agent. The owner always keeps a kill switch that repatriates
                everything.
              </P>
            </Section>

            <Section id="committee" label="04" title="The guardian committee">
              <P>
                For any action whose truth lives outside the contract (a
                cross-chain state, an execution price), a committee of guardians is
                drawn at random, weighted by bond, with rotation. Each guardian
                runs approved code in an Intel TDX TEE (via OutLayer) and attests
                the facts the contract can&rsquo;t read.
              </P>
              <P>
                Guardians use <B>commit-reveal</B>: they publish a hash of their
                report at decision time (so nothing leaks and no one, not even the
                operator, can front-run), then reveal the plaintext after
                execution. The contract verifies <Code>sha256(report)</Code>{" "}
                matches the commit on-chain, applies the mandate rules to the
                attested facts, and only then executes. A key invariant: the
                summed bond of the drawn quorum must exceed the action value, so
                it is never profitable to bribe a committee.
              </P>
            </Section>

            <Section id="slashing" label="05" title="Slashing & insurance">
              <P>
                An action executes on the committee&rsquo;s attestation, so slashing
                is deterrence <Em>and</Em> compensation. After execution, anyone can
                challenge during a window by submitting proof. On a proven fault
                the guardian&rsquo;s bond is slashed and the challenger is rewarded
                from it.
              </P>
              <Ul
                items={[
                  <>
                    <B>False attestation</B>, the revealed facts are contradicted
                    by a verifiable source at the same block.
                  </>,
                  <>
                    <B>Equivocation</B>, two contradicting reveals; fully decided
                    on-chain against the stored commit.
                  </>,
                  <>
                    <B>Unavailability</B>, a drawn guardian never commits by the
                    deadline (partial penalty).
                  </>,
                ]}
              />
              <P>
                Because the quorum bond exceeds the value at risk, the slashed bond
                makes the user whole when prevention fails. Bond = insurance.
              </P>
            </Section>

            <Section id="crosschain" label="06" title="Cross-chain, no bridge">
              <P>
                A NEAR account, gated by the committee, controls an address on
                another chain through <B>Chain Signatures</B> (threshold-MPC
                signing). It signs a standard Ethereum transaction directly, no
                bridge, no wrapped key. YieldAI has landed a real committee-gated
                transaction on Ethereum from NEAR this way.
              </P>
              <P>
                This is exactly where the committee earns its keep: the NEAR
                contract cannot read Ethereum state, so a bonded committee attests
                it before the cross-chain signature is produced.
              </P>
            </Section>

            <Section id="strategies" label="07" title="Strategies & APYs">
              <P>
                The agent composes across a universe of venues spanning stablecoin
                lending, RWA / savings, fixed-rate, delta-neutral, liquid staking,
                BTC yield, DEX liquidity, restaking, and incentivized vaults,                 across NEAR, Ethereum, Base and Arbitrum. For any brief it selects
                a subset and weights it; two different briefs yield visibly
                different strategies.
              </P>
              <P>
                <B>Risk scores are deterministic</B>, computed in code from audits,
                TVL, age, exploit history, oracle dependency and yield source. The
                LLM only explains the number; it never sets it.{" "}
                <B>APYs are live</B>, pulled from DefiLlama and refreshed
                continuously. A protocol like Morpho runs many markets with
                different rates, YieldAI surfaces and names the deepest
                (highest-TVL) market, so each rate is tied to a real market.
              </P>
            </Section>

            <Section id="earn" label="08" title="The Earn flow">
              <P>In the app, under <Link href="/app/earn" className="underline underline-offset-4 hover:text-ink">Earn</Link>:</P>
              <Ul
                items={[
                  <>
                    <B>Propose</B>, your prompt becomes a strategy (allocations,
                    live APYs, deterministic risk), or an honest refusal for the
                    impossible (&ldquo;40% APY, no risk&rdquo;).
                  </>,
                  <>
                    <B>Learn more</B>, where each venue&rsquo;s yield comes from, the
                    risk factor breakdown, the characteristic risk of the venue
                    type, and the mandate it maps to.
                  </>,
                  <>
                    <B>Discuss</B>, refine the proposal in natural language.
                  </>,
                  <>
                    <B>Launch</B>, connect a NEAR wallet and sign a real{" "}
                    <Code>register_mandate</Code> transaction that records your
                    mandate on-chain.
                  </>,
                ]}
              />
            </Section>

            <Section id="cli" label="09" title="Use it from your terminal">
              <P>
                The protocol is usable programmatically, the same proposal +
                on-chain pipeline from a shell, no install, no API key:
              </P>
              <Pre>
{`node cli/src/index.js chat "5000 USDC, around 8%, low risk"   # interactive, refine in the terminal
node cli/src/index.js propose "5000 USDC, around 8%, low risk"
node cli/src/index.js guardians            # roster, bonds, slashings
node cli/src/index.js committee a2         # a committee draw + tally
node cli/src/index.js portfolio <acct>     # an account's on-chain mandate
node cli/src/index.js proof                # the cross-chain Sepolia proof
node cli/src/index.js register "USDC ~7%" --account you.testnet`}
              </Pre>
              <P>
                Reads hit NEAR testnet RPC directly; <Code>register</Code> signs a
                real transaction via your <Code>near-cli-rs</Code> keychain.
              </P>
            </Section>

            <Section id="deployment" label="10" title="Live deployment">
              <P>Everything is deployed and verifiable on NEAR testnet.</P>
              <Table
                rows={[
                  ["Coordinator", "coordinator.mandate-arthur.testnet"],
                  ["Vault (demo)", "demo.vaults.mandate-arthur.testnet"],
                  ["Mandate Registry", "registry.mandate-arthur.testnet"],
                ]}
              />
              <P>
                A committee-gated, MPC-signed transaction is mined on Ethereum
                Sepolia (status <Code>0x1</Code>) from the derived address{" "}
                <Code>0x3919…79D7</Code>. The full source is on{" "}
                <a href={REPO} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-ink">GitHub</a>.
              </P>
            </Section>

            <Section id="limits" label="11" title="Security & limits (honest)">
              <Ul
                items={[
                  <>
                    Decentralization is at the <B>guardian layer</B> (bonds, diverse
                    implementations, diverse data sources), not the TEE
                    infrastructure. The <Code>random_seed</Code> is slightly
                    biasable by the block producer.
                  </>,
                  <>
                    Live on-chain execution today settles <B>Rhea (NEAR)</B> and{" "}
                    <B>Morpho (Ethereum)</B>; the wider venue universe is the
                    roadmap and is labeled as such in the app.
                  </>,
                  <>
                    APYs are live market rates; a venue without a clean data match
                    falls back to a representative rate, marked{" "}
                    <Em>indicative</Em>.
                  </>,
                ]}
              />
            </Section>

            <div className="mt-16 border-t border-hairline pt-8">
              <Link
                href="/app"
                className="text-sm font-medium text-ink underline underline-offset-4"
              >
                Launch the app →
              </Link>
              <span className="ml-4 text-sm text-muted">
                or read the source on{" "}
                <a href={REPO} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 hover:text-ink">GitHub</a>.
              </span>
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

/* ── small presentational helpers (kept local, consistent with the DA) ── */

function Section({
  id,
  label,
  title,
  children,
}: {
  id: string;
  label: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-hairline py-12 first:border-t-0 first:pt-0">
      <div className="mb-5 flex items-baseline gap-3">
        <span className="num text-xs text-muted">{label}</span>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{title}</h2>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-base leading-relaxed text-muted">{children}</p>;
}
function B({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}
function Em({ children }: { children: React.ReactNode }) {
  return <em className="not-italic text-ink">{children}</em>;
}
function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-mist px-1.5 py-0.5 font-mono text-[0.85em] text-ink">
      {children}
    </code>
  );
}
function Ul({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-base leading-relaxed text-muted">
          <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-near" aria-hidden />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}
function Ol({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3 text-base leading-relaxed text-muted">
          <span className="num text-sm text-muted">{String(i + 1).padStart(2, "0")}</span>
          <span>{it}</span>
        </li>
      ))}
    </ol>
  );
}
function Pre({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-hairline bg-mist p-4 font-mono text-xs leading-relaxed text-ink">
      {children}
    </pre>
  );
}
function Table({ rows }: { rows: [string, string][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table text-sm">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="font-medium text-ink">{k}</td>
              <td className="num text-muted">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
