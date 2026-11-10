// Routing and guard behaviour of the API, without calling Claude.
import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { handleApi, MODEL } from "./api";

function call(method: string, url: string, body?: unknown) {
  const req = Object.assign(new EventEmitter(), { method, url, body }) as unknown as IncomingMessage;
  let status = 0, out = "";
  const res = {
    writeHead(s: number) { status = s; return this; },
    write(c: string) { out += c; return true; },
    end(c?: string) { if (c) out += c; },
  } as unknown as ServerResponse;
  return handleApi(req, res).then(() => ({ status, json: out ? JSON.parse(out) : null }));
}
const saved = process.env.ANTHROPIC_API_KEY;
afterEach(() => { process.env.ANTHROPIC_API_KEY = saved; });

describe("handleApi", () => {
  it("reports AI off without a key, and the model in use", async () => {
    process.env.ANTHROPIC_API_KEY = "";
    const r = await call("GET", "/api/status");
    expect(r.status).toBe(200);
    expect(r.json).toEqual({ ai: false, model: MODEL });
    expect(MODEL).toBe("claude-opus-5-5");
  });
  it("refuses AI calls with a clear 503 when no key is configured", async () => {
    process.env.ANTHROPIC_API_KEY = "";
    for (const ep of ["professor", "grade", "quiz", "screen", "rag", "agent", "capstone-grade"]) {
      const r = await call("POST", `/api/${ep}`, {});
      expect(r.status, ep).toBe(503);
      expect(r.json.error).toMatch(/ANTHROPIC_API_KEY/);
    }
  });
  it("only accepts POST for AI endpoints", async () => {
    expect((await call("GET", "/api/professor")).status).toBe(405);
  });
  it("returns 404 for unknown endpoints", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-not-used";
    expect((await call("POST", "/api/nope", {})).status).toBe(404);
  });
  it("reports AI on when a key is present (without calling the API)", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key-not-used";
    expect((await call("GET", "/api/status?x=1")).json.ai).toBe(true);
  });
});
