// FICTIONAL library of past outbreaks, stored as vectors (weekly reported cases, first 6 weeks) + metadata.
// Used by the Similar Epidemics (vector database) lab. All places and numbers are invented.
import { OBSERVED } from "./model";

export type Analogue = {
  id: string;
  name: string;
  family: "respiratory" | "enteric" | "vector-borne";
  setting: "city" | "island" | "school" | "hospital";
  population: number;
  year: number;
  vec: number[]; // weekly reported cases, weeks 1-6
  outcome: string; // what happened next (fictional)
};

/** Weekly totals of a daily series (6 weeks). */
export const weekly = (daily: number[]) => Array.from({ length: 6 }, (_, w) => daily.slice(w * 7, w * 7 + 7).reduce((a, b) => a + b, 0));
const grow = (start: number, factor: number) => Array.from({ length: 6 }, (_, w) => Math.round(start * factor ** w));

/** Port Calder's first six weeks: the query vector. */
export const QUERY = { id: "PC-2026", name: "Port Calder 2026 (now)", vec: weekly(OBSERVED) };

export const ANALOGUES: Analogue[] = [
  { id: "MV-24", name: "Marrow Vale 2024", family: "respiratory", setting: "city", population: 180_000, year: 2024, vec: grow(5, 2.3), outcome: "Peaked in week 11; estimated R0 1.8-2.2." },
  { id: "AB-19", name: "Ashford Bay 2019", family: "respiratory", setting: "city", population: 310_000, year: 2019, vec: grow(16, 2.25), outcome: "Peaked in week 9 after an early start in schools; estimated R0 1.9-2.3." },
  { id: "KI-22", name: "Kellen Island 2022", family: "respiratory", setting: "island", population: 40_000, year: 2022, vec: grow(1, 2.4), outcome: "Peaked in week 8; the island's size limited spread." },
  { id: "CV-17", name: "Corvin 2017", family: "respiratory", setting: "city", population: 900_000, year: 2017, vec: grow(40, 1.7), outcome: "Slow growth, doubling about every 9 days; peaked in week 16." },
  { id: "NG-23", name: "Northgate School cluster 2023", family: "respiratory", setting: "school", population: 1_200, year: 2023, vec: [3, 41, 88, 30, 6, 1], outcome: "Burned out in a month after half the pupils were infected." },
  { id: "SB-20", name: "St. Brannock ward outbreak 2020", family: "respiratory", setting: "hospital", population: 400, year: 2020, vec: [2, 9, 14, 6, 2, 0], outcome: "Controlled by ward closure in week 4." },
  { id: "RS-21", name: "Riverside 2021", family: "enteric", setting: "city", population: 220_000, year: 2021, vec: [180, 95, 30, 9, 3, 1], outcome: "Point-source food outbreak; over within six weeks." },
  { id: "HD-18", name: "Halden 2018", family: "vector-borne", setting: "city", population: 260_000, year: 2018, vec: [8, 12, 19, 27, 39, 55], outcome: "Seasonal mosquito-borne rise that ended with the first cold weeks." },
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
  { id: "euclidean", label: "Euclidean distance (raw counts)", higherIsCloser: false },
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
