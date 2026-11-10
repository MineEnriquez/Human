// FICTIONAL study records for the Research Intelligence path.
// The "Meridian Evidence Unit", every author, journal, study and number below is invented for teaching.
// Methods vocabulary (PICO, RoB 2, ROBINS-I, GRADE) is real and used as those tools define it.
// Shared by the browser (labs) and the server (the capstone agent's tools).

export type Design = "RCT" | "cohort" | "before-after" | "review" | "editorial" | "conference abstract" | "modelling study" | "single-arm" | "laboratory study";

export type Study = {
  id: string;
  title: string;
  authors: string; // fictional
  journal: string; // fictional
  year: number;
  design: Design;
  population: string;
  intervention: string;
  comparator: string;
  outcomes: string;
  n: number | null;
  /** Main reported result for time to optimal therapy (fictional), or null if not reported. */
  effect: string | null;
  abstract: string;
  /** Risk of bias as assessed (RoB 2 for RCTs, ROBINS-I for non-randomized comparative studies); "not applicable" for records with no comparative patient data. Assessments exist for excluded comparative studies too, so this field doesn't reveal eligibility. */
  rob: { tool: "RoB 2" | "ROBINS-I" | "not applicable"; judgment: string; notes: string };
  /** Toy 2-D "abstract embedding" used by the semantic-search lab. */
  vec: [number, number];
};

/** The review question and inclusion criteria (PICO + design), shown to learners and to Claude. */
export const REVIEW_QUESTION = "In adults with bloodstream infection, does rapid molecular identification from positive blood cultures (vs conventional culture-based identification) reduce time to optimal antibiotic therapy?";
export const CRITERIA = `Include a study only if ALL of these hold:
P (population): adults (18 years or older) with a bloodstream infection, i.e. a positive blood culture.
I (intervention): rapid MOLECULAR (nucleic-acid based) identification run on positive blood culture broth, e.g. a multiplex PCR panel. Mass spectrometry (MALDI-TOF) is not molecular. Tests run on whole blood before the culture turns positive are out of scope.
C (comparator): conventional culture-based identification.
O (outcome): reports time to optimal antibiotic therapy (time from blood culture positivity to the first dose of the narrowest effective antibiotic).
Design: original research with patient-level data comparing the two approaches (randomized trial, cohort, or before-after study). Exclude reviews, editorials, conference abstracts without outcome data, single-arm studies, modelling studies and laboratory studies.`;

type Criterion = "population" | "intervention" | "comparator" | "outcome" | "design";
/** Answer key: included studies, and for every excluded study the decisive criterion it fails (others may also fail). */
export const KEY: { included: string[]; excluded: Record<string, { fails: Criterion; reason: string }> } = {
  included: ["MS-01", "MS-02", "MS-04", "MS-06", "MS-09", "MS-12"],
  excluded: {
    "MS-03": { fails: "population", reason: "Children and neonates, not adults." },
    "MS-05": { fails: "outcome", reason: "Reports 30-day mortality only; no time to optimal therapy." },
    "MS-07": { fails: "design", reason: "Narrative review, not original research." },
    "MS-08": { fails: "design", reason: "Editorial, no data." },
    "MS-10": { fails: "intervention", reason: "MALDI-TOF mass spectrometry is not molecular identification." },
    "MS-11": { fails: "design", reason: "Conference abstract without outcome data." },
    "MS-13": { fails: "population", reason: "Urinary tract infection without bloodstream infection." },
    "MS-14": { fails: "intervention", reason: "Test run on whole blood before culture positivity." },
    "MS-15": { fails: "comparator", reason: "Single-arm study with no comparator group." },
    "MS-16": { fails: "design", reason: "Modelling (cost-effectiveness) study without patient-level data." },
    "MS-17": { fails: "population", reason: "Laboratory study on spiked samples, no patients." },
    "MS-18": { fails: "outcome", reason: "Reports time to organism identification only, not time to therapy." },
  },
};

/** Capstone key beyond the included set. */
export const SYNTHESIS_KEY = {
  direction: "reduces",
  certainty: "moderate",
  rationale: "Three RCTs (MS-01, MS-02, MS-09; 962 patients) start at high certainty. Risk of bias is not serious overall (two low, one some concerns). Downgrade one level for inconsistency: MS-09 found a small, non-significant difference while MS-01 and MS-02 found large reductions (fictional I² = 64%). Imprecision and indirectness not serious; publication bias not suspected, though with only three trials it cannot be assessed reliably (funnel-plot methods need about 10 or more studies). Observational studies (MS-04, MS-06, MS-12) agree in direction, but after rating down for their serious/moderate risk of bias (ROBINS-I) they are lower certainty than the trials, so they don't raise it.",
};

const F = "(fictional)";
export const STUDIES: Study[] = [
  {
    id: "MS-01", title: "Multiplex PCR identification of positive blood cultures and time to optimal therapy: the QUILL randomized trial", authors: "Quillfeather A, Mossgrave R, Tindlewick S " + F, journal: "Journal of Imaginary Diagnostics " + F, year: 2022,
    design: "RCT", population: "Adults with a positive blood culture, two hospitals", intervention: "Multiplex PCR panel on positive blood culture broth", comparator: "Conventional culture-based identification", outcomes: "Time to optimal antibiotic therapy; 30-day mortality; length of stay", n: 412,
    effect: "Median time to optimal therapy 21 h vs 45 h (difference -24 h, 95% CI -30 to -18)",
    abstract: "Background: Delays in identifying organisms in bloodstream infection can delay effective, narrow antibiotic therapy. Methods: We randomized 412 adults with a positive blood culture to identification by a multiplex PCR panel run on the culture broth or to conventional culture-based identification. The primary outcome was time to optimal antibiotic therapy. Results: Median time to optimal therapy was 21 hours with PCR and 45 hours with conventional identification (difference -24 h, 95% CI -30 to -18). 30-day mortality did not differ. Conclusion: Rapid molecular identification shortened time to optimal therapy.",
    rob: { tool: "RoB 2", judgment: "low", notes: "Central computer randomization, concealed allocation, complete outcome data, objective outcome from the medication record, prespecified analysis." },
    vec: [0.78, 0.72],
  },
  {
    id: "MS-02", title: "Rapid PCR identification with stewardship review versus culture: an open-label randomized trial in bloodstream infection", authors: "Brackenfell O, Ashgrove N " + F, journal: "Meridian Proceedings of Clinical Microbiology " + F, year: 2023,
    design: "RCT", population: "Adults with bloodstream infection (positive blood culture), one hospital", intervention: "Multiplex PCR panel on positive blood culture broth plus antimicrobial stewardship review", comparator: "Conventional culture-based identification", outcomes: "Time to optimal antibiotic therapy", n: 300,
    effect: "Median time to optimal therapy 26 h vs 40 h (difference -14 h, 95% CI -20 to -8)",
    abstract: "Methods: In this open-label randomized trial, 300 adults with bloodstream infection were assigned to multiplex PCR identification of positive blood culture broth with same-day stewardship review, or to conventional culture-based identification. Results: Median time to optimal antibiotic therapy was 26 h vs 40 h (difference -14 h, 95% CI -20 to -8). Clinicians knew group allocation. Conclusion: PCR identification combined with stewardship reduced time to optimal therapy; the contribution of each component cannot be separated.",
    rob: { tool: "RoB 2", judgment: "some concerns", notes: "Open label: clinicians knew allocation, possible deviations from intended interventions; outcome objective. Co-intervention (stewardship) also limits directness." },
    vec: [0.75, 0.75],
  },
  {
    id: "MS-03", title: "Molecular identification of blood culture isolates in a neonatal and paediatric unit", authors: "Larkspur-Vale T, Hennicot P " + F, journal: "Imaginary Journal of Child Health " + F, year: 2021,
    design: "cohort", population: "Neonates and children under 16 with bloodstream infection", intervention: "Multiplex PCR panel on positive blood culture broth", comparator: "Conventional culture-based identification", outcomes: "Time to optimal antibiotic therapy", n: 188,
    effect: "Median 30 h vs 49 h (children)",
    abstract: "We compared multiplex PCR identification of positive blood cultures with conventional identification in 188 neonates and children under 16 years with bloodstream infection. Median time to optimal antibiotic therapy was 30 h vs 49 h. Rapid identification may benefit paediatric patients.",
    rob: { tool: "ROBINS-I", judgment: "moderate", notes: "Concurrent comparison in one unit; some confounding by illness severity." },
    vec: [0.66, 0.58],
  },
  {
    id: "MS-04", title: "Molecular identification of positive blood cultures and time to optimal therapy: a retrospective multicentre cohort", authors: "Ferncastle M, Odalys Rue J " + F, journal: "Journal of Imaginary Diagnostics " + F, year: 2020,
    design: "cohort", population: "Adults with a positive blood culture, three hospitals", intervention: "Multiplex PCR panel on positive blood culture broth", comparator: "Conventional culture-based identification (hospitals without the panel)", outcomes: "Time to optimal antibiotic therapy; mortality", n: 680,
    effect: "Median 24 h vs 48 h (adjusted difference -21 h)",
    abstract: "Methods: Retrospective cohort of 680 adults with a positive blood culture in three hospitals, comparing hospitals that used a multiplex PCR panel on positive blood culture broth with hospitals using conventional culture-based identification. Results: Median time to optimal antibiotic therapy was 24 h vs 48 h (adjusted difference -21 h). Hospitals differed in stewardship staffing. Conclusion: Molecular identification was associated with faster optimal therapy, but residual confounding is likely.",
    rob: { tool: "ROBINS-I", judgment: "serious", notes: "Confounding by hospital (stewardship staffing, case mix) only partly adjusted." },
    vec: [0.8, 0.68],
  },
  {
    id: "MS-05", title: "Rapid molecular identification and 30-day mortality in adult bloodstream infection", authors: "Pemberwick D " + F, journal: "Meridian Proceedings of Clinical Microbiology " + F, year: 2021,
    design: "cohort", population: "Adults with a positive blood culture", intervention: "Multiplex PCR panel on positive blood culture broth", comparator: "Conventional culture-based identification", outcomes: "30-day mortality only", n: 540,
    effect: null,
    abstract: "We studied 540 adults with a positive blood culture identified either by a multiplex PCR panel or by conventional culture. The only outcome was 30-day all-cause mortality, which was 14% vs 15% (adjusted odds ratio 0.94). Antibiotic timing was not recorded.",
    rob: { tool: "ROBINS-I", judgment: "serious", notes: "Allocation by laboratory workflow with limited adjustment for confounding." },
    vec: [0.7, 0.62],
  },
  {
    id: "MS-06", title: "Introducing molecular identification of positive blood cultures: a before-after study", authors: "Hollowmere C, Strand-Abbot I " + F, journal: "Imaginary Antimicrobial Review " + F, year: 2019,
    design: "before-after", population: "Adults with bloodstream infection, one hospital", intervention: "Multiplex PCR panel on positive blood culture broth (after period)", comparator: "Conventional culture-based identification (before period)", outcomes: "Time to optimal antibiotic therapy", n: 520,
    effect: "Median 20 h vs 44 h",
    abstract: "Methods: We compared 260 adults with bloodstream infection in the 12 months before and 260 in the 12 months after the laboratory introduced a multiplex PCR panel on positive blood culture broth, replacing conventional culture-based identification for first reporting. Results: Median time to optimal antibiotic therapy fell from 44 h to 20 h. A new stewardship team started during the after period. Conclusion: Time to optimal therapy improved after the change; other changes over time may contribute.",
    rob: { tool: "ROBINS-I", judgment: "serious", notes: "Secular trends and a co-occurring stewardship programme confound the before-after comparison." },
    vec: [0.77, 0.66],
  },
  {
    id: "MS-07", title: "Rapid diagnostics for bloodstream infection: a narrative review", authors: "Winterbourne G " + F, journal: "Imaginary Antimicrobial Review " + F, year: 2022,
    design: "review", population: "Not applicable", intervention: "Various rapid diagnostics", comparator: "Not applicable", outcomes: "Narrative summary", n: null, effect: null,
    abstract: "This narrative review summarises rapid diagnostic technologies for bloodstream infection, including molecular panels and mass spectrometry, and discusses how they may shorten time to optimal antibiotic therapy. No new data are presented.",
    rob: { tool: "not applicable", judgment: "not applicable", notes: "No comparative patient-level data to assess." },
    vec: [0.62, 0.7],
  },
  {
    id: "MS-08", title: "Editorial: faster is not always better in bloodstream infection diagnostics", authors: "Calloway-Fenn B " + F, journal: "Meridian Proceedings of Clinical Microbiology " + F, year: 2023,
    design: "editorial", population: "Not applicable", intervention: "Not applicable", comparator: "Not applicable", outcomes: "Opinion", n: null, effect: null,
    abstract: "In this editorial we argue that rapid molecular identification only shortens time to optimal antibiotic therapy when results are acted on, and that laboratories should pair new tests with stewardship.",
    rob: { tool: "not applicable", judgment: "not applicable", notes: "No comparative patient-level data to assess." },
    vec: [0.58, 0.73],
  },
  {
    id: "MS-09", title: "PCR panel identification versus conventional identification of positive blood cultures: a pragmatic randomized trial", authors: "Okafield R, Marrowby L, Venn-Castell H " + F, journal: "Journal of Imaginary Diagnostics " + F, year: 2024,
    design: "RCT", population: "Adults with a positive blood culture, four hospitals", intervention: "Multiplex PCR panel on positive blood culture broth", comparator: "Conventional culture-based identification", outcomes: "Time to optimal antibiotic therapy; length of stay", n: 250,
    effect: "Median 33 h vs 37 h (difference -4 h, 95% CI -10 to +2)",
    abstract: "Methods: Pragmatic randomized trial in four hospitals; 250 adults with a positive blood culture were allocated to multiplex PCR identification of culture broth or conventional culture-based identification. Results were reported to wards without additional stewardship input. Results: Median time to optimal antibiotic therapy was 33 h vs 37 h (difference -4 h, 95% CI -10 to +2). Conclusion: Without active follow-up of results, the reduction in time to optimal therapy was small and uncertain.",
    rob: { tool: "RoB 2", judgment: "low", notes: "Concealed allocation, complete follow-up, objective outcome, prespecified analysis." },
    vec: [0.74, 0.7],
  },
  {
    id: "MS-10", title: "MALDI-TOF mass spectrometry directly from positive blood cultures and time to optimal therapy", authors: "Durnhallow K " + F, journal: "Imaginary Journal of Laboratory Medicine " + F, year: 2021,
    design: "cohort", population: "Adults with a positive blood culture", intervention: "MALDI-TOF mass spectrometry on positive blood culture broth", comparator: "Conventional culture-based identification", outcomes: "Time to optimal antibiotic therapy", n: 430,
    effect: "Median 27 h vs 42 h",
    abstract: "We evaluated rapid identification of organisms by MALDI-TOF mass spectrometry performed directly on positive blood culture broth in 430 adults, compared with conventional culture-based identification. Median time to optimal antibiotic therapy was 27 h vs 42 h.",
    rob: { tool: "ROBINS-I", judgment: "moderate", notes: "Concurrent comparison; adjusted for age and source of infection." },
    vec: [0.62, 0.48],
  },
  {
    id: "MS-11", title: "Early experience with a molecular blood culture panel (conference abstract)", authors: "Seabright Y " + F, journal: "Imaginary Congress of Infection, Abstract Book " + F, year: 2024,
    design: "conference abstract", population: "Adults with bloodstream infection", intervention: "Multiplex PCR panel on positive blood culture broth", comparator: "Conventional culture-based identification", outcomes: "Planned: time to optimal therapy (not yet reported)", n: null, effect: null,
    abstract: "Conference abstract. We describe the first six months of using a multiplex PCR panel on positive blood cultures in adults with bloodstream infection. Analysis of time to optimal antibiotic therapy versus conventional identification is ongoing and will be presented later.",
    rob: { tool: "not applicable", judgment: "not applicable", notes: "No comparative patient-level data to assess." },
    vec: [0.72, 0.78],
  },
  {
    id: "MS-12", title: "Prospective cohort of molecular versus culture identification in adult bloodstream infection", authors: "Thistledown E, Garamond-Peel A " + F, journal: "Imaginary Antimicrobial Review " + F, year: 2023,
    design: "cohort", population: "Adults with a positive blood culture, two hospitals", intervention: "Multiplex PCR panel on positive blood culture broth", comparator: "Conventional culture-based identification", outcomes: "Time to optimal antibiotic therapy", n: 390,
    effect: "Median 28 h vs 46 h (adjusted difference -15 h)",
    abstract: "Methods: Prospective cohort of 390 adults with a positive blood culture; identification by multiplex PCR panel on culture broth or conventional culture-based identification depended on the time of day the culture flagged positive. Results: Median time to optimal antibiotic therapy was 28 h vs 46 h (adjusted difference -15 h). Conclusion: Molecular identification was associated with shorter time to optimal therapy.",
    rob: { tool: "ROBINS-I", judgment: "moderate", notes: "Allocation by time of day reduces but does not remove confounding; outcome objectively measured." },
    vec: [0.79, 0.74],
  },
  {
    id: "MS-13", title: "Rapid molecular testing of urine in urinary tract infection without bacteremia", authors: "Pollenbridge U " + F, journal: "Imaginary Journal of Laboratory Medicine " + F, year: 2022,
    design: "cohort", population: "Adults with urinary tract infection without bacteremia", intervention: "Rapid molecular test on urine", comparator: "Urine culture", outcomes: "Time to optimal antibiotic therapy", n: 610,
    effect: "Median 19 h vs 38 h (urine)",
    abstract: "Bacteremia was absent in all 610 adults with urinary tract infection in this cohort. A rapid molecular test on urine was compared with urine culture; time to optimal antibiotic therapy was 19 h vs 38 h. Bacteremia patients were excluded by design.",
    rob: { tool: "ROBINS-I", judgment: "moderate", notes: "Concurrent comparison; outcome objectively measured." },
    vec: [0.28, 0.6],
  },
  {
    id: "MS-14", title: "Direct molecular detection in whole blood before culture positivity", authors: "Gallowmarsh F " + F, journal: "Journal of Imaginary Diagnostics " + F, year: 2023,
    design: "cohort", population: "Adults with suspected sepsis", intervention: "Molecular detection on whole blood drawn at presentation, before any culture result", comparator: "Conventional blood culture", outcomes: "Time to optimal antibiotic therapy", n: 290,
    effect: "Median 16 h vs 40 h",
    abstract: "In 290 adults with suspected sepsis we tested whole blood at presentation with a molecular assay, without waiting for blood cultures to turn positive, and compared it with conventional blood culture. Median time to optimal antibiotic therapy was 16 h vs 40 h.",
    rob: { tool: "ROBINS-I", judgment: "serious", notes: "Testing offered at clinician discretion: confounding by indication." },
    vec: [0.55, 0.6],
  },
  {
    id: "MS-15", title: "Implementing a molecular blood culture panel: a single-arm evaluation", authors: "Rookwood-Haye S " + F, journal: "Imaginary Antimicrobial Review " + F, year: 2020,
    design: "single-arm", population: "Adults with a positive blood culture", intervention: "Multiplex PCR panel on positive blood culture broth", comparator: "None", outcomes: "Time to optimal antibiotic therapy", n: 150,
    effect: "Median 22 h (no comparison group)",
    abstract: "We describe 150 consecutive adults with a positive blood culture identified with a multiplex PCR panel on culture broth. Median time to optimal antibiotic therapy was 22 h. There was no comparison group.",
    rob: { tool: "not applicable", judgment: "not applicable", notes: "No comparative patient-level data to assess." },
    vec: [0.7, 0.8],
  },
  {
    id: "MS-16", title: "Cost-effectiveness of molecular identification of positive blood cultures: a decision model", authors: "Ledgerwood P " + F, journal: "Imaginary Health Economics Letters " + F, year: 2024,
    design: "modelling study", population: "Hypothetical cohort of adults with bloodstream infection", intervention: "Multiplex PCR panel on positive blood culture broth", comparator: "Conventional culture-based identification", outcomes: "Modelled cost per quality-adjusted life year", n: null, effect: null,
    abstract: "We built a decision model for a hypothetical cohort of adults with bloodstream infection, using assumed values for time to optimal antibiotic therapy, to estimate the cost-effectiveness of molecular identification versus conventional culture. No patient-level data were collected.",
    rob: { tool: "not applicable", judgment: "not applicable", notes: "No comparative patient-level data to assess." },
    vec: [0.6, 0.82],
  },
  {
    id: "MS-17", title: "Analytical performance of a multiplex PCR panel on spiked blood culture bottles", authors: "Ironvale M " + F, journal: "Imaginary Journal of Laboratory Medicine " + F, year: 2021,
    design: "laboratory study", population: "Blood culture bottles spiked with reference strains (no patients)", intervention: "Multiplex PCR panel", comparator: "Reference identification", outcomes: "Sensitivity and specificity of identification", n: null, effect: null,
    abstract: "We measured the sensitivity and specificity of a multiplex PCR panel on blood culture bottles spiked with reference strains. No patients were enrolled and no treatment outcomes were measured.",
    rob: { tool: "not applicable", judgment: "not applicable", notes: "No comparative patient-level data to assess." },
    vec: [0.45, 0.4],
  },
  {
    id: "MS-18", title: "Turnaround time of molecular versus conventional identification of positive blood cultures: a randomized laboratory trial", authors: "Fairhallow N, Quint-Berry O " + F, journal: "Imaginary Journal of Laboratory Medicine " + F, year: 2022,
    design: "RCT", population: "Adults with a positive blood culture", intervention: "Multiplex PCR panel on positive blood culture broth", comparator: "Conventional culture-based identification", outcomes: "Time to organism identification only", n: 320,
    effect: null,
    abstract: "Positive blood cultures from 320 adults were randomized to identification by multiplex PCR panel or conventional culture. Median time to organism identification was 2 h vs 26 h. Antibiotic therapy was not studied. Rapid molecular identification dramatically shortened laboratory turnaround.",
    rob: { tool: "RoB 2", judgment: "low", notes: "Concealed allocation of samples; objective laboratory outcome." },
    vec: [0.68, 0.52],
  },
];

export const studyById = (id: string) => STUDIES.find(s => s.id === id);

/** Cohen's kappa for two raters' categorical labels on the same items: κ = (po - pe) / (1 - pe). */
export function cohenKappa(a: string[], b: string[]): number {
  if (a.length !== b.length || !a.length) throw new Error("need two equal-length, non-empty label lists");
  const n = a.length;
  const cats = [...new Set([...a, ...b])];
  const po = a.filter((x, i) => x === b[i]).length / n;
  const pe = cats.reduce((s, c) => s + (a.filter(x => x === c).length / n) * (b.filter(x => x === c).length / n), 0);
  if (pe === 1) return 1; // both raters used one identical category throughout
  return (po - pe) / (1 - pe);
}

/** Landis & Koch (1977) descriptive labels for kappa. */
export function kappaLabel(k: number): string {
  if (k < 0) return "poor";
  if (k <= 0.2) return "slight";
  if (k <= 0.4) return "fair";
  if (k <= 0.6) return "moderate";
  if (k <= 0.8) return "substantial";
  return "almost perfect";
}

/** Reciprocal rank fusion: score(d) = Σ over rankings of 1 / (k + rank(d)), ranks starting at 1. */
export function rrf(rankings: string[][], k = 60): { id: string; score: number }[] {
  const s = new Map<string, number>();
  for (const r of rankings) r.forEach((id, i) => s.set(id, (s.get(id) || 0) + 1 / (k + i + 1)));
  return [...s.entries()].map(([id, score]) => ({ id, score })).sort((x, y) => y.score - x.score);
}
