// Semantic-search lab logic (pure, tested): keyword (BM25) vs toy vector search vs hybrid (RRF).
import { makeSearch } from "../search";
import { STUDIES, rrf, type Study } from "./papers";

/** BM25 over each study's title + abstract (one record per study). */
export const studySearch = makeSearch(STUDIES.map(s => ({ id: s.id, doc: s.id, title: s.title, text: s.abstract })));

/** Toy embeddings are 2-D map coordinates centred on the map's middle (0.5, 0.5); similarity is the
 *  cosine of the centred vectors. Real text embeddings have hundreds to thousands of dimensions. */
const centre = (v: [number, number]): [number, number] => [v[0] - 0.5, v[1] - 0.5];
export function cosine(a: number[], b: number[]): number {
  const dot = a.reduce((s, x, i) => s + x * b[i], 0);
  const na = Math.hypot(...a), nb = Math.hypot(...b);
  return na && nb ? dot / (na * nb) : 0;
}

export type Preset = { id: string; text: string; vec: [number, number]; note: string };
export const PRESETS: Preset[] = [
  { id: "q1", text: "bacteremia", vec: [0.74, 0.7], note: "Synonym trap: eligible studies say 'bloodstream infection', not 'bacteremia'." },
  { id: "q2", text: "rapid diagnostics time to treatment", vec: [0.7, 0.66], note: "Paraphrase: the studies say 'molecular identification' and 'optimal antibiotic therapy'." },
  { id: "q3", text: "mass spectrometry organism identification", vec: [0.6, 0.45], note: "Exact-term query: here keywords are precise and vectors drift to neighbours." },
];

export type Filter = { id: string; label: string; field: "year" | "design"; test: (s: Study) => boolean };
export const FILTERS: Filter[] = [
  { id: "y2022", label: "year ≥ 2022", field: "year", test: s => s.year >= 2022 },
  { id: "rct", label: "design = RCT", field: "design", test: s => s.design === "RCT" },
  { id: "cohort", label: "design = cohort", field: "design", test: s => s.design === "cohort" },
  { id: "ba", label: "design = before-after", field: "design", test: s => s.design === "before-after" },
];

/** Same field = OR, different fields = AND (the usual metadata-filter semantics). */
export function applyFilters(active: Filter[], s: Study): boolean {
  const by = new Map<string, Filter[]>();
  for (const f of active) by.set(f.field, [...(by.get(f.field) || []), f]);
  return [...by.values()].every(fs => fs.some(f => f.test(s)));
}

export function vectorSearch(q: [number, number], k = 6, keep: (s: Study) => boolean = () => true) {
  return STUDIES.filter(keep)
    .map(s => ({ id: s.id, score: Math.round(cosine(centre(q), centre(s.vec)) * 1000) / 1000 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export function keywordSearch(q: string, k = 6, keep: (s: Study) => boolean = () => true) {
  return studySearch(q, STUDIES.length)
    .filter(h => keep(STUDIES.find(s => s.id === h.chunk.id)!))
    .slice(0, k)
    .map(h => ({ id: h.chunk.id, score: h.score }));
}

/** Hybrid ranking: fuse the keyword and vector rankings with RRF (k = 60). */
export function hybridSearch(p: Preset, k = 6, keep: (s: Study) => boolean = () => true) {
  const kw = keywordSearch(p.text, 10, keep).map(r => r.id);
  const vec = vectorSearch(p.vec, 10, keep).map(r => r.id);
  return rrf([kw, vec]).slice(0, k).map(r => ({ ...r, kwRank: kw.indexOf(r.id) + 1 || null, vecRank: vec.indexOf(r.id) + 1 || null }));
}
