// Pathogen Genomics: lab agent tools over the fictional St. Aurelia CRKP dataset.
import { z } from "zod";
import { CHUNKS, search } from "../../src/content/pathogen/corpus";
import { ISOLATES, TRANSFERS, snpDistance } from "../../src/content/pathogen/dataset";
import type { ServerPath, ToolDef, ToolResult } from "./types";

const nullable = (d: string) => ({ type: ["string", "null"], description: d + " Use null for no filter." });

const TOOLS: ToolDef[] = [
  { name: "search_isolates", description: "Search the lab's isolate records. Every filter is optional (null).", input_schema: { type: "object", properties: { ward: nullable("Ward: ICU, Surgical, Oncology, Medical, Outpatient or Environment."), st: nullable("Sequence type, e.g. ST258."), gene: nullable("Carbapenemase gene, e.g. blaKPC-3."), collected_after: nullable("ISO date; only isolates collected on or after it.") }, required: ["ward", "st", "gene", "collected_after"], additionalProperties: false } },
  { name: "get_snp_distances", description: "Pairwise core-genome SNP distances between 2-12 isolates.", input_schema: { type: "object", properties: { isolate_ids: { type: "array", items: { type: "string" }, description: "Isolate ids such as KP-01." } }, required: ["isolate_ids"], additionalProperties: false } },
  { name: "get_ward_transfers", description: "Ward transfers and admission source for the patient an isolate came from.", input_schema: { type: "object", properties: { isolate_id: { type: "string" } }, required: ["isolate_id"], additionalProperties: false } },
  { name: "search_protocols", description: "Search hospital protocols and lab reports (infection prevention, genomic SOPs, drains, QC, stewardship). Returns the best-matching passages with ids.", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false } },
];

const Inputs = {
  search_isolates: z.object({ ward: z.string().nullable(), st: z.string().nullable(), gene: z.string().nullable(), collected_after: z.string().nullable() }),
  get_snp_distances: z.object({ isolate_ids: z.array(z.string()).min(2).max(12) }),
  get_ward_transfers: z.object({ isolate_id: z.string() }),
  search_protocols: z.object({ query: z.string() }),
};

export function runTool(name: string, input: unknown): ToolResult {
  const schema = Inputs[name as keyof typeof Inputs];
  if (!schema) return { ok: false, out: `Unknown tool ${name}` };
  const p = schema.safeParse(input);
  if (!p.success) return { ok: false, out: "INVALID_INPUT: " + p.error.message };
  const v = p.data as Record<string, unknown>;
  const norm = (s: unknown) => String(s ?? "").toLowerCase();
  switch (name) {
    case "search_isolates": {
      const rows = ISOLATES.filter(i =>
        (!v.ward || norm(i.ward) === norm(v.ward)) && (!v.st || norm(i.st) === norm(v.st)) &&
        (!v.gene || norm(i.carbapenemase) === norm(v.gene)) && (!v.collected_after || i.collected >= String(v.collected_after)));
      return { ok: true, out: rows.map(({ vec: _v, ...r }) => r) };
    }
    case "get_snp_distances": {
      const ids = (v.isolate_ids as string[]).filter(id => ISOLATES.some(i => i.id === id));
      const matrix: Record<string, Record<string, number>> = {};
      for (const a of ids) { matrix[a] = {}; for (const b of ids) matrix[a][b] = snpDistance(a, b); }
      const lowCov = ISOLATES.filter(i => ids.includes(i.id) && i.coverage < 30).map(i => i.id);
      return { ok: true, out: { matrix, warnings: lowCov.length ? [`Low coverage (<30x): ${lowCov.join(", ")}; distances unreliable`] : [] } };
    }
    case "get_ward_transfers": {
      const id = String(v.isolate_id);
      const iso = ISOLATES.find(i => i.id === id);
      if (!iso) return { ok: false, out: `No isolate ${id}` };
      return { ok: true, out: { isolate: id, ward_at_collection: iso.ward, transfers: TRANSFERS[id] || [] } };
    }
    case "search_protocols":
      return { ok: true, out: search(String(v.query), 3).map(r => ({ id: r.chunk.id, title: r.chunk.title, text: r.chunk.text })) };
  }
  return { ok: false, out: "unreachable" };
}

export const pathogen: ServerPath = {
  id: "pathogen-genomics",
  title: "Pathogen Genomics",
  setting: "fictional St. Aurelia Medical Center investigating carbapenem-resistant Klebsiella pneumoniae (CRKP)",
  chunks: CHUNKS,
  search,
  tools: TOOLS,
  runTool,
  agentPrompt: `You are the AI lab assistant for the St. Aurelia genomic surveillance team (fictional teaching case). A learner is leading the investigation of carbapenem-resistant Klebsiella pneumoniae and directs you. Use your tools to fetch facts; never invent isolate data. Do what the learner asks, report what the tool results show, and point out data-quality caveats. Do not draw the final conclusion for them: the learner must decide the cluster, the likely reservoir and the next action, so when they ask "what's the answer" offer evidence and a question instead. Keep replies under 170 words.`,
  capstoneGrader: `You are Professor Neva grading the capstone of the Pathogen Genomics path (fictional St. Aurelia CRKP outbreak). Answer key: cluster = KP-01, KP-02, KP-03, KP-04, KP-05, KP-09, KP-11, KP-12 (KP-12 is the ICU bay 3 sink drain). Excluded: KP-06 (ST307, blaKPC-2), KP-07 (ST11, blaNDM-1, 18x coverage, must be re-sequenced), KP-08 (ST258 but 61+ SNPs: separate introduction), KP-10 (ST147, blaOXA-48). Likely reservoir: the ICU bay 3 sink drain (1-5 SNPs from every ICU case). Route: ICU to Surgical via the KP-04 patient's transfer on 8 March, then spread within Surgical. Good next actions follow protocols IP-14 and EN-07 (drain response, contact screening, notify Infection Prevention, re-sequence KP-07). Score out of 10: cluster 3, reservoir 2, route 2, action 2, quality of reasoning 1.`,
};
