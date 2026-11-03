import { describe, expect, it } from "vitest";
import {
  MarketClient,
  type HttpClient,
  type HttpResponse,
} from "./market.js";

interface Call {
  method: string;
  url: string;
  body?: string;
}

class MockHttp implements HttpClient {
  public calls: Call[] = [];
  constructor(private readonly responder: (c: Call) => HttpResponse) {}
  async request(
    method: "GET" | "POST",
    url: string,
    opts: { headers: Record<string, string>; body?: string },
  ): Promise<HttpResponse> {
    const call = { method, url, body: opts.body };
    this.calls.push(call);
    return this.responder(call);
  }
}

function okJson(obj: unknown): HttpResponse {
  return {
    ok: true,
    status: 200,
    json: async () => obj,
    text: async () => JSON.stringify(obj),
  };
}

describe("MarketClient", () => {
  it("requires an aat_ token", () => {
    expect(() => new MarketClient("bad-token", new MockHttp(() => okJson({})))).toThrow();
    expect(() => new MarketClient("aat_ok", new MockHttp(() => okJson({})))).not.toThrow();
  });

  it("polls GET /v1/agents/me/assignments", async () => {
    const http = new MockHttp(() => okJson({ assignments: [{ id: "x1", status: "new" }] }));
    const client = new MarketClient("aat_tok", http);
    const list = await client.pollAssignments();
    expect(list).toEqual([{ id: "x1", status: "new" }]);
    expect(http.calls[0]!.url).toContain("/v1/agents/me/assignments");
    expect(http.calls[0]!.method).toBe("GET");
  });

  it("accepts via POST /start (NOT /accept)", async () => {
    const http = new MockHttp(() => okJson({}));
    const client = new MarketClient("aat_tok", http);
    await client.accept("asg-42");
    const call = http.calls[0]!;
    expect(call.method).toBe("POST");
    expect(call.url).toContain("/v1/assignments/asg-42/start");
    // critical: must NOT use /accept
    expect(call.url).not.toContain("/accept");
  });

  it("submits markdown via POST /submit", async () => {
    const http = new MockHttp(() => okJson({}));
    const client = new MarketClient("aat_tok", http);
    await client.submit("asg-42", "# Deliverable\nhello");
    const call = http.calls[0]!;
    expect(call.method).toBe("POST");
    expect(call.url).toContain("/v1/assignments/asg-42/submit");
    expect(call.body).toContain("# Deliverable");
    expect(call.body).toContain("markdown");
  });
});
