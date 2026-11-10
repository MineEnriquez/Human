// FICTIONAL document library for the Meridian Evidence Unit: the review protocol plus every study
// abstract, chunked by section (methods vs results), which is how you'd chunk structured abstracts.
// Used by the RAG lab and the capstone agent's search tools.
import { makeSearch, type Chunk } from "../search.js";
import { STUDIES } from "./papers.js";

export const PROTOCOL: Chunk[] = [
  { id: "PR-1", doc: "Protocol", title: "Protocol: review question", text: "Meridian Evidence Unit review protocol (fictional). Question: in adults with bloodstream infection, does rapid molecular identification from positive blood cultures, compared with conventional culture-based identification, reduce time to optimal antibiotic therapy? Two reviewers screen every record independently and resolve disagreements by discussion with a third reviewer." },
  { id: "PR-2", doc: "Protocol", title: "Protocol: definition of the intervention", text: "Rapid molecular identification means a nucleic-acid based test, such as a multiplex PCR panel, run on positive blood culture broth. MALDI-TOF mass spectrometry identifies organisms by protein profile and is not a molecular method for this review. Tests run on whole blood before the culture turns positive are a different intervention and are excluded." },
  { id: "PR-3", doc: "Protocol", title: "Protocol: primary outcome", text: "The primary outcome is time to optimal antibiotic therapy, defined as the time from blood culture positivity to the first dose of the narrowest effective antibiotic. Time to organism identification is a laboratory process measure, not this outcome. Mortality and length of stay are secondary outcomes and do not qualify a study on their own." },
  { id: "PR-4", doc: "Protocol", title: "Protocol: eligible designs", text: "Eligible designs are randomized trials, cohort studies and before-after studies with patient-level data comparing molecular and conventional identification. Reviews, editorials, conference abstracts without outcome data, single-arm studies, modelling studies and laboratory studies are excluded." },
  { id: "PR-5", doc: "Protocol", title: "Protocol: risk of bias", text: "Randomized trials are assessed with RoB 2 (low risk, some concerns, high risk). Non-randomized studies are assessed with ROBINS-I (low, moderate, serious, critical). Two reviewers assess each study independently." },
  { id: "PR-6", doc: "Protocol", title: "Protocol: certainty of evidence", text: "Certainty is rated with GRADE as high, moderate, low or very low. Evidence from randomized trials starts as high. Observational evidence starts as low in traditional GRADE; when its risk of bias is assessed with ROBINS-I, as in this review, it starts as high and is usually rated down (often by two levels) for risk of bias. Evidence is downgraded for risk of bias, inconsistency, indirectness, imprecision or publication bias, and can be upgraded (mainly observational evidence) for a large effect, a dose-response gradient, or plausible confounding that would reduce the observed effect. Randomized and observational evidence are rated separately." },
];

/** Split a structured abstract at "Results:" so methods and results become separate chunks. */
function chunkAbstract(id: string, title: string, abstract: string): Chunk[] {
  const i = abstract.indexOf("Results:");
  if (i < 0) return [{ id: `${id}-A`, doc: id, title: `${id}: ${title}`, text: abstract }];
  return [
    { id: `${id}-M`, doc: id, title: `${id} methods: ${title}`, text: abstract.slice(0, i).trim() },
    { id: `${id}-R`, doc: id, title: `${id} results: ${title}`, text: abstract.slice(i).trim() },
  ];
}

export const CHUNKS: Chunk[] = [...PROTOCOL, ...STUDIES.flatMap(s => chunkAbstract(s.id, s.title, s.abstract))];
export const search = makeSearch(CHUNKS);

/** Questions offered in the RAG lab, with the chunk a good retrieval must surface (checked by tests). */
export const RAG_QUESTIONS: { q: string; needs: string }[] = [
  { q: "Does the protocol count MALDI-TOF as rapid molecular identification?", needs: "PR-2" },
  { q: "How does the protocol define the primary outcome, time to optimal antibiotic therapy?", needs: "PR-3" },
  { q: "What did the pragmatic randomized trial without stewardship input find for time to optimal therapy?", needs: "MS-09-R" },
];
