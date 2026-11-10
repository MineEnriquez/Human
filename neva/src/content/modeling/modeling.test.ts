import { describe, expect, it } from "vitest";
import { modeling, runTool } from "../../../server/paths/modeling";
import { MCP_EVIDENCE } from "../../labs/shared/McpLabView";
import { RAG_EVIDENCE } from "../../labs/shared/RagLabView";
import { checkBriefing } from "../../labs/modeling/BriefingRoom";
import { FIT_THRESHOLD } from "../../labs/modeling/ParameterLab";
import { HANDSHAKE } from "../../labs/modeling/McpLab";
import { MODELING_LABS } from "../../labs/modeling";
import { ANALOGUES, QUERY, cosine, euclidean, rank, unit } from "./analogues";
import { CHUNKS, RAG_QUESTIONS, search } from "./corpus";
import { BRIEFING_EVIDENCE, LESSONS, LLM_EVIDENCE, MCP_EVIDENCE_COPY, PATH, RAG_EVIDENCE_COPY, VDB_EVIDENCE } from "./lessons";
import {
  BRIEFING_KEY, CITY, OBSERVED, SCHOOL_CLOSURE, TODAY, TRUTH, expectedReported, finalSize, fitGrowthRate, growthFromR0,
  herdImmunityThreshold, logFitError, rFromGrowth, simulateSEIR, summarize,
} from "./model";

describe("SEIR simulator", () => {
  const run = simulateSEIR({ ...TRUTH, days: 200 });

  it("conserves the population every day", () => {
    for (const s of run) expect(s.S + s.E + s.I + s.R).toBeCloseTo(TRUTH.N, 6);
  });

  it("keeps every compartment non-negative", () => {
    for (const s of run) for (const v of [s.S, s.E, s.I, s.R, s.incidence]) expect(v).toBeGreaterThanOrEqual(-1e-9);
  });

  it("grows at the rate implied by R0 = (1 + r·latent)(1 + r·infectious)", () => {
    const r = growthFromR0(TRUTH.R0, TRUTH.latentDays, TRUTH.infectiousDays);
    expect(rFromGrowth(r, TRUTH.latentDays, TRUTH.infectiousDays)).toBeCloseTo(TRUTH.R0, 10);
    const clean = expectedReported(run, TRUTH.reportingFraction);
    expect(fitGrowthRate(clean, 14, 41).r).toBeCloseTo(r, 2);
  });

  it("has R0 = β/γ: with R0 = 1 an epidemic does not take off", () => {
    const flat = simulateSEIR({ ...TRUTH, R0: 1, days: 200 });
    expect(Math.max(...flat.map(s => s.incidence))).toBeLessThan(TRUTH.E0);
  });

  it("matches the final-size relation z = 1 - exp(-R0 z)", () => {
    const z = finalSize(TRUTH.R0);
    expect(z).toBeCloseTo(1 - Math.exp(-TRUTH.R0 * z), 10);
    const last = simulateSEIR({ ...TRUTH, days: 400 }).at(-1)!;
    expect(1 - last.S / TRUTH.N).toBeCloseTo(z, 2);
  });

  it("peaks in prevalence when S/N falls to about 1/R0", () => {
    let peak = run[0];
    for (const s of run) if (s.I > peak.I) peak = s;
    expect(peak.S / TRUTH.N).toBeCloseTo(1 / TRUTH.R0, 1);
  });

  it("computes the herd immunity threshold 1 - 1/R0", () => {
    expect(herdImmunityThreshold(2)).toBe(0.5);
    expect(herdImmunityThreshold(4)).toBe(0.75);
  });

  it("is deterministic", () => {
    expect(OBSERVED).toEqual(OBSERVED.slice());
    expect(OBSERVED).toHaveLength(TODAY);
    expect(OBSERVED.every(n => Number.isInteger(n) && n >= 0)).toBe(true);
  });
});

describe("growth-rate fit", () => {
  it("recovers r exactly from noise-free exponential data", () => {
    const series = Array.from({ length: 30 }, (_, d) => 5 * Math.exp(0.12 * d));
    const f = fitGrowthRate(series, 0, 29);
    expect(f.r).toBeCloseTo(0.12, 10);
    expect(f.doublingDays).toBeCloseTo(Math.log(2) / 0.12, 8);
    expect(f.r2).toBeCloseTo(1, 10);
  });

  it("returns NaN with too few points", () => {
    expect(Number.isNaN(fitGrowthRate([0, 0, 1], 0, 2).r)).toBe(true);
  });
});

describe("capstone answer key", () => {
  it("is consistent with the simulator", () => {
    const base = summarize(simulateSEIR({ ...TRUTH, days: 180 }), TRUTH.reportingFraction);
    const closed = summarize(simulateSEIR({ ...TRUTH, days: 180, interventionDay: SCHOOL_CLOSURE.day, contactReduction: SCHOOL_CLOSURE.contactReduction }), TRUTH.reportingFraction);
    expect(BRIEFING_KEY.peakDayUnmitigated).toBe(base.peakDay);
    expect(BRIEFING_KEY.closurePeakDay).toBe(closed.peakDay);
    expect(BRIEFING_KEY.closurePeakDay).toBeGreaterThan(BRIEFING_KEY.peakDayUnmitigated);
    expect(BRIEFING_KEY.peakReduction).toBeGreaterThan(0);
    expect(BRIEFING_KEY.closureAttackRate).toBeLessThan(BRIEFING_KEY.attackRateUnmitigated);
  });

  it("the R0 a learner gets from the observed data falls in the accepted range", () => {
    expect(BRIEFING_KEY.R0FromData).toBeGreaterThan(BRIEFING_KEY.R0Range[0]);
    expect(BRIEFING_KEY.R0FromData).toBeLessThan(BRIEFING_KEY.R0Range[1]);
    expect(BRIEFING_KEY.R0Range[0]).toBeLessThan(TRUTH.R0);
    expect(BRIEFING_KEY.R0Range[1]).toBeGreaterThan(TRUTH.R0);
  });

  it("using the incubation period instead of the latent period gives a different R0", () => {
    const wrong = rFromGrowth(BRIEFING_KEY.r, 4.1, 4);
    expect(wrong).toBeGreaterThan(BRIEFING_KEY.R0FromData);
  });

  it("checkBriefing accepts the key and rejects far-off answers", () => {
    expect(checkBriefing(2.05, BRIEFING_KEY.peakDayUnmitigated)).toEqual({ r0ok: true, peakOk: true });
    expect(checkBriefing(2.6, BRIEFING_KEY.peakDayUnmitigated + 20)).toEqual({ r0ok: false, peakOk: false });
    expect(checkBriefing(NaN, NaN)).toEqual({ r0ok: false, peakOk: false });
  });
});

describe("parameter-fitting lab", () => {
  it("the true parameters fit under the threshold; the starting sliders don't", () => {
    const fit = (R0: number, lat: number, inf: number, rep: number) =>
      logFitError(OBSERVED, expectedReported(simulateSEIR({ N: CITY.population, E0: 12, R0, latentDays: lat, infectiousDays: inf, days: TODAY }), rep).slice(0, TODAY));
    expect(fit(TRUTH.R0, TRUTH.latentDays, TRUTH.infectiousDays, TRUTH.reportingFraction)).toBeLessThan(FIT_THRESHOLD);
    expect(fit(2.8, 2, 6, 0.15)).toBeGreaterThan(FIT_THRESHOLD);
  });
});

describe("analogue library", () => {
  it("cosine ignores scale; raw Euclidean doesn't", () => {
    const a = [1, 2, 4, 8], b = a.map(x => x * 10);
    expect(cosine(a, b)).toBeCloseTo(1, 12);
    expect(euclidean(a, b)).toBeGreaterThan(50);
  });

  it("unit-length Euclidean ranks exactly like cosine", () => {
    const byCos = rank("cosine", ANALOGUES).map(r => r.a.id);
    const byUnit = rank("euclidean-normalised", ANALOGUES).map(r => r.a.id);
    expect(byUnit).toEqual(byCos);
    const u = unit(QUERY.vec), v = unit(ANALOGUES[0].vec);
    expect(euclidean(u, v) ** 2).toBeCloseTo(2 - 2 * cosine(u, v), 10);
  });

  it("shows the lesson's contrast: cosine favours the island, raw Euclidean the similar-size city", () => {
    expect(rank("cosine", ANALOGUES)[0].a.id).toBe("KI-22");
    expect(rank("euclidean", ANALOGUES)[0].a.id).toBe("MV-24");
  });

  it("the query vector is the observed weekly totals", () => {
    expect(QUERY.vec.reduce((a, b) => a + b, 0)).toBe(OBSERVED.reduce((a, b) => a + b, 0));
  });
});

describe("evidence library (RAG)", () => {
  it("has unique chunk ids", () => {
    expect(new Set(CHUNKS.map(c => c.id)).size).toBe(CHUNKS.length);
  });

  it.each(RAG_QUESTIONS)("retrieves the needed chunks in the top 3 for: $q", ({ q, needs }) => {
    const top = search(q, 3).map(h => h.chunk.id);
    for (const id of needs) expect(top).toContain(id);
  });
});

describe("server tools", () => {
  const ok = (name: string, input: unknown) => { const r = runTool(name, input); expect(r.ok).toBe(true); return r.out as any; };
  const bad = (name: string, input: unknown) => expect(runTool(name, input).ok).toBe(false);

  it("lists four strict-compatible tools", () => {
    expect(modeling.tools.map(t => t.name)).toEqual(["get_case_counts", "fit_growth_rate", "run_seir", "search_evidence"]);
    for (const t of modeling.tools) {
      expect(t.input_schema.additionalProperties).toBe(false);
      expect(Object.keys(t.input_schema.properties as object).sort()).toEqual([...(t.input_schema.required as string[])].sort());
    }
  });

  it("get_case_counts returns observed days and refuses the future", () => {
    const out = ok("get_case_counts", { start_day: 40, end_day: 41 });
    expect(out.days).toEqual([{ day: 40, reported: OBSERVED[40] }, { day: 41, reported: OBSERVED[41] }]);
    bad("get_case_counts", { start_day: 0, end_day: TODAY });
    bad("get_case_counts", { start_day: 10, end_day: 5 });
    bad("get_case_counts", { start_day: "0", end_day: 5 });
  });

  it("fit_growth_rate warns about the noisy first weeks", () => {
    const early = ok("fit_growth_rate", { start_day: 0, end_day: 41 });
    expect(early.warnings.length).toBeGreaterThan(0);
    const good = ok("fit_growth_rate", { start_day: 14, end_day: 41 });
    expect(good.r_per_day).toBeCloseTo(BRIEFING_KEY.r, 3);
    bad("fit_growth_rate", { start_day: 10, end_day: 12 });
  });

  it("run_seir projects and validates", () => {
    const out = ok("run_seir", { R0: 2, latent_days: 3, infectious_days: 4, reporting_fraction: 0.3, days: 180, intervention_day: null, contact_reduction: null });
    expect(out.peak_day).toBe(BRIEFING_KEY.peakDayUnmitigated);
    const closed = ok("run_seir", { R0: 2, latent_days: 3, infectious_days: 4, reporting_fraction: 0.3, days: 180, intervention_day: 45, contact_reduction: 0.25 });
    expect(closed.peak_day).toBe(BRIEFING_KEY.closurePeakDay);
    bad("run_seir", { R0: 2, latent_days: 3, infectious_days: 4, reporting_fraction: 0.3, days: 180 });
    bad("run_seir", { R0: 50, latent_days: 3, infectious_days: 4, reporting_fraction: 0.3, days: 180, intervention_day: null, contact_reduction: null });
  });

  it("search_evidence returns passages; unknown tools fail", () => {
    const out = ok("search_evidence", { query: "school closure contacts" });
    expect(out[0].id).toBe("CON-2");
    bad("search_evidence", { query: "" });
    bad("delete_everything", {});
  });

  it("grader prompt carries the derived answer key", () => {
    expect(modeling.capstoneGrader).toContain(`day ${BRIEFING_KEY.peakDayUnmitigated}`);
    expect(modeling.capstoneGrader).toContain(`day ${BRIEFING_KEY.closurePeakDay}`);
  });
});

describe("lesson content", () => {
  it("is a live path with five lessons and a boss capstone", () => {
    expect(PATH.status).toBe("live");
    expect(LESSONS.map(l => l.id)).toEqual(["om-llm", "om-vdb", "om-rag", "om-mcp", "om-capstone"]);
    expect(LESSONS.at(-1)!.boss).toBe(true);
  });

  it("every lab key is registered", () => {
    for (const l of LESSONS) expect(MODELING_LABS[l.lab]).toBeDefined();
  });

  it("evidence strings match what the labs award", () => {
    expect(RAG_EVIDENCE_COPY).toEqual(RAG_EVIDENCE);
    expect(MCP_EVIDENCE_COPY).toEqual(MCP_EVIDENCE);
    const byId = Object.fromEntries(LESSONS.map(l => [l.id, l.brief.evidence]));
    expect(byId["om-llm"]).toEqual(LLM_EVIDENCE);
    expect(byId["om-vdb"]).toEqual(VDB_EVIDENCE);
    expect(byId["om-rag"]).toEqual(RAG_EVIDENCE);
    expect(byId["om-mcp"]).toEqual(MCP_EVIDENCE);
    expect(byId["om-capstone"]).toEqual(BRIEFING_EVIDENCE);
  });

  it.each(LESSONS.filter(l => !l.boss))("$id has deep lectures, valid checks and quizzes", l => {
    expect(l.lecture.length).toBeGreaterThanOrEqual(5);
    expect(l.lecture.filter(s => s.check).length).toBeGreaterThanOrEqual(3);
    for (const s of l.lecture) {
      const words = s.body.split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(110);
      expect(words).toBeLessThanOrEqual(260);
    }
    expect(l.quiz).toHaveLength(5);
    for (const q of [...l.quiz, ...l.lecture.flatMap(s => (s.check ? [s.check] : []))]) {
      expect(q.options).toHaveLength(4);
      expect(q.answer).toBeGreaterThanOrEqual(0);
      expect(q.answer).toBeLessThan(4);
      expect(new Set(q.options).size).toBe(4);
    }
    expect(l.seminar.rubric).toHaveLength(4);
    expect(l.brief.objectives).toHaveLength(4);
    expect(l.takeaways).toHaveLength(4);
  });

  it("uses only valid keyword markup", () => {
    const text = JSON.stringify(LESSONS);
    for (const m of text.matchAll(/\[\[([^|\]]*)\|/g)) expect(["c", "b", "t", "w"]).toContain(m[1]);
    expect((text.match(/\[\[/g) || []).length).toBe((text.match(/\]\]/g) || []).length);
  });

  it("the MCP handshake starts with initialize and ends with the result going back to the LLM", () => {
    expect(HANDSHAKE[1].label).toContain("initialize");
    expect(HANDSHAKE[3].label).toContain("notifications/initialized");
  });
});
