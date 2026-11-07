"use client";

import { useState } from "react";
import { Button } from "@/components/button";

// SHELL of the intended Earn flow. The real AI proposal flow is the next pass.
// The handler is stubbed with a clear TODO; the UI is built out so the
// structure reads as finished.
export default function Earn() {
  const [prompt, setPrompt] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    // TODO(earn): POST the brief to the agent and render the real proposed
    // strategy. For now we reveal the placeholder result area.
    setSubmitted(true);
  }

  return (
    <div className="flex flex-col gap-12">
      <header>
        <h1 className="display text-4xl font-semibold leading-tight text-ink sm:text-5xl">
          Earn
        </h1>
        <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted">
          Describe what you want. The agent proposes a strategy that fits inside
          your on-chain mandate — nothing outside the rules can run.
        </p>
      </header>

      {/* Prompt input */}
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label
          htmlFor="brief"
          className="text-xs font-medium uppercase tracking-wider text-muted"
        >
          Your brief
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            id="brief"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want, e.g. '5,000 USDC, around 8%, low risk'"
            className="flex-1 rounded-lg border border-hairline bg-paper px-4 py-3 text-base text-ink placeholder:text-muted/70 focus:border-ink/40 focus:outline-none"
          />
          <Button type="submit" variant="primary" size="lg">
            Propose a strategy →
          </Button>
        </div>
      </form>

      {/* Result area */}
      <section className="border-t border-hairline pt-10">
        {submitted ? (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2 text-sm text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-near" aria-hidden />
              Proposed strategy
            </div>

            <div className="rounded-xl border border-hairline p-6">
              <h2 className="text-xl font-semibold text-ink">
                Strategy proposal
              </h2>
              <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted">
                The AI-proposed allocation, its expected APY, and a transparent
                risk breakdown will appear here — validated against your mandate
                before anything can execute.
              </p>
              <p className="mt-4 font-mono text-sm text-muted">
                {/* TODO(earn): render the real proposal for: */}
                brief: &ldquo;{prompt}&rdquo;
              </p>

              <div className="mt-6 flex flex-wrap gap-3 border-t border-hairline pt-6">
                <Button variant="secondary">Learn more</Button>
                <Button variant="secondary">Discuss</Button>
                <Button variant="primary">Launch</Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-md">
            <h2 className="text-base font-semibold text-ink">
              Your proposed strategy will appear here
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Enter a brief above and the agent will draft an allocation inside
              your mandate, with an expected APY and a risk breakdown you can
              inspect before anything runs.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
