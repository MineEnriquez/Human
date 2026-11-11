// @vitest-environment node
// Free trial + bring-your-own-key gate, tested without calling Claude.
import { EventEmitter } from "node:events";
import type { IncomingMessage, ServerResponse } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleApi, USER_KEY_HEADER } from "./api";
import { consumeTrial, resetTrialCounters, trialRemaining, visitorId } from "./trial";

function call(method: string, url: string, headers: Record<string, string> = {}, ip = "203.0.113.7") {
  const req = Object.assign(new EventEmitter(), { method, url, body: {}, headers: { "x-forwarded-for": ip, ...headers }, socket: { remoteAddress: "10.0.0.1" } }) as unknown as IncomingMessage;
  let status = 0, out = "";
  const res = { writeHead(s: number) { status = s; return this; }, write(c: string) { out += c; return true; }, end(c?: string) { if (c) out += c; } } as unknown as ServerResponse;
  return handleApi(req, res).then(() => ({ status, json: out ? JSON.parse(out.split("\n")[0]) : null }));
}
const env = { ...process.env };
beforeEach(() => { resetTrialCounters(); process.env.TRIAL_ENFORCE = "1"; process.env.TRIAL_PER_VISITOR = "2"; process.env.TRIAL_DAILY_CAP = "3"; delete process.env.UPSTASH_REDIS_REST_URL; });
afterEach(() => { process.env = { ...env }; vi.restoreAllMocks(); });

describe("trial counters", () => {
  it("counts per visitor and stops at the per-visitor limit", async () => {
    expect(await trialRemaining("a")).toBe(2);
    expect(await consumeTrial("a")).toBe(true);
    expect(await consumeTrial("a")).toBe(true);
    expect(await consumeTrial("a")).toBe(false);
    expect(await trialRemaining("a")).toBe(0);
  });
  it("stops everyone at the site-wide daily cap", async () => {
    await consumeTrial("a"); await consumeTrial("a"); await consumeTrial("b");
    expect(await consumeTrial("c")).toBe(false);
    expect(await trialRemaining("c")).toBe(0);
  });
  it("is disabled when the per-visitor allowance is 0", async () => {
    process.env.TRIAL_PER_VISITOR = "0";
    expect(await consumeTrial("a")).toBe(false);
  });
  it("identifies visitors by the first X-Forwarded-For hop", () => {
    const req = { headers: { "x-forwarded-for": "198.51.100.4, 10.0.0.2" }, socket: { remoteAddress: "10.0.0.1" } } as unknown as IncomingMessage;
    expect(visitorId(req)).toBe("198.51.100.4");
  });
});

describe("AI gate", () => {
  it("with no key anywhere: 503 no_key", async () => {
    process.env.ANTHROPIC_API_KEY = "";
    const r = await call("POST", "/api/professor");
    expect(r.status).toBe(503);
    expect(r.json.code).toBe("no_key");
  });
  it("on the owner's key: uses the trial, then 429 trial_exhausted", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-owner-test";
    const ip = "198.51.100.9";
    // Unknown routes are rejected before any trial is used.
    expect((await call("POST", "/api/nope", {}, ip)).status).toBe(404);
    expect((await call("GET", "/api/status", {}, ip)).json.trial).toEqual({ enabled: true, limit: 2, remaining: 2 });
    await consumeTrial(ip); await consumeTrial(ip);
    const r = await call("POST", "/api/grade", {}, ip);
    expect(r.status).toBe(429);
    expect(r.json.code).toBe("trial_exhausted");
    expect((await call("GET", "/api/status", {}, ip)).json.trial.remaining).toBe(0);
  });
  it("a visitor's own key bypasses the trial (and an exhausted trial doesn't block it)", async () => {
    process.env.ANTHROPIC_API_KEY = "";
    process.env.TRIAL_PER_VISITOR = "0";
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    // The request reaches the handler (which then fails offline): it is not a 503 or 429 from the gate.
    const r = await call("POST", "/api/quiz", { [USER_KEY_HEADER]: "sk-ant-api03-" + "x".repeat(40) });
    expect([503, 429]).not.toContain(r.status);
    // Whatever was logged, the key never appears in it.
    for (const args of log.mock.calls) expect(args.join(" ")).not.toMatch(/sk-ant-api03-x{10}/);
  }, 20000);
  it("ignores malformed visitor keys", async () => {
    process.env.ANTHROPIC_API_KEY = "";
    const r = await call("POST", "/api/professor", { [USER_KEY_HEADER]: "not-a-key" });
    expect(r.status).toBe(503);
  });
  it("local runs (no TRIAL_ENFORCE, not on Vercel, not production) are unlimited on the owner's credentials", async () => {
    delete process.env.TRIAL_ENFORCE; delete process.env.VERCEL; process.env.NODE_ENV = "development";
    process.env.ANTHROPIC_API_KEY = "sk-ant-owner-test";
    const s = (await call("GET", "/api/status")).json;
    expect(s).toMatchObject({ ai: true, unlimited: true, trial: { enabled: false } });
    process.env.VERCEL = "1";
    expect((await call("GET", "/api/status")).json).toMatchObject({ unlimited: false, trial: { enabled: true } });
  });
  it("verify-key rejects keys that don't look like Anthropic keys without calling out", async () => {
    const r = await call("POST", "/api/verify-key", { [USER_KEY_HEADER]: "hello" });
    expect(r.status).toBe(400);
    expect(r.json.ok).toBe(false);
  });
});
