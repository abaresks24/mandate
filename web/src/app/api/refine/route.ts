import { NextResponse } from "next/server";
import { refineStrategy, type ProposedStrategy } from "@/lib/earn/propose";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { status: "refused", reason_code: "MALFORMED_BRIEF", reason: "Invalid JSON body." },
      { status: 400 },
    );
  }

  const { brief, priorStrategy, message } = (body ?? {}) as {
    brief?: unknown;
    priorStrategy?: unknown;
    message?: unknown;
  };

  if (typeof brief !== "string" || typeof message !== "string" || !priorStrategy) {
    return NextResponse.json(
      {
        status: "refused",
        reason_code: "MALFORMED_BRIEF",
        reason: "Expected { brief: string, priorStrategy, message: string }.",
      },
      { status: 400 },
    );
  }

  try {
    const result = await refineStrategy(brief, priorStrategy as ProposedStrategy, message);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        status: "refused",
        reason_code: "LLM_ERROR",
        reason: err instanceof Error ? err.message : "Unexpected server error.",
      },
      { status: 500 },
    );
  }
}
