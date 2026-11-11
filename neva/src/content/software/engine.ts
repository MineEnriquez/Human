// A SIMPLIFIED, deterministic engine for the course: it runs a model SPEC (not Python) as a two-group
// (higher-risk / general) compartmental approximation of syphilis with HIV co-infection and mother-to-child
// transmission, in monthly steps. Real Epiloom (like Starsim) would run an agent-based model; this engine only
// lets learners compare scenarios and sanity-check direction and rough size. All parameters are illustrative.
import type { ModelSpec } from "./spec.js";

export const ENGINE_NOTE = "Simplified two-group compartmental engine for the course, not an agent-based run: use it to compare scenarios and check plausibility, not for real estimates.";

const P = {
  highRiskShare: 0.1,
  hivPrev: { high: 0.2, general: 0.04 },
  /** Monthly force of infection per infected share, by contact (rows: susceptible group; cols: infected group). */
  contact: { hh: 0.041, hg: 0.004, gh: 0.0035, gg: 0.008 },
  recoveryPerMonth: 1 / 24, // untreated infectiousness ~2 years (illustrative)
  hivRelSus: 2.0,
  initPrev: { high: 0.10, general: 0.01 },
  birthsPerAdultPerYear: 0.03,
  pCongenital: 0.4,
  efficacy: 0.95,
  campaign: { years: [2028, 2030, 2032], coverage: 0.3 },
  outreachPerMonth: 0.07,
};

export type YearRow = { year: number; prevalence: number; congenital: number; treated: number };
export type ScenarioResult = { scenario: string; years: YearRow[]; congenitalTotal: number; treatedTotal: number; prevalenceEnd: number };

/** Run every scenario in the spec (per 100,000 adults). Unknown or missing features simply aren't modelled. */
export function runModel(spec: ModelSpec): { note: string; results: ScenarioResult[]; assumptions: string[] } {
  const start = spec.horizon?.start ?? 2027, stop = spec.horizon?.stop ?? 2037;
  const N = 100_000, nh = N * P.highRiskShare, ng = N - nh;
  const co = spec.coinfection && spec.coinfection.source === "hiv" && spec.coinfection.target === "syphilis";
  const sus = (g: "high" | "general") => 1 + (co ? (P.hivRelSus - 1) * P.hivPrev[g] : 0);
  const results = spec.scenarios.map(scn => {
    const iv = spec.interventions.find(i => i.name === scn);
    let Ih = P.initPrev.high * nh, Ig = P.initPrev.general * ng;
    const years: YearRow[] = [];
    for (let y = start; y < stop; y++) {
      let congenital = 0, treated = 0;
      for (let m = 0; m < 12; m++) {
        const ih = Ih / nh, ig = Ig / ng;
        const newH = (nh - Ih) * sus("high") * (P.contact.hh * ih + P.contact.hg * ig);
        const newG = (ng - Ig) * sus("general") * (P.contact.gh * ih + P.contact.gg * ig);
        Ih += newH - Ih * P.recoveryPerMonth;
        Ig += newG - Ig * P.recoveryPerMonth;
        if (iv && iv.delivery !== "campaign" && y >= 2028) {
          // Routine delivery: targeted reaches only the higher-risk group; untargeted routine reaches everyone.
          const reachH = nh * P.outreachPerMonth, reachG = iv.delivery === "targeted" ? 0 : ng * P.outreachPerMonth;
          treated += reachH + reachG;
          Ih -= Ih * P.outreachPerMonth * P.efficacy;
          if (reachG) Ig -= Ig * P.outreachPerMonth * P.efficacy;
        }
        if (spec.mtct) congenital += (N * P.birthsPerAdultPerYear / 12) * ((Ih + Ig) / N) * P.pCongenital;
      }
      if (iv && iv.delivery === "campaign" && P.campaign.years.includes(y)) {
        treated += N * P.campaign.coverage;
        Ih -= Ih * P.campaign.coverage * P.efficacy;
        Ig -= Ig * P.campaign.coverage * P.efficacy;
      }
      years.push({ year: y, prevalence: (Ih + Ig) / N, congenital, treated });
    }
    const sum = (f: (r: YearRow) => number) => years.reduce((n, r) => n + f(r), 0);
    return { scenario: scn, years, congenitalTotal: Math.round(sum(r => r.congenital)), treatedTotal: Math.round(sum(r => r.treated)), prevalenceEnd: years.at(-1)!.prevalence };
  });
  return {
    note: ENGINE_NOTE,
    results,
    assumptions: [
      `higher-risk group = ${P.highRiskShare * 100}% of adults (placeholder until the researcher defines it)`,
      `mass campaign: ${P.campaign.coverage * 100}% of all adults treated in ${P.campaign.years.join(", ")}`,
      `targeted outreach: ${P.outreachPerMonth * 100}% of the higher-risk group reached each month from 2028`,
      `HIV prevalence ${P.hivPrev.high * 100}% (higher-risk) and ${P.hivPrev.general * 100}% (general), held constant`,
      `illustrative transmission, recovery and congenital-transmission values; not calibrated`,
    ],
  };
}
