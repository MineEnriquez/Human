// Tuberculosis (TB) compartmental model and the FICTIONAL Kestrel Valley District data for the Disease Modeling path.
// Pure functions shared by the browser labs, the server's agent tools and the tests.
//
// Compartments (people):
//   S   uninfected
//   Lr  recent latent infection (infected within the last few years: highest risk of progressing)
//   Lt  remote ("stabilised") latent infection (low risk of reactivation)
//   I   active TB, infectious, not yet on treatment
//   T   on treatment
//   R   treated or self-cured (can relapse, or be reinfected)
// Rates are per year (rate = 1 / mean duration; risk over t years at a constant rate r is 1 - exp(-r·t)).
//
//   λ      = beta · I / N                  force of infection (beta: effective contacts per active case per year)
//   dS/dt  = births − λS − μS
//   dLr/dt = λS + p·λ(Lt + R) − (eps + kappa + μ)·Lr          p: relative susceptibility to reinfection (1 − p = partial protection)
//   dLt/dt = kappa·Lr − p·λ·Lt − (nu + μ)·Lt
//   dI/dt  = eps·Lr + nu·Lt + rho·R + (1 − s)·tau·T − (delta + sc + muTB + μ)·I
//   dT/dt  = delta·I − (tau + μ)·T
//   dR/dt  = s·tau·T + sc·I − p·λ·R − (rho + μ)·R
// Births replace all deaths (background μ and TB deaths), so the population stays constant.
//
// Kestrel Valley District and every number below are invented for teaching. Parameter values are illustrative.

export type TbParams = {
  beta: number; // effective contacts per active case per year
  eps: number; // progression from recent latent infection, per year
  kappa: number; // stabilisation from recent to remote latency, per year
  nu: number; // reactivation from remote latency, per year
  p: number; // susceptibility to reinfection of previously infected people, relative to uninfected (0-1)
  delta: number; // detection (and treatment start) rate of active TB, per year
  sc: number; // self-cure rate of untreated active TB, per year
  muTB: number; // TB death rate of untreated active TB, per year
  tau: number; // rate of finishing treatment (1 / mean treatment duration), per year
  s: number; // treatment success: share of people leaving treatment whose outcome is cured or treatment completed (WHO: success = cured + completed)
  rho: number; // relapse after cure, per year
  mu: number; // background death rate, per year
};
export type State = { S: number; Lr: number; Lt: number; I: number; T: number; R: number };
export type Year = State & { year: number; incidence: number; notifications: number; tbDeaths: number };

export const N_DISTRICT = 600_000;

/** Baseline natural-history and programme values (illustrative). */
export const BASE: TbParams = {
  beta: 14, eps: 0.07, kappa: 0.93, nu: 0.0006, p: 0.5,
  delta: 0.7, sc: 0.2, muTB: 0.2, tau: 2, s: 0.8, rho: 0.01, mu: 1 / 65,
};

const total = (x: State) => x.S + x.Lr + x.Lt + x.I + x.T + x.R;

function deriv(x: State, q: TbParams, N: number) {
  const lam = (q.beta * x.I) / N;
  const deaths = q.mu * total(x) + q.muTB * x.I;
  const dS = deaths - lam * x.S - q.mu * x.S;
  const dLr = lam * x.S + q.p * lam * (x.Lt + x.R) - (q.eps + q.kappa + q.mu) * x.Lr;
  const dLt = q.kappa * x.Lr - q.p * lam * x.Lt - (q.nu + q.mu) * x.Lt;
  const inc = q.eps * x.Lr + q.nu * x.Lt + q.rho * x.R; // new and relapse active TB
  const dI = inc + (1 - q.s) * q.tau * x.T - (q.delta + q.sc + q.muTB + q.mu) * x.I;
  const dT = q.delta * x.I - (q.tau + q.mu) * x.T;
  const dR = q.s * q.tau * x.T + q.sc * x.I - q.p * lam * x.R - (q.rho + q.mu) * x.R;
  return { d: { S: dS, Lr: dLr, Lt: dLt, I: dI, T: dT, R: dR }, inc, notif: q.delta * x.I, tbDeaths: q.muTB * x.I };
}

const add = (a: State, b: State, h: number): State => ({ S: a.S + h * b.S, Lr: a.Lr + h * b.Lr, Lt: a.Lt + h * b.Lt, I: a.I + h * b.I, T: a.T + h * b.T, R: a.R + h * b.R });

/** One year of RK4 with `steps` sub-steps; also integrates the year's incidence, notifications and TB deaths. */
function stepYear(x: State, q: TbParams, N: number, steps = 8) {
  const h = 1 / steps;
  let inc = 0, notif = 0, dth = 0;
  for (let k = 0; k < steps; k++) {
    const k1 = deriv(x, q, N), k2 = deriv(add(x, k1.d, h / 2), q, N), k3 = deriv(add(x, k2.d, h / 2), q, N), k4 = deriv(add(x, k3.d, h), q, N);
    const comb = (f: (r: ReturnType<typeof deriv>) => number) => (h / 6) * (f(k1) + 2 * f(k2) + 2 * f(k3) + f(k4));
    x = { S: x.S + comb(r => r.d.S), Lr: x.Lr + comb(r => r.d.Lr), Lt: x.Lt + comb(r => r.d.Lt), I: x.I + comb(r => r.d.I), T: x.T + comb(r => r.d.T), R: x.R + comb(r => r.d.R) };
    inc += comb(r => r.inc); notif += comb(r => r.notif); dth += comb(r => r.tbDeaths);
  }
  return { x, inc, notif, dth };
}

/** Endemic starting state: run the model for 400 years from a small seed with constant parameters. */
export function equilibrium(q: TbParams, N = N_DISTRICT): State {
  let x: State = { S: N - 100, Lr: 0, Lt: 0, I: 100, T: 0, R: 0 };
  for (let y = 0; y < 400; y++) x = stepYear(x, q, N, 8).x;
  return x;
}

/** Programme strategies the district can fund from START_YEAR (illustrative effect sizes). */
export type Strategy = "baseline" | "acf" | "tpt" | "treatment" | "tpt_treatment";
export const STRATEGIES: Record<Strategy, { label: string; costPerYear: number; describe: string; apply: (q: TbParams) => TbParams }> = {
  baseline: { label: "No new strategy", costPerYear: 0, describe: "Current programme continues.", apply: q => q },
  acf: { label: "Active case finding", costPerYear: 1_200_000, describe: "Community screening adds 0.4 per year to the detection rate of active TB (from 0.70 to 1.10 at the programme's baseline).", apply: q => ({ ...q, delta: q.delta + 0.4 }) },
  tpt: { label: "Preventive treatment for household contacts", costPerYear: 600_000, describe: "TPT for household contacts prevents an estimated 20% of progression from recent infection (the progression rate is multiplied by 0.8).", apply: q => ({ ...q, eps: q.eps * 0.8 }) },
  treatment: { label: "Treatment adherence support", costPerYear: 500_000, describe: "Adherence support adds 10 percentage points to treatment success (from 80% to 90% at the programme's baseline).", apply: q => ({ ...q, s: Math.min(0.99, q.s + 0.1) }) },
  tpt_treatment: { label: "Preventive treatment + adherence support", costPerYear: 1_100_000, describe: "Both: TPT for household contacts and treatment adherence support.", apply: q => ({ ...q, eps: q.eps * 0.8, s: Math.min(0.99, q.s + 0.1) }) },
};
/** The district can fund up to this much per year from START_YEAR (fictional). */
export const BUDGET_PER_YEAR = 1_200_000;

export type RunOpts = { params?: Partial<TbParams>; strategy?: Strategy | null; startYear?: number; endYear?: number; strategyFrom?: number };

/**
 * Simulate year by year from 2015 (endemic start), optionally switching on a strategy from `strategyFrom`
 * (default 2027). Returns one row per calendar year with that year's incidence, notifications and TB deaths.
 */
export function runTb(o: RunOpts = {}): Year[] {
  const q0 = { ...BASE, ...o.params };
  const from = o.strategyFrom ?? START_YEAR;
  const strat = STRATEGIES[o.strategy || "baseline"];
  const start = 2015, end = o.endYear ?? 2035;
  let x = equilibrium(q0);
  const out: Year[] = [];
  for (let year = start; year <= end; year++) {
    const q = year >= from ? strat.apply(q0) : q0;
    const r = stepYear(x, q, N_DISTRICT);
    x = r.x;
    out.push({ year, ...x, incidence: r.inc, notifications: r.notif, tbDeaths: r.dth });
  }
  return out.filter(y => y.year >= (o.startYear ?? start));
}

export const per100k = (n: number) => (n / N_DISTRICT) * 100_000;
/** Constant-rate conversion between a rate (per year) and the risk of the event within t years. */
export const riskFromRate = (rate: number, years: number) => 1 - Math.exp(-rate * years);
export const rateFromRisk = (risk: number, years: number) => -Math.log(1 - risk) / years;

/** Seeded PRNG (mulberry32) so the "observed" data is identical everywhere. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ the case (fictional)
export const DISTRICT = { name: "Kestrel Valley District", population: N_DISTRICT };
/** Strategies start in this year; the projection horizon is 2035. */
export const START_YEAR = 2027;
export const HORIZON = 2035;
/** True parameters behind the synthetic data: the baseline, with a detection rate learners must infer. */
export const TRUTH: TbParams = { ...BASE };

const truthRun = runTb({ endYear: HORIZON });
const rand = mulberry32(20151231);
/** Observed annual notifications 2015-2025 (people starting TB treatment), with deterministic ±4% noise. */
export const NOTIFICATIONS: { year: number; notified: number }[] = truthRun
  .filter(y => y.year <= 2025)
  .map(y => ({ year: y.year, notified: Math.round(y.notifications * (1 + (rand() - 0.5) * 0.08)) }));

/** The fictional 2019 prevalence survey: active TB per 100,000 (true model value, rounded to the nearest 10). */
export const PREVALENCE_SURVEY = { year: 2019, perHundredK: Math.round(per100k(truthRun.find(y => y.year === 2019)!.I) / 10) * 10 };

// ------------------------------------------------------------------ fitting (identifiability lesson)
/** Sum of squared relative errors of modelled notifications against the observed series. */
export function notificationError(model: Year[]) {
  let e = 0;
  for (const o of NOTIFICATIONS) {
    const m = model.find(y => y.year === o.year)!;
    e += ((m.notifications - o.notified) / o.notified) ** 2;
  }
  return e / NOTIFICATIONS.length;
}
/** Root-mean-square relative error (as a fraction), for the hand-fitting lab. */
export const fitError = (model: Year[]) => Math.sqrt(notificationError(model));

export type Fit = { beta: number; delta: number; error: number; prevalence2019: number; incidence2025: number; caseDetection2025: number };

/**
 * Grid-search beta and delta to match 2015-2025 notifications, optionally also the 2019 prevalence survey.
 * Without the survey, many (beta, delta) pairs fit the notifications almost equally well.
 */
export function fitModel(prevalencePerHundredK: number | null): { best: Fit; alternatives: Fit[] } {
  const fits: Fit[] = [];
  for (let beta = 6; beta <= 14.001; beta += 0.5) for (let delta = 0.3; delta <= 1.6001; delta += 0.1) {
    const run = runTb({ params: { beta, delta }, endYear: 2025 });
    const y19 = run.find(y => y.year === 2019)!, y25 = run.find(y => y.year === 2025)!;
    const prev = per100k(y19.I);
    let error = notificationError(run);
    if (prevalencePerHundredK != null) error += ((prev - prevalencePerHundredK) / prevalencePerHundredK) ** 2;
    fits.push({ beta: +beta.toFixed(2), delta: +delta.toFixed(2), error, prevalence2019: prev, incidence2025: y25.incidence, caseDetection2025: y25.notifications / y25.incidence });
  }
  fits.sort((a, b) => a.error - b.error);
  return { best: fits[0], alternatives: fits.slice(1, 6) };
}

// ------------------------------------------------------------------ answer key (derived, not hand-typed)
const y2025 = truthRun.find(y => y.year === 2025)!;
const baselineRun = runTb({ endYear: HORIZON });
const base2035 = baselineRun.find(r => r.year === HORIZON)!.incidence;
/** Cases averted START_YEAR..HORIZON versus baseline, and cost per case averted, for one strategy. */
export function strategyImpact(s: Strategy, params: Partial<TbParams> = {}) {
  const base = Object.keys(params).length ? runTb({ params, endYear: HORIZON }) : baselineRun;
  const run = runTb({ params, strategy: s, endYear: HORIZON });
  const window = (r: Year[]) => r.filter(y => y.year >= START_YEAR);
  const b = window(base), w = window(run);
  const casesAverted = b.reduce((n, y, i) => n + y.incidence - w[i].incidence, 0);
  const inc2035 = run.find(r => r.year === HORIZON)!.incidence, b2035 = base.find(r => r.year === HORIZON)!.incidence;
  const cost = STRATEGIES[s].costPerYear * (HORIZON - START_YEAR + 1);
  return { strategy: s, incidence2035: inc2035, perHundredK: per100k(inc2035), reduction: 1 - inc2035 / b2035, casesAverted, cost, costPerCaseAverted: casesAverted > 0 ? cost / casesAverted : Infinity };
}
const ranked = (["acf", "tpt", "treatment", "tpt_treatment"] as Strategy[]).map(s => strategyImpact(s)).sort((a, b) => b.reduction - a.reduction);

export const STRATEGY_KEY = {
  incidence2025: y2025.incidence,
  incidence2025PerHundredK: per100k(y2025.incidence),
  notifications2025: NOTIFICATIONS.find(n => n.year === 2025)!.notified,
  caseDetection2025: y2025.notifications / y2025.incidence,
  /** Accepted range for the learner's 2025 incidence estimate (per 100,000). */
  incidenceTolerance: 0.15,
  prevalence2019: PREVALENCE_SURVEY.perHundredK,
  baseline2035PerHundredK: per100k(base2035),
  strategies: ranked,
  /** Largest 2035 reduction among the three single strategies (auto-checked in the capstone). */
  largestSingle: ranked.filter(r => r.strategy !== "tpt_treatment")[0].strategy as Strategy,
  /** Largest 2035 reduction among options that fit the budget, including the combination. */
  largestWithinBudget: ranked.filter(r => STRATEGIES[r.strategy].costPerYear <= BUDGET_PER_YEAR)[0].strategy as Strategy,
  mostCasesAverted: [...ranked].sort((a, b) => b.casesAverted - a.casesAverted)[0].strategy as Strategy,
  bestValue: [...ranked].sort((a, b) => a.costPerCaseAverted - b.costPerCaseAverted)[0].strategy as Strategy,
};
