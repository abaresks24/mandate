import { describe, expect, it } from "vitest";
import type { ChatMessage, LlmClient } from "./llm.js";
import { briefToMandate, detectUnrealistic } from "./mandate.js";

/** Mock LLM that returns a scripted JSON string — NO network. */
class MockLlm implements LlmClient {
  public lastMessages: ChatMessage[] = [];
  constructor(private readonly reply: string) {}
  async listModel(): Promise<string> {
    return "mock-model-1";
  }
  async chat(messages: ChatMessage[]): Promise<string> {
    this.lastMessages = messages;
    return this.reply;
  }
}

describe("briefToMandate", () => {
  it("proposes a mandate with a deterministic (non-LLM) risk score", async () => {
    const llm = new MockLlm(
      JSON.stringify({
        realistic: true,
        owner: "alice.testnet",
        target_apy_bps: 800,
        max_risk_score: 60,
        max_loss_bps: 300,
        daily_cap_usdc: "5000000000",
        allocation_protocols: ["rhea"],
        explanations: { rhea: "Mature NEAR lending market." },
        summary: "Conservative NEAR yield.",
      }),
    );
    const res = await briefToMandate("I want ~8% APY, conservative", { llm });
    expect(res.status).toBe("proposed");
    if (res.status !== "proposed") return;
    expect(res.allocations.length).toBeGreaterThanOrEqual(1);
    const alloc = res.allocations[0]!;
    // risk score is an integer in 0..100, produced deterministically
    expect(Number.isInteger(alloc.risk_score)).toBe(true);
    expect(alloc.risk_score).toBeGreaterThanOrEqual(0);
    expect(alloc.risk_score).toBeLessThanOrEqual(100);
    // explanation must mention the deterministic score verbatim
    expect(alloc.explanation).toContain(`${alloc.risk_score}/100`);
    expect(res.mandate.committee_threshold_usdc).toBe("0");
  });

  it("REFUSES an unrealistic brief even if the LLM says realistic", async () => {
    // LLM lies: claims 40% APY at near-zero risk is realistic.
    const llm = new MockLlm(
      JSON.stringify({
        realistic: true,
        owner: "greedy.testnet",
        target_apy_bps: 4000, // 40%
        max_risk_score: 10, // "no risk"
        allocation_protocols: ["rhea"],
      }),
    );
    const res = await briefToMandate("40% APY, no risk", { llm });
    expect(res.status).toBe("refused");
    if (res.status !== "refused") return;
    expect(res.reason_code).toBe("UNREALISTIC_APY");
    expect(res.reason.length).toBeGreaterThan(0);
  });

  it("refuses protocols outside the catalogue", async () => {
    const llm = new MockLlm(
      JSON.stringify({
        realistic: true,
        target_apy_bps: 700,
        max_risk_score: 60,
        allocation_protocols: ["ponzi-finance"],
      }),
    );
    const res = await briefToMandate("yield on ponzi-finance", { llm });
    expect(res.status).toBe("refused");
    if (res.status !== "refused") return;
    expect(res.reason_code).toBe("UNSUPPORTED_PROTOCOL");
  });

  it("refuses a malformed/empty brief without calling the LLM meaningfully", async () => {
    const llm = new MockLlm("not json");
    const res = await briefToMandate("", { llm });
    expect(res.status).toBe("refused");
    if (res.status !== "refused") return;
    expect(res.reason_code).toBe("MALFORMED_BRIEF");
  });

  it("refuses when LLM returns non-JSON", async () => {
    const llm = new MockLlm("sorry, I cannot do that");
    const res = await briefToMandate("some real brief here", { llm });
    expect(res.status).toBe("refused");
    if (res.status !== "refused") return;
    expect(res.reason_code).toBe("MALFORMED_BRIEF");
  });

  it("honours an LLM-signalled refusal", async () => {
    const llm = new MockLlm(
      JSON.stringify({ realistic: false, refusal_reason: "contradictory brief" }),
    );
    const res = await briefToMandate("do something impossible", { llm });
    expect(res.status).toBe("refused");
  });
});

describe("detectUnrealistic (deterministic guardrail)", () => {
  it("flags high APY + low risk cap", () => {
    expect(detectUnrealistic(4000, 10)).not.toBeNull();
  });
  it("allows a realistic combination", () => {
    expect(detectUnrealistic(800, 60)).toBeNull();
  });
});
