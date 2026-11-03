// NEAR Agent Market provider client.
//
// REGISTER AS PROVIDER (one-time, out of band):
//   1. Sign up as a self-hosted provider at https://market.near.ai and declare
//      this service's endpoint + capabilities (the MANDATE "brief->mandate" skill).
//   2. The market issues a provider token prefixed `aat_`. Put it in
//      MARKET_AAT_TOKEN. All requests here authenticate with that bearer token.
//   3. MCP endpoint for tool-style integration: https://market.near.ai/mcp
//      (lets MCP-capable clients call this agent's skill directly).
//
// ASSIGNMENT LIFECYCLE (verified endpoint names):
//   - poll    GET  /v1/agents/me/assignments
//   - accept  POST /v1/assignments/{id}/start      (NOT /accept — verified)
//   - deliver POST /v1/assignments/{id}/submit      (Markdown deliverable)
//
// All HTTP is behind the HttpClient interface so tests can mock it.

export const MARKET_BASE = "https://market.near.ai";
export const MARKET_MCP_ENDPOINT = "https://market.near.ai/mcp";

export interface HttpResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export interface HttpClient {
  request(
    method: "GET" | "POST",
    url: string,
    opts: { headers: Record<string, string>; body?: string },
  ): Promise<HttpResponse>;
}

export interface Assignment {
  id: string;
  status: string;
  brief?: string;
  // other fields are passed through opaquely
  [k: string]: unknown;
}

/** Thin wrapper over global fetch implementing HttpClient. */
export class FetchHttpClient implements HttpClient {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}
  async request(
    method: "GET" | "POST",
    url: string,
    opts: { headers: Record<string, string>; body?: string },
  ): Promise<HttpResponse> {
    const res = await this.fetchImpl(url, {
      method,
      headers: opts.headers,
      body: opts.body,
    });
    return {
      ok: res.ok,
      status: res.status,
      json: () => res.json(),
      text: () => res.text(),
    };
  }
}

export class MarketClient {
  constructor(
    private readonly aatToken: string,
    private readonly http: HttpClient,
    private readonly base: string = MARKET_BASE,
  ) {
    if (!aatToken.startsWith("aat_")) {
      throw new Error("MARKET_AAT_TOKEN must be an `aat_` provider token");
    }
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.aatToken}`,
      "Content-Type": "application/json",
    };
  }

  /** Poll for assignments routed to this provider. */
  async pollAssignments(): Promise<Assignment[]> {
    const url = `${this.base}/v1/agents/me/assignments`;
    const res = await this.http.request("GET", url, { headers: this.headers() });
    if (!res.ok) {
      throw new Error(`poll assignments failed: ${res.status} ${await res.text()}`);
    }
    const body = (await res.json()) as { assignments?: Assignment[] } | Assignment[];
    if (Array.isArray(body)) return body;
    return body.assignments ?? [];
  }

  /**
   * Accept an assignment. VERIFIED: the accept action is POST .../start,
   * NOT .../accept.
   */
  async accept(assignmentId: string): Promise<void> {
    const url = `${this.base}/v1/assignments/${encodeURIComponent(assignmentId)}/start`;
    const res = await this.http.request("POST", url, {
      headers: this.headers(),
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      throw new Error(`accept(start) failed: ${res.status} ${await res.text()}`);
    }
  }

  /** Deliver the result as a Markdown deliverable via POST .../submit. */
  async submit(assignmentId: string, markdown: string): Promise<void> {
    const url = `${this.base}/v1/assignments/${encodeURIComponent(assignmentId)}/submit`;
    const res = await this.http.request("POST", url, {
      headers: this.headers(),
      body: JSON.stringify({ deliverable: markdown, format: "markdown" }),
    });
    if (!res.ok) {
      throw new Error(`submit failed: ${res.status} ${await res.text()}`);
    }
  }
}
