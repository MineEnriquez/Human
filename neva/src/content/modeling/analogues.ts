// FICTIONAL library of other districts' TB notification trajectories, stored as vectors + metadata.
// Each vector is annual notifications per 100,000 population, 2015-2025 (11 dimensions).
// Used by the Similar Settings (vector database) lab. All districts and numbers are invented.
import { NOTIFICATIONS, per100k } from "./model.js";

export type Analogue = {
  id: string;
  name: string;
  setting: "urban" | "rural" | "mixed";
  hiv: "low" | "high"; // HIV prevalence band among adults
  acf: boolean; // ran an active case-finding programme during 2015-2025
  population: number;
  vec: number[]; // notifications per 100,000, 2015..2025
  outcome: string; // what the district learned (fictional)
};

const YEARS = 11;
const flat = (level: number, wobble = 0.02) => Array.from({ length: YEARS }, (_, i) => Math.round(level * (1 + wobble * Math.sin(i * 1.7))));
const trend = (start: number, perYear: number) => Array.from({ length: YEARS }, (_, i) => Math.round(start * (1 + perYear) ** i));
/** Active case finding starting in year index `at`: notifications jump as backlog is found, then fall below the old level. */
const acfShape = (level: number, at: number) => Array.from({ length: YEARS }, (_, i) => Math.round(i < at ? level : i === at ? level * 1.35 : i === at + 1 ? level * 1.2 : level * (1.02 - 0.06 * (i - at - 1))));

/** Kestrel Valley's own notifications per 100,000, 2015-2025: the query vector. */
export const QUERY = { id: "KV", name: "Kestrel Valley District (now)", vec: NOTIFICATIONS.map(n => Math.round(per100k(n.notified))) };

export const ANALOGUES: Analogue[] = [
  { id: "CT", name: "Calloway Town District", setting: "mixed", hiv: "low", acf: false, population: 540_000, vec: flat(160), outcome: "Stable notifications; its 2021 prevalence survey suggested about 7 in 10 cases were being detected." },
  { id: "LM", name: "Lowmere District", setting: "rural", hiv: "low", acf: false, population: 210_000, vec: flat(55), outcome: "Low, stable burden; a different epidemic level, not a different shape." },
  { id: "SC", name: "Sable Coast District", setting: "urban", hiv: "high", acf: false, population: 900_000, vec: flat(420, 0.015), outcome: "High burden driven partly by HIV; stable notifications." },
  { id: "BH", name: "Brennock Hills District", setting: "rural", hiv: "low", acf: false, population: 380_000, vec: trend(185, -0.03), outcome: "Slow decline attributed to improving housing and nutrition." },
  { id: "HF", name: "Harrow Flats District", setting: "mixed", hiv: "low", acf: true, population: 620_000, vec: acfShape(165, 4), outcome: "ACF from 2019: notifications rose for two years as undetected cases were found, then fell below the old level." },
  { id: "IV", name: "Iverly District", setting: "urban", hiv: "high", acf: false, population: 750_000, vec: trend(390, -0.045), outcome: "Fast decline after expanding HIV treatment; not a like-for-like setting." },
  { id: "OV", name: "Ostrin Valley District", setting: "rural", hiv: "low", acf: true, population: 300_000, vec: acfShape(140, 2), outcome: "ACF from 2017 with a similar rise-then-fall pattern; programme costs were higher in remote villages." },
  { id: "PM", name: "Pell Marsh District", setting: "mixed", hiv: "low", acf: false, population: 450_000, vec: trend(110, 0.05), outcome: "Rising notifications after a new laboratory improved diagnosis, not necessarily more disease." },
];

// ------------------------------------------------------------------ similarity
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);
const norm = (a: number[]) => Math.sqrt(dot(a, a));
export const cosine = (a: number[], b: number[]) => dot(a, b) / (norm(a) * norm(b));
export const euclidean = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0));
export const unit = (a: number[]) => { const n = norm(a); return a.map(x => x / n); };

export type Metric = "cosine" | "euclidean" | "euclidean-normalised";
export const METRICS: { id: Metric; label: string; higherIsCloser: boolean }[] = [
  { id: "cosine", label: "Cosine similarity", higherIsCloser: true },
  { id: "euclidean", label: "Euclidean distance (raw rates)", higherIsCloser: false },
  { id: "euclidean-normalised", label: "Euclidean distance (unit-length vectors)", higherIsCloser: false },
];

export function score(metric: Metric, a: number[], b: number[]) {
  if (metric === "cosine") return cosine(a, b);
  if (metric === "euclidean") return euclidean(a, b);
  return euclidean(unit(a), unit(b));
}

/** Rank analogues for a metric (closest first). */
export function rank(metric: Metric, items: Analogue[], query = QUERY.vec) {
  const m = METRICS.find(x => x.id === metric)!;
  return items
    .map(a => ({ a, s: score(metric, query, a.vec) }))
    .sort((x, y) => (m.higherIsCloser ? y.s - x.s : x.s - y.s));
}
