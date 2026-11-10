// FICTIONAL teaching dataset for the Pathogen Genomics path.
// "St. Aurelia Medical Center" and every isolate, patient movement and document below are invented.
// Gene names (blaKPC-3, blaNDM-1, ...) and sequence types (ST258, ...) are real names used realistically,
// but the numbers are constructed so the case has a single defensible answer.
// Shared by the browser (labs) and the server (the capstone agent's tools).

export type Isolate = {
  id: string;
  collected: string; // ISO date
  ward: "ICU" | "Surgical" | "Oncology" | "Medical" | "Outpatient" | "Environment";
  source: string;
  species: string;
  st: string; // multilocus sequence type
  carbapenemase: string;
  otherGenes: string[];
  coverage: number; // mean sequencing depth (x)
  vec: [number, number]; // toy 2-D "genome embedding" used by the vector database lab
};

export const ISOLATES: Isolate[] = [
  { id: "KP-01", collected: "2026-03-02", ward: "ICU", source: "blood culture", species: "Klebsiella pneumoniae", st: "ST258", carbapenemase: "blaKPC-3", otherGenes: ["blaSHV-11", "blaTEM-1"], coverage: 74, vec: [0.71, 0.69] },
  { id: "KP-02", collected: "2026-03-05", ward: "ICU", source: "rectal screen", species: "Klebsiella pneumoniae", st: "ST258", carbapenemase: "blaKPC-3", otherGenes: ["blaSHV-11", "blaTEM-1"], coverage: 68, vec: [0.74, 0.66] },
  { id: "KP-03", collected: "2026-03-09", ward: "ICU", source: "tracheal aspirate", species: "Klebsiella pneumoniae", st: "ST258", carbapenemase: "blaKPC-3", otherGenes: ["blaSHV-11", "blaTEM-1"], coverage: 81, vec: [0.68, 0.73] },
  { id: "KP-04", collected: "2026-03-11", ward: "Surgical", source: "wound swab", species: "Klebsiella pneumoniae", st: "ST258", carbapenemase: "blaKPC-3", otherGenes: ["blaSHV-11", "blaTEM-1"], coverage: 59, vec: [0.66, 0.76] },
  { id: "KP-05", collected: "2026-03-14", ward: "Surgical", source: "urine", species: "Klebsiella pneumoniae", st: "ST258", carbapenemase: "blaKPC-3", otherGenes: ["blaSHV-11", "blaTEM-1"], coverage: 63, vec: [0.63, 0.78] },
  { id: "KP-06", collected: "2026-03-12", ward: "Oncology", source: "blood culture", species: "Klebsiella pneumoniae", st: "ST307", carbapenemase: "blaKPC-2", otherGenes: ["blaCTX-M-15"], coverage: 70, vec: [0.22, 0.31] },
  { id: "KP-07", collected: "2026-03-15", ward: "ICU", source: "rectal screen", species: "Klebsiella pneumoniae", st: "ST11", carbapenemase: "blaNDM-1", otherGenes: ["blaCTX-M-15", "armA"], coverage: 18, vec: [0.83, 0.21] },
  { id: "KP-08", collected: "2026-03-16", ward: "Medical", source: "urine", species: "Klebsiella pneumoniae", st: "ST258", carbapenemase: "blaKPC-3", otherGenes: ["blaSHV-11"], coverage: 66, vec: [0.52, 0.88] },
  { id: "KP-09", collected: "2026-03-18", ward: "ICU", source: "blood culture", species: "Klebsiella pneumoniae", st: "ST258", carbapenemase: "blaKPC-3", otherGenes: ["blaSHV-11", "blaTEM-1"], coverage: 77, vec: [0.72, 0.71] },
  { id: "KP-10", collected: "2026-03-20", ward: "Outpatient", source: "urine", species: "Klebsiella pneumoniae", st: "ST147", carbapenemase: "blaOXA-48", otherGenes: ["blaCTX-M-15"], coverage: 72, vec: [0.29, 0.82] },
  { id: "KP-11", collected: "2026-03-21", ward: "Surgical", source: "rectal screen", species: "Klebsiella pneumoniae", st: "ST258", carbapenemase: "blaKPC-3", otherGenes: ["blaSHV-11", "blaTEM-1"], coverage: 61, vec: [0.61, 0.8] },
  { id: "KP-12", collected: "2026-03-19", ward: "Environment", source: "ICU bay 3 handwash sink drain", species: "Klebsiella pneumoniae", st: "ST258", carbapenemase: "blaKPC-3", otherGenes: ["blaSHV-11", "blaTEM-1"], coverage: 55, vec: [0.7, 0.7] },
];

// The newly sequenced isolate the vector-database lab searches with.
export const QUERY_ISOLATE = { id: "KP-13 (new)", collected: "2026-03-22", ward: "ICU", st: "ST258?", vec: [0.69, 0.71] as [number, number] };

// Core-genome SNPs, modelled as sets of mutation labels: distance = size of the symmetric difference.
const A = ["a1", "a2", "a3", "a4", "a5"];
const MUT: Record<string, string[]> = {
  "KP-01": [],
  "KP-12": [...A],
  "KP-02": ["a1", "a2", "b1", "b2"],
  "KP-09": [...A, "d1"],
  "KP-03": [...A, "c1", "c2"],
  "KP-04": [...A, "c1", "c2", "e1", "e2"],
  "KP-05": [...A, "c1", "c2", "e1", "e2", "f1", "f2", "f3"],
  "KP-11": [...A, "c1", "c2", "e1", "e2", "f1", "f2", "f3", "g1", "g2", "g3"],
  "KP-08": Array.from({ length: 61 }, (_, i) => "h" + i),
};
// Isolates of a different sequence type are far away (values illustrative). ST11 shares clonal group CC258
// with ST258, so KP-07 is the closest of the three; unrelated lineages (ST307, ST147) are much further.
const FAR: Record<string, number> = { "KP-06": 11240, "KP-07": 1480, "KP-10": 10870 };

export function snpDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (FAR[a] || FAR[b]) return FAR[a] && FAR[b] ? Math.max(FAR[a], FAR[b]) + 900 : FAR[a] || FAR[b];
  const x = new Set(MUT[a]), y = new Set(MUT[b]);
  let d = 0;
  for (const m of x) if (!y.has(m)) d++;
  for (const m of y) if (!x.has(m)) d++;
  return d;
}

export const TRANSFERS: Record<string, { date: string; from: string; to: string }[]> = {
  "KP-04": [{ date: "2026-03-08", from: "ICU (bay 3)", to: "Surgical" }],
  "KP-05": [{ date: "2026-03-10", from: "Surgical", to: "Surgical (bed next to KP-04's patient)" }],
  "KP-11": [{ date: "2026-03-17", from: "Surgical", to: "Surgical (same bay as KP-05's patient)" }],
  "KP-08": [{ date: "2026-02-10", from: "Admitted from a long-term care facility", to: "Medical" }],
  "KP-07": [{ date: "2026-03-13", from: "Transferred from a hospital abroad", to: "ICU" }],
};

// Answer key for the capstone (checked in the browser; the AI grades the reasoning).
export const OUTBREAK_KEY = {
  cluster: ["KP-01", "KP-02", "KP-03", "KP-04", "KP-05", "KP-09", "KP-11", "KP-12"],
  excluded: { "KP-06": "different ST (ST307) and gene (blaKPC-2)", "KP-07": "different ST (ST11) and mechanism (blaNDM-1); low coverage, re-sequence", "KP-08": "same ST258 but 61+ SNPs away: not recent transmission", "KP-10": "different ST (ST147) and gene (blaOXA-48)" },
  reservoir: "ICU bay 3 handwash sink drain (KP-12 is 1-5 SNPs from every ICU ST258 case)",
  route: "ICU to Surgical via the KP-04 patient's transfer on 2026-03-08, then onward within Surgical",
};
