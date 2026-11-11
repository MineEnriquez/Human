// @vitest-environment node
import { describe, expect, it } from "vitest";
import { cancer } from "./cancer";
import { serverPath, SERVER_PATHS } from "./index";

const run = cancer.runTool;

describe("cancer tools", () => {
  it("every declared tool has a strict object schema", () => {
    for (const t of cancer.tools) {
      expect(t.input_schema.type).toBe("object");
      expect(t.input_schema.additionalProperties).toBe(false);
      expect(Object.keys(t.input_schema.properties as object).sort()).toEqual([...(t.input_schema.required as string[])].sort());
    }
  });
  it("rejects unknown tools and invalid input", () => {
    expect(run("drop_table", {}).ok).toBe(false);
    expect(run("search_variants", { gene: "NPM1" }).ok).toBe(false); // all fields required (null = no filter)
    expect(run("search_variants", { gene: null, sample: null, min_vaf: 2 }).ok).toBe(false);
    expect(run("search_variants", { gene: null, sample: "BM-XX", min_vaf: null }).ok).toBe(false);
    expect(run("get_vaf_timeline", { variant_id: "NOPE" }).ok).toBe(false);
    expect(run("get_sample_qc", { sample_id: "BM-XX" }).ok).toBe(false);
  });
  it("search_variants filters case-insensitively", () => {
    const r = run("search_variants", { gene: null, sample: "skin", min_vaf: 0.1 });
    expect(r.ok).toBe(true);
    expect((r.out as { variant_id: string }[]).map(x => x.variant_id)).toEqual(["DDX41-fs"]);
    const all = run("search_variants", { gene: "npm1", sample: null, min_vaf: null }).out as unknown[];
    expect(all).toHaveLength(4);
  });
  it("get_vaf_timeline, get_sample_qc and search_sops return the case facts", () => {
    const t = run("get_vaf_timeline", { variant_id: "idh2-r140q" }).out as { timeline: { sample: string; vaf: number }[] };
    expect(t.timeline.find(x => x.sample === "BM-REL")!.vaf).toBe(0.4);
    const q = run("get_sample_qc", { sample_id: "BM-DX" }).out as { purity: number; reporting_thresholds: { min_depth: number } };
    expect(q.purity).toBe(0.85);
    expect(q.reporting_thresholds.min_depth).toBe(100);
    const s = run("search_sops", { query: "germline genetic counseling referral" }).out as { id: string }[];
    expect(s.map(x => x.id)).toContain("GL01-3");
  });
  it("the grader key states the CCFs the data implies", () => {
    expect(cancer.capstoneGrader).toContain("IDH2 CCF 0.14 at diagnosis, 1.00 at relapse");
    expect(cancer.capstoneGrader).toContain("FLT3 CCF 0.71 at diagnosis, 0.00 at relapse");
  });
});

describe("server path registry", () => {
  it("knows all three paths and falls back to Cancer Genomics", () => {
    expect(Object.keys(SERVER_PATHS).sort()).toEqual(["cancer-genomics", "outbreak-modeling", "research-intelligence"]);
    expect(serverPath("nope").id).toBe("cancer-genomics");
    expect(serverPath(undefined).id).toBe("cancer-genomics");
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
