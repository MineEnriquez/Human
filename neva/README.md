# Neva: learn AI by solving real cases

A case-based course site that teaches how modern AI works (LLMs, vector databases, RAG and MCP)
through casework in four fields: software engineering (the general-audience path), cancer genomics,
disease modeling and research. Otto, an AI tutor, teaches Socratically, grades open
answers, writes new questions and coaches you through a live investigation.

| Path | Field | Case setting (all fictional) |
|---|---|---|
| **AI for Software Engineers** | Software engineering | Launch week at Lumenrail, an online booking and payments platform: an AI-written PR, duplicate tickets, a docs bot, on-call tools and a 3 a.m. incident. The general-audience path: no science background needed |
| **Cancer Genomics** | Genetics | A relapsed acute myeloid leukemia at the Cascade Ridge Cancer Research Center: tumor sequencing and a single-cell atlas |
| **Disease Modeling** | Disease modeling | Tuberculosis in the high-burden Kestrel Valley District; the programme must choose which strategy to fund to 2035 |
| **Research Intelligence** | Research | A systematic review at the Meridian Evidence Unit |

Each path has five cases teaching the same AI stack in order: LLMs → vector databases → RAG → MCP → a capstone
where you lead an investigation with a tool-using AI agent.

## Fonts

Typefaces follow pratt.edu's roles: **Graphik** for UI and headings, **Tiempos Text** for reading text, and
**Tiempos Fine** light italic for emphasised words in headlines. They are commercial fonts and are not included.
Readers who have them installed see them; to serve them to everyone, add licensed WOFF2 files to
`src/assets/fonts/` (see the README there; the files are git-ignored). Until then the free stand-ins are Hanken
Grotesk, Source Serif 4 and Newsreader.

## Run it

```bash
cd neva
npm install
ant auth login                        # once; or: export ANTHROPIC_API_KEY=sk-ant-... (or neva/.env)
npm run dev                           # http://localhost:5173
```

**Local development with `ant`.** After `brew install anthropics/tap/ant` and `ant auth login`, the dev server
uses that login with no API key to copy around. An exported `ANTHROPIC_API_KEY` takes precedence over the login,
so unset it (or run `env -u ANTHROPIC_API_KEY npm run dev`) to use the login. `/api/status` reports which
credential is active (`source`: `api-key`, `auth-token` or `ant-login`).

**Visitors' own keys.** Anyone can click **Connect Claude** in the top bar and paste their own Anthropic API key;
Otto then runs on their account. The key is kept only in their browser (session or device), sent with each AI
request over HTTPS, used by the server for that request only, and never stored or logged. Claude.ai subscriptions
don't include API usage, so visitors need an Anthropic Console key.

**Free trial on your key.** Visitors without a key get a daily allowance on the server's key:

| Variable | Default | Meaning |
|---|---|---|
| `TRIAL_PER_VISITOR` | 10 | AI requests per visitor (IP) per UTC day; 0 disables the trial |
| `TRIAL_DAILY_CAP` | 300 | AI requests per day across all trial visitors |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | unset | Shared counters. Without them, counts live in memory per server instance, so on Vercel the limits are approximate |

Set a monthly spend limit for your key in the Anthropic Console as a backstop.

Without any key the site still runs: lectures, labs, drag-and-drop and the fixed quizzes work, and the
AI features show an "AI is off" notice.

Production: `npm run build && npm start` serves `dist/` and the API on port 8787 (`PORT` to change).

## The paths

### AI for Software Engineers (start here)

For any software engineer: every AI term is defined on first use. The fictional company Lumenrail launches Instant
Payouts on Friday 11 Dec 2026, and you are the engineering team's new AI lead. The path has a case dossier
(timeline, seven people, stakes) and a scene for each case, like Cancer Genomics.

| # | AI topic | Case | Lab |
|---|---|---|---|
| 1 | LLMs | The Hallucinated API | Tokenize code, sample a completion after `ledger.` with no docs in context, check an AI-written PR's claims against the docs, diff and CI |
| 2 | Vector databases | Duplicate Tickets | Ticket record anatomy, top-k similarity with drag-in filters, pick the true duplicate (not the most similar-sounding) |
| 3 | RAG | Ask the Runbook | Cited answers from the team's deploy policy, severity levels, on-call policy, runbooks, SLOs and ADRs |
| 4 | MCP | Wire Up the Tools | Handshake order, tool approval policy for production tools, live tool-using assistant |
| 5 | Capstone | The 3 a.m. Incident | Agent with `search_logs`, `get_metrics`, `list_deploys`, `search_runbooks`; classify cause, symptoms and red herrings and choose the mitigation (checked exactly), then a blameless postmortem graded by Otto |

The incident has one defensible answer, derived from the case data: a config change pushed outside the deploy
pipeline shrank the database connection pool from 50 to 5, so requests timed out waiting for connections. A traffic
bump from the nightly batch, a noisy warning and two other deploys are red herrings. One log line is a prompt-injection
attempt, for the lesson on treating tool output as data.

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
| 5 | Capstone | The Tumor Board | Direct a tool-using agent, classify every variant (founder, lost, relapse, germline, artifact), file a report graded by Otto |

### Disease Modeling (tuberculosis)

The district's notifications come from a deterministic TB compartmental model (uninfected, recent and remote latent
infection, active TB, on treatment, recovered; illustrative rates per year), so the capstone answer is computed from
the model, not typed in. Fitting notifications alone is deliberately not identifiable; the 2019 prevalence survey
separates burden from detection.

| # | AI topic | Case | Lab |
|---|---|---|---|
| 1 | LLMs | The Parameter Hunt | Sort an LLM's extracted TB parameters (risk vs rate, per month vs per year, unreported values), fit the TB model to notifications with sliders, review LLM-written model code |
| 2 | Vector databases | Similar Settings | Other districts' notification trajectories as vectors: cosine vs Euclidean vs normalised distance, drag-in filters (HIV band, setting, case finding) |
| 3 | RAG | Evidence-Based Priors | Retrieve the prevalence survey, contact-cohort and pilot evidence with citations |
| 4 | MCP | The Simulation Server | Handshake order, tool approval policy, live TB model tools |
| 5 | Capstone | The Strategy Room | Agent with `get_notifications`, `fit_tb_model`, `run_tb_model`, `search_evidence`; 2025 incidence and the strongest single strategy checked exactly; recommendation within a $1.2M/year budget graded by Otto |

### Research Intelligence

| # | AI topic | Case | Lab |
|---|---|---|---|
| 1 | LLMs | The Abstract Screen | Screen abstracts by drag and drop, compare with Claude as second reviewer (Cohen's kappa), PRISMA 2020 flow |
| 2 | Vector databases | Semantic Search | BM25 vs vector results side by side, reciprocal rank fusion, metadata filters |
| 3 | RAG | The Grounded Review | Cited answers over the protocol and abstracts chunked by section |
| 4 | MCP | Library Connectors | Bibliographic and reference-manager tools and their approval policy |
| 5 | Capstone | The Review Board | Agent with `search_studies`, `get_study`, `get_risk_of_bias`, `search_protocol`; inclusion set, direction and GRADE certainty checked exactly |

Each case runs the same way: **case file → lecture with checks → lab → AI-graded seminar → quiz → debrief.**

## The Cancer Genomics case dossier

Every case in the path follows one fictional dossier (`src/content/cancer/dossier.ts`). Patient AML-0412, a
58-year-old at the fictional Cascade Ridge Cancer Research Center, has acute myeloid leukemia that relapsed about
six months after remission. Over three days before the molecular tumor board (Thu 10 Sep 2026, 08:00) you are
the lab's AI lead:

| When | Brought by | Case | You hand over |
|---|---|---|---|
| Tue 8 Sep, 02:10 | Dr. Ines Varga, molecular pathology fellow | The Overnight Variant Report | A fact-checked LLM summary |
| Tue 8 Sep, 14:00 | Dr. Kenji Albright, hematopathologist | Which Cell Is This? | Cell-type labels with neighbour agreement and caveats |
| Wed 9 Sep, 10:30 | Dr. Ines Varga | The Tiering Question | Three SOP answers with citations |
| Wed 9 Sep, 16:00 | Omar Haddad, research informatics | Wire Up the Lab | A tool policy and an audited live trace |
| Thu 10 Sep, 08:00 | Dr. Mara Ellison, tumor board chair | The Tumor Board | The full tumor board report |

The path page shows the dossier: summary, stakes, key facts, timeline with your progress, and who's involved. Each
case file shows:
- the scene: who asks, when, and their exact request
- Otto's opening hook
- the deliverable and how you'll be judged
- the missions and the XP each stage is worth

## How it teaches

- **Cold calls.** After each lecture segment, Otto can cold-call you: an AI-written question that applies
  the segment to the case, graded against a 3-point rubric.
- **Professor, not chatbot.** Otto runs a case-method seminar: guiding questions first,
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
| `/api/coldcall` | Writes a cold-call question + rubric for a lecture segment | structured outputs |
| `/api/screen` | Second reviewer for abstract screening | structured outputs |
| `/api/rag` | Answers only from the chunks the learner packed | document blocks + **citations** |
| `/api/agent` | Each path's lab assistant, calling that path's tools | tool use loop, strict schemas, eager input streaming |
| `/api/capstone-grade` | Grades each path's capstone report | structured outputs |

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
- the simulators and statistics: the TB model and its fitting, rate/risk conversions, Cohen's kappa, RRF
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
variant notation, marker genes and methods (TB compartmental models, GRADE, PRISMA, MCP...) are real and described accurately. This is not medical advice.
