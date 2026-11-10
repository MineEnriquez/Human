// SEIR model and the FICTIONAL Port Calder surveillance data for the Outbreak Modeling path.
// Pure functions shared by the browser labs, the server's agent tools and the tests.
//
//   dS/dt = -β S I / N
//   dE/dt =  β S I / N - σ E        σ = 1 / mean latent period
//   dI/dt =  σ E - γ I              γ = 1 / mean infectious period
//   dR/dt =  γ I                    R0 = β / γ  (for this SEIR model, as for SIR)
//
// "Calder respiratory virus" (CRV), the city and every number below are invented for teaching.

export type SeirParams = {
  N: number;
  R0: number;
  latentDays: number; // mean latent period (infected, not yet infectious)
  infectiousDays: number; // mean infectious period
  E0: number; // seeded exposed people on day 0
  days: number;
  interventionDay?: number | null; // from this day, transmission is reduced
  contactReduction?: number | null; // fraction 0..1 removed from β
};
export type DayState = { day: number; S: number; E: number; I: number; R: number; incidence: number };

/** Deterministic SEIR, RK4 with 10 sub-steps per day. `incidence` = new infectious people that day (σE integrated). */
export function simulateSEIR(p: SeirParams): DayState[] {
  const sigma = 1 / p.latentDays, gamma = 1 / p.infectiousDays, beta0 = p.R0 * gamma;
  let S = p.N - p.E0, E = p.E0, I = 0, R = 0;
  const out: DayState[] = [{ day: 0, S, E, I, R, incidence: 0 }];
  const steps = 10, h = 1 / steps;
  for (let day = 1; day <= p.days; day++) {
    const beta = p.interventionDay != null && day > p.interventionDay ? beta0 * (1 - (p.contactReduction || 0)) : beta0;
    let inc = 0;
    for (let k = 0; k < steps; k++) {
      const f = (s: number, e: number, i: number) => {
        const force = (beta * s * i) / p.N;
        return [-force, force - sigma * e, sigma * e - gamma * i, gamma * i, sigma * e];
      };
      const k1 = f(S, E, I);
      const k2 = f(S + (h / 2) * k1[0], E + (h / 2) * k1[1], I + (h / 2) * k1[2]);
      const k3 = f(S + (h / 2) * k2[0], E + (h / 2) * k2[1], I + (h / 2) * k2[2]);
      const k4 = f(S + h * k3[0], E + h * k3[1], I + h * k3[2]);
      const d = (j: number) => (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]);
      S += d(0); E += d(1); I += d(2); R += d(3); inc += d(4);
    }
    out.push({ day, S, E, I, R, incidence: inc });
  }
  return out;
}

/** Seeded PRNG (mulberry32) so the "observed" data is identical everywhere. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Expected reported cases = reporting fraction × new infectious people (no noise). */
export const expectedReported = (states: DayState[], reportingFraction: number) => states.map(s => s.incidence * reportingFraction);

/** Reported cases with deterministic multiplicative noise (log-normal, sd 0.15). */
export function noisyReported(states: DayState[], reportingFraction: number, seed = 20260311): number[] {
  const rand = mulberry32(seed);
  return states.map(s => {
    const u1 = Math.max(rand(), 1e-12), u2 = rand();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.round(s.incidence * reportingFraction * Math.exp(0.15 * z));
  });
}

// ------------------------------------------------------------------ the case (fictional)
export const CITY = { name: "Port Calder", population: 250_000 };
/** True parameters behind the synthetic data. Learners must recover them; never shown in the UI. */
export const TRUTH = { N: CITY.population, R0: 2.0, latentDays: 3, infectiousDays: 4, E0: 12, reportingFraction: 0.3 };
/** Data are available for days 0..TODAY-1 (the first six weeks). */
export const TODAY = 42;
export const HORIZON = 180;

const truthRun = simulateSEIR({ ...TRUTH, days: HORIZON });
const allReported = noisyReported(truthRun, TRUTH.reportingFraction);
/** Observed daily reported cases, days 0..41. */
export const OBSERVED: number[] = allReported.slice(0, TODAY);

// ------------------------------------------------------------------ analysis helpers
export type GrowthFit = { r: number; doublingDays: number; r2: number; n: number };

/** Log-linear least squares: ln(cases) = a + r·day over [start, end] (days with 0 cases are skipped). */
export function fitGrowthRate(series: number[], start: number, end: number): GrowthFit {
  const xs: number[] = [], ys: number[] = [];
  for (let d = Math.max(0, start); d <= Math.min(end, series.length - 1); d++) if (series[d] > 0) { xs.push(d); ys.push(Math.log(series[d])); }
  const n = xs.length;
  if (n < 3) return { r: NaN, doublingDays: NaN, r2: NaN, n };
  const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  const r = sxy / sxx;
  return { r, doublingDays: Math.log(2) / r, r2: syy ? (sxy * sxy) / (sxx * syy) : 1, n };
}

/** SEIR with exponentially distributed latent and infectious periods: R = (1 + r·latent)(1 + r·infectious). */
export const rFromGrowth = (r: number, latentDays: number, infectiousDays: number) => (1 + r * latentDays) * (1 + r * infectiousDays);

/** Inverse of rFromGrowth: the early growth rate implied by R0 (positive root of a quadratic). */
export function growthFromR0(R0: number, latentDays: number, infectiousDays: number) {
  const a = latentDays * infectiousDays, b = latentDays + infectiousDays, c = 1 - R0;
  return (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
}

/** Herd immunity threshold for a homogeneous population: 1 - 1/R0. */
export const herdImmunityThreshold = (R0: number) => 1 - 1 / R0;

/** SIR/SEIR final size z (fraction ever infected) solving z = 1 - exp(-R0 z), by fixed-point iteration. */
export function finalSize(R0: number) {
  if (R0 <= 1) return 0;
  let z = 0.5;
  for (let i = 0; i < 200; i++) z = 1 - Math.exp(-R0 * z);
  return z;
}

export type Summary = { peakDay: number; peakIncidence: number; peakReported: number; attackRate: number; weekly: { day: number; reported: number }[] };
export function summarize(states: DayState[], reportingFraction: number): Summary {
  let peakDay = 0, peakIncidence = 0;
  for (const s of states) if (s.incidence > peakIncidence) { peakIncidence = s.incidence; peakDay = s.day; }
  const last = states[states.length - 1];
  const N = last.S + last.E + last.I + last.R;
  return {
    peakDay,
    peakIncidence: Math.round(peakIncidence),
    peakReported: Math.round(peakIncidence * reportingFraction),
    attackRate: Math.round(((N - last.S) / N) * 1000) / 1000,
    weekly: states.filter(s => s.day % 7 === 0).map(s => ({ day: s.day, reported: Math.round(s.incidence * reportingFraction) })),
  };
}

/** Mean absolute error between ln(1 + observed) and ln(1 + model) over the observed days. */
export function logFitError(observed: number[], model: number[]) {
  let e = 0;
  for (let d = 0; d < observed.length; d++) e += Math.abs(Math.log1p(observed[d]) - Math.log1p(model[d] ?? 0));
  return e / observed.length;
}

// ------------------------------------------------------------------ answer key (derived, not hand-typed)
export const SCHOOL_CLOSURE = { day: 45, contactReduction: 0.25 };
const unmitigated = summarize(truthRun, TRUTH.reportingFraction);
const closure = summarize(simulateSEIR({ ...TRUTH, days: HORIZON, interventionDay: SCHOOL_CLOSURE.day, contactReduction: SCHOOL_CLOSURE.contactReduction }), TRUTH.reportingFraction);
const fit = fitGrowthRate(OBSERVED, 14, TODAY - 1);

export const BRIEFING_KEY = {
  r: fit.r,
  doublingDays: fit.doublingDays,
  R0FromData: rFromGrowth(fit.r, TRUTH.latentDays, TRUTH.infectiousDays),
  R0True: TRUTH.R0,
  R0Range: [1.7, 2.3] as [number, number],
  peakDayUnmitigated: unmitigated.peakDay,
  peakDayTolerance: 7,
  peakReportedUnmitigated: unmitigated.peakReported,
  attackRateUnmitigated: unmitigated.attackRate,
  closurePeakDay: closure.peakDay,
  closurePeakReported: closure.peakReported,
  closureAttackRate: closure.attackRate,
  peakReduction: 1 - closure.peakReported / unmitigated.peakReported,
};
