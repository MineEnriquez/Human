// Neva API: every Claude call lives here, on the server, so the API key never reaches the browser.
//   GET  /api/status          -> { ai: boolean }
//   POST /api/professor       -> NDJSON stream: Professor Neva (Socratic tutor, lesson-aware)
//   POST /api/grade           -> JSON: rubric grading of a seminar answer (structured output)
//   POST /api/quiz            -> JSON: a fresh case-based multiple-choice question (structured output)
//   POST /api/rag             -> NDJSON stream: answer grounded ONLY in the chunks the learner packed, with citations
//   POST /api/agent           -> NDJSON stream: lab assistant agent that calls genomic tools (manual tool loop)
//   POST /api/capstone-grade  -> JSON: grades the outbreak conclusion
import type { IncomingMessage, ServerResponse } from "node:http";
import { existsSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { CHUNKS, search } from "../src/content/corpus";
import { ISOLATES, TRANSFERS, snpDistance } from "../src/content/dataset";

if (existsSync(".env")) process.loadEnvFile(".env");

const MODEL = "claude-opus-5-5";
// Server-side refusal fallback: if a safety classifier declines (pathogen content can trip the
// bio classifier on legitimate surveillance questions), the API re-runs the request on Anthropic's
// recommended fallback model inside the same call.
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

let client: Anthropic | null = null;
const ai = () => (client ??= new Anthropic());
const hasKey = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

type Msg = Anthropic.Beta.BetaMessageParam;

// ------------------------------------------------------------------ prompts
const MARKUP = `Formatting: write short paragraphs and use Markdown lists, **bold** and \`code\`. Colour-code key words with this markup, which the site renders as coloured highlights. Use it for the 2-5 terms that matter most in a reply, not every noun:
[[c|...]] a core AI concept (e.g. [[c|embedding]], [[c|retrieval]], [[c|context window]])
[[b|...]] a biology or genomics term or data item (e.g. [[b|ST258]], [[b|SNP distance]], [[b|blaKPC-3]])
[[t|...]] a tool, API, protocol or system (e.g. [[t|vector database]], [[t|MCP server]], [[t|tools/call]])
[[w|...]] a pitfall, risk or common mistake (e.g. [[w|hallucination]], [[w|same ST is not transmission]])`;

const PROFESSOR = `You are Professor Neva, a university professor who teaches how modern AI (LLMs, vector databases, retrieval-augmented generation and the Model Context Protocol) is used in the life sciences. This course is the Pathogen Genomics path: every idea is taught through a genomic surveillance case at the fictional St. Aurelia Medical Center, where the infection prevention team is investigating carbapenem-resistant Klebsiella pneumoniae.

How you teach:
- Like a real professor running a case-method seminar. Anchor every explanation in the current case, then generalise.
- Socratic first: when a learner asks for an answer they could reason out, ask one guiding question before explaining. If they are stuck after a try, explain directly and clearly.
- Precise and honest. Distinguish what the case data shows from what it does not. Name uncertainty. Correct misconceptions explicitly and kindly ("A common mix-up is... In fact...").
- Brief. Usually 60-180 words. End with one question that checks understanding or pushes the case forward, unless the learner asked you to stop.
- Reward good reasoning specifically ("Good: you linked the SNP distance to the transfer date").
- Use the learner's known misconceptions (given in the lesson context) to target your questions.

Boundaries: the hospital, patients, isolates and documents are fictional teaching material. Stay at the level of public-health surveillance, infection prevention and data analysis. Do not give individual treatment advice; say treatment is decided by the clinical team with susceptibility testing. Do not discuss making organisms more dangerous.

${MARKUP}`;

// ------------------------------------------------------------------ helpers
async function body<T>(req: IncomingMessage): Promise<T> {
  const parts: Buffer[] = [];
  for await (const c of req) parts.push(c as Buffer);
  return JSON.parse(Buffer.concat(parts).toString("utf8") || "{}") as T;
}
function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(data));
}
function ndjson(res: ServerResponse) {
  res.writeHead(200, { "content-type": "application/x-ndjson", "cache-control": "no-cache", "x-accel-buffering": "no" });
  return (o: unknown) => res.write(JSON.stringify(o) + "\n");
}
function errMessage(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "The server's Anthropic API key was rejected. Check ANTHROPIC_API_KEY.";
  if (e instanceof Anthropic.RateLimitError) return "Too many requests right now. Wait a minute and try again.";
  if (e instanceof Anthropic.BadRequestError) return "The request was rejected: " + e.message;
  if (e instanceof Anthropic.APIError) return `Claude API error ${e.status ?? ""}. Try again.`;
  if (e instanceof Error && /credentials|api key/i.test(e.message)) return "No Anthropic API key is configured on the server.";
  return "Couldn't reach Claude. Check the server log and your connection.";
}
const REFUSAL = "Professor Neva can't help with that request. Try rephrasing it around the surveillance case.";

// ------------------------------------------------------------------ /api/professor
type ProfessorReq = { context: string; messages: Msg[] };
async function professor(req: IncomingMessage, res: ServerResponse) {
  const { context, messages } = await body<ProfessorReq>(req);
  const send = ndjson(res);
  try {
    const stream = ai().beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      ...FALLBACK,
      output_config: { effort: "low" },
      // The persona is frozen and cached; the lesson context is fixed for the whole conversation
      // (the client starts a new conversation per lesson), so the prompt prefix never changes mid-chat.
      system: [
        { type: "text", text: PROFESSOR, cache_control: { type: "ephemeral" } },
        { type: "text", text: "Lesson context for this conversation:\n" + context },
      ],
      messages,
    });
    stream.on("text", t => send({ type: "text", text: t }));
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") send({ type: "error", message: REFUSAL });
    // The assistant turn goes back verbatim (thinking blocks included) so history stays append-only.
    send({ type: "done", content: final.content });
  } catch (e) {
    console.error("[professor]", e);
    send({ type: "error", message: errMessage(e) });
  }
  res.end();
}

// ------------------------------------------------------------------ /api/grade
const Grade = z.object({
  score: z.number().int().min(0).max(3).describe("0 = off target, 1 = partial, 2 = solid, 3 = excellent"),
  verdict: z.enum(["Not yet", "Getting there", "Solid", "Excellent"]),
  strengths: z.string().describe("One sentence naming what the learner got right, specifically"),
  gap: z.string().describe("One sentence naming the most important missing or wrong idea; empty if none"),
  nudge: z.string().describe("One Socratic follow-up question that would move the learner forward"),
  misconception: z.string().nullable().describe("A short label for a misconception the answer reveals, or null"),
});
type GradeReq = { lesson: string; question: string; rubric: string[]; answer: string };
async function grade(req: IncomingMessage, res: ServerResponse) {
  const g = await body<GradeReq>(req);
  try {
    const r = await ai().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: "medium", format: betaZodOutputFormat(Grade) },
      system: `You are Professor Neva grading a seminar answer in the Pathogen Genomics path (fictional St. Aurelia Medical Center case). Grade against the rubric only, generously for correct ideas in the learner's own words, strictly for factual errors. Use the colour markup [[c|...]], [[b|...]], [[t|...]], [[w|...]] for at most two key terms in your sentences.`,
      messages: [{ role: "user", content: `Lesson: ${g.lesson}\nQuestion: ${g.question}\nRubric (each point is one idea a strong answer includes):\n${g.rubric.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n\nLearner's answer:\n"""${g.answer.slice(0, 4000)}"""` }],
    });
    if (r.stop_reason === "refusal" || !r.parsed_output) return json(res, 502, { error: REFUSAL });
    json(res, 200, r.parsed_output);
  } catch (e) {
    console.error("[grade]", e);
    json(res, 502, { error: errMessage(e) });
  }
}

// ------------------------------------------------------------------ /api/quiz
const Quiz = z.object({
  question: z.string(),
  options: z.array(z.string()).describe("Exactly four options"),
  answer: z.number().int().min(0).max(3).describe("Index of the correct option"),
  explanation: z.string().describe("Why the answer is right and the most tempting wrong option is wrong, 2-3 sentences"),
});
type QuizReq = { lesson: string; summary: string; avoid: string[]; difficulty: "core" | "challenge" };
async function quiz(req: IncomingMessage, res: ServerResponse) {
  const q = await body<QuizReq>(req);
  try {
    const r = await ai().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: "medium", format: betaZodOutputFormat(Quiz) },
      system: `You write case-based multiple-choice questions for the Pathogen Genomics path of an AI course (fictional St. Aurelia Medical Center CRKP case). Each question puts the learner in a concrete situation from the case and tests understanding, not recall of wording. Exactly four options, one unambiguously correct, distractors that reflect real misconceptions. Use the colour markup [[c|...]], [[b|...]], [[t|...]], [[w|...]] sparingly in the question and explanation.`,
      messages: [{ role: "user", content: `Lesson: ${q.lesson}\nWhat the lesson taught:\n${q.summary}\nDifficulty: ${q.difficulty === "challenge" ? "challenge (combine two ideas, apply to a new situation in the case)" : "core"}\nDon't repeat these questions:\n${q.avoid.map(a => "- " + a).join("\n") || "(none)"}` }],
    });
    const out = r.parsed_output;
    if (r.stop_reason === "refusal" || !out || out.options.length !== 4) return json(res, 502, { error: "The question came back malformed. Try again." });
    json(res, 200, out);
  } catch (e) {
    console.error("[quiz]", e);
    json(res, 502, { error: errMessage(e) });
  }
}

// ------------------------------------------------------------------ /api/rag
type RagReq = { question: string; chunkIds: string[] };
async function rag(req: IncomingMessage, res: ServerResponse) {
  const { question, chunkIds } = await body<RagReq>(req);
  const chosen = chunkIds.map(id => CHUNKS.find(c => c.id === id)).filter((c): c is (typeof CHUNKS)[number] => Boolean(c));
  const send = ndjson(res);
  try {
    // Real RAG step 3: the packed chunks become document blocks with citations enabled, so every
    // claim in the answer points back to the exact sentence it came from.
    const stream = ai().beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      ...FALLBACK,
      output_config: { effort: "low" },
      system: "You answer questions for the St. Aurelia infection prevention team using ONLY the provided documents (fictional teaching material). Cite the documents for every factual claim. If the documents do not contain the answer, say exactly what is missing instead of guessing; do not use outside knowledge. Keep answers under 150 words.",
      messages: [{
        role: "user",
        content: [
          ...chosen.map(c => ({ type: "document" as const, title: `${c.id}: ${c.title}`, source: { type: "text" as const, media_type: "text/plain" as const, data: c.text }, citations: { enabled: true } })),
          { type: "text" as const, text: chosen.length ? question : question + "\n\n(No documents were retrieved.)" },
        ],
      }],
    });
    for await (const ev of stream) {
      // Citations arrive at the start of a text block; the client places them where the block ends.
      if (ev.type === "content_block_stop") { send({ type: "block_end" }); continue; }
      if (ev.type !== "content_block_delta") continue;
      if (ev.delta.type === "text_delta") send({ type: "text", text: ev.delta.text });
      else if (ev.delta.type === "citations_delta" && ev.delta.citation.type === "char_location") {
        const c = chosen[ev.delta.citation.document_index];
        send({ type: "cite", chunk: c?.id, quote: ev.delta.citation.cited_text });
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") send({ type: "error", message: REFUSAL });
    send({ type: "done" });
  } catch (e) {
    console.error("[rag]", e);
    send({ type: "error", message: errMessage(e) });
  }
  res.end();
}

// ------------------------------------------------------------------ /api/agent (tools)
// These tools are what an MCP server for the hospital's genomics lab would expose via tools/list.
// Here they run in-process so learners can watch each tools/call and its result.
const nullable = (d: string) => ({ type: ["string", "null"], description: d + " Use null for no filter." });
const TOOLS = [
  { name: "search_isolates", description: "Search the lab's isolate records. Every filter is optional (null).", input_schema: { type: "object", properties: { ward: nullable("Ward: ICU, Surgical, Oncology, Medical, Outpatient or Environment."), st: nullable("Sequence type, e.g. ST258."), gene: nullable("Carbapenemase gene, e.g. blaKPC-3."), collected_after: nullable("ISO date; only isolates collected on or after it.") }, required: ["ward", "st", "gene", "collected_after"], additionalProperties: false } },
  { name: "get_snp_distances", description: "Pairwise core-genome SNP distances between 2-12 isolates.", input_schema: { type: "object", properties: { isolate_ids: { type: "array", items: { type: "string" }, description: "Isolate ids such as KP-01." } }, required: ["isolate_ids"], additionalProperties: false } },
  { name: "get_ward_transfers", description: "Ward transfers and admission source for the patient an isolate came from.", input_schema: { type: "object", properties: { isolate_id: { type: "string" } }, required: ["isolate_id"], additionalProperties: false } },
  { name: "search_protocols", description: "Search hospital protocols and lab reports (infection prevention, genomic SOPs, drains, QC, stewardship). Returns the best-matching passages with ids.", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false } },
] as const;

const ToolInputs = {
  search_isolates: z.object({ ward: z.string().nullable(), st: z.string().nullable(), gene: z.string().nullable(), collected_after: z.string().nullable() }),
  get_snp_distances: z.object({ isolate_ids: z.array(z.string()).min(2).max(12) }),
  get_ward_transfers: z.object({ isolate_id: z.string() }),
  search_protocols: z.object({ query: z.string() }),
};

function runTool(name: string, input: unknown): { ok: boolean; out: unknown } {
  const schema = ToolInputs[name as keyof typeof ToolInputs];
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

const AGENT = `You are the AI lab assistant for the St. Aurelia genomic surveillance team (fictional teaching case). A learner is leading the investigation of carbapenem-resistant Klebsiella pneumoniae and directs you. Use your tools to fetch facts; never invent isolate data. Do what the learner asks, report what the tool results show, and point out data-quality caveats. Do not draw the final conclusion for them: the learner must decide the cluster, the likely reservoir and the next action, so when they ask "what's the answer" offer evidence and a question instead. Keep replies under 170 words.

${MARKUP}`;

async function agent(req: IncomingMessage, res: ServerResponse) {
  const { messages } = await body<{ messages: Msg[] }>(req);
  const send = ndjson(res);
  const convo: Msg[] = [...messages];
  const added: Msg[] = [];
  try {
    for (let turn = 0; turn < 8; turn++) {
      const stream = ai().beta.messages.stream({
        model: MODEL,
        max_tokens: 64000,
        ...FALLBACK,
        output_config: { effort: "medium" },
        system: [{ type: "text", text: AGENT, cache_control: { type: "ephemeral" } }],
        tools: TOOLS.map(t => ({ ...t, strict: true, eager_input_streaming: true })) as unknown as Anthropic.Beta.BetaTool[],
        messages: convo,
      });
      stream.on("text", t => send({ type: "text", text: t }));
      const final = await stream.finalMessage();
      const assistant: Msg = { role: "assistant", content: final.content };
      convo.push(assistant); added.push(assistant);
      if (final.stop_reason === "refusal") { send({ type: "error", message: REFUSAL }); break; }
      const uses = final.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (final.stop_reason === "max_tokens" && uses.length) { send({ type: "error", message: "The assistant's tool call was cut off. Ask again." }); break; }
      if (final.stop_reason !== "tool_use" || !uses.length) break;
      // All results for one assistant turn go back in a single user message.
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = uses.map(u => {
        send({ type: "tool_call", id: u.id, name: u.name, input: u.input });
        const r = runTool(u.name, u.input);
        send({ type: "tool_result", id: u.id, name: u.name, ok: r.ok, output: r.out });
        return { type: "tool_result", tool_use_id: u.id, content: JSON.stringify(r.out), is_error: !r.ok };
      });
      const user: Msg = { role: "user", content: results };
      convo.push(user); added.push(user);
      send({ type: "turn" });
    }
    send({ type: "done", messages: added });
  } catch (e) {
    console.error("[agent]", e);
    send({ type: "error", message: errMessage(e) });
    send({ type: "done", messages: added });
  }
  res.end();
}

// ------------------------------------------------------------------ /api/capstone-grade
const CapGrade = z.object({
  score: z.number().int().min(0).max(10),
  headline: z.string().describe("One-line verdict in the voice of a professor"),
  strengths: z.array(z.string()).describe("1-3 specific strengths"),
  improvements: z.array(z.string()).describe("1-3 specific improvements"),
});
type CapReq = { cluster: string[]; reservoir: string; route: string; action: string; reasoning: string; clusterCorrect: number; clusterWrong: string[] };
async function capstoneGrade(req: IncomingMessage, res: ServerResponse) {
  const a = await body<CapReq>(req);
  try {
    const r = await ai().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: "medium", format: betaZodOutputFormat(CapGrade) },
      system: `You are Professor Neva grading the capstone of the Pathogen Genomics path (fictional St. Aurelia CRKP outbreak). Answer key: cluster = KP-01, KP-02, KP-03, KP-04, KP-05, KP-09, KP-11, KP-12 (KP-12 is the ICU bay 3 sink drain). Excluded: KP-06 (ST307, blaKPC-2), KP-07 (ST11, blaNDM-1, 18x coverage, must be re-sequenced), KP-08 (ST258 but 61+ SNPs: separate introduction), KP-10 (ST147, blaOXA-48). Likely reservoir: the ICU bay 3 sink drain (1-5 SNPs from every ICU case). Route: ICU to Surgical via the KP-04 patient's transfer on 8 March, then spread within Surgical. Good next actions follow protocols IP-14 and EN-07 (drain response, contact screening, notify Infection Prevention, re-sequence KP-07). Score out of 10: cluster 3, reservoir 2, route 2, action 2, quality of reasoning 1. Use the colour markup [[c|...]], [[b|...]], [[t|...]], [[w|...]] for at most three key terms.`,
      messages: [{ role: "user", content: `Cluster membership (checked automatically): ${a.clusterCorrect}/12 isolates classified correctly. Misclassified: ${a.clusterWrong.join(", ") || "none"}.\nChosen cluster: ${a.cluster.join(", ")}\nReservoir: ${a.reservoir}\nRoute: ${a.route}\nNext action: ${a.action}\nReasoning: ${a.reasoning}`.slice(0, 6000) }],
    });
    if (r.stop_reason === "refusal" || !r.parsed_output) return json(res, 502, { error: REFUSAL });
    json(res, 200, r.parsed_output);
  } catch (e) {
    console.error("[capstone-grade]", e);
    json(res, 502, { error: errMessage(e) });
  }
}

// ------------------------------------------------------------------ router
export async function handleApi(req: IncomingMessage, res: ServerResponse) {
  const path = (req.url || "").split("?")[0];
  if (path === "/api/status") return json(res, 200, { ai: hasKey(), model: MODEL });
  if (req.method !== "POST") return json(res, 405, { error: "POST only" });
  if (!hasKey()) return json(res, 503, { error: "AI is off: set ANTHROPIC_API_KEY on the server to enable Professor Neva." });
  switch (path) {
    case "/api/professor": return professor(req, res);
    case "/api/grade": return grade(req, res);
    case "/api/quiz": return quiz(req, res);
    case "/api/rag": return rag(req, res);
    case "/api/agent": return agent(req, res);
    case "/api/capstone-grade": return capstoneGrade(req, res);
  }
  json(res, 404, { error: "Unknown endpoint" });
}
