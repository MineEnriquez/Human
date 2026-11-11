import { describe, expect, it } from "vitest";
import { modeling, runTool } from "../../../server/paths/modeling";
import { MCP_EVIDENCE } from "../../labs/shared/McpLabView";
import { RAG_EVIDENCE } from "../../labs/shared/RagLabView";
import { checkStrategy } from "../../labs/modeling/StrategyRoom";
import { FIT_THRESHOLD } from "../../labs/modeling/ParameterLab";
import { HANDSHAKE } from "../../labs/modeling/McpLab";
import { MODELING_LABS } from "../../labs/modeling";
import { stageRewards, totalXp } from "../../lib/rewards";
import { ANALOGUES, QUERY, cosine, euclidean, rank, unit } from "./analogues";
import { CHUNKS, RAG_QUESTIONS, search } from "./corpus";
import { DOSSIER, SCENES } from "./dossier";
import { LESSONS, LLM_EVIDENCE, MCP_EVIDENCE_COPY, PATH, RAG_EVIDENCE_COPY, STRATEGY_EVIDENCE, VDB_EVIDENCE } from "./lessons";
import {
  BASE, BUDGET_PER_YEAR, DISTRICT, NOTIFICATIONS, PREVALENCE_SURVEY, START_YEAR, STRATEGIES, STRATEGY_KEY, TRUTH,
  fitError, fitModel, per100k, rateFromRisk, riskFromRate, runTb, strategyImpact, type Strategy,
} from "./model";

const sum = (y: { S: number; Lr: number; Lt: number; I: number; T: number; R: number }) => y.S + y.Lr + y.Lt + y.I + y.T + y.R;

describe("TB model", () => {
  const run = runTb({ endYear: 2045 });

  it("keeps the population constant (births replace all deaths) and never goes negative", () => {
    for (const y of run) {
      expect(sum(y)).toBeCloseTo(DISTRICT.population, 3);
      for (const v of [y.S, y.Lr, y.Lt, y.I, y.T, y.R, y.incidence, y.notifications, y.tbDeaths]) expect(v).toBeGreaterThanOrEqual(0);
    }
  });

  it("starts at the endemic equilibrium: baseline incidence stays flat", () => {
    const first = run[0].incidence, last = run.at(-1)!.incidence;
    expect(Math.abs(last - first) / first).toBeLessThan(0.01);
  });

  it("dies out without transmission and settles higher with more transmission", () => {
    const none = runTb({ params: { beta: 4 }, endYear: 2035 }).at(-1)!.incidence;
    const more = runTb({ params: { beta: 18 }, endYear: 2035 }).at(-1)!.incidence;
    expect(more).toBeGreaterThan(run.find(y => y.year === 2035)!.incidence);
    expect(none).toBeLessThan(run.find(y => y.year === 2035)!.incidence);
  });

  it("is a high-burden district with incidence above notifications", () => {
    const y = run.find(r => r.year === 2025)!;
    expect(per100k(y.incidence)).toBeGreaterThan(150);
    expect(y.notifications).toBeLessThan(y.incidence);
  });

  it("matches the natural history the lessons describe", () => {
    const share = BASE.eps / (BASE.eps + BASE.kappa + BASE.mu);
    expect(share).toBeGreaterThan(0.06); // about 7% of recent infections progress...
    expect(share).toBeLessThan(0.08);
    expect(1 / (BASE.eps + BASE.kappa)).toBeCloseTo(1, 5); // ...after about one year, on average, in the recent stage
    expect(riskFromRate(BASE.nu, 40)).toBeCloseTo(0.024, 3); // remote reactivation over 40 years
    expect(1 / BASE.tau).toBeCloseTo(0.5, 10); // six months of treatment
  });
});

describe("rate / risk conversions", () => {
  it("are inverses and match the constant-rate formula", () => {
    expect(riskFromRate(1, 1)).toBeCloseTo(1 - Math.exp(-1), 12);
    expect(rateFromRisk(riskFromRate(0.3, 2), 2)).toBeCloseTo(0.3, 12);
    expect(riskFromRate(0.01, 1)).toBeCloseTo(0.01, 3); // small rate·t: risk ≈ rate·t
  });
});

describe("fitting and identifiability", () => {
  it("the truth fits the noisy notifications within the lab's threshold", () => {
    expect(fitError(runTb({ endYear: 2025 }))).toBeLessThan(FIT_THRESHOLD);
  });

  it("notifications alone are not identified: a wrong (beta, delta) pair fits about as well", () => {
    const { best, alternatives } = fitModel(null);
    const fits = [best, ...alternatives];
    const truthLike = fits.find(f => f.beta === TRUTH.beta && Math.abs(f.delta - TRUTH.delta) < 1e-9);
    const wrong = fits.find(f => f.beta !== TRUTH.beta);
    expect(truthLike).toBeDefined();
    expect(wrong).toBeDefined();
    expect(Math.abs(wrong!.incidence2025 - truthLike!.incidence2025) / truthLike!.incidence2025).toBeGreaterThan(0.1);
    expect(fitError(runTb({ params: { beta: wrong!.beta, delta: wrong!.delta }, endYear: 2025 }))).toBeLessThan(FIT_THRESHOLD);
  });

  it("adding the prevalence survey recovers the true parameters", () => {
    const { best } = fitModel(PREVALENCE_SURVEY.perHundredK);
    expect(best.beta).toBe(TRUTH.beta);
    expect(best.delta).toBeCloseTo(TRUTH.delta, 9);
  });

  it("the survey value is the model's 2019 prevalence, rounded", () => {
    const y = runTb({ endYear: 2019 }).find(r => r.year === 2019)!;
    expect(Math.abs(PREVALENCE_SURVEY.perHundredK - per100k(y.I))).toBeLessThanOrEqual(5);
  });

  it("observed notifications stay within 4% of the model (deterministic noise)", () => {
    const run = runTb({ endYear: 2025 });
    for (const n of NOTIFICATIONS) {
      const m = run.find(y => y.year === n.year)!.notifications;
      expect(Math.abs(n.notified - m) / m).toBeLessThanOrEqual(0.04 + 1e-9);
    }
  });
});

describe("strategy answer key (derived from the model)", () => {
  const k = STRATEGY_KEY;
  it("2025 incidence and case detection come from the true model", () => {
    const y = runTb({ endYear: 2025 }).find(r => r.year === 2025)!;
    expect(k.incidence2025).toBeCloseTo(y.incidence, 6);
    expect(k.caseDetection2025).toBeCloseTo(y.notifications / y.incidence, 9);
    expect(k.caseDetection2025).toBeGreaterThan(0.6);
    expect(k.caseDetection2025).toBeLessThan(0.8);
  });

  it("every strategy lowers 2035 incidence below baseline and averts cases", () => {
    for (const s of k.strategies) {
      expect(s.reduction, s.strategy).toBeGreaterThan(0);
      expect(s.casesAverted, s.strategy).toBeGreaterThan(0);
      expect(strategyImpact(s.strategy).incidence2035).toBeCloseTo(s.incidence2035, 6);
    }
  });

  it("documents the decision: ACF is the strongest single option; TPT + adherence wins within budget; TPT is best value", () => {
    expect(k.largestSingle).toBe("acf");
    expect(k.largestWithinBudget).toBe("tpt_treatment");
    expect(k.mostCasesAverted).toBe("tpt_treatment");
    expect(k.bestValue).toBe("tpt");
    expect(STRATEGIES.tpt_treatment.costPerYear).toBeLessThanOrEqual(BUDGET_PER_YEAR);
    expect(STRATEGIES.acf.costPerYear).toBeLessThanOrEqual(BUDGET_PER_YEAR);
  });

  it("strategies only start in the start year", () => {
    const base = runTb({ endYear: 2035 }), acf = runTb({ strategy: "acf", endYear: 2035 });
    for (let i = 0; i < base.length; i++) if (base[i].year < START_YEAR) expect(acf[i].incidence).toBeCloseTo(base[i].incidence, 9);
    // Case finding first raises notifications (missed cases found), as the evidence says.
    const yr = (r: typeof base) => r.find(y => y.year === START_YEAR)!.notifications;
    expect(yr(acf)).toBeGreaterThan(yr(base));
  });

  it("the capstone check accepts the key and rejects notifications-as-incidence", () => {
    expect(checkStrategy(k.incidence2025PerHundredK, "acf")).toEqual({ incOk: true, strategyOk: true });
    expect(checkStrategy(per100k(k.notifications2025), "tpt")).toEqual({ incOk: false, strategyOk: false });
  });
});

describe("analogue library (vector database lab)", () => {
  it("cosine ignores level; raw Euclidean doesn't", () => {
    const a = [100, 100, 100], b = a.map(x => x * 3);
    expect(cosine(a, b)).toBeCloseTo(1, 12);
    expect(euclidean(a, b)).toBeGreaterThan(300);
  });

  it("unit-length Euclidean ranks exactly like cosine", () => {
    expect(rank("euclidean-normalised", ANALOGUES).map(r => r.a.id)).toEqual(rank("cosine", ANALOGUES).map(r => r.a.id));
    const u = unit(QUERY.vec), v = unit(ANALOGUES[0].vec);
    expect(euclidean(u, v) ** 2).toBeCloseTo(2 - 2 * cosine(u, v), 10);
  });

  it("shows the lesson's contrast: cosine favours high-HIV Sable Coast, raw Euclidean favours Calloway Town", () => {
    expect(rank("cosine", ANALOGUES)[0].a.id).toBe("SC");
    expect(rank("euclidean", ANALOGUES)[0].a.id).toBe("CT");
    const sc = ANALOGUES.find(a => a.id === "SC")!;
    expect(sc.hiv).toBe("high");
  });

  it("the query vector is the observed notifications per 100,000", () => {
    expect(QUERY.vec).toHaveLength(NOTIFICATIONS.length);
    expect(QUERY.vec[0]).toBe(Math.round(per100k(NOTIFICATIONS[0].notified)));
  });

  it("case-finding districts show a rise then a fall", () => {
    for (const a of ANALOGUES.filter(x => x.acf)) {
      const peak = Math.max(...a.vec);
      const i = a.vec.indexOf(peak);
      expect(peak).toBeGreaterThan(a.vec[0]);
      expect(a.vec.at(-1)!).toBeLessThan(a.vec[0]);
      expect(i).toBeGreaterThan(0);
    }
  });
});

describe("evidence library (RAG)", () => {
  it("has unique chunk ids and quotes the survey value", () => {
    expect(new Set(CHUNKS.map(c => c.id)).size).toBe(CHUNKS.length);
    expect(CHUNKS.find(c => c.id === "PREV-1")!.text).toContain(`${PREVALENCE_SURVEY.perHundredK} people with active TB per 100,000`);
  });

  it.each(RAG_QUESTIONS)("retrieves the needed chunks in the top 3 for: $q", ({ q, needs }) => {
    const top = search(q, 3).map(h => h.chunk.id);
    for (const id of needs) expect(top).toContain(id);
  });

  it("pilot effect sizes in the evidence match the model's strategies", () => {
    expect(CHUNKS.find(c => c.id === "ACF-1")!.text).toContain("0.70 to 1.10");
    expect(BASE.delta).toBeCloseTo(0.7, 9);
    expect(STRATEGIES.acf.apply(BASE).delta).toBeCloseTo(1.1, 9);
    expect(STRATEGIES.tpt.apply(BASE).eps).toBeCloseTo(BASE.eps * 0.8, 12);
    expect(STRATEGIES.treatment.apply(BASE).s).toBeCloseTo(0.9, 9);
  });
});

describe("server tools", () => {
  const ok = (name: string, input: unknown) => { const r = runTool(name, input); expect(r.ok, JSON.stringify(r.out)).toBe(true); return r.out as any; };
  const bad = (name: string, input: unknown) => expect(runTool(name, input).ok).toBe(false);

  it("lists four strict-compatible tools", () => {
    expect(modeling.id).toBe("disease-modeling");
    expect(modeling.tools.map(t => t.name)).toEqual(["get_notifications", "fit_tb_model", "run_tb_model", "search_evidence"]);
    for (const t of modeling.tools) {
      expect(t.input_schema.additionalProperties).toBe(false);
      expect(Object.keys(t.input_schema.properties as object).sort()).toEqual([...(t.input_schema.required as string[])].sort());
    }
  });

  it("get_notifications returns observed years and refuses the future", () => {
    const out = ok("get_notifications", { start_year: 2024, end_year: 2025 });
    expect(out.rows.map((r: any) => r.notified)).toEqual(NOTIFICATIONS.slice(-2).map(n => n.notified));
    bad("get_notifications", { start_year: 2015, end_year: 2026 });
    bad("get_notifications", { start_year: 2020, end_year: 2018 });
    bad("get_notifications", { start_year: "2015", end_year: 2020 });
  });

  it("fit_tb_model warns without the survey and recovers the truth with it", () => {
    const blind = ok("fit_tb_model", { prevalence_per_100k: null });
    expect(blind.warnings.length).toBeGreaterThan(0);
    const fitted = ok("fit_tb_model", { prevalence_per_100k: PREVALENCE_SURVEY.perHundredK });
    expect(fitted.best.beta).toBe(TRUTH.beta);
    expect(fitted.best.incidence_2025_per_100k).toBeCloseTo(STRATEGY_KEY.incidence2025PerHundredK, 0);
    bad("fit_tb_model", {});
    bad("fit_tb_model", { prevalence_per_100k: -3 });
  });

  it("run_tb_model projects strategies and validates input", () => {
    const base = ok("run_tb_model", { beta: null, delta: null, strategy: null, end_year: 2035 });
    expect(base.rows.at(-1).year).toBe(2035);
    const tpt = ok("run_tb_model", { beta: null, delta: null, strategy: "tpt", end_year: 2035 });
    expect(tpt.rows.at(-1).incidence_per_100k).toBeLessThan(base.rows.at(-1).incidence_per_100k);
    expect(tpt[`cases_averted_${START_YEAR}_2035`]).toBe(Math.round(strategyImpact("tpt").casesAverted));
    bad("run_tb_model", { beta: null, delta: null, strategy: "magic", end_year: 2035 });
    bad("run_tb_model", { beta: 100, delta: null, strategy: null, end_year: 2035 });
    bad("run_tb_model", { strategy: null, end_year: 2035 });
  });

  it("search_evidence returns passages; unknown tools fail", () => {
    const out = ok("search_evidence", { query: "prevalence survey undetected active TB" });
    expect(out.map((r: any) => r.id)).toContain("PREV-1");
    bad("search_evidence", { query: "" });
    bad("delete_everything", {});
  });

  it("grader prompt carries the derived answer key", () => {
    expect(modeling.capstoneGrader).toContain(`${Math.round(STRATEGY_KEY.incidence2025PerHundredK)}/100k`);
    expect(modeling.capstoneGrader).toContain(`${STRATEGY_KEY.prevalence2019}/100k`);
    for (const s of STRATEGY_KEY.strategies) expect(modeling.capstoneGrader).toContain(STRATEGIES[s.strategy as Strategy].label);
  });
});

describe("lesson content", () => {
  it("is a live path with five lessons and a boss capstone", () => {
    expect(PATH.id).toBe("disease-modeling");
    expect(PATH.title).toBe("Disease Modeling");
    expect(PATH.status).toBe("live");
    expect(LESSONS.map(l => l.id)).toEqual(["dm-llm", "dm-vdb", "dm-rag", "dm-mcp", "dm-capstone"]);
    expect(LESSONS.at(-1)!.boss).toBe(true);
  });

  it("every lab key is registered", () => {
    for (const l of LESSONS) expect(MODELING_LABS[l.lab]).toBeDefined();
  });

  it("evidence strings match what the labs award", () => {
    expect(RAG_EVIDENCE_COPY).toEqual(RAG_EVIDENCE);
    expect(MCP_EVIDENCE_COPY).toEqual(MCP_EVIDENCE);
    const byId = Object.fromEntries(LESSONS.map(l => [l.id, l.brief.evidence]));
    expect(byId["dm-llm"]).toEqual(LLM_EVIDENCE);
    expect(byId["dm-vdb"]).toEqual(VDB_EVIDENCE);
    expect(byId["dm-rag"]).toEqual(RAG_EVIDENCE);
    expect(byId["dm-mcp"]).toEqual(MCP_EVIDENCE);
    expect(byId["dm-capstone"]).toEqual(STRATEGY_EVIDENCE);
  });

  it.each(LESSONS.filter(l => !l.boss))("$id has deep lectures, valid checks and quizzes", l => {
    expect(l.lecture.length).toBeGreaterThanOrEqual(5);
    expect(l.lecture.filter(s => s.check).length).toBeGreaterThanOrEqual(3);
    for (const s of l.lecture) {
      const words = s.body.split(/\s+/).length;
      expect(words, s.title).toBeGreaterThanOrEqual(100);
      expect(words, s.title).toBeLessThanOrEqual(260);
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
    const text = [JSON.stringify(LESSONS), JSON.stringify(DOSSIER), JSON.stringify(SCENES)].join(" ");
    for (const m of text.matchAll(/\[\[([^|\]]*)\|/g)) expect(["c", "b", "t", "w"]).toContain(m[1]);
    expect((text.match(/\[\[/g) || []).length).toBe((text.match(/\]\]/g) || []).length);
  });

  it("the MCP handshake includes the initialize result and notifications/initialized", () => {
    expect(HANDSHAKE[1].label).toContain("initialize");
    expect(HANDSHAKE[2].label).toContain("initialize result");
    expect(HANDSHAKE[3].label).toContain("notifications/initialized");
  });
});

describe("Disease Modeling case dossier", () => {
  it("pins every case to the timeline once, in order", () => {
    expect(DOSSIER.timeline.filter(t => t.lesson).map(t => t.lesson)).toEqual(PATH.lessons.map(l => l.id));
  });

  it("gives every case a scene: who asks, when, the deliverable, success criteria and a hook", () => {
    for (const l of PATH.lessons) {
      const sc = SCENES[l.id];
      expect(sc, l.id).toBeDefined();
      expect(l.hook).toBe(sc.hook);
      expect(l.brief.from?.name).toBe(sc.from.name);
      expect(l.brief.success?.length).toBeGreaterThanOrEqual(3);
      expect(DOSSIER.cast.map(c => c.name)).toContain(sc.from.name);
      expect(DOSSIER.timeline.find(t => t.lesson === l.id)!.when.slice(0, 8)).toBe(sc.when.slice(0, 8));
    }
  });

  it("quotes the data it summarises", () => {
    expect(DOSSIER.summary).toContain(NOTIFICATIONS.at(-1)!.notified.toLocaleString("en-US"));
    expect(JSON.stringify(DOSSIER.timeline)).toContain(`${PREVALENCE_SURVEY.perHundredK} per 100,000`);
  });

  it("shows sensible rewards for every stage", () => {
    for (const l of PATH.lessons) {
      expect(Object.keys(stageRewards(l))).toContain("lab");
      expect(totalXp(l)).toBeGreaterThan(200);
    }
  });
});
