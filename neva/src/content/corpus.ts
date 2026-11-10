// FICTIONAL document library for St. Aurelia Medical Center, already chunked.
// Used by the RAG lab (learner retrieves + packs chunks; Claude answers with citations)
// and by the capstone agent's search_protocols tool.

export type Chunk = { id: string; doc: string; title: string; text: string };

export const CHUNKS: Chunk[] = [
  // IP-14: infection prevention protocol
  { id: "IP14-1", doc: "IP-14", title: "IP-14 Carbapenemase-producing Enterobacterales: scope", text: "This protocol applies to any patient colonised or infected with a carbapenemase-producing Enterobacterales (CPE), including Klebsiella pneumoniae carrying blaKPC, blaNDM, blaOXA-48 or blaVIM. A positive result from any specimen, including a rectal screen, counts." },
  { id: "IP14-2", doc: "IP-14", title: "IP-14 Isolation and precautions", text: "CPE patients are placed in a single room with dedicated equipment and contact precautions (gown and gloves) for the rest of the admission. Do not cohort CPE patients carrying different carbapenemase genes in the same bay." },
  { id: "IP14-3", doc: "IP-14", title: "IP-14 Contact screening", text: "When a new CPE case is identified, every patient who shared a bay with the case in the previous 14 days gets weekly rectal screens for 4 weeks. Screening is extended ward-wide if two or more linked cases occur on the same ward within 28 days." },
  { id: "IP14-4", doc: "IP-14", title: "IP-14 Notification", text: "The laboratory notifies Infection Prevention within 24 hours of a CPE result. Infection Prevention decides whether to declare an outbreak; genomic results support that decision but do not replace the epidemiological review." },

  // GS-03: genomic surveillance SOP
  { id: "GS03-1", doc: "GS-03", title: "GS-03 Interpreting core-genome SNP distances", text: "For K. pneumoniae this hospital classifies pairs of isolates by core-genome SNP distance: 0-20 SNPs is possible recent transmission, 21-50 is indeterminate, and more than 50 is unlikely to be recent transmission. These cut-offs are local and organism-specific; they are not universal." },
  { id: "GS03-2", doc: "GS-03", title: "GS-03 Genomics needs epidemiology", text: "A small SNP distance alone does not prove direct patient-to-patient spread. Always combine genomic distance with an epidemiological link: shared ward or bay, overlapping stay, a transfer, or a shared environmental source." },
  { id: "GS03-3", doc: "GS-03", title: "GS-03 Same sequence type is not enough", text: "Sharing a sequence type (for example ST258) shows two isolates belong to the same lineage, which can circulate across many hospitals for years. Same ST with a large SNP distance should be treated as a separate introduction." },
  { id: "GS03-4", doc: "GS-03", title: "GS-03 Quality thresholds", text: "Do not interpret SNP distances for genomes with mean depth below 30x or with contamination flagged in QC. Re-sequence those isolates first; low-coverage genomes can hide or invent SNPs." },

  // EN-07: water and drains
  { id: "EN07-1", doc: "EN-07", title: "EN-07 Sinks as reservoirs", text: "Handwash sink drains can harbour CPE in biofilm for months and splash organisms onto nearby surfaces and patients. An environmental isolate that is genomically close to patient isolates is evidence for a persistent reservoir." },
  { id: "EN07-2", doc: "EN-07", title: "EN-07 Drain response", text: "When a drain is linked to cases: stop using the sink for patient fluids, remove items within one metre of the sink, start drain disinfection, and consider replacing the trap and pipework. Re-sample the drain two weeks after intervention." },
  { id: "EN07-3", doc: "EN-07", title: "EN-07 Sampling", text: "Environmental sampling is targeted, not routine: sample sinks, drains and shared equipment in bays where genomically linked cases occurred." },

  // R-0319: sequencing run QC report
  { id: "R0319-1", doc: "R-0319", title: "R-0319 Sequencing run summary", text: "Run R-0319 (19 March 2026) sequenced 12 K. pneumoniae isolates on a short-read platform. 11 of 12 genomes passed QC with mean depth between 55x and 81x and no contamination flags." },
  { id: "R0319-2", doc: "R-0319", title: "R-0319 Failed sample", text: "Isolate KP-07 reached a mean depth of only 18x, below the 30x threshold. Its typing (ST11, blaNDM-1) is reported as provisional and KP-07 is queued for re-sequencing." },

  // AS-22: stewardship note
  { id: "AS22-1", doc: "AS-22", title: "AS-22 Carbapenemase classes", text: "KPC and OXA-48 enzymes are serine carbapenemases. NDM, VIM and IMP are metallo-beta-lactamases (MBLs). Avibactam does not inhibit MBLs, so the carbapenemase class matters when stewardship reviews treatment options." },
  { id: "AS22-2", doc: "AS-22", title: "AS-22 Treatment decisions", text: "Gene detection does not replace phenotypic susceptibility testing. Treatment of an individual patient is decided by the treating team with Infectious Diseases, using the lab's susceptibility report." },
];

// Small BM25 index so retrieval is transparent (learners see every score).
const STOP = new Set("a an and are as at be by can do does for from has have how in is it its of on or our should that the their this to was we what when which who why will with".split(" "));
export const tokenize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\- ]+/g, " ").split(/\s+/).filter(w => w && !STOP.has(w));

const docs = CHUNKS.map(c => tokenize(c.title + " " + c.text));
const avg = docs.reduce((n, d) => n + d.length, 0) / docs.length;
const df = new Map<string, number>();
for (const d of docs) for (const w of new Set(d)) df.set(w, (df.get(w) || 0) + 1);

export function search(query: string, k = 5): { chunk: Chunk; score: number }[] {
  const q = tokenize(query);
  const N = docs.length, k1 = 1.4, b = 0.75;
  return docs
    .map((d, i) => {
      let s = 0;
      for (const w of q) {
        const f = d.filter(x => x === w).length;
        if (!f) continue;
        const idf = Math.log(1 + (N - (df.get(w) || 0) + 0.5) / ((df.get(w) || 0) + 0.5));
        s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.length / avg));
      }
      return { chunk: CHUNKS[i], score: Math.round(s * 100) / 100 };
    })
    .filter(r => r.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, k);
}
