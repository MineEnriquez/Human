// The case dossier the whole Cancer Genomics path follows. Everything here is FICTIONAL:
// the center, the patient, the people and the dates. The biology described is real.
import type { Dossier } from "../types";

export const DOSSIER: Dossier = {
  headline: "Case AML-0412: why did the leukemia come back?",
  summary:
    "Patient AML-0412 (fictional) is a 58-year-old with [[b|acute myeloid leukemia]] diagnosed at the Cascade Ridge Cancer Research Center (fictional). " +
    "At diagnosis the marrow was about 85% blasts and carried an [[b|NPM1]] mutation. After standard intensive induction chemotherapy the marrow was in " +
    "morphologic remission (under 5% blasts) and the NPM1 mutation was no longer detected by sequencing. About six months later the blasts were back. " +
    "The translational genomics lab has sequenced every sample with a targeted myeloid [[t|NGS panel]], run [[b|FLT3-ITD]] fragment analysis, and profiled " +
    "the relapse marrow cell by cell with [[b|single-cell RNA-seq]]. You are the lab's AI lead: over three days you will use AI to turn that data into a " +
    "molecular picture the tumor board can rely on, and you will be the one who checks the AI.",
  timeline: [
    { when: "Mon 12 Jan 2026", what: "Diagnosis. Bone marrow **BM-DX** (~85% blasts) and a **skin biopsy** for cultured fibroblasts, the germline control." },
    { when: "Thu 15 Jan 2026", what: "Induction chemotherapy begins." },
    { when: "Fri 20 Feb 2026", what: "Remission marrow **BM-REM**: under 5% blasts; NPM1 not detected by NGS." },
    { when: "Thu 3 Sep 2026", what: "Relapse marrow **BM-REL**: ~80% blasts. Sequencing and single-cell profiling ordered." },
    { when: "Tue 8 Sep, 02:10", what: "Relapse panel finishes. An LLM drafts the report summary.", lesson: "cg-llm" },
    { when: "Tue 8 Sep, 14:00", what: "Single-cell data ready: which cells are the blasts?", lesson: "cg-vdb" },
    { when: "Wed 9 Sep, 10:30", what: "The fellow's three SOP questions for the board packet.", lesson: "cg-rag" },
    { when: "Wed 9 Sep, 16:00", what: "Informatics connects the assistant to the lab's systems.", lesson: "cg-mcp" },
    { when: "Thu 10 Sep, 08:00", what: "Molecular tumor board. You present the molecular picture.", lesson: "cg-capstone" },
  ],
  cast: [
    { name: "Dr. Mara Ellison", role: "Hematologist-oncologist, chairs the molecular tumor board", needs: "A clear account of which clone came back, and what is solid enough to report" },
    { name: "Dr. Kenji Albright", role: "Hematopathologist", needs: "Confidence that the cells called blasts in the single-cell data really are leukemic" },
    { name: "Dr. Ines Varga", role: "Molecular pathology fellow, assembling the board packet", needs: "SOP answers with citations she can paste into the packet" },
    { name: "Sol Navarro", role: "Bioinformatician on call", needs: "To know which pipeline calls survive QC" },
    { name: "Ruth Achebe", role: "Genetic counselor", needs: "Any presumed germline finding routed to her under the lab's policy, not buried in a tumor report" },
    { name: "Omar Haddad", role: "Research informatics", needs: "A tool policy: what the AI assistant may do alone, and what needs a human" },
    { name: "You", role: "AI lead, translational genomics lab", needs: "To use AI to move fast without letting it decide" },
  ],
  facts: [
    { label: "Samples", value: "BM-DX (purity 0.85) · BM-REM (0.03) · BM-REL (0.80) · SKIN (germline control)" },
    { label: "Assays", value: "Targeted myeloid NGS panel (~560-930x) · FLT3-ITD fragment analysis · single-cell RNA-seq of BM-REL" },
    { label: "Variants called", value: "Six, in DNMT3A, NPM1, FLT3, IDH2, DDX41 and KRAS" },
    { label: "Reference data", value: "A healthy bone-marrow single-cell atlas (toy 2-D version in the lab)" },
    { label: "Lab SOPs", value: "Variant classification (AMP/ASCO/CAP tiers), germline findings, QC thresholds, purity/CCF, MRD, report release" },
  ],
  stakes:
    "The tumor board decides what happens next for the patient; that decision belongs to the clinical team. Your job is the molecular picture it rests on: " +
    "which mutations were there from the start, which subclone drove the relapse, which finding is [[w|presumed germline]] and may matter for relatives, " +
    "and which call is [[w|not reportable]]. A fluent but wrong summary here is not a typo: it changes what a room of clinicians believes.",
  deadline: "Molecular tumor board · Thu 10 Sep 2026, 08:00",
};

/** Scene details for each case: who brings it, when, what you hand over, and how it's judged. */
export const SCENES: Record<string, { from: { name: string; role: string; ask: string }; when: string; deliverable: string; success: string[]; hook: string }> = {
  "cg-llm": {
    from: { name: "Dr. Ines Varga", role: "Molecular pathology fellow", ask: "I had the assistant draft the relapse summary for the board packet. It reads beautifully. Can you check every sentence before 07:00?" },
    when: "Tue 8 Sep 2026, 02:10",
    deliverable: "A fact-checked summary: every sentence marked supported or not supported by the variant report, with the reason.",
    success: ["Catch every fabricated or overstated sentence", "Explain why a fluent model writes unsupported claims", "Propose a check that stops this reaching the board"],
    hook: "A fluent paragraph is not a verified paragraph. Tonight you'll see why the model can't tell the difference, and how you can.",
  },
  "cg-vdb": {
    from: { name: "Dr. Kenji Albright", role: "Hematopathologist", ask: "Flow says the blasts are back. In the single-cell data, which cells look like blasts, and how sure can we be?" },
    when: "Tue 8 Sep 2026, 14:00",
    deliverable: "Cell-type labels for four unlabelled relapse cells, each with its neighbour agreement and one caveat.",
    success: ["Label each cell by nearest-neighbour vote and report the agreement", "Show how k and metadata filters change a label", "Explain why 'looks like a progenitor' isn't 'is leukemic'"],
    hook: "A nearest neighbour tells you what a cell resembles. Leukemia is, among other things, a disease of resemblance.",
  },
  "cg-rag": {
    from: { name: "Dr. Ines Varga", role: "Molecular pathology fellow", ask: "Three questions for the packet, and I need the SOP sentence behind each answer: the DDX41 variant, the KRAS call, and how we tier a variant nobody understands yet." },
    when: "Wed 9 Sep 2026, 10:30",
    deliverable: "Three answers grounded only in the lab's SOPs, every claim with a citation, and an honest 'the SOPs don't say' where they don't.",
    success: ["Build the retrieval pipeline in the right order", "Pack the context window with the chunks that matter", "Check that each citation really supports its claim"],
    hook: "Before you trust an answer, ask where it came from. Before you trust a citation, read it.",
  },
  "cg-mcp": {
    from: { name: "Omar Haddad", role: "Research informatics", ask: "I can connect the assistant to the variant database and the QC system before the board. Tell me which tools to expose, and which ones need a person to say yes." },
    when: "Wed 9 Sep 2026, 16:00",
    deliverable: "A tool policy for the lab's MCP server (auto-run, ask first, don't expose) and a reviewed trace of a live session.",
    success: ["Order a full MCP tool call from server discovery to the model's answer", "Sort every tool by the approval it needs", "Audit a live tool call: what ran, with which arguments, what came back"],
    hook: "Giving a model tools is giving it hands. Decide now which hands need a second person watching.",
  },
  "cg-capstone": {
    from: { name: "Dr. Mara Ellison", role: "Chair, molecular tumor board", ask: "Walk us through it: what came back, what's inherited, and what you can stand behind in the report." },
    when: "Thu 10 Sep 2026, 08:00",
    deliverable: "A tumor board report: all six variants classified, the relapse explained, the germline action and the reporting decisions, with your reasoning.",
    success: ["Classify every variant correctly (checked exactly)", "Explain the relapse from VAF and CCF across timepoints, stating assumptions", "Route the presumed germline finding and handle the unreportable call per SOP", "Interpret, don't prescribe: no treatment advice"],
    hook: "Six variants, four samples, one question: why did it come back? Bring evidence, not adjectives.",
  },
};
