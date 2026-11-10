// Outbreak Modeling: lab agent tools over the fictional Port Calder surveillance data and SEIR simulator.
import { z } from "zod";
import { CHUNKS, search } from "../../src/content/modeling/corpus";
import { BRIEFING_KEY, CITY, OBSERVED, TODAY, fitGrowthRate, simulateSEIR, summarize } from "../../src/content/modeling/model";
import type { ServerPath, ToolDef, ToolResult } from "./types";

const num = (d: string) => ({ type: "number", description: d });
const numOrNull = (d: string) => ({ type: ["number", "null"], description: d + " Use null for none." });

const TOOLS: ToolDef[] = [
  { name: "get_case_counts", description: `Daily reported CRV cases in Port Calder for a range of days. Data exist for day 0 to day ${TODAY - 1} only (today is day ${TODAY}).`, input_schema: { type: "object", properties: { start_day: num("First day, 0 or later."), end_day: num(`Last day, at most ${TODAY - 1}.`) }, required: ["start_day", "end_day"], additionalProperties: false } },
  { name: "fit_growth_rate", description: "Log-linear least-squares fit of ln(reported cases) against day over a window of observed days. Returns the growth rate r per day, doubling time and R².", input_schema: { type: "object", properties: { start_day: num("First day of the window."), end_day: num(`Last day of the window (at most ${TODAY - 1}).`) }, required: ["start_day", "end_day"], additionalProperties: false } },
  { name: "run_seir", description: "Run the deterministic SEIR model for Port Calder (population 250,000, 12 people exposed on day 0) and summarise it. In-memory computation only; nothing is saved or published.", input_schema: { type: "object", properties: { R0: num("Basic reproduction number, 0.5-6."), latent_days: num("Mean latent period in days, 0.5-14."), infectious_days: num("Mean infectious period in days, 0.5-21."), reporting_fraction: num("Fraction of infections reported, 0.01-1."), days: num("Days to simulate, 1-365."), intervention_day: numOrNull("Day from which contacts are reduced."), contact_reduction: numOrNull("Fraction of transmission removed from intervention_day, 0-0.9.") }, required: ["R0", "latent_days", "infectious_days", "reporting_fraction", "days", "intervention_day", "contact_reduction"], additionalProperties: false } },
  { name: "search_evidence", description: "Search the modeling cell's evidence library (household study, viral culture substudy, seroprevalence pilot, contact survey, method notes, forecast SOP). Returns the best-matching passages with ids.", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false } },
];

const day = z.number().int().min(0).max(TODAY - 1);
const Inputs = {
  get_case_counts: z.object({ start_day: day, end_day: day }).refine(v => v.end_day >= v.start_day, "end_day must be >= start_day"),
  fit_growth_rate: z.object({ start_day: day, end_day: day }).refine(v => v.end_day - v.start_day >= 4, "window must span at least 5 days"),
  run_seir: z.object({
    R0: z.number().min(0.5).max(6), latent_days: z.number().min(0.5).max(14), infectious_days: z.number().min(0.5).max(21),
    reporting_fraction: z.number().min(0.01).max(1), days: z.number().int().min(1).max(365),
    intervention_day: z.number().int().min(0).max(365).nullable(), contact_reduction: z.number().min(0).max(0.9).nullable(),
  }),
  search_evidence: z.object({ query: z.string().min(1) }),
};

export function runTool(name: string, input: unknown): ToolResult {
  const schema = Inputs[name as keyof typeof Inputs];
  if (!schema) return { ok: false, out: `Unknown tool ${name}` };
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, out: "INVALID_INPUT: " + p.error.issues.map(i => `${i.path.join(".") || "input"}: ${i.message}`).join("; ") };
  switch (name) {
    case "get_case_counts": {
      const v = p.data as z.infer<typeof Inputs.get_case_counts>;
      return { ok: true, out: { unit: "reported cases per day", days: Array.from({ length: v.end_day - v.start_day + 1 }, (_, i) => ({ day: v.start_day + i, reported: OBSERVED[v.start_day + i] })) } };
    }
    case "fit_growth_rate": {
      const v = p.data as z.infer<typeof Inputs.fit_growth_rate>;
      const f = fitGrowthRate(OBSERVED, v.start_day, v.end_day);
      const warnings = [];
      if (v.start_day < 14) warnings.push("Window includes the first two weeks, when counts are very small and noisy; the fit may be biased.");
      if (f.n < v.end_day - v.start_day + 1) warnings.push("Days with zero cases were skipped.");
      const r3 = (x: number) => Math.round(x * 10000) / 10000;
      return { ok: true, out: { window: [v.start_day, v.end_day], r_per_day: r3(f.r), doubling_time_days: Math.round(f.doublingDays * 100) / 100, r_squared: r3(f.r2), days_used: f.n, warnings } };
    }
    case "run_seir": {
      const v = p.data as z.infer<typeof Inputs.run_seir>;
      const states = simulateSEIR({ N: CITY.population, E0: 12, R0: v.R0, latentDays: v.latent_days, infectiousDays: v.infectious_days, days: v.days, interventionDay: v.intervention_day, contactReduction: v.contact_reduction });
      const s = summarize(states, v.reporting_fraction);
      return { ok: true, out: { assumptions: v, peak_day: s.peakDay, peak_new_infections_per_day: s.peakIncidence, peak_reported_per_day: s.peakReported, share_ever_infected_by_end: s.attackRate, weekly_reported: s.weekly, note: "Deterministic projection under the stated assumptions, not a prediction." } };
    }
    case "search_evidence":
      return { ok: true, out: search((p.data as { query: string }).query, 3).map(r => ({ id: r.chunk.id, title: r.chunk.title, text: r.chunk.text })) };
  }
  return { ok: false, out: "unreachable" };
}

const k = BRIEFING_KEY;
const pct = (x: number) => Math.round(x * 100);

export const modeling: ServerPath = {
  id: "outbreak-modeling",
  title: "Outbreak Modeling",
  setting: "fictional city of Port Calder (population 250,000) modeling an outbreak of the fictional Calder respiratory virus (CRV) with an SEIR model",
  chunks: CHUNKS,
  search,
  tools: TOOLS,
  runTool,
  agentPrompt: `You are the AI modeling assistant for the Port Calder Health Department's modeling cell (fictional teaching case). Today is day ${TODAY}; reported case data exist for days 0-${TODAY - 1}. A learner is leading the analysis and directs you. Use your tools to fetch data, fit growth rates, run SEIR scenarios and look up evidence; never invent numbers. Report what the tool results show, explain the method briefly, and point out caveats (noisy early days, which evidence a value came from, latent vs incubation period, projections vs predictions). Do not hand the learner the final answers: if they ask you for the R0 estimate, the peak day or the recommendation outright, show them the evidence and ask a question that helps them decide. Keep replies under 170 words.`,
  capstoneGrader: `You are Professor Neva grading the capstone of the Outbreak Modeling path (fictional Port Calder, CRV). Answer key: reported cases grow exponentially from about day 14; a log-linear fit over days 14-${TODAY - 1} gives r ≈ ${k.r.toFixed(3)} per day (doubling time ≈ ${k.doublingDays.toFixed(1)} days). The evidence gives a mean latent period of 3.0 days (VCS-1; not the 4.1-day incubation period in HHS-2) and a mean infectious period of 4.0 days (VCS-2), so R0 = (1 + 3r)(1 + 4r) ≈ ${k.R0FromData.toFixed(2)} (true value used to generate the data: ${k.R0True}; accept ${k.R0Range[0]}-${k.R0Range[1]}). The reporting fraction is about 30% (SERO-1). Without intervention the model peaks around day ${k.peakDayUnmitigated} at about ${k.peakReportedUnmitigated} reported cases per day, with about ${pct(k.attackRateUnmitigated)}% of the city eventually infected. Closing schools from day 45 with the evidence-based 25% contact reduction (CON-2; plausible range 20-30%) delays the peak to about day ${k.closurePeakDay}, lowers it by about ${pct(k.peakReduction)}% (to about ${k.closurePeakReported} reported/day) and reduces the share infected to about ${pct(k.closureAttackRate)}%, assuming schools stay closed for the rest of the projection (to day 180); a time-limited closure mainly delays and flattens the peak and saves fewer infections, so a strong answer states the closure duration as an assumption. A strong recommendation weighs this benefit against the costs of closure, states assumptions and uncertainty (for example the 20-30% range, homogeneous mixing, constant reporting), labels results as projections, and follows the SOP (second-modeler review and Director sign-off before release). Score out of 10: R0 estimate with correct method 3, unmitigated peak timing 2, school-closure effect 2, recommendation with assumptions and uncertainty 2, quality of reasoning 1.`,
};
