// Tiny HTTP server exposing POST /brief -> proposal/refusal JSON.
//
// Uses Node's built-in http (no framework). The LLM client is constructed from
// env; in tests the mandate logic is exercised directly with a mock LLM instead
// of going through this server.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { NearAiClient } from "./llm.js";
import { briefToMandate } from "./mandate.js";
import type { BriefResult } from "./types.js";

export function buildHandler(resolveBrief: (brief: string) => Promise<BriefResult>) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method === "GET" && req.url === "/health") {
      return send(res, 200, { ok: true });
    }
    if (req.method !== "POST" || req.url !== "/brief") {
      return send(res, 404, { error: "not found" });
    }
    let body = "";
    for await (const chunk of req) body += chunk;
    let brief: string;
    try {
      const parsed = JSON.parse(body || "{}") as { brief?: unknown };
      if (typeof parsed.brief !== "string") throw new Error("missing 'brief' string");
      brief = parsed.brief;
    } catch (err) {
      return send(res, 400, {
        error: `bad request: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
    try {
      const result = await resolveBrief(brief);
      return send(res, result.status === "refused" ? 422 : 200, result);
    } catch (err) {
      return send(res, 500, {
        error: `internal: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };
}

function send(res: ServerResponse, status: number, obj: unknown): void {
  const payload = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

/** Start the server using the real NEAR AI Cloud client from env. */
export function startServer(port = Number(process.env.PORT ?? 8787)) {
  const apiKey = process.env.NEAR_AI_API_KEY ?? "";
  const llm = new NearAiClient(apiKey);
  const handler = buildHandler((brief) => briefToMandate(brief, { llm }));
  const server = createServer((req, res) => {
    handler(req, res).catch((err) => {
      send(res, 500, { error: String(err) });
    });
  });
  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`[mandate-agent] POST /brief listening on :${port}`);
  });
  return server;
}

// Run directly: `tsx src/server.ts`.
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}
