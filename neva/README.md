# Neva: AI for the life sciences

A case-based course site that teaches how modern AI works (LLMs, vector databases, RAG and MCP)
through casework in three fields. Professor Neva, an AI tutor, teaches Socratically, grades open
answers, writes new questions and coaches you through a live investigation.

| Path | Field | Status |
|---|---|---|
| **Pathogen Genomics** | Genetics | Built: 5 cases |
| Outbreak Modeling | Disease modeling | Syllabus only |
| Research Intelligence | Research | Syllabus only |

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

## The Pathogen Genomics path

The whole path follows one case: a fictional carbapenem-resistant *Klebsiella pneumoniae* outbreak at
St. Aurelia Medical Center.

| # | AI topic | Case | Lab (drag-and-drop + live AI) |
|---|---|---|---|
| 1 | LLMs | The Midnight Report | Tokenizer bench, temperature sampler, sort the draft's sentences into fact or fabrication |
| 2 | Vector databases | Who's Related? | Build a record (id / vector / metadata), embedding map, drag filter chips into the query |
| 3 | RAG | The Protocol Question | Order the pipeline, BM25 retrieval, pack a 200-token context window, Claude answers **with citations** |
| 4 | MCP | Wire Up the Lab | Order the host/client/server messages, sort tools by approval policy, watch a live tool-using host |
| 5 | Capstone | The Outbreak Room | Direct a tool-using agent, sort all 12 isolates, file a report graded by the professor |

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
| `/api/rag` | Answers only from the chunks the learner packed | document blocks + **citations** |
| `/api/agent` | Lab assistant that calls `search_isolates`, `get_snp_distances`, `get_ward_transfers`, `search_protocols` | tool use loop, strict schemas, eager input streaming |
| `/api/capstone-grade` | Grades the outbreak report | structured outputs |

Every call uses `claude-opus-5-5` with server-side refusal fallback (`fallbacks: "default"`). Pathogen
content can occasionally trip a safety classifier on legitimate surveillance questions, and the fallback
reruns the request on Anthropic's recommended fallback model. Conversation history is sent back exactly as
the API returned it, so it is only ever appended to.

## Code map

```
server/api.ts           all /api routes (prompts, tools, grading schemas)
server/index.ts         production static + API server
src/content/paths.ts    paths, cases, lectures, checks, seminars, quizzes
src/content/dataset.ts  fictional isolates, SNP model, transfers, answer key
src/content/corpus.ts   fictional hospital documents (chunked) + BM25
src/labs/*              one lab per case
src/components/dnd.tsx  drag-and-drop: SortableSequence, BucketBoard, SortIntoBuckets
src/lib/progress.ts     XP, levels, badges, streak, evidence, misconceptions
```

To add a path, add a `Path` with `lessons` to `PATHS` in `src/content/paths.ts`, plus labs in
`src/labs/`. To build one of the planned paths, reuse the drag-and-drop components and the agent console.

All hospitals, patients, isolates and documents are fictional teaching material. Gene names and sequence
types are real names used for realism. This is not medical advice.
