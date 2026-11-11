// Disease Modeling (tuberculosis): lab agent tools over the fictional Kestrel Valley District data and TB model.
import { z } from "zod";
import { CHUNKS, search } from "../../src/content/modeling/corpus.js";
import { BUDGET_PER_YEAR, DISTRICT, HORIZON, NOTIFICATIONS, START_YEAR, STRATEGIES, STRATEGY_KEY, fitModel, per100k, runTb, strategyImpact, type Strategy } from "../../src/content/modeling/model.js";
import type { ServerPath, ToolDef, ToolResult } from "./types.js";

const num = (d: string) => ({ type: "number", description: d });
const numOrNull = (d: string) => ({ type: ["number", "null"], description: d + " Use null for the programme's baseline value." });
const STRATEGY_IDS = Object.keys(STRATEGIES) as Strategy[];

const TOOLS: ToolDef[] = [
  { name: "get_notifications", description: `Annual TB notifications (people diagnosed and started on treatment) in ${DISTRICT.name}, population ${DISTRICT.population.toLocaleString("en-US")}. Data exist for 2015-2025 only.`, input_schema: { type: "object", properties: { start_year: num("First year, 2015 or later."), end_year: num("Last year, at most 2025.") }, required: ["start_year", "end_year"], additionalProperties: false } },
  { name: "fit_tb_model", description: "Fit the district TB model's transmission (beta) and case detection rate (delta) to the 2015-2025 notifications by grid search, optionally also to a prevalence survey value. Returns the best fit, its implied 2019 prevalence, 2025 incidence and case detection, and the next-best alternatives.", input_schema: { type: "object", properties: { prevalence_per_100k: { type: ["number", "null"], description: "Active TB not on treatment per 100,000 from a prevalence survey (2019), or null to fit notifications only." } }, required: ["prevalence_per_100k"], additionalProperties: false } },
  { name: "run_tb_model", description: `Run the deterministic district TB model from 2015 to end_year and return yearly incidence, notifications and TB deaths per 100,000. A strategy, if given, starts in ${START_YEAR}. In-memory computation only; nothing is saved or published.`, input_schema: { type: "object", properties: { beta: numOrNull("Effective contacts per active case per year, 4-30."), delta: numOrNull("Case detection rate per year, 0.1-3."), strategy: { anyOf: [{ type: "string", enum: STRATEGY_IDS }, { type: "null" }], description: `One of ${STRATEGY_IDS.join(", ")}, or null for baseline.` }, end_year: num(`Last year to simulate, 2016-2045.`) }, required: ["beta", "delta", "strategy", "end_year"], additionalProperties: false } },
  { name: "search_evidence", description: "Search the TB programme's evidence library (background notes, Kestrel Contact Cohort, prevalence survey, pilots, budget note, projection SOP). Returns the best-matching passages with ids.", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false } },
];

const year = z.number().int().min(2015).max(2025);
const Inputs = {
  get_notifications: z.object({ start_year: year, end_year: year }).refine(v => v.end_year >= v.start_year, "end_year must be >= start_year"),
  fit_tb_model: z.object({ prevalence_per_100k: z.number().min(1).max(5000).nullable() }),
  run_tb_model: z.object({
    beta: z.number().min(4).max(30).nullable(), delta: z.number().min(0.1).max(3).nullable(),
    strategy: z.enum(STRATEGY_IDS as [Strategy, ...Strategy[]]).nullable(), end_year: z.number().int().min(2016).max(2045),
  }),
  search_evidence: z.object({ query: z.string().min(1) }),
};

const r1 = (x: number) => Math.round(x * 10) / 10;
const r3 = (x: number) => Math.round(x * 1000) / 1000;

export function runTool(name: string, input: unknown): ToolResult {
  const schema = Inputs[name as keyof typeof Inputs];
  if (!schema) return { ok: false, out: `Unknown tool ${name}` };
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, out: "INVALID_INPUT: " + p.error.issues.map(i => `${i.path.join(".") || "input"}: ${i.message}`).join("; ") };
  switch (name) {
    case "get_notifications": {
      const v = p.data as z.infer<typeof Inputs.get_notifications>;
      const rows = NOTIFICATIONS.filter(n => n.year >= v.start_year && n.year <= v.end_year).map(n => ({ year: n.year, notified: n.notified, per_100k: r1(per100k(n.notified)) }));
      return { ok: true, out: { unit: "people notified per year", population: DISTRICT.population, rows } };
    }
    case "fit_tb_model": {
      const v = p.data as z.infer<typeof Inputs.fit_tb_model>;
      const { best, alternatives } = fitModel(v.prevalence_per_100k);
      const show = (f: typeof best) => ({ beta: f.beta, delta: f.delta, fit_error: r3(f.error * 1000), prevalence_2019_per_100k: Math.round(f.prevalence2019), incidence_2025_per_100k: r1(per100k(f.incidence2025)), case_detection_2025: r3(f.caseDetection2025) });
      const warnings = v.prevalence_per_100k == null
        ? ["Fitted to notifications only: several (beta, delta) pairs fit almost equally well, with very different incidence. Add independent evidence on undetected TB before trusting the incidence estimate."]
        : [];
      return { ok: true, out: { fitted_to: v.prevalence_per_100k == null ? "notifications 2015-2025" : `notifications 2015-2025 + prevalence ${v.prevalence_per_100k}/100k (2019)`, best: show(best), alternatives: alternatives.slice(0, 4).map(show), warnings, note: "fit_error is the mean squared relative error ×1000; lower is better." } };
    }
    case "run_tb_model": {
      const v = p.data as z.infer<typeof Inputs.run_tb_model>;
      const params = { ...(v.beta != null ? { beta: v.beta } : {}), ...(v.delta != null ? { delta: v.delta } : {}) };
      const strategy = v.strategy || "baseline";
      const rows = runTb({ params, strategy, endYear: v.end_year }).map(y => ({ year: y.year, incidence_per_100k: r1(per100k(y.incidence)), notifications_per_100k: r1(per100k(y.notifications)), tb_deaths_per_100k: r1(per100k(y.tbDeaths)) }));
      const s = STRATEGIES[strategy];
      const impact = strategy !== "baseline" && v.end_year >= HORIZON ? strategyImpact(strategy, params) : null;
      return { ok: true, out: { assumptions: { ...v, strategy, strategy_starts: START_YEAR, strategy_effect: s.describe, cost_per_year: s.costPerYear }, rows, ...(impact ? { [`cases_averted_${START_YEAR}_${HORIZON}`]: Math.round(impact.casesAverted), [`incidence_reduction_${HORIZON}_vs_baseline`]: r3(impact.reduction), cost_per_case_averted: Math.round(impact.costPerCaseAverted) } : {}), note: "Deterministic projection under the stated assumptions, not a prediction." } };
    }
    case "search_evidence":
      return { ok: true, out: search((p.data as { query: string }).query, 3).map(r => ({ id: r.chunk.id, title: r.chunk.title, text: r.chunk.text })) };
  }
  return { ok: false, out: "unreachable" };
}

const k = STRATEGY_KEY;
const pct = (x: number) => Math.round(x * 1000) / 10;
const usd = (x: number) => "$" + Math.round(x).toLocaleString("en-US");
const strategyLines = k.strategies.map(s => `${STRATEGIES[s.strategy].label} (${usd(STRATEGIES[s.strategy].costPerYear)}/year): 2035 incidence ${Math.round(s.perHundredK)}/100k, ${pct(s.reduction)}% below baseline, ${Math.round(s.casesAverted)} cases averted ${START_YEAR}-${HORIZON}, ${usd(s.costPerCaseAverted)} per case averted`).join("; ");

export const modeling: ServerPath = {
  id: "disease-modeling",
  title: "Disease Modeling",
  setting: `fictional ${DISTRICT.name} (population ${DISTRICT.population.toLocaleString("en-US")}), a high-burden tuberculosis (TB) district whose programme must choose which strategy to fund to reduce TB incidence by ${HORIZON}, using a TB compartmental model`,
  chunks: CHUNKS,
  search,
  tools: TOOLS,
  runTool,
  agentPrompt: `You are the AI modelling assistant for the ${DISTRICT.name} TB programme (fictional teaching case). Notification data exist for 2015-2025; strategies would start in ${START_YEAR}. A learner is leading the analysis and directs you. Use your tools to fetch notifications, fit the model, run strategy projections and look up evidence; never invent numbers. Report what tool results show, explain the method briefly, and point out caveats (notifications are not incidence, identifiability without the prevalence survey, illustrative parameters, projections vs predictions, drug resistance and HIV not modelled). Do not hand the learner the final answers: if they ask outright for the 2025 incidence, the best strategy or the recommendation, show the evidence and ask a question that helps them decide. Do not give individual treatment advice. Keep replies under 170 words.`,
  capstoneGrader: `You are Otto grading the capstone of the Disease Modeling path (fictional ${DISTRICT.name}, tuberculosis). Answer key: notifications are about ${k.notifications2025} people in 2025 (about ${Math.round(per100k(k.notifications2025))}/100k). Fitting the model to notifications alone is not identifiable (more TB with poorer detection fits about as well); adding the 2019 prevalence survey (about ${k.prevalence2019}/100k not on treatment, PREV-1) gives 2025 incidence of about ${Math.round(k.incidence2025)} cases (${Math.round(k.incidence2025PerHundredK)}/100k; accept within ±${k.incidenceTolerance * 100}%), so the programme detects about ${Math.round(k.caseDetection2025 * 100)}% of incident cases. Baseline 2035 incidence stays about ${Math.round(k.baseline2035PerHundredK)}/100k. Strategies from ${START_YEAR}: ${strategyLines}. The largest 2035 reduction among single strategies is active case finding; the best option within the ${usd(BUDGET_PER_YEAR)}/year budget (BUD-1) is preventive treatment for household contacts combined with adherence support (largest 2035 reduction and most cases averted); preventive treatment alone is the best value per case averted. Active case finding first raises notifications as undetected cases are found (ACF-1), which a strong answer anticipates. A strong recommendation compares options within the budget, uses cases averted and cost per case averted as well as 2035 incidence, states assumptions and uncertainties (illustrative effect sizes, survey interval, drug resistance and HIV not modelled, homogeneous mixing), labels results as projections, and follows SOP-1 (second-modeller review and Director sign-off). Score out of 10: incidence estimate with the right method (notifications + prevalence survey) 3, projections and strategy comparison 3, recommendation within budget with trade-offs 2, assumptions and uncertainty 1, quality of reasoning 1.`,
};
