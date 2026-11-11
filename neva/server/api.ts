// Neva API: every Claude call lives here, on the server, so the API key never reaches the browser.
// Every POST body carries `path` (a learning-path id); path-specific data lives in server/paths/.
//   GET  /api/status          -> { ai: boolean }
//   POST /api/professor       -> NDJSON stream: Otto (Socratic tutor, lesson-aware)
//   POST /api/grade           -> JSON: rubric grading of a seminar answer (structured output)
//   POST /api/quiz            -> JSON: a fresh case-based multiple-choice question (structured output)
//   POST /api/coldcall        -> JSON: Otto's cold-call question + 3-point rubric for one lecture segment
//   POST /api/screen          -> JSON: Claude screens abstracts against inclusion criteria (structured output)
//   POST /api/rag             -> NDJSON stream: answer grounded ONLY in the chunks the learner packed, with citations
//   POST /api/agent           -> NDJSON stream: lab assistant agent that calls the path's tools (manual tool loop)
//   POST /api/capstone-grade  -> JSON: grades the capstone report against the path's answer key
import { AsyncLocalStorage } from "node:async_hooks";
import type { IncomingMessage, ServerResponse } from "node:http";
import { existsSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { serverPath } from "./paths/index.js";
import { consumeTrial, trialLimits, trialRemaining, visitorId } from "./trial.js";

if (existsSync(".env")) process.loadEnvFile(".env");

export const MODEL = "claude-opus-5-5";
// Server-side refusal fallback: if a safety classifier declines (life-science content can occasionally
// trip a classifier on legitimate research questions), the API re-runs the request on Anthropic's
// recommended fallback model inside the same call.
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

// Each AI request runs with either the visitor's own key ("bring your own key") or the site owner's key
// (free trial). The client for the current request lives in AsyncLocalStorage so handlers just call ai().
// Visitor keys arrive in a header, are used for that request only, and are never stored or logged.
export const USER_KEY_HEADER = "x-anthropic-api-key";
type Ctx = { client: Anthropic; byok: boolean };
const als = new AsyncLocalStorage<Ctx>();
let ownerClient: Anthropic | null = null;
const owner = () => (ownerClient ??= new Anthropic());
const ai = () => als.getStore()?.client ?? owner();
const hasKey = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const userKey = (req: IncomingMessage): string | null => {
  const v = req.headers?.[USER_KEY_HEADER];
  const k = (Array.isArray(v) ? v[0] : v)?.trim();
  return k && /^sk-ant-[A-Za-z0-9_-]{20,300}$/.test(k) ? k : null;
};

type Msg = Anthropic.Beta.BetaMessageParam;

// ------------------------------------------------------------------ prompts
export const MARKUP = `Formatting: write short paragraphs and use Markdown lists, **bold** and \`code\`. Colour-code key words with this markup, which the site renders as coloured highlights. Use it for the 2-5 terms that matter most in a reply, not every noun:
[[c|...]] a core AI or methods concept (e.g. [[c|embedding]], [[c|retrieval]], [[c|context window]], [[c|basic reproduction number]])
[[b|...]] a domain term or data item from biology, epidemiology or the research literature (e.g. [[b|VAF]], [[b|NPM1]], [[b|subclone]], [[b|serial interval]], [[b|risk of bias]])
[[t|...]] a tool, API, protocol or system (e.g. [[t|vector database]], [[t|MCP server]], [[t|tools/call]])
[[w|...]] a pitfall, risk or common mistake (e.g. [[w|hallucination]], [[w|germline is not somatic]])`;

const PROFESSOR = `You are Otto, the AI professor of the Neva course: a university professor who teaches how modern AI (LLMs, vector databases, retrieval-augmented generation and the Model Context Protocol) is used in the life sciences. The course has three paths, each teaching the same AI ideas through casework in one field: Cancer Genomics, Outbreak Modeling and Research Intelligence. The lesson context below names the path, the case and what the lesson teaches.

How you teach:
- Like a real professor running a case-method seminar. Anchor every explanation in the current case, then generalise.
- Socratic first: when a learner asks for an answer they could reason out, ask one guiding question before explaining. If they are stuck after a try, explain directly and clearly.
- Precise and honest. Distinguish what the case data shows from what it does not. Name uncertainty. Correct misconceptions explicitly and kindly ("A common mix-up is... In fact...").
- Only state things that are true. If you are not sure about a fact, say so rather than guessing. Cases, people and data in the course are fictional; general scientific and technical facts you state must be accurate.
- Brief. Usually 60-180 words. End with one question that checks understanding or pushes the case forward, unless the learner asked you to stop.
- Reward good reasoning specifically ("Good: you linked the rising VAF to the subclone's expansion").
- Use the learner's known misconceptions (given in the lesson context) to target your questions.

Boundaries: stay at the level of molecular profiling, public-health surveillance, epidemiology, research methods and data analysis. Do not give individual treatment advice; say treatment is decided by the clinical team. Do not discuss making organisms more dangerous.

${MARKUP}`;

// ------------------------------------------------------------------ helpers
async function body<T>(req: IncomingMessage): Promise<T> {
  // Vercel's Node runtime may already have parsed the JSON body.
  const pre = (req as IncomingMessage & { body?: unknown }).body;
  if (pre && typeof pre === "object") return pre as T;
  if (typeof pre === "string") return JSON.parse(pre || "{}") as T;
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
  if (e instanceof Anthropic.AuthenticationError) return als.getStore()?.byok ? "Your Anthropic API key was rejected. Reconnect it with a valid key." : "The server's Anthropic API key was rejected. Check ANTHROPIC_API_KEY.";
  if (e instanceof Anthropic.PermissionDeniedError && als.getStore()?.byok) return "Your Anthropic API key isn't allowed to use this model. Check its workspace and billing in the Anthropic Console.";
  if (e instanceof Anthropic.RateLimitError) return "Too many requests right now. Wait a minute and try again.";
  if (e instanceof Anthropic.BadRequestError) return "The request was rejected: " + e.message;
  if (e instanceof Anthropic.APIError) return `Claude API error ${e.status ?? ""}. Try again.`;
  if (e instanceof Error && /credentials|api key/i.test(e.message)) return "No Anthropic API key is configured on the server.";
  return "Couldn't reach Claude. Check the server log and your connection.";
}
/** Logs only the error's class, status and message: never request headers, so visitor keys can't leak into logs. */
function logError(where: string, e: unknown) {
  const status = e instanceof Anthropic.APIError ? ` ${e.status ?? ""}` : "";
  console.error(where, (e as Error)?.constructor?.name + status, String((e as Error)?.message || e).replace(/sk-ant-[A-Za-z0-9_-]+/g, "sk-ant-***"));
}
const REFUSAL = "Otto can't help with that request. Try rephrasing it around the case.";

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
    logError("[professor]", e);
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
type GradeReq = { path: string; lesson: string; question: string; rubric: string[]; answer: string };
async function grade(req: IncomingMessage, res: ServerResponse) {
  const g = await body<GradeReq>(req);
  const p = serverPath(g.path);
  try {
    const r = await ai().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: "medium", format: betaZodOutputFormat(Grade) },
      system: `You are Otto grading a seminar answer in the ${p.title} path (${p.setting}). Grade against the rubric only, generously for correct ideas in the learner's own words, strictly for factual errors. Use the colour markup [[c|...]], [[b|...]], [[t|...]], [[w|...]] for at most two key terms in your sentences.`,
      messages: [{ role: "user", content: `Lesson: ${g.lesson}\nQuestion: ${g.question}\nRubric (each point is one idea a strong answer includes):\n${(g.rubric || []).map((x, i) => `${i + 1}. ${x}`).join("\n")}\n\nLearner's answer:\n"""${String(g.answer).slice(0, 4000)}"""` }],
    });
    if (r.stop_reason === "refusal" || !r.parsed_output) return json(res, 502, { error: REFUSAL });
    json(res, 200, r.parsed_output);
  } catch (e) {
    logError("[grade]", e);
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
type QuizReq = { path: string; lesson: string; summary: string; avoid: string[]; difficulty: "core" | "challenge" };
async function quiz(req: IncomingMessage, res: ServerResponse) {
  const q = await body<QuizReq>(req);
  const p = serverPath(q.path);
  try {
    const r = await ai().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: "medium", format: betaZodOutputFormat(Quiz) },
      system: `You write case-based multiple-choice questions for the ${p.title} path of an AI course (${p.setting}). Each question puts the learner in a concrete situation from the case and tests understanding, not recall of wording. Exactly four options, one unambiguously correct, distractors that reflect real misconceptions. Every factual statement must be true. Use the colour markup sparingly in the question and explanation: [[c|...]] AI or methods concept, [[b|...]] domain term or data, [[t|...]] tool or system, [[w|...]] pitfall.`,
      messages: [{ role: "user", content: `Lesson: ${q.lesson}\nWhat the lesson taught:\n${q.summary}\nDifficulty: ${q.difficulty === "challenge" ? "challenge (combine two ideas, apply to a new situation in the case)" : "core"}\nDon't repeat these questions:\n${(q.avoid || []).map(a => "- " + a).join("\n") || "(none)"}` }],
    });
    const out = r.parsed_output;
    if (r.stop_reason === "refusal" || !out || out.options.length !== 4) return json(res, 502, { error: "The question came back malformed. Try again." });
    json(res, 200, out);
  } catch (e) {
    logError("[quiz]", e);
    json(res, 502, { error: errMessage(e) });
  }
}

// ------------------------------------------------------------------ /api/coldcall
const ColdCall = z.object({
  question: z.string().describe("One open question a professor would cold-call a student with, anchored in the case"),
  rubric: z.array(z.string()).describe("Exactly three ideas a strong answer includes"),
});
type ColdCallReq = { path: string; lesson: string; caseTitle: string; segmentTitle: string; segmentBody: string };
async function coldcall(req: IncomingMessage, res: ServerResponse) {
  const c = await body<ColdCallReq>(req);
  const p = serverPath(c.path);
  try {
    const r = await ai().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: "low", format: betaZodOutputFormat(ColdCall) },
      system: `You are Otto running a case-method class in the ${p.title} path (${p.setting}). After a short lecture segment, you cold-call one student with a single open question. It must require applying the segment to the case (why/what would happen if/how would you check), be answerable in 2-4 sentences, and never be answerable by copying a sentence from the segment. Give exactly three rubric ideas. Every factual statement must be true. Use at most two colour-markup terms: [[c|...]] concept, [[b|...]] domain term, [[t|...]] tool, [[w|...]] pitfall.`,
      messages: [{ role: "user", content: `Lesson: ${c.lesson}\nCase: ${c.caseTitle}\nSegment: ${c.segmentTitle}\n"""${String(c.segmentBody).slice(0, 4000)}"""` }],
    });
    const out = r.parsed_output;
    if (r.stop_reason === "refusal" || !out || out.rubric.length < 2) return json(res, 502, { error: "The cold call came back malformed. Try again." });
    json(res, 200, { question: out.question, rubric: out.rubric.slice(0, 3) });
  } catch (e) {
    logError("[coldcall]", e);
    json(res, 502, { error: errMessage(e) });
  }
}

// ------------------------------------------------------------------ /api/screen
const Screen = z.object({
  decisions: z.array(z.object({
    id: z.string(),
    decision: z.enum(["include", "exclude", "unsure"]),
    criterion: z.string().describe("The single criterion that decided it, e.g. 'Population' or 'Study design'"),
    reason: z.string().describe("One sentence quoting or paraphrasing the abstract"),
  })),
});
type ScreenReq = { path: string; criteria: string; abstracts: { id: string; text: string }[] };
async function screen(req: IncomingMessage, res: ServerResponse) {
  const s = await body<ScreenReq>(req);
  try {
    const r = await ai().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: "medium", format: betaZodOutputFormat(Screen) },
      system: "You are the second reviewer in a systematic review's title/abstract screening (fictional teaching abstracts). Apply the inclusion criteria exactly as written, using only what each abstract says. If an abstract doesn't give enough information to decide, answer 'unsure' rather than guessing. Return one decision per abstract id.",
      messages: [{ role: "user", content: `Inclusion criteria:\n${s.criteria}\n\nAbstracts:\n${(s.abstracts || []).slice(0, 20).map(a => `[${a.id}] ${a.text}`).join("\n\n")}` }],
    });
    if (r.stop_reason === "refusal" || !r.parsed_output) return json(res, 502, { error: REFUSAL });
    json(res, 200, r.parsed_output);
  } catch (e) {
    logError("[screen]", e);
    json(res, 502, { error: errMessage(e) });
  }
}

// ------------------------------------------------------------------ /api/rag
type RagReq = { path: string; question: string; chunkIds: string[] };
async function rag(req: IncomingMessage, res: ServerResponse) {
  const { path, question, chunkIds } = await body<RagReq>(req);
  const p = serverPath(path);
  const chosen = (chunkIds || []).map(id => p.chunks.find(c => c.id === id)).filter((c): c is (typeof p.chunks)[number] => Boolean(c));
  const send = ndjson(res);
  try {
    // Real RAG step: the packed chunks become document blocks with citations enabled, so every
    // claim in the answer points back to the exact sentence it came from.
    const stream = ai().beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      ...FALLBACK,
      output_config: { effort: "low" },
      system: `You answer questions for the team in a fictional teaching case (${p.setting}) using ONLY the provided documents. Cite the documents for every factual claim. If the documents do not contain the answer, say exactly what is missing instead of guessing; do not use outside knowledge. Keep answers under 150 words.`,
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
    logError("[rag]", e);
    send({ type: "error", message: errMessage(e) });
  }
  res.end();
}

// ------------------------------------------------------------------ /api/agent (tools)
// The path's tools are what an MCP server for that lab would expose via tools/list.
// Here they run in-process so learners can watch each tools/call and its result.
async function agent(req: IncomingMessage, res: ServerResponse) {
  const { path, messages } = await body<{ path: string; messages: Msg[] }>(req);
  const p = serverPath(path);
  const send = ndjson(res);
  const convo: Msg[] = [...(messages || [])];
  const added: Msg[] = [];
  try {
    for (let turn = 0; turn < 8; turn++) {
      const stream = ai().beta.messages.stream({
        model: MODEL,
        max_tokens: 64000,
        ...FALLBACK,
        output_config: { effort: "medium" },
        system: [{ type: "text", text: p.agentPrompt + "\n\n" + MARKUP, cache_control: { type: "ephemeral" } }],
        tools: p.tools.map(t => ({ ...t, strict: true, eager_input_streaming: true })) as unknown as Anthropic.Beta.BetaTool[],
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
        const r = p.runTool(u.name, u.input);
        send({ type: "tool_result", id: u.id, name: u.name, ok: r.ok, output: r.out });
        return { type: "tool_result", tool_use_id: u.id, content: JSON.stringify(r.out), is_error: !r.ok };
      });
      const user: Msg = { role: "user", content: results };
      convo.push(user); added.push(user);
      send({ type: "turn" });
    }
    send({ type: "done", messages: added });
  } catch (e) {
    logError("[agent]", e);
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
/** `report` is the learner's free-text fields; `autoCheck` summarises what the browser already verified exactly. */
type CapReq = { path: string; report: Record<string, string>; autoCheck: string };
async function capstoneGrade(req: IncomingMessage, res: ServerResponse) {
  const a = await body<CapReq>(req);
  const p = serverPath(a.path);
  try {
    const fields = Object.entries(a.report || {}).map(([k, v]) => `${k}: ${v}`).join("\n");
    const r = await ai().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      ...FALLBACK,
      output_config: { effort: "medium", format: betaZodOutputFormat(CapGrade) },
      system: p.capstoneGrader + " Use the colour markup [[c|...]], [[b|...]], [[t|...]], [[w|...]] for at most three key terms.",
      messages: [{ role: "user", content: `Checked automatically: ${a.autoCheck}\n\n${fields}`.slice(0, 8000) }],
    });
    if (r.stop_reason === "refusal" || !r.parsed_output) return json(res, 502, { error: REFUSAL });
    json(res, 200, r.parsed_output);
  } catch (e) {
    logError("[capstone-grade]", e);
    json(res, 502, { error: errMessage(e) });
  }
}

// ------------------------------------------------------------------ /api/verify-key
/** Checks a visitor's key without spending tokens (a model lookup), so the connect panel can confirm it works. */
async function verifyKey(req: IncomingMessage, res: ServerResponse) {
  const key = userKey(req);
  if (!key) return json(res, 400, { ok: false, error: "That doesn't look like an Anthropic API key (it should start with sk-ant-)." });
  try {
    await new Anthropic({ apiKey: key, maxRetries: 1 }).models.retrieve(MODEL);
    json(res, 200, { ok: true });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json(res, 401, { ok: false, error: "Anthropic rejected this key. Check that it's copied in full and still active." });
    if (e instanceof Anthropic.PermissionDeniedError || e instanceof Anthropic.NotFoundError) return json(res, 403, { ok: false, error: `This key can't use ${MODEL}. Check its workspace and billing in the Anthropic Console.` });
    json(res, 502, { ok: false, error: "Couldn't reach Anthropic to check the key. Try again." });
  }
}

// ------------------------------------------------------------------ router
const ROUTES: Record<string, (req: IncomingMessage, res: ServerResponse) => Promise<void>> = {
  "/api/professor": professor,
  "/api/grade": grade,
  "/api/quiz": quiz,
  "/api/coldcall": coldcall,
  "/api/screen": screen,
  "/api/rag": rag,
  "/api/agent": agent,
  "/api/capstone-grade": capstoneGrade,
};

export async function handleApi(req: IncomingMessage, res: ServerResponse) {
  const path = (req.url || "").split("?")[0];
  if (path === "/api/status") {
    const { perVisitor } = trialLimits();
    const remaining = hasKey() ? await trialRemaining(visitorId(req)) : 0;
    return json(res, 200, { ai: hasKey(), byok: true, model: MODEL, trial: { enabled: hasKey() && perVisitor > 0, limit: perVisitor, remaining } });
  }
  if (req.method !== "POST") return json(res, 405, { error: "POST only" });
  if (path === "/api/verify-key") return verifyKey(req, res);
  const route = ROUTES[path];
  if (!route) return json(res, 404, { error: "Unknown endpoint" });

  const key = userKey(req);
  if (key) return als.run({ client: new Anthropic({ apiKey: key }), byok: true }, () => route(req, res));
  if (!hasKey()) return json(res, 503, { code: "no_key", error: "Connect your Anthropic API key to use Otto (AI is off on this server: ANTHROPIC_API_KEY is not set)." });
  if (!(await consumeTrial(visitorId(req)))) return json(res, 429, { code: "trial_exhausted", error: "You've used today's free Otto requests. Connect your own Anthropic API key to keep going." });
  return als.run({ client: owner(), byok: false }, () => route(req, res));
}
