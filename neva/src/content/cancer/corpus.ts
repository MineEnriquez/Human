// FICTIONAL SOPs and policies of the Cascade Ridge Cancer Research Center's translational genomics lab, already chunked.
// The general rules they describe (the AMP/ASCO/CAP four-tier system, germline vs somatic reasoning, QC practice,
// cancer cell fraction, MRD markers) are real practice described accurately; the document ids, thresholds chosen
// and workflows are invented for the case.
// Used by the RAG lab (learner retrieves + packs chunks; Claude answers with citations) and by the capstone agent's search_sops tool.

import { makeSearch, type Chunk } from "../search";

export const CHUNKS: Chunk[] = [
  // VC-SOP-02: somatic variant classification
  { id: "VC02-1", doc: "VC-SOP-02", title: "VC-SOP-02 Somatic variant classification: four tiers", text: "Somatic variants are classified with the four-tier system of the 2017 AMP/ASCO/CAP joint consensus guideline. Tier I: variants of strong clinical significance. Tier II: variants of potential clinical significance. Tier III: variants of unknown clinical significance. Tier IV: benign or likely benign variants." },
  { id: "VC02-2", doc: "VC-SOP-02", title: "VC-SOP-02 Evidence levels", text: "Tier I rests on level A evidence (an FDA-approved therapy or professional guidelines for that tumor type) or level B (well-powered studies with expert consensus). Tier II rests on level C (approval for a different tumor type, investigational therapies, or multiple small studies with some consensus) or level D (preclinical data or a few case reports without consensus). The classifying scientist records the evidence used for every tier assignment." },
  { id: "VC02-3", doc: "VC-SOP-02", title: "VC-SOP-02 Unknown significance", text: "A variant whose clinical significance cannot be established from the evidence is reported as Tier III, variant of unknown significance. Tier III variants are listed in the report but never described as drivers or as actionable." },
  { id: "VC02-4", doc: "VC-SOP-02", title: "VC-SOP-02 Scope", text: "Tiering applies to somatic variants only. Presumed germline variants follow GL-POL-01 and are not tiered as tumor findings. Tiering describes clinical significance in general; it is not a treatment recommendation for an individual patient." },

  // GL-POL-01: germline findings
  { id: "GL01-1", doc: "GL-POL-01", title: "GL-POL-01 Recognising presumed germline variants", text: "A heterozygous germline variant is present in every cell, so it appears at roughly 40-60% VAF in both the tumor sample and the germline control, and it does not fall in remission. Such a variant is presumed germline, not a tumor finding." },
  { id: "GL01-2", doc: "GL-POL-01", title: "GL-POL-01 Germline control samples", text: "In hematologic cancers, blood, marrow and buccal swabs can contain tumor cells, so cultured skin fibroblasts are the preferred germline control. A variant seen at about 50% in cultured fibroblasts is strong evidence of germline origin." },
  { id: "GL01-3", doc: "GL-POL-01", title: "GL-POL-01 What we must do", text: "When a presumed germline variant is found in a cancer predisposition gene, such as DDX41 in myeloid neoplasms, the lab director flags it, it is reported separately from tumor findings, and the treating team offers referral for genetic counseling and confirmatory germline testing with the patient's consent." },

  // QC-SOP-05: sequencing quality control
  { id: "QC05-1", doc: "QC-SOP-05", title: "QC-SOP-05 Minimum depth", text: "A variant call is reportable only at a read depth of at least 100x at that position. Calls below 100x are listed as not assessable and are not reported as positive or negative." },
  { id: "QC05-2", doc: "QC-SOP-05", title: "QC-SOP-05 Low-level variants and artifacts", text: "Variants below 5% VAF, and any call with a strand-bias flag, require orthogonal confirmation, for example digital PCR, before reporting. Strand bias means the alternate allele is seen almost only on reads from one DNA strand, a common signature of sequencing or library artifacts." },
  { id: "QC05-3", doc: "QC-SOP-05", title: "QC-SOP-05 FLT3-ITD", text: "Short-read NGS can underestimate FLT3 internal tandem duplication allele burden and miss long duplications. FLT3-ITD status and allelic ratio are confirmed by fragment analysis." },

  // PUR-NOTE-1: purity and cancer cell fraction
  { id: "PUR1-1", doc: "PUR-NOTE-1", title: "PUR-NOTE-1 From VAF to cancer cell fraction", text: "Purity is the fraction of cells in a sample that are tumor cells. For a heterozygous variant in a diploid, copy-neutral region, the cancer cell fraction is approximately 2 x VAF / purity. A CCF near 1 means the variant is in essentially all tumor cells (clonal); clearly below 1 means a subclone." },
  { id: "PUR1-2", doc: "PUR-NOTE-1", title: "PUR-NOTE-1 Limits of the formula", text: "The formula fails when copy number is altered, when the variant is also present in non-tumor cells (for example clonal hematopoiesis), and when purity is low or uncertain. In those cases report the VAF and state why a CCF was not computed." },

  // MRD-SOP-03: measurable residual disease
  { id: "MRD3-1", doc: "MRD-SOP-03", title: "MRD-SOP-03 Choosing a marker", text: "NPM1 mutations are the preferred molecular marker for measurable residual disease in NPM1-mutated AML, measured by quantitative PCR. DNMT3A, TET2 and ASXL1 mutations are not used as MRD markers because they often persist in remission in non-leukemic clonal hematopoiesis." },
  { id: "MRD3-2", doc: "MRD-SOP-03", title: "MRD-SOP-03 Interpreting persistence", text: "Persistence of a DNMT3A mutation at low VAF after induction, with NPM1 negative, is expected and does not by itself indicate residual leukemia." },

  // RPT-POL-02: report release
  { id: "RPT2-1", doc: "RPT-POL-02", title: "RPT-POL-02 Release", text: "Molecular reports are released to the treating team only after review and sign-off by the lab director. Unconfirmed low-level calls are never released as positive findings." },
  { id: "RPT2-2", doc: "RPT-POL-02", title: "RPT-POL-02 Drafts and AI tools", text: "Drafts written with AI assistance must have every gene, variant, VAF and sample id checked against the pipeline output before sign-off. Identifiable patient data may only be used in tools approved by the center." },
];

export const search = makeSearch(CHUNKS);
