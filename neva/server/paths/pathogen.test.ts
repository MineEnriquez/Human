import { describe, expect, it } from "vitest";
import { pathogen } from "./pathogen";
import { serverPath, SERVER_PATHS } from "./index";

const run = pathogen.runTool;

describe("pathogen tools", () => {
  it("every declared tool has a strict object schema", () => {
    for (const t of pathogen.tools) {
      expect(t.input_schema.type).toBe("object");
      expect(t.input_schema.additionalProperties).toBe(false);
      expect(Object.keys(t.input_schema.properties as object).sort()).toEqual([...(t.input_schema.required as string[])].sort());
    }
  });
  it("rejects unknown tools and invalid input", () => {
    expect(run("drop_table", {}).ok).toBe(false);
    expect(run("get_snp_distances", { isolate_ids: ["KP-01"] }).ok).toBe(false);
    expect(run("get_snp_distances", { isolate_ids: "KP-01" }).ok).toBe(false);
    expect(run("search_isolates", { ward: "ICU" }).ok).toBe(false); // all fields required (null = no filter)
  });
  it("search_isolates filters case-insensitively and hides the toy embedding", () => {
    const r = run("search_isolates", { ward: "icu", st: null, gene: "BLAKPC-3", collected_after: null });
    expect(r.ok).toBe(true);
    const rows = r.out as { id: string; vec?: unknown }[];
    expect(rows.map(x => x.id)).toEqual(["KP-01", "KP-02", "KP-03", "KP-09"]);
    expect(rows.every(x => x.vec === undefined)).toBe(true);
  });
  it("get_snp_distances returns a matrix and warns about low coverage", () => {
    const r = run("get_snp_distances", { isolate_ids: ["KP-01", "KP-07", "KP-12"] });
    const out = r.out as { matrix: Record<string, Record<string, number>>; warnings: string[] };
    expect(out.matrix["KP-01"]["KP-12"]).toBe(5);
    expect(out.warnings.join(" ")).toContain("KP-07");
  });
  it("get_ward_transfers and search_protocols return the case facts", () => {
    const t = run("get_ward_transfers", { isolate_id: "KP-04" }).out as { transfers: { date: string }[] };
    expect(t.transfers[0].date).toBe("2026-03-08");
    expect(run("get_ward_transfers", { isolate_id: "KP-99" }).ok).toBe(false);
    const s = run("search_protocols", { query: "drain response" }).out as { id: string }[];
    expect(s.length).toBeGreaterThan(0);
    expect(s.map(x => x.id)).toContain("EN07-2");
  });
});

describe("server path registry", () => {
  it("knows all three paths and falls back to Pathogen Genomics", () => {
    expect(Object.keys(SERVER_PATHS).sort()).toEqual(["outbreak-modeling", "pathogen-genomics", "research-intelligence"]);
    expect(serverPath("nope").id).toBe("pathogen-genomics");
    expect(serverPath(undefined).id).toBe("pathogen-genomics");
  });
  it.each(Object.values(SERVER_PATHS).map(p => [p.id, p] as const))("%s is fully configured", (_id, p) => {
    expect(p.title.length).toBeGreaterThan(3);
    expect(p.setting.length).toBeGreaterThan(20);
    expect(p.agentPrompt.length).toBeGreaterThan(100);
    expect(p.capstoneGrader).toMatch(/10/);
    expect(p.tools.length).toBeGreaterThanOrEqual(3);
    expect(p.chunks.length).toBeGreaterThanOrEqual(8);
    expect(new Set(p.chunks.map(c => c.id)).size).toBe(p.chunks.length);
    for (const t of p.tools) expect(p.runTool(t.name, {}).ok, `${t.name} must reject empty input`).toBe(false);
  });
});
