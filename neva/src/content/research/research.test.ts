import { describe, expect, it } from "vitest";
import { research, runTool } from "../../../server/paths/research";
import { RESEARCH_LABS } from "../../labs/research";
import { TOOL_EVIDENCE } from "../../labs/research/ReviewBoard";
import { EVIDENCE as SCREEN_EV } from "../../labs/research/ScreenLab";
import { EVIDENCE as SEMANTIC_EV } from "../../labs/research/SemanticLab";
import { MCP_EVIDENCE } from "../../labs/shared/McpLabView";
import { RAG_EVIDENCE } from "../../labs/shared/RagLabView";
import { CHUNKS, RAG_QUESTIONS, search } from "./corpus";
import { LESSONS, PATH } from "./lessons";
import { KEY, STUDIES, SYNTHESIS_KEY, cohenKappa, kappaLabel, rrf, type Study } from "./papers";
import { PRESETS, applyFilters, FILTERS, hybridSearch, keywordSearch, vectorSearch } from "./semantic";

describe("Cohen's kappa", () => {
  it("matches the worked example in the lecture (κ = 0.40)", () => {
    // 20 both include, 5 A-include/B-exclude, 10 A-exclude/B-include, 15 both exclude
    const a = [...Array(20).fill("i"), ...Array(5).fill("i"), ...Array(10).fill("e"), ...Array(15).fill("e")];
    const b = [...Array(20).fill("i"), ...Array(5).fill("e"), ...Array(10).fill("i"), ...Array(15).fill("e")];
    expect(cohenKappa(a, b)).toBeCloseTo(0.4, 10);
  });
  it("is 1 for perfect agreement", () => {
    expect(cohenKappa(["i", "e", "u", "e"], ["i", "e", "u", "e"])).toBe(1);
  });
  it("is about 0 when agreement equals chance", () => {
    const a = Array.from({ length: 40 }, (_, i) => (i % 2 ? "i" : "e"));
    const b = Array.from({ length: 40 }, (_, i) => (Math.floor(i / 2) % 2 ? "i" : "e"));
    expect(cohenKappa(a, b)).toBeCloseTo(0, 10);
  });
  it("is below raw agreement whenever chance agreement is positive", () => {
    const a = ["i", "e", "e", "e", "e", "e", "e", "e"], b = ["e", "e", "e", "e", "e", "e", "e", "e"];
    expect(cohenKappa(a, b)).toBeLessThan(7 / 8);
  });
  it("labels follow Landis & Koch", () => {
    expect(kappaLabel(0.4)).toBe("fair");
    expect(kappaLabel(0.55)).toBe("moderate");
    expect(kappaLabel(0.61)).toBe("substantial");
    expect(kappaLabel(0.8)).toBe("substantial");
    expect(kappaLabel(0.81)).toBe("almost perfect");
  });
  it("rejects mismatched input", () => {
    expect(() => cohenKappa(["i"], ["i", "e"])).toThrow();
  });
});

describe("reciprocal rank fusion", () => {
  it("scores 1/(k + rank) summed over rankings, ranks from 1, k = 60", () => {
    const out = rrf([["A", "B", "C"], ["B", "C", "A"]]);
    const score = Object.fromEntries(out.map(r => [r.id, r.score]));
    expect(score.A).toBeCloseTo(1 / 61 + 1 / 63, 12);
    expect(score.B).toBeCloseTo(1 / 62 + 1 / 61, 12);
    expect(out[0].id).toBe("B");
  });
  it("matches the lecture check: 2nd and 3rd = 1/62 + 1/63", () => {
    const out = rrf([["x", "d"], ["y", "z", "d"]]);
    expect(out.find(r => r.id === "d")!.score).toBeCloseTo(1 / 62 + 1 / 63, 12);
  });
  it("honours a custom k", () => {
    expect(rrf([["A"]], 10)[0].score).toBeCloseTo(1 / 11, 12);
  });
});

// Each PICO + design criterion, evaluated from the record's fields.
const CRIT: Record<string, (s: Study) => boolean> = {
  population: s => /adult/i.test(s.population) && /bloodstream|positive blood culture/i.test(s.population) && !/child|neonat|urinary|spiked/i.test(s.population),
  intervention: s => /PCR/.test(s.intervention) && /positive blood culture broth/i.test(s.intervention),
  comparator: s => /^conventional culture-based identification/i.test(s.comparator),
  outcome: s => /time to optimal antibiotic therapy/i.test(s.outcomes) && s.effect !== null,
  design: s => ["RCT", "cohort", "before-after"].includes(s.design),
};

describe("answer key is consistent with the study records", () => {
  it("covers every study exactly once", () => {
    const ids = [...KEY.included, ...Object.keys(KEY.excluded)].sort();
    expect(ids).toEqual(STUDIES.map(s => s.id).sort());
  });
  it("every included study meets every criterion", () => {
    for (const id of KEY.included) {
      const s = STUDIES.find(x => x.id === id)!;
      for (const [name, ok] of Object.entries(CRIT)) expect(ok(s), `${id} ${name}`).toBe(true);
    }
  });
  it("every excluded study fails the criterion recorded in the key", () => {
    for (const [id, ex] of Object.entries(KEY.excluded)) {
      const s = STUDIES.find(x => x.id === id)!;
      expect(CRIT[ex.fails](s), `${id} should fail ${ex.fails}`).toBe(false);
      expect(ex.reason.length).toBeGreaterThan(10);
    }
  });
  it("synthesis key matches the included trials", () => {
    const rcts = STUDIES.filter(s => KEY.included.includes(s.id) && s.design === "RCT");
    expect(rcts.map(s => s.id)).toEqual(["MS-01", "MS-02", "MS-09"]);
    expect(rcts.reduce((n, s) => n + (s.n || 0), 0)).toBe(962);
    expect(SYNTHESIS_KEY.rationale).toContain("962");
    expect(["high", "moderate", "low", "very low"]).toContain(SYNTHESIS_KEY.certainty);
  });
  it("every included study has a risk-of-bias judgment from the right tool", () => {
    for (const id of KEY.included) {
      const s = STUDIES.find(x => x.id === id)!;
      expect(s.rob.tool).toBe(s.design === "RCT" ? "RoB 2" : "ROBINS-I");
      const allowed = s.rob.tool === "RoB 2" ? ["low", "some concerns", "high"] : ["low", "moderate", "serious", "critical"];
      expect(allowed).toContain(s.rob.judgment);
    }
  });
  it("risk of bias doesn't reveal eligibility: every comparative study is assessed, included or not", () => {
    for (const s of STUDIES) {
      if (["RCT", "cohort", "before-after"].includes(s.design)) expect(s.rob.tool, s.id).toBe(s.design === "RCT" ? "RoB 2" : "ROBINS-I");
      else expect(s.rob.tool, s.id).toBe("not applicable");
    }
  });
  it("labels every author and journal fictional", () => {
    for (const s of STUDIES) { expect(s.authors).toContain("(fictional)"); expect(s.journal).toContain("(fictional)"); }
  });
});

describe("server tools", () => {
  it("every tool schema is strict-compatible (all properties required, no extras)", () => {
    for (const t of research.tools) {
      const sch = t.input_schema as { properties: Record<string, unknown>; required: string[]; additionalProperties: boolean };
      expect(sch.additionalProperties).toBe(false);
      expect([...sch.required].sort()).toEqual(Object.keys(sch.properties).sort());
    }
  });
  it("rejects unknown tools and invalid input", () => {
    expect(runTool("nope", {}).ok).toBe(false);
    expect(runTool("search_studies", { query: "pcr" }).ok).toBe(false); // design missing
    expect(runTool("get_study", { id: 7 }).ok).toBe(false);
    expect(String(runTool("search_protocol", {}).out)).toMatch(/INVALID_INPUT/);
  });
  it("search_studies returns records and filters by design", () => {
    const all = runTool("search_studies", { query: "multiplex PCR positive blood culture", design: null });
    expect(all.ok).toBe(true);
    const rows = all.out as { id: string; title: string; design: string; year: number }[];
    expect(rows.length).toBeGreaterThan(3);
    expect(Object.keys(rows[0]).sort()).toEqual(["design", "id", "n", "title", "year"]);
    const rct = runTool("search_studies", { query: "multiplex PCR positive blood culture", design: "RCT" }).out as { design: string }[];
    expect(rct.length).toBeGreaterThan(0);
    expect(rct.every(r => r.design === "RCT")).toBe(true);
    expect(runTool("search_studies", { query: "pcr", design: "meta-analysis" }).ok).toBe(false);
  });
  it("get_study hides internal fields and handles unknown ids", () => {
    const r = runTool("get_study", { id: "ms-09" });
    expect(r.ok).toBe(true);
    const s = r.out as Record<string, unknown>;
    expect(s.id).toBe("MS-09");
    expect(s).not.toHaveProperty("vec");
    expect(s).not.toHaveProperty("rob");
    expect(runTool("get_study", { id: "MS-99" }).ok).toBe(false);
  });
  it("get_risk_of_bias and search_protocol return the expected shapes", () => {
    const rob = runTool("get_risk_of_bias", { id: "MS-02" }).out as { tool: string; judgment: string };
    expect(rob).toMatchObject({ tool: "RoB 2", judgment: "some concerns" });
    const pr = runTool("search_protocol", { query: "MALDI-TOF molecular" }).out as { id: string }[];
    expect(pr[0].id).toBe("PR-2");
    expect(pr.every(c => c.id.startsWith("PR-"))).toBe(true);
  });
  it("capstone grader carries the full answer key", () => {
    for (const id of KEY.included) expect(research.capstoneGrader).toContain(id);
    for (const id of Object.keys(KEY.excluded)) expect(research.capstoneGrader).toContain(id);
    expect(research.capstoneGrader).toContain(SYNTHESIS_KEY.certainty);
  });
});

describe("retrieval", () => {
  it("each RAG question's needed chunk ranks in BM25's top 3", () => {
    for (const r of RAG_QUESTIONS) expect(search(r.q, 3).map(h => h.chunk.id), r.q).toContain(r.needs);
  });
  it("chunks abstracts by section with unique ids", () => {
    const ids = CHUNKS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("MS-09-M");
    expect(ids).toContain("MS-09-R");
    expect(CHUNKS.find(c => c.id === "MS-09-R")!.text.startsWith("Results:")).toBe(true);
  });
  it("the synonym example: BM25 misses eligible studies for 'bacteremia', vector search finds them", () => {
    const q = PRESETS.find(p => p.text === "bacteremia")!;
    const kw = keywordSearch(q.text);
    expect(kw.map(r => r.id)).toEqual(["MS-13"]); // only the study that says bacteremia was absent
    expect(kw.some(r => KEY.included.includes(r.id))).toBe(false);
    const vec = vectorSearch(q.vec, 3);
    expect(vec.every(r => KEY.included.includes(r.id))).toBe(true);
  });
  it("no eligible abstract uses the word 'bacteremia'", () => {
    for (const id of KEY.included) expect(STUDIES.find(s => s.id === id)!.abstract.toLowerCase()).not.toContain("bacteremia");
  });
  it("hybrid results include eligible studies and filters combine as OR within a field, AND across fields", () => {
    expect(hybridSearch(PRESETS[0]).some(r => KEY.included.includes(r.id))).toBe(true);
    const rct = FILTERS.find(f => f.id === "rct")!, cohort = FILTERS.find(f => f.id === "cohort")!, y = FILTERS.find(f => f.id === "y2022")!;
    const ms01 = STUDIES.find(s => s.id === "MS-01")!, ms04 = STUDIES.find(s => s.id === "MS-04")!;
    expect(applyFilters([rct, cohort], ms04)).toBe(true);
    expect(applyFilters([rct, y], ms01)).toBe(true);
    expect(applyFilters([cohort, y], ms04)).toBe(false); // 2020
  });
});

const VALID = /\[\[([a-z])\|([^\]]+)\]\]/g;
function allStrings(o: unknown, out: string[] = []): string[] {
  if (typeof o === "string") out.push(o);
  else if (Array.isArray(o)) o.forEach(x => allStrings(x, out));
  else if (o && typeof o === "object") Object.values(o).forEach(x => allStrings(x, out));
  return out;
}

describe("lesson content integrity", () => {
  const LAB_EVIDENCE: Record<string, string[]> = {
    "ri-screen": SCREEN_EV, "ri-semantic": SEMANTIC_EV, "ri-rag": RAG_EVIDENCE, "ri-mcp": MCP_EVIDENCE, "ri-capstone": Object.values(TOOL_EVIDENCE),
  };
  it("has five lessons with the expected ids and a live path", () => {
    expect(LESSONS.map(l => l.id)).toEqual(["ri-llm", "ri-vdb", "ri-rag", "ri-mcp", "ri-capstone"]);
    expect(PATH.status).toBe("live");
    expect(PATH.lessons).toBe(LESSONS);
    expect(LESSONS.filter(l => l.boss).map(l => l.id)).toEqual(["ri-capstone"]);
  });
  it("every lab key is registered and its evidence matches the brief", () => {
    for (const l of LESSONS) {
      expect(RESEARCH_LABS[l.lab], l.lab).toBeDefined();
      expect(l.brief.evidence, l.id).toEqual(LAB_EVIDENCE[l.lab]);
    }
  });
  it("non-boss lessons are deep: 5+ segments of 100-300 words, 3+ checks, 4 objectives, 4-point rubric, 5 quiz questions", () => {
    for (const l of LESSONS.filter(x => !x.boss)) {
      expect(l.lecture.length, l.id).toBeGreaterThanOrEqual(5);
      for (const s of l.lecture) {
        const words = s.body.split(/\s+/).length;
        expect(words, `${l.id} ${s.title}`).toBeGreaterThanOrEqual(100);
        expect(words, `${l.id} ${s.title}`).toBeLessThanOrEqual(300);
      }
      expect(l.lecture.filter(s => s.check).length, l.id).toBeGreaterThanOrEqual(3);
      expect(l.brief.objectives.length).toBe(4);
      expect(l.seminar.rubric.length).toBe(4);
      expect(l.quiz.length).toBe(5);
      expect(l.takeaways.length).toBe(4);
    }
  });
  it("every quiz and check question has 4 options and a valid answer", () => {
    for (const l of LESSONS) {
      for (const q of [...l.quiz, ...l.lecture.flatMap(s => (s.check ? [s.check] : []))]) {
        expect(q.options.length, q.q).toBe(4);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(4);
        expect(q.explain.length).toBeGreaterThan(10);
      }
    }
  });
  it("keyword markup uses only the four colour kinds and is balanced", () => {
    for (const s of allStrings(LESSONS)) {
      for (const m of s.matchAll(VALID)) expect("cbtw", s).toContain(m[1]);
      const stripped = s.replace(VALID, "");
      expect(stripped.includes("[[") || stripped.includes("]]"), s.slice(0, 80)).toBe(false);
    }
  });
});
