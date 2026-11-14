"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// =============================================================================
// YieldAI, landing (scrollytelling, Sagittaire-reskin).
// A tall intro stage (~220vh) with a sticky 100vh hero drives a scroll
// choreography: as the user scrolls DOWN the hero rises UP and fades, revealing
// the protocol story beneath it. Scroll is driven in JS via a rAF-throttled
// handler writing CSS vars on .sc (--p hero progress, --hero late lift/fade).
// prefers-reduced-motion skips the choreography and shows static content.
// =============================================================================

const REPO = "https://github.com/abaresks24/yieldai";

export default function Home() {
  const stageRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const root = rootRef.current;
    if (!root) return;

    const sections = Array.from(root.querySelectorAll<HTMLElement>(".sc__sec"));

    if (reduce) {
      root.style.setProperty("--p", "0");
      root.style.setProperty("--hero", "0");
      sections.forEach((s) => s.classList.add("is-in"));
      setScrolled(true);
      return;
    }

    let raf = 0;
    const update = () => {
      raf = 0;
      const stage = stageRef.current;
      if (!stage) return;
      const vh = window.innerHeight;
      const start = stage.offsetTop;
      const span = stage.offsetHeight - vh;
      const raw = span > 0 ? (window.scrollY - start) / span : 0;
      const p = Math.min(1, Math.max(0, raw));
      root.style.setProperty("--p", p.toFixed(4));
      const hero = Math.min(1, Math.max(0, (p - 0.6) / 0.4));
      root.style.setProperty("--hero", hero.toFixed(4));
      setScrolled(p > 0.55);
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" },
    );
    sections.forEach((s) => io.observe(s));

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, []);

  return (
    <div className="sc" ref={rootRef}>
      {/* --- Persistent top bar --- */}
      <div className={`sc__bar${scrolled ? " is-scrolled" : ""}`}>
        <Link href="/" className="sc__home" aria-label="YieldAI home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/yield-logo.png" alt="" className="sc__bar-mark" draggable={false} />
          <span className="sc__bar-word">YieldAI</span>
        </Link>
        <div className="sc__bar-actions">
          <Link href="/docs" className="sc__docs">
            Docs
          </Link>
          <Link href="/app" className="sg-launch">
            Launch app →
          </Link>
        </div>
      </div>

      {/* --- INTRO STAGE: sticky hero --- */}
      <div className="sc__stage" ref={stageRef}>
        <div className="sc__sticky">
          <div className="sc__hero">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/yield-logo.png" alt="" className="sc__mark" draggable={false} />
            <div className="sc__heroText">
              <h1 className="sc__title">YieldAI</h1>
              <p className="sc__line">
                An AI agent that earns yield inside limits you set on-chain.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* --- STORY --- */}
      <div className="sc__story">
        {/* Thesis */}
        <section className="sc__sec sc__sec--thesis">
          <p className="sc__thesis">
            An AI manages the yield.
            <br />
            The chain keeps it <em>in bounds.</em>
          </p>
          <p className="sc__lede">
            You define what the agent may do. The contract enforces it. The agent
            never holds your funds, and you can return to stablecoins at any time.
          </p>
        </section>

        {/* Problem */}
        <section className="sc__sec">
          <span className="sc__kicker">The problem</span>
          <h2 className="sc__h2">An agent with your keys is a single point of failure.</h2>
          <p className="sc__body">
            A model can be wrong, prompt-injected, or over-eager. If nothing but
            good intentions sits between it and your balance, one bad call empties
            the account. Intentions are not a security model.
          </p>
        </section>

        {/* The mandate */}
        <section className="sc__sec sc__sec--mandate">
          <div className="sc__split">
            <div className="sc__split-copy">
              <span className="sc__kicker">Limits on-chain</span>
              <h2 className="sc__h2 sc__h2--wide">The agent only acts inside your rules.</h2>
              <p className="sc__body">
                You set the allowed protocols, a risk ceiling, a maximum loss and
                a daily spend limit. They live in a contract. Any action outside
                them is <strong>rejected on-chain, before it runs</strong>, not
                caught after the money has moved.
              </p>
            </div>
            <ul className="sc__props" style={{ marginTop: 0 }}>
              <li className="sc__prop">
                <h3>On-chain mandate</h3>
                <p>Your rules are enforced by the contract, not by the agent.</p>
              </li>
              <li className="sc__prop">
                <h3>Risk ceiling</h3>
                <p>Every allocation is scored and capped at a limit you choose.</p>
              </li>
            </ul>
          </div>
        </section>

        {/* The guardians */}
        <section className="sc__sec">
          <span className="sc__kicker">Verification</span>
          <h2 className="sc__h2 sc__h2--wide">
            Cross-chain facts are checked before funds move.
          </h2>
          <p className="sc__body">
            Some facts live off-chain, where the contract cannot see them. A
            randomly drawn committee of guardians attests them inside a trusted
            enclave. Their combined bond is larger than the amount at stake, so a
            false attestation <strong>costs more than it could gain</strong>.
          </p>
          <ul className="sc__props">
            <li className="sc__prop">
              <h3>Trusted enclaves</h3>
              <p>Guardians run audited code in a TEE; the output is verifiable.</p>
            </li>
            <li className="sc__prop">
              <h3>Bond above value</h3>
              <p>The committee&rsquo;s bond exceeds the value at risk on each action.</p>
            </li>
            <li className="sc__prop">
              <h3>Owner kill switch</h3>
              <p>Pause the agent and return to stablecoins whenever you want.</p>
            </li>
            <li className="sc__prop">
              <h3>On NEAR</h3>
              <p>Live on testnet, with a real cross-chain transaction on Ethereum.</p>
            </li>
          </ul>
        </section>

        {/* Lifecycle */}
        <section className="sc__sec">
          <span className="sc__kicker">How it works</span>
          <h2 className="sc__h2">Four steps, each one checkable.</h2>
          <ol className="sc__life">
            <li className="sc__life-step">
              <div>
                <h3>Set the mandate</h3>
                <p>Describe your goal and limits in plain language: amount, target yield, risk, assets to keep.</p>
              </div>
            </li>
            <li className="sc__life-step">
              <div>
                <h3>Review the strategy</h3>
                <p>The agent drafts a plan from live markets that fits your mandate. Out-of-bounds plans are refused.</p>
              </div>
            </li>
            <li className="sc__life-step">
              <div>
                <h3>Guardians verify</h3>
                <p>Cross-chain facts are attested in a TEE by a bonded committee before any capital moves.</p>
              </div>
            </li>
            <li className="sc__life-step">
              <div>
                <h3>Stay in control</h3>
                <p>Pause the agent and return to stablecoins at any time.</p>
              </div>
            </li>
          </ol>
        </section>

        {/* Closing */}
        <section className="sc__sec sc__sec--close">
          <p className="sc__closingLine">Managed by an agent. Bounded by the chain.</p>
          <div className="sc__closingLinks">
            <Link href="/app" className="sg-launch sg-launch--lg">
              Launch app →
            </Link>
            <Link href="/docs" className="sc__ghostlink">
              Read the docs
            </Link>
            <a href={REPO} target="_blank" rel="noopener noreferrer" className="sc__ghostlink">
              GitHub
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
