// Server-only OpenAI-compatible LLM client (Mistral). The API key is read from
// process.env on the server and NEVER shipped to the browser. Imported only
// from app/api/*/route.ts handlers (runtime: nodejs). The key is read from
// process.env (no NEXT_PUBLIC_ prefix) so it is never bundled for the browser.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function readLlmConfig(): LlmConfig {
  const baseUrl = process.env.LLM_BASE_URL;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL;
  if (!baseUrl || !apiKey || !model) {
    throw new Error(
      "Missing LLM configuration. Set LLM_BASE_URL, LLM_API_KEY and LLM_MODEL on the server.",
    );
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), apiKey, model };
}

/** OpenAI-compatible chat completion asking for a JSON object. Returns text. */
export async function chatJson(
  messages: ChatMessage[],
  cfg: LlmConfig,
  opts?: { temperature?: number },
): Promise<string> {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: opts?.temperature ?? 0.1,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "<no body>");
    throw new Error(`LLM request failed: ${res.status} ${body}`);
  }
  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (content == null) throw new Error("LLM returned no content");
  return content;
}
