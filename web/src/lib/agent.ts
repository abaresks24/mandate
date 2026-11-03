import { BriefProposal } from "./types";
import { mockBrief } from "@/mock/brief";
import { MOCK_MODE } from "./near";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL ?? "";

// POST /brief → agent service (NEAR AI Cloud). Falls back to mock on failure
// or when mock mode is on. The returned shape is BriefProposal in both paths.
export async function postBrief(
  brief: string
): Promise<{ proposal: BriefProposal; source: "live" | "mock" }> {
  if (MOCK_MODE || !AGENT_URL) {
    return { proposal: mockBrief(brief), source: "mock" };
  }
  try {
    const res = await fetch(`${AGENT_URL}/brief`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brief }),
    });
    if (!res.ok) throw new Error(`agent ${res.status}`);
    const proposal = (await res.json()) as BriefProposal;
    return { proposal, source: "live" };
  } catch {
    return { proposal: mockBrief(brief), source: "mock" };
  }
}
