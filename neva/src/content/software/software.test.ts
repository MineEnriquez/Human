// The AI for Software Engineers case: Epiloom's API, the validator, the engine and the capstone key must agree.
import { describe, expect, it } from "vitest";
import { runTool, software } from "../../../server/paths/software";
import { RAG_QUESTIONS, search, CHUNKS } from "./corpus";
import { CODE_VERSIONS, EXAMPLE_QUERY, LLM_SNIPPET, LLM_SPEC, RIGHT_EXAMPLE, SHIP_VERSION, SPEC_FIELDS, topExamples } from "./data";
import { runModel } from "./engine";
import { API, EXAMPLES, SYMBOLS } from "./epiloom";
import { DRAFT_SPEC, REFERENCE_SPEC, REQUIREMENTS } from "./spec";
import { findCalls, validateCode } from "./validator";

describe("Epiloom API reference", () => {
  it("has unique symbols, and every required parameter has a description", () => {
    expect(new Set(API.map(s => s.name)).size).toBe(API.length);
    for (const s of API) for (const p of s.params) expect(p.desc.length, `${s.name}.${p.name}`).toBeGreaterThan(5);
  });
  it("examples use only real symbols and parameters (EX-10 is the deliberate look-alike)", () => {
    for (const e of EXAMPLES) {
      const issues = validateCode(e.code).filter(i => ["unknown-symbol", "unknown-arg", "missing-arg", "unit"].includes(i.rule));
      expect(issues, e.id).toEqual([]);
    }
    expect(validateCode(EXAMPLES.find(e => e.id === "EX-10")!.code).map(i => i.rule)).toContain("maternal-needs-pregnancy");
  });
});

describe("validator", () => {
  it("parses multi-line calls and keyword arguments", () => {
    const c = findCalls("x = el.Sim(\n  n_agents=10,\n  diseases=[el.SIR(beta=el.peryear(1), dur_inf=el.days(5))],\n)");
    expect(c.map(x => x.name)).toEqual(["Sim", "SIR", "peryear", "days"]);
    expect(c[0].args.map(a => a.name)).toEqual(["n_agents", "diseases"]);
    expect(c[1].line).toBe(3);
  });
  it("finds every planted bug class in the LLM's snippet", () => {
    const rules = validateCode(LLM_SNIPPET, LLM_SPEC).map(i => i.rule);
    for (const r of ["unknown-symbol", "deprecated", "unit", "sexual-network", "mtct-pregnancy", "maternal-needs-pregnancy", "mtct-probability", "mtct-beta"]) expect(rules, r).toContain(r);
  });
  it("flags unknown and missing arguments, probabilities over 1, and a duration used as a rate", () => {
    const rules = validateCode("el.MFNet(duration=el.years(1), partners=3)\nel.Campaign(product=tx, years=[2030], coverage=60)\nel.Births(birth_rate=el.years(20))").map(i => i.rule);
    expect(rules).toEqual(expect.arrayContaining(["unknown-arg", "missing-arg", "probability-range", "unit"]));
  });
  it("passes the version to ship and fails the others against the reviewed spec", () => {
    const n = Object.fromEntries(CODE_VERSIONS.map(v => [v.id, validateCode(v.code, REFERENCE_SPEC).map(i => i.rule)]));
    expect(n[SHIP_VERSION]).toEqual([]);
    expect(n.v1).toEqual(expect.arrayContaining(["coinfection-direction", "age-assortative", "mtct-pregnancy", "targeted-eligibility", "crn-seed"]));
    expect(n.v3.sort()).toEqual(["crn-seed", "targeted-eligibility"]);
  });
  it("follows seeds passed through a variable (v3 gives each scenario its own seed)", () => {
    const msg = validateCode(CODE_VERSIONS.find(v => v.id === "v3")!.code, REFERENCE_SPEC).find(i => i.rule === "crn-seed")!.message;
    expect(msg).toMatch(/different seeds \(1, 2, 3\)/);
  });
  it("catches single_rng=True and different seeds", () => {
    // Every scenario in the spec, including the baseline, needs a labelled sim.
    const v2 = CODE_VERSIONS.find(v => v.id === "v2")!.code;
    expect(validateCode(v2.replace("make_sim('baseline', []), ", ""), REFERENCE_SPEC).map(i => i.rule)).toEqual(["missing-scenario"]);
    expect(validateCode(CODE_VERSIONS.find(v => v.id === "v1")!.code, REFERENCE_SPEC).map(i => i.rule)).toContain("missing-scenario");
    expect(validateCode("el.options(single_rng=True)").map(i => i.rule)).toContain("crn-off");
    expect(validateCode("el.Sim(rand_seed=1)\nel.Sim(rand_seed=2)", { ...REFERENCE_SPEC, interventions: [], mtct: false, coinfection: null, diseases: [], horizon: null }).map(i => i.rule)).toContain("crn-seed");
  });
});

describe("capstone key", () => {
  it("the draft spec differs from the reference exactly where the requirement key says", () => {
    expect(DRAFT_SPEC.age_assortative).toBe(false);
    expect(DRAFT_SPEC.coinfection).toEqual({ source: "syphilis", target: "hiv" });
    expect(DRAFT_SPEC.scenarios).not.toContain("baseline");
    expect(DRAFT_SPEC.needs_clarification).toEqual([]);
    expect(DRAFT_SPEC.interventions.find(i => i.name === "targeted")!.delivery).toBe("routine");
    expect(REQUIREMENTS.filter(r => r.key === "captured")).toHaveLength(3);
    expect(REQUIREMENTS.filter(r => r.key === "wrong")).toHaveLength(2);
    expect(REQUIREMENTS.filter(r => r.key === "missing")).toHaveLength(3);
  });
  it("the engine is deterministic and both strategies beat the baseline, targeted most, with fewer people treated", () => {
    const a = runModel(REFERENCE_SPEC), b = runModel(REFERENCE_SPEC);
    expect(a).toEqual(b);
    const by = (s: string) => a.results.find(r => r.scenario === s)!;
    expect(by("mass").congenitalTotal).toBeLessThan(by("baseline").congenitalTotal);
    expect(by("targeted").congenitalTotal).toBeLessThan(by("mass").congenitalTotal);
    expect(by("targeted").treatedTotal).toBeLessThan(by("mass").treatedTotal);
    expect(by("baseline").years[0].prevalence).toBeGreaterThan(0.01);
    expect(by("baseline").years[0].prevalence).toBeLessThan(0.05);
    expect(software.capstoneGrader).toContain(`baseline ${by("baseline").congenitalTotal}`);
  });
  it("without mother-to-child transmission the engine produces no congenital cases", () => {
    expect(runModel({ ...REFERENCE_SPEC, mtct: false }).results.every(r => r.congenitalTotal === 0)).toBe(true);
  });
});

describe("case 1 and case 2 data", () => {
  it("the spec-review lab has captured, wrong and ask cards", () => {
    for (const b of ["ok", "wrong", "ask"]) expect(SPEC_FIELDS.filter(f => f.bucket === b).length, b).toBeGreaterThanOrEqual(2);
  });
  it("the closest example is the look-alike; the right one is second and survives an mtct + sexual-network filter", () => {
    const top = topExamples(EXAMPLE_QUERY.vec, 2).map(r => r.e.id);
    expect(top).toEqual(["EX-10", RIGHT_EXAMPLE]);
    const filtered = topExamples(EXAMPLE_QUERY.vec, 1, e => e.features.includes("mtct") && e.features.includes("sexual-network"));
    expect(filtered[0].e.id).toBe(RIGHT_EXAMPLE);
  });
});

describe("RAG lab retrieval", () => {
  it.each(RAG_QUESTIONS.map(q => [q.q, q.needs] as const))("%s -> %s in the top 3", (q, id) => {
    expect(search(q, 3).map(h => h.chunk.id)).toContain(id);
  });
  it("has unique chunk ids, one deprecated page and one injected README", () => {
    expect(new Set(CHUNKS.map(c => c.id)).size).toBe(CHUNKS.length);
    expect(CHUNKS.filter(c => /deprecated/i.test(c.title)).length).toBeGreaterThanOrEqual(1);
    expect(CHUNKS.find(c => c.id === "README-EX-COMMUNITY")!.text).toMatch(/ignore your instructions/i);
  });
});

describe("Model Builder tools", () => {
  it("every tool has a strict object schema and rejects empty input", () => {
    for (const t of software.tools) {
      expect(t.input_schema.type).toBe("object");
      expect(t.input_schema.additionalProperties).toBe(false);
      expect(runTool(t.name, {}).ok, t.name).toBe(false);
    }
    expect(runTool("push_to_main", {}).ok).toBe(false);
  });
  it("get_api returns real symbols and refuses invented ones", () => {
    expect((runTool("get_api", { symbol: "el.MaternalNet" }).out as { name: string }).name).toBe("MaternalNet");
    expect(runTool("get_api", { symbol: "MassTreatment" }).ok).toBe(false);
    expect(SYMBOLS.has("MassTreatment")).toBe(false);
  });
  it("find_examples applies filters; validate_code checks against the reviewed spec", () => {
    const ex = runTool("find_examples", { query: "congenital syphilis", module_kind: null, feature: "mtct" }).out as { examples: { id: string; features: string[] }[] };
    expect(ex.examples.every(e => e.features.includes("mtct"))).toBe(true);
    expect(ex.examples.map(e => e.id)).toContain(RIGHT_EXAMPLE);
    const v = runTool("validate_code", { code: CODE_VERSIONS.find(c => c.id === "v3")!.code }).out as { issue_count: number };
    expect(v.issue_count).toBe(2);
  });
  it("run_model validates the spec JSON and returns scenarios with assumptions", () => {
    expect(runTool("run_model", { spec_json: "{not json" }).ok).toBe(false);
    expect(runTool("run_model", { spec_json: JSON.stringify({ diseases: [] }) }).ok).toBe(false);
    const r = runTool("run_model", { spec_json: JSON.stringify(REFERENCE_SPEC) }).out as { scenarios: { scenario: string }[]; assumptions: string[]; note: string };
    expect(r.scenarios.map(s => s.scenario)).toEqual(["baseline", "mass", "targeted"]);
    expect(r.assumptions.length).toBeGreaterThan(3);
    expect(r.note).toMatch(/simplified/i);
  });
});
