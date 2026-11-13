"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// =============================================================================
// YieldAI — landing (scrollytelling, Sagittaire-reskin).
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
                An AI agent earns yield within rules you set on-chain — and you
                never have to trust the agent.
              </p>
            </div>
          </div>
          <div className="sc__scrollcue">Scroll</div>
        </div>
      </div>

      {/* --- STORY --- */}
      <div className="sc__story">
        {/* Thesis */}
        <section className="sc__sec sc__sec--thesis">
          <p className="sc__thesis">
            Put an agent to work. <em>Keep the control.</em>
          </p>
          <p className="sc__lede">
            YieldAI&rsquo;s power is bounded on-chain, and every risky move is
            checked by bonded guardians. The agent never holds custody — your
            funds stay yours, and a kill switch unwinds everything on demand.
          </p>
        </section>

        {/* Problem */}
        <section className="sc__sec">
          <span className="sc__kicker">The problem</span>
          <h2 className="sc__h2">
            An AI that moves your money is only as safe as what it&rsquo;s
            allowed to do.
          </h2>
          <p className="sc__body">
            Hand an autonomous agent your capital and you&rsquo;re trusting a
            black box: a prompt, a model, an API key. If it hallucinates, gets
            jailbroken, or simply errs, the money is gone. &ldquo;Trust me&rdquo;
            is not a security model.
          </p>
        </section>

        {/* The mandate */}
        <section className="sc__sec sc__sec--mandate">
          <div className="sc__split">
            <div className="sc__split-copy">
              <span className="sc__kicker">The mandate</span>
              <h2 className="sc__h2 sc__h2--wide">
                Its power is bounded on-chain.
              </h2>
              <p className="sc__body">
                You set the rules — allowed protocols, a risk ceiling, a loss
                cap, a daily limit — and they live in a contract. Anything the
                agent proposes outside those bounds is <strong>rejected by the
                contract</strong>, not by a promise. The agent can only ever act
                inside the box you drew.
              </p>
            </div>
            <ul className="sc__props" style={{ marginTop: 0 }}>
              <li className="sc__prop">
                <span className="sc__prop-ic">§</span>
                <h3>On-chain mandate</h3>
                <p>The rules the agent must honor are enforced by the contract.</p>
              </li>
              <li className="sc__prop">
                <span className="sc__prop-ic">◇</span>
                <h3>Risk-capped</h3>
                <p>A deterministic score bounds every allocation; the cap is yours.</p>
              </li>
            </ul>
          </div>
        </section>

        {/* The guardians */}
        <section className="sc__sec">
          <span className="sc__kicker">The guardians</span>
          <h2 className="sc__h2 sc__h2--wide">
            Every cross-chain move is verified before capital moves.
          </h2>
          <p className="sc__body">
            For facts the contract can&rsquo;t see, a randomly-drawn committee of
            bonded guardians attests the truth inside a trusted enclave. Their
            pooled bond <strong>exceeds the value at stake</strong> on every
            action — lie, and the bond is slashed. Bond is insurance, not a
            formality.
          </p>
          <ul className="sc__props">
            <li className="sc__prop">
              <span className="sc__prop-ic">⬡</span>
              <h3>TEE-attested</h3>
              <p>Guardians run verified code in trusted enclaves, not on faith.</p>
            </li>
            <li className="sc__prop">
              <span className="sc__prop-ic">⚖</span>
              <h3>Bond as insurance</h3>
              <p>Quorum bond is set above the value at risk, action by action.</p>
            </li>
            <li className="sc__prop">
              <span className="sc__prop-ic">⟲</span>
              <h3>Kill switch</h3>
              <p>You can halt the agent and unwind to stablecoins at any time.</p>
            </li>
            <li className="sc__prop">
              <span className="sc__prop-ic">◈</span>
              <h3>Built on NEAR</h3>
              <p>Live on testnet, with a real cross-chain tx landed via Chain Signatures.</p>
            </li>
          </ul>
        </section>

        {/* Lifecycle */}
        <section className="sc__sec">
          <span className="sc__kicker">How it works</span>
          <h2 className="sc__h2">Four steps. No blind trust at any of them.</h2>
          <ol className="sc__life">
            <li className="sc__life-step">
              <div>
                <h3>Tell it what you want</h3>
                <p>Describe your goal in plain language — an amount, a target yield, a risk appetite, an asset to stay exposed to.</p>
              </div>
            </li>
            <li className="sc__life-step">
              <div>
                <h3>The AI proposes a strategy</h3>
                <p>It drafts a plan from real, live markets that must fit inside your mandate. Anything outside the rules is refused before it runs.</p>
              </div>
            </li>
            <li className="sc__life-step">
              <div>
                <h3>Guardians verify every cross-chain move</h3>
                <p>Bonded guardians attest remote facts in a TEE. Their pooled bond exceeds the value at stake — lie and it is slashed.</p>
              </div>
            </li>
            <li className="sc__life-step">
              <div>
                <h3>You keep a kill switch</h3>
                <p>At any moment you can halt the agent and unwind positions back to stablecoins. Control never leaves you.</p>
              </div>
            </li>
          </ol>
        </section>

        {/* Closing */}
        <section className="sc__sec sc__sec--close">
          <p className="sc__closingLine">Put an agent to work. Keep the control.</p>
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
