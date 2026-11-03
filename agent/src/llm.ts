// LLM client behind an interface so tests use a mock (no network in tests).
//
// NEAR AI Cloud is OpenAI-compatible. Base: https://cloud-api.near.ai/v1.
// The model id is pulled at runtime from GET /v1/models — never hardcoded.

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmClient {
  /** Returns the first available model id from GET /v1/models. */
  listModel(): Promise<string>;
  /** OpenAI-compatible chat completion; returns the assistant text content. */
  chat(messages: ChatMessage[], opts?: { temperature?: number }): Promise<string>;
}

const DEFAULT_BASE = "https://cloud-api.near.ai/v1";

/** Real NEAR AI Cloud client. Not exercised in tests (mock is used there). */
export class NearAiClient implements LlmClient {
  private cachedModel: string | null = null;

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = DEFAULT_BASE,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    if (!apiKey) throw new Error("NEAR_AI_API_KEY is required for NearAiClient");
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  async listModel(): Promise<string> {
    if (this.cachedModel) return this.cachedModel;
    const res = await this.fetchImpl(`${this.baseUrl}/models`, {
      method: "GET",
      headers: this.headers(),
    });
    if (!res.ok) {
      throw new Error(`GET /models failed: ${res.status} ${await safeText(res)}`);
    }
    const body = (await res.json()) as { data?: Array<{ id: string }> };
    const id = body.data?.[0]?.id;
    if (!id) throw new Error("GET /models returned no model");
    this.cachedModel = id;
    return id;
  }

  async chat(
    messages: ChatMessage[],
    opts?: { temperature?: number },
  ): Promise<string> {
    const model = await this.listModel();
    const res = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model,
        messages,
        temperature: opts?.temperature ?? 0.2,
        // Ask for JSON back; NEAR AI Cloud mirrors OpenAI's response_format.
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      throw new Error(
        `POST /chat/completions failed: ${res.status} ${await safeText(res)}`,
      );
    }
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    if (content == null) throw new Error("chat completion returned no content");
    return content;
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "<no body>";
  }
}
