import { NextResponse } from "next/server";
import { proposeStrategy } from "@/lib/earn/propose";

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

  const brief = (body as { brief?: unknown })?.brief;
  if (typeof brief !== "string") {
    return NextResponse.json(
      { status: "refused", reason_code: "MALFORMED_BRIEF", reason: "Missing `brief` string." },
      { status: 400 },
    );
  }

  try {
    const result = await proposeStrategy(brief);
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
