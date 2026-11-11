// The AI for Software Engineers case data must support exactly one defensible answer.
import { describe, expect, it } from "vitest";
import { runTool, software } from "../../../server/paths/software";
import { RAG_QUESTIONS, search } from "./corpus";
import {
  DEPLOYS, DUPLICATE_OF_NEW, EVENTS, INCIDENT_KEY, LOGS, MITIGATIONS, NEW_TICKET, PAYOUTS_METRICS, PR_CLAIMS, TICKETS, TIMES,
  failedRequests, onset, similarity, toMin, topK,
} from "./data";

const at = (t: string) => TIMES.indexOf(t);
const m = PAYOUTS_METRICS;

describe("PR #482 claims", () => {
  it("has both supported and invented claims, each with a reason", () => {
    expect(PR_CLAIMS.filter(c => c.bucket === "sup").length).toBeGreaterThanOrEqual(3);
    expect(PR_CLAIMS.filter(c => c.bucket === "fab").length).toBeGreaterThanOrEqual(3);
    for (const c of PR_CLAIMS) expect(c.why.length).toBeGreaterThan(15);
  });
});

describe("duplicate tickets", () => {
  it("the true duplicate is the top unfiltered match and shares area, version and cause", () => {
    expect(topK(NEW_TICKET.vec, 1)[0].t.id).toBe(DUPLICATE_OF_NEW);
    const d = TICKETS.find(t => t.id === DUPLICATE_OF_NEW)!;
    expect([d.area, d.version, d.status, d.cause]).toEqual([NEW_TICKET.area, NEW_TICKET.version, "open", NEW_TICKET.cause]);
  });
  it("the runners-up look alike but have different causes", () => {
    const top3 = topK(NEW_TICKET.vec, 3).map(r => r.t);
    expect(top3.map(t => t.id)).toEqual(["T-108", "T-115", "T-112"]);
    for (const t of top3.slice(1)) expect(t.cause).not.toBe(NEW_TICKET.cause);
  });
  it("filtering to the wrong area returns confident wrong matches", () => {
    const rows = topK(NEW_TICKET.vec, 3, t => t.area === "Checkout");
    expect(rows.length).toBe(3);
    expect(rows.every(r => r.t.area === "Checkout")).toBe(true);
    expect(rows.map(r => r.t.id)).not.toContain(DUPLICATE_OF_NEW);
  });
  it("similarity decreases with distance", () => {
    expect(similarity([0, 0], [0, 0])).toBe(1);
    expect(similarity([0, 0], [0.1, 0])).toBeGreaterThan(similarity([0, 0], [0.2, 0]));
  });
});

describe("RAG lab retrieval", () => {
  it.each(RAG_QUESTIONS.map(q => [q.q, q.needs] as const))("%s -> %s in the top 3", (q, id) => {
    expect(search(q, 3).map(h => h.chunk.id)).toContain(id);
  });
  it("marks the superseded ADR as superseded", () => {
    expect(search("feature flags default", 3).find(h => h.chunk.id === "ADR-021")?.chunk.text).toMatch(/superseded/i);
  });
});

describe("incident data supports exactly the key", () => {
  const deploy = DEPLOYS.find(d => d.id === "D-884")!;
  it("the cause (D-884) changes the pool size and precedes the error onset", () => {
    expect(deploy.change).toMatch(/50 → 5/);
    expect(toMin(onset()!)).toBeGreaterThanOrEqual(toMin(deploy.time));
    expect(m.error_rate_pct[at("02:35")]).toBeLessThan(1);
  });
  it("after the deploy the pool is exhausted (in use = max) and latency sits at the 3 s acquire timeout", () => {
    for (const t of TIMES.filter(t => toMin(t) >= toMin("02:40"))) {
      expect(m.db_pool_max[at(t)]).toBe(5);
      expect(m.db_pool_in_use[at(t)]).toBe(m.db_pool_max[at(t)]);
      expect(m.p99_latency_ms[at(t)]).toBeGreaterThanOrEqual(2900);
    }
    for (const t of TIMES.filter(t => toMin(t) < toMin("02:40"))) expect(m.db_pool_in_use[at(t)]).toBeLessThan(m.db_pool_max[at(t)] * 0.7);
  });
  it("the traffic bump (02:30) starts earlier and doesn't explain the error onset", () => {
    expect(m.requests_per_min[at("02:30")]).toBeGreaterThan(m.requests_per_min[at("02:25")] * 1.3);
    expect(m.error_rate_pct[at("02:30")]).toBeLessThan(1);
    expect(m.error_rate_pct[at("02:35")]).toBeLessThan(1);
  });
  it("the database is not overloaded: CPU falls after the deploy", () => {
    expect(m.db_cpu_pct[at("02:45")]).toBeLessThan(m.db_cpu_pct[at("02:35")]);
    expect(Math.max(...m.db_cpu_pct)).toBeLessThan(60);
  });
  it("the other deploys are in other services, and D-886 comes after the onset", () => {
    expect(DEPLOYS.filter(d => d.id !== "D-884").every(d => d.service !== "payouts-api")).toBe(true);
    expect(toMin(DEPLOYS.find(d => d.id === "D-886")!.time)).toBeGreaterThan(toMin(onset()!));
  });
  it("classifies every event once, with one cause, and the mitigation rolls back D-884", () => {
    expect(Object.keys(INCIDENT_KEY.classes).sort()).toEqual(EVENTS.map(e => e.id).sort());
    expect(Object.values(INCIDENT_KEY.classes).filter(c => c === "cause")).toHaveLength(1);
    expect(MITIGATIONS.map(x => x.id)).toContain(INCIDENT_KEY.mitigation);
    expect(INCIDENT_KEY.mitigation).toBe("rollback-d884");
  });
  it("contains one prompt-injection log line for the lesson on untrusted tool output", () => {
    expect(LOGS.filter(l => /ignore previous instructions/i.test(l.message))).toHaveLength(1);
  });
  it("computes the impact from the metrics", () => {
    expect(failedRequests()).toBeGreaterThan(15000);
    expect(failedRequests()).toBeLessThan(30000);
  });
});

describe("on-call tools", () => {
  it("every tool has a strict object schema", () => {
    for (const t of software.tools) {
      expect(t.input_schema.type).toBe("object");
      expect(t.input_schema.additionalProperties).toBe(false);
      expect(Object.keys(t.input_schema.properties as object).sort()).toEqual([...(t.input_schema.required as string[])].sort());
    }
  });
  it("rejects unknown tools and invalid input", () => {
    expect(runTool("run_shell", { command: "ls" }).ok).toBe(false);
    expect(runTool("get_metrics", { service: "payouts-api", metric: "cpu", from: "02:00", to: "03:00" }).ok).toBe(false);
    expect(runTool("get_metrics", { service: "payouts-api", metric: "error_rate_pct", from: "2am", to: "03:00" }).ok).toBe(false);
    expect(runTool("search_logs", { service: "payouts-api" }).ok).toBe(false);
    expect(runTool("search_logs", { service: "billing", level: null, contains: null, from: null, to: null }).ok).toBe(false);
  });
  it("search_logs filters by service, level, text and time", () => {
    const r = runTool("search_logs", { service: "payouts-api", level: "ERROR", contains: "pool", from: "02:40", to: "03:00" });
    const lines = (r.out as { lines: { time: string; level: string }[] }).lines;
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every(l => l.level === "ERROR" && toMin(l.time) >= toMin("02:40") && toMin(l.time) <= toMin("03:00"))).toBe(true);
  });
  it("get_metrics returns 5-minute points in range", () => {
    const r = runTool("get_metrics", { service: "payouts-api", metric: "db_pool_max", from: "02:30", to: "02:45" });
    expect((r.out as { points: { t: string; value: number }[] }).points).toEqual([{ t: "02:30", value: 50 }, { t: "02:35", value: 50 }, { t: "02:40", value: 5 }, { t: "02:45", value: 5 }]);
    expect(runTool("get_metrics", { service: "payouts-api", metric: "error_rate_pct", from: "03:00", to: "02:00" }).ok).toBe(false);
  });
  it("list_deploys and search_runbooks return the case facts", () => {
    const d = runTool("list_deploys", { service: null, from: "02:00", to: "03:00" }).out as { deploys: { id: string }[] };
    expect(d.deploys.map(x => x.id)).toEqual(["D-884"]);
    const rb = runTool("search_runbooks", { query: "connection pool exhausted" }).out as { id: string }[];
    expect(rb.map(x => x.id)).toContain("RB-POOL-1");
  });
});
