// FICTIONAL teaching dataset for the Cancer Genomics path.
// "Cascade Ridge Cancer Research Center" and patient "AML-0412" are invented. Gene names, variant
// notation and the biology (founder clones, subclones, germline vs somatic, cell-type markers) are real
// and used realistically, but every number is constructed so the case has one defensible answer.
// Shared by the browser (labs) and the server (the capstone agent's tools).

// ------------------------------------------------------------------ samples
export type SampleId = "BM-DX" | "BM-REM" | "BM-REL" | "SKIN";
export type Sample = { id: SampleId; label: string; timepoint: string; blasts: string; purity: number | null; meanDepth: number; flags: string[] };

export const SAMPLES: Sample[] = [
  { id: "BM-DX", label: "Bone marrow at diagnosis", timepoint: "2026-01-12 (diagnosis)", blasts: "~85% blasts", purity: 0.85, meanDepth: 850, flags: [] },
  { id: "BM-REM", label: "Bone marrow after induction chemotherapy", timepoint: "2026-02-20 (morphologic remission)", blasts: "<5% blasts", purity: 0.03, meanDepth: 910, flags: [] },
  { id: "BM-REL", label: "Bone marrow at relapse", timepoint: "2026-09-03 (relapse)", blasts: "~80% blasts", purity: 0.8, meanDepth: 820, flags: [] },
  { id: "SKIN", label: "Cultured skin fibroblasts (germline control)", timepoint: "2026-01-12", blasts: "n/a (germline)", purity: null, meanDepth: 600, flags: [] },
];

// ------------------------------------------------------------------ variants
export type VariantClass = "founder" | "lost" | "relapse" | "germline" | "artifact";
export type Call = { vaf: number; depth: number; flags: string[] };
export type Variant = {
  id: string; gene: string; hgvsC: string; hgvsP: string; kind: string;
  calls: Record<SampleId, Call>;
  note?: string;
};

const c = (vaf: number, depth: number, flags: string[] = []): Call => ({ vaf, depth, flags });

export const VARIANTS: Variant[] = [
  { id: "DNMT3A-R882H", gene: "DNMT3A", hgvsC: "c.2645G>A", hgvsP: "p.R882H", kind: "missense",
    calls: { "BM-DX": c(0.45, 812), "BM-REM": c(0.02, 905), "BM-REL": c(0.44, 798), SKIN: c(0, 590) } },
  { id: "NPM1-W288Cfs", gene: "NPM1", hgvsC: "c.860_863dupTCTG", hgvsP: "p.W288Cfs*12", kind: "frameshift (type A)",
    calls: { "BM-DX": c(0.41, 870), "BM-REM": c(0, 930), "BM-REL": c(0.38, 845), SKIN: c(0, 610) } },
  { id: "FLT3-ITD", gene: "FLT3", hgvsC: "internal tandem duplication (juxtamembrane domain, exons 14-15)", hgvsP: "ITD", kind: "internal tandem duplication",
    calls: { "BM-DX": c(0.3, 760), "BM-REM": c(0, 880), "BM-REL": c(0, 790), SKIN: c(0, 560) },
    note: "NGS can underestimate ITD allele burden; the lab also ran fragment analysis, which was positive at diagnosis and negative at relapse." },
  { id: "IDH2-R140Q", gene: "IDH2", hgvsC: "c.419G>A", hgvsP: "p.R140Q", kind: "missense",
    calls: { "BM-DX": c(0.06, 840), "BM-REM": c(0, 900), "BM-REL": c(0.4, 830), SKIN: c(0, 600) } },
  { id: "DDX41-fs", gene: "DDX41", hgvsC: "frameshift (exact coordinate not shown)", hgvsP: "frameshift", kind: "frameshift",
    calls: { "BM-DX": c(0.5, 820), "BM-REM": c(0.51, 900), "BM-REL": c(0.48, 810), SKIN: c(0.49, 595) } },
  { id: "KRAS-G12D", gene: "KRAS", hgvsC: "c.35G>A", hgvsP: "p.G12D", kind: "missense",
    calls: { "BM-DX": c(0, 805), "BM-REM": c(0, 890), "BM-REL": c(0.03, 38, ["strand bias", "low depth"]), SKIN: c(0, 600) } },
];

/** Lab reporting thresholds (mirrors fictional SOP QC-SOP-05 in the corpus). */
export const QC = { minDepth: 100, confirmBelowVaf: 0.05 };

/** Can a call be reported without orthogonal confirmation? */
export function reportable(call: Call): boolean {
  return call.depth >= QC.minDepth && call.vaf >= QC.confirmBelowVaf && !call.flags.includes("strand bias");
}

/**
 * Cancer cell fraction for a heterozygous variant in a diploid, copy-neutral region:
 * CCF ≈ 2 × VAF / purity, capped at 1. Returns null when purity is unknown or zero.
 */
export function ccf(vaf: number, purity: number | null): number | null {
  if (!purity) return null;
  return Math.min(1, (2 * vaf) / purity);
}

export const sample = (id: string) => SAMPLES.find(s => s.id === id);
export const variant = (id: string) => VARIANTS.find(v => v.id === id);

// Answer key for the capstone (checked in the browser; the AI grades the reasoning).
export const TUMOR_BOARD_KEY: { classes: Record<string, VariantClass>; relapse: string; germline: string; reporting: string } = {
  classes: {
    "DNMT3A-R882H": "founder",
    "NPM1-W288Cfs": "founder",
    "FLT3-ITD": "lost",
    "IDH2-R140Q": "relapse",
    "DDX41-fs": "germline",
    "KRAS-G12D": "artifact",
  },
  relapse: "The relapse grew from the founder clone (DNMT3A + NPM1, both clonal at diagnosis and relapse) through the minor IDH2 R140Q subclone (CCF ~0.14 at diagnosis, ~1.0 at relapse); the FLT3-ITD subclone (CCF ~0.71 at diagnosis) was lost and is negative by fragment analysis at relapse.",
  germline: "DDX41 frameshift at ~0.5 VAF in every sample including cultured skin fibroblasts: presumed germline, not a tumor finding; refer for genetic counseling under GL-POL-01 and report separately with consent.",
  reporting: "KRAS G12D (3% VAF, 38x, strand bias; about one supporting read) fails QC-SOP-05 twice: below the 100x minimum it is not assessable (QC05-1), and a call under 5% VAF with strand bias needs orthogonal confirmation (QC05-2). Probable artifact; not reportable. DNMT3A persisting at 2% in remission is expected (it can persist in pre-leukemic or clonal hematopoiesis cells) and is not used as an MRD marker; NPM1 is.",
};

// ------------------------------------------------------------------ single-cell reference atlas (vector database lab)
export type CellType = "HSC/MPP" | "Myeloid progenitor" | "Monocyte" | "Erythroid" | "T cell" | "NK cell" | "B cell";
export const MARKERS: Record<CellType, string[]> = {
  "HSC/MPP": ["CD34"],
  "Myeloid progenitor": ["CD34", "KIT", "MPO"],
  Monocyte: ["CD14", "LYZ"],
  Erythroid: ["HBB", "GATA1"],
  "T cell": ["CD3E"],
  "NK cell": ["NKG7", "GNLY"],
  "B cell": ["CD19", "MS4A1"],
};
export type RefCell = { id: string; type: CellType; tissue: "Bone marrow" | "Peripheral blood"; donor: string; assay: string; vec: [number, number] };

// Toy 2-D embedding (think: two principal components after normalisation). Real atlases use 30-50
// PCs or learned embeddings, and hold millions of cells.
const R = (id: string, type: CellType, tissue: RefCell["tissue"], donor: string, vec: [number, number]): RefCell => ({ id, type, tissue, donor, assay: "3' scRNA-seq", vec });
export const ATLAS: RefCell[] = [
  R("A01", "HSC/MPP", "Bone marrow", "HD-1", [0.29, 0.77]), R("A02", "HSC/MPP", "Bone marrow", "HD-2", [0.32, 0.74]), R("A03", "HSC/MPP", "Bone marrow", "HD-2", [0.27, 0.73]),
  R("A04", "Myeloid progenitor", "Bone marrow", "HD-1", [0.42, 0.66]), R("A05", "Myeloid progenitor", "Bone marrow", "HD-2", [0.44, 0.69]), R("A06", "Myeloid progenitor", "Bone marrow", "HD-1", [0.39, 0.64]),
  R("A07", "Monocyte", "Bone marrow", "HD-1", [0.61, 0.55]), R("A08", "Monocyte", "Peripheral blood", "HD-2", [0.64, 0.53]), R("A09", "Monocyte", "Peripheral blood", "HD-1", [0.6, 0.51]),
  R("A10", "Erythroid", "Bone marrow", "HD-1", [0.19, 0.46]), R("A11", "Erythroid", "Bone marrow", "HD-2", [0.22, 0.43]),
  R("A12", "T cell", "Peripheral blood", "HD-1", [0.74, 0.25]), R("A13", "T cell", "Bone marrow", "HD-2", [0.77, 0.22]), R("A14", "T cell", "Peripheral blood", "HD-2", [0.72, 0.21]),
  R("A15", "NK cell", "Peripheral blood", "HD-1", [0.86, 0.36]), R("A16", "NK cell", "Bone marrow", "HD-2", [0.84, 0.33]),
  R("A17", "B cell", "Peripheral blood", "HD-1", [0.5, 0.2]), R("A18", "B cell", "Bone marrow", "HD-2", [0.53, 0.17]),
];

/** Unlabelled cells from the relapse marrow (BM-REL) that the lab wants to annotate. */
export const QUERY_CELLS: { id: string; vec: [number, number] }[] = [
  { id: "Q1", vec: [0.41, 0.67] },
  { id: "Q2", vec: [0.62, 0.56] },
  { id: "Q3", vec: [0.75, 0.24] },
  { id: "Q4", vec: [0.35, 0.7] },
];

export const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** k-nearest-neighbour label transfer with a majority vote. Ties and weak majorities are reported honestly. */
export function labelTransfer(q: [number, number], k: number, keep: (c: RefCell) => boolean = () => true) {
  const nn = ATLAS.filter(keep).map(c => ({ c, d: dist(q, c.vec) })).sort((a, b) => a.d - b.d).slice(0, k);
  const votes = new Map<CellType, number>();
  for (const n of nn) votes.set(n.c.type, (votes.get(n.c.type) || 0) + 1);
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  const [label, n] = ranked[0] || [null, 0];
  return { neighbours: nn, label, agreement: nn.length ? n / nn.length : 0, tie: ranked.length > 1 && ranked[1][1] === n };
}
