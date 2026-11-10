# Neva: AI for the life sciences

A case-based course site that teaches how modern AI works (LLMs, vector databases, RAG and MCP)
through casework in three fields. Professor Neva, an AI tutor, teaches Socratically, grades open
answers, writes new questions and coaches you through a live investigation.

| Path | Field | Case setting (all fictional) |
|---|---|---|
| **Cancer Genomics** | Genetics | A relapsed acute myeloid leukemia at the Cascade Ridge Cancer Research Center: tumor sequencing and a single-cell atlas |
| **Outbreak Modeling** | Disease modeling | A new respiratory virus in Port Calder; the city must decide on school closures |
| **Research Intelligence** | Research | A systematic review at the Meridian Evidence Unit |

Each path has five cases teaching the same AI stack in order: LLMs → vector databases → RAG → MCP → a capstone
where you lead an investigation with a tool-using AI agent.

## Run it

```bash
cd neva
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # or put it in neva/.env (see .env.example)
npm run dev                           # http://localhost:5173
```

Without a key the site still runs: lectures, labs, drag-and-drop and the fixed quizzes work, and the
AI features show an "AI is off" notice.

Production: `npm run build && npm start` serves `dist/` and the API on port 8787 (`PORT` to change).

## The paths

### Cancer Genomics

The whole path follows one fictional patient, AML-0412, whose acute myeloid leukemia relapsed after induction
chemotherapy. The lab sequenced marrow at diagnosis, remission and relapse plus a skin germline control, and
annotates single cells against a healthy bone-marrow reference atlas. Research-level interpretation only.

| # | AI topic | Case | Lab (drag-and-drop + live AI) |
|---|---|---|---|
| 1 | LLMs | The Overnight Variant Report | Tokenizer bench on HGVS notation, temperature sampler, sort the draft's sentences into fact or fabrication |
| 2 | Vector databases | Which Cell Is This? | Build a reference-cell record, k-nearest-neighbour label transfer on a single-cell map, drag-in metadata filters |
| 3 | RAG | The Tiering Question | Order the pipeline, BM25 retrieval over the lab's SOPs, pack a 200-token context window, Claude answers **with citations** |
| 4 | MCP | Wire Up the Lab | Order the host/client/server messages, sort tools by approval policy, watch a live tool-using host |
| 5 | Capstone | The Tumor Board | Direct a tool-using agent, classify every variant (founder, lost, relapse, germline, artifact), file a report graded by the professor |

### Outbreak Modeling

The case data comes from a deterministic SEIR model with known parameters, so the capstone answer is
computed from the model, not typed in.

| # | AI topic | Case | Lab |
|---|---|---|---|
| 1 | LLMs | The Parameter Hunt | Sort an LLM's extracted parameters (unit errors, hallucinated values), fit an SEIR curve with sliders, review LLM-written model code |
| 2 | Vector databases | Similar Epidemics | Past outbreaks as curve vectors: cosine vs Euclidean vs normalised distance, drag-in filters |
| 3 | RAG | Evidence-Based Priors | Retrieve incubation, serial-interval and contact evidence with citations |
| 4 | MCP | The Simulation Server | Handshake order, tool approval policy, live simulation tools |
| 5 | Capstone | The Briefing Room | Agent with `get_case_counts`, `fit_growth_rate`, `run_seir`, `search_evidence`; R0 and peak day checked exactly |

### Research Intelligence

| # | AI topic | Case | Lab |
|---|---|---|---|
| 1 | LLMs | The Abstract Screen | Screen abstracts by drag and drop, compare with Claude as second reviewer (Cohen's kappa), PRISMA 2020 flow |
| 2 | Vector databases | Semantic Search | BM25 vs vector results side by side, reciprocal rank fusion, metadata filters |
| 3 | RAG | The Grounded Review | Cited answers over the protocol and abstracts chunked by section |
| 4 | MCP | Library Connectors | Bibliographic and reference-manager tools and their approval policy |
| 5 | Capstone | The Review Board | Agent with `search_studies`, `get_study`, `get_risk_of_bias`, `search_protocol`; inclusion set, direction and GRADE certainty checked exactly |

Each case runs the same way: **case file → lecture with checks → lab → AI-graded seminar → quiz → debrief.**

## How it teaches

- **Professor, not chatbot.** Professor Neva runs a case-method seminar: guiding questions first,
  explicit correction of misconceptions, and short answers that end with a question. Misconceptions found
  while grading are saved and fed back into later tutoring.
- **Gamification.** XP for checks, evidence, seminar points and quiz answers. Five levels from Lab Intern
  to Principal Investigator, 10 badges, a daily streak, evidence boards for each case, and cases that
  unlock in order. Progress is saved in `localStorage`.
- **Coloured key words.** Content and AI answers use `[[c|concept]]`, `[[b|biology/data]]`,
  `[[t|tool/system]]` and `[[w|pitfall]]`, shown as coloured highlights with a colour key.

## AI features (all calls run on the server)

| Endpoint | What it does | API features |
|---|---|---|
| `/api/professor` | Socratic tutor that knows the lesson | streaming, prompt caching |
| `/api/grade` | Grades seminar answers against a rubric and spots misconceptions | structured outputs (Zod) |
| `/api/quiz` | Writes a new case-based challenge question | structured outputs |
| `/api/screen` | Second reviewer for abstract screening | structured outputs |
| `/api/rag` | Answers only from the chunks the learner packed | document blocks + **citations** |
| `/api/agent` | Each path's lab assistant, calling that path's tools | tool use loop, strict schemas, eager input streaming |
| `/api/capstone-grade` | Grades the outbreak report | structured outputs |

Every call uses `claude-opus-5-5` with server-side refusal fallback (`fallbacks: "default"`). Life-science
content can occasionally trip a safety classifier on legitimate research questions, and the fallback
reruns the request on Anthropic's recommended fallback model. Conversation history is sent back exactly as
the API returned it, so it is only ever appended to.

## Tests

```bash
npm test           # unit tests (vitest): no network, no API key
npm run test:e2e   # browser smoke test: every path, lesson, lecture, lab and quiz in Chrome (no AI calls)
```

The unit tests check:
- content integrity for every lesson: depth, quiz answer indices and colour markup
- that each answer key is consistent with its case data
- the simulators and statistics: SEIR, growth fit, Cohen's kappa, RRF
- retrieval: each RAG question's source chunk ranks in the top 3
- server tools and input validation, plus API routing and guards
- the markup renderer, including HTML injection
- the progress store

## Code map

```
server/api.ts             all /api routes (prompts, grading schemas, agent loop)
server/paths/<path>.ts    each path's agent tools, agent prompt and capstone key
server/index.ts           production static + API server; api/*.ts are the Vercel functions
src/content/paths.ts      path registry
src/content/<path>/       lessons, case data, documents for each path
src/content/search.ts     shared BM25 retrieval
src/labs/<path>/          one lab per case; src/labs/shared/ has the RAG and MCP lab views
src/labs/registry.ts      lesson lab key -> component
src/components/dnd.tsx    drag-and-drop: SortableSequence, BucketBoard, SortIntoBuckets
src/lib/progress.ts       XP, levels, badges, streak, evidence, misconceptions
e2e/smoke.ts              browser smoke test
```

To add a path: create `src/content/<path>/lessons.ts` (export `PATH`), labs in `src/labs/<path>/`
(export a lab map), `server/paths/<path>.ts` (export a `ServerPath`), and register each one.

All institutions, cities, patients, samples, studies and documents are fictional teaching material. Gene names,
variant notation, marker genes and methods (SEIR, GRADE, PRISMA, MCP...) are real and described accurately. This is not medical advice.
