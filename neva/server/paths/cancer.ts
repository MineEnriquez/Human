// Cancer Genomics: lab agent tools over the fictional Cascade Ridge AML-0412 dataset.
import { z } from "zod";
import { CHUNKS, search } from "../../src/content/cancer/corpus";
import { QC, SAMPLES, VARIANTS, ccf, sample, type SampleId } from "../../src/content/cancer/dataset";
import type { ServerPath, ToolDef, ToolResult } from "./types";

const SAMPLE_IDS = SAMPLES.map(s => s.id);

const TOOLS: ToolDef[] = [
  { name: "search_variants", description: "Search the variant calls for patient AML-0412 (fictional). Every filter is optional (null). Returns one row per variant per sample with VAF, depth and QC flags.", input_schema: { type: "object", properties: { gene: { type: ["string", "null"], description: "Gene symbol, e.g. NPM1. Use null for all genes." }, sample: { type: ["string", "null"], description: `Sample id: ${SAMPLE_IDS.join(", ")}. Use null for all samples.` }, min_vaf: { type: ["number", "null"], description: "Only calls with VAF at or above this fraction (0-1). Use null for no minimum." } }, required: ["gene", "sample", "min_vaf"], additionalProperties: false } },
  { name: "get_vaf_timeline", description: "VAF and depth of one variant across all samples (diagnosis, remission, relapse, skin germline control), with QC flags and lab notes.", input_schema: { type: "object", properties: { variant_id: { type: "string", description: "Variant id, e.g. IDH2-R140Q. Use search_variants to find ids." } }, required: ["variant_id"], additionalProperties: false } },
  { name: "get_sample_qc", description: "Sample metadata and QC: timepoint, blast percentage, tumor purity estimate, mean depth, flags.", input_schema: { type: "object", properties: { sample_id: { type: "string", description: `One of ${SAMPLE_IDS.join(", ")}.` } }, required: ["sample_id"], additionalProperties: false } },
  { name: "search_sops", description: "Search the lab's SOPs and policies (variant tiering, germline findings, sequencing QC, purity and CCF, MRD markers, report release). Returns the best-matching passages with ids.", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false } },
];

const Inputs = {
  search_variants: z.object({ gene: z.string().nullable(), sample: z.string().nullable(), min_vaf: z.number().min(0).max(1).nullable() }),
  get_vaf_timeline: z.object({ variant_id: z.string() }),
  get_sample_qc: z.object({ sample_id: z.string() }),
  search_sops: z.object({ query: z.string().min(1) }),
};

export function runTool(name: string, input: unknown): ToolResult {
  const schema = Inputs[name as keyof typeof Inputs];
  if (!schema) return { ok: false, out: `Unknown tool ${name}` };
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, out: "INVALID_INPUT: " + p.error.message };
  const v = p.data as Record<string, unknown>;
  const norm = (s: unknown) => String(s ?? "").toUpperCase();
  switch (name) {
    case "search_variants": {
      if (v.sample && !SAMPLE_IDS.includes(norm(v.sample) as SampleId)) return { ok: false, out: `No sample ${v.sample}. Samples: ${SAMPLE_IDS.join(", ")}` };
      const rows = VARIANTS.filter(x => !v.gene || norm(x.gene) === norm(v.gene)).flatMap(x =>
        SAMPLE_IDS.filter(s => !v.sample || s === norm(v.sample)).map(s => ({ variant_id: x.id, gene: x.gene, hgvs_c: x.hgvsC, hgvs_p: x.hgvsP, sample: s, vaf: x.calls[s].vaf, depth: x.calls[s].depth, flags: x.calls[s].flags })))
        .filter(r => v.min_vaf == null || r.vaf >= (v.min_vaf as number));
      return { ok: true, out: rows };
    }
    case "get_vaf_timeline": {
      const x = VARIANTS.find(y => norm(y.id) === norm(v.variant_id));
      if (!x) return { ok: false, out: `No variant ${v.variant_id}. Known ids: ${VARIANTS.map(y => y.id).join(", ")}` };
      return { ok: true, out: { variant_id: x.id, gene: x.gene, hgvs_c: x.hgvsC, hgvs_p: x.hgvsP, kind: x.kind, note: x.note || null, timeline: SAMPLE_IDS.map(s => ({ sample: s, vaf: x.calls[s].vaf, depth: x.calls[s].depth, flags: x.calls[s].flags })) } };
    }
    case "get_sample_qc": {
      const s = sample(norm(v.sample_id));
      if (!s) return { ok: false, out: `No sample ${v.sample_id}. Samples: ${SAMPLE_IDS.join(", ")}` };
      return { ok: true, out: { ...s, reporting_thresholds: { min_depth: QC.minDepth, orthogonal_confirmation_below_vaf: QC.confirmBelowVaf, strand_bias: "requires orthogonal confirmation" } } };
    }
    case "search_sops":
      return { ok: true, out: search(String(v.query), 3).map(r => ({ id: r.chunk.id, title: r.chunk.title, text: r.chunk.text })) };
  }
  return { ok: false, out: "unreachable" };
}

// Kept here (not only in the prompt) so tests can check the grader's numbers against the data.
const pct = (x: number | null) => (x == null ? "n/a" : x.toFixed(2));
const dx = sample("BM-DX")!.purity, rel = sample("BM-REL")!.purity;
const raw = (vaf: number, p: number | null) => (p ? (2 * vaf) / p : null);
const ccfLine = VARIANTS.filter(x => x.gene !== "DDX41" && x.gene !== "KRAS").map(x => `${x.gene} CCF ${pct(ccf(x.calls["BM-DX"].vaf, dx))} at diagnosis, ${pct(ccf(x.calls["BM-REL"].vaf, rel))} at relapse (uncapped ${pct(raw(x.calls["BM-DX"].vaf, dx))} / ${pct(raw(x.calls["BM-REL"].vaf, rel))})`).join("; ") + ". DNMT3A exceeds 1 uncapped, consistent with the variant also being in non-leukemic clonal hematopoiesis cells, where the CCF formula is not strictly valid (PUR1-2).";

export const cancer: ServerPath = {
  id: "cancer-genomics",
  title: "Cancer Genomics",
  setting: "fictional Cascade Ridge Cancer Research Center, translational genomics lab, studying the clonal evolution of a fictional acute myeloid leukemia patient (AML-0412) from diagnosis to relapse",
  chunks: CHUNKS,
  search,
  tools: TOOLS,
  runTool,
  agentPrompt: `You are the AI lab assistant for the translational genomics lab at the Cascade Ridge Cancer Research Center (fictional teaching case). A learner is preparing patient AML-0412's case for the molecular tumor board (a research review of the sequencing data) and directs you. Use your tools to fetch facts; never invent variants, VAFs or SOP text. Do what the learner asks, report what the tool results show, compute cancer cell fractions when asked (state the assumptions: heterozygous, diploid, copy-neutral), and point out QC caveats. Do not classify the variants or state the final conclusion for them: the learner must decide which variants are founder, lost, relapse-driving, germline or artifact, so when they ask "what's the answer" offer evidence and a question instead. Never make treatment recommendations; treatment is decided by the clinical team. Keep replies under 170 words.`,
  capstoneGrader: `You are Professor Neva grading the capstone of the Cancer Genomics path (fictional AML-0412 case at the fictional Cascade Ridge Cancer Research Center). Answer key: DNMT3A p.R882H and NPM1 c.860_863dupTCTG (p.W288Cfs*12) are founder/truncal (clonal at diagnosis and relapse; DNMT3A persisting at 2% in remission is expected and is not an MRD marker, NPM1 is). FLT3-ITD is a diagnostic subclone lost at relapse (negative by NGS and fragment analysis at relapse). IDH2 p.R140Q is a minor diagnostic subclone that drove relapse. ${ccfLine}. DDX41 frameshift at ~0.5 VAF in all samples including cultured skin fibroblasts is presumed germline: not a tumor finding, reported separately, genetic counseling referral with consent (GL-POL-01). KRAS p.G12D at 3% VAF, 38x depth (about one supporting read) with strand bias fails QC-SOP-05 twice: below 100x it is not assessable (QC05-1), and <5% VAF with strand bias needs orthogonal confirmation (QC05-2). Probable artifact; not reportable. Accept 'unconfirmed/not assessable' as equivalent. A strong report explains the relapse as outgrowth of the IDH2 subclone from the founder clone, names the germline action, makes correct reporting decisions, and states assumptions (CCF formula, purity) without giving treatment advice. Score out of 10: variant classification 3, relapse explanation 2, germline action 2, reporting/QC decisions 2, quality of reasoning 1.`,
};
