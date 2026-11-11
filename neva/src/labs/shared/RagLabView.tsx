import { useMemo, useState } from "react";
import { AiOffNotice } from "../../components/ConnectKey";
import { BucketBoard, DragHint, SortableSequence } from "../../components/dnd";
import { RichInline } from "../../components/Rich";
import { tokenEstimate as tokens, type Chunk, type Hit } from "../../content/search";
import { stream, useAi } from "../../lib/ai";
import { earnBadge, useProgress } from "../../lib/progress";
import { finishPart, LabCard } from "../common";

/** The RAG pipeline is the same in every field; only the first step's wording changes. */
export const ragPipeline = (docs: string) => [
  { id: "p1", label: `**Load** ${docs}`, why: "Ingestion starts with the raw documents." },
  { id: "p2", label: "**Chunk** them into passages", why: "Passages small enough to be precise, big enough to keep a rule with its condition." },
  { id: "p3", label: "**Embed** each chunk", why: "Turn each chunk into a vector (or index its words for BM25)." },
  { id: "p4", label: "**Store** chunks in the [[t|vector database]]", why: "Ingestion ends here; the rest happens per question." },
  { id: "p5", label: "**Embed** the user's question", why: "The query must live in the same space as the chunks." },
  { id: "p6", label: "**Retrieve** the top-k chunks", why: "Rank by relevance; take the best few." },
  { id: "p7", label: "**Augment** the prompt with those chunks", why: "Put them in the context window with instructions to use only them." },
  { id: "p8", label: "**Generate** the answer with citations", why: "The model answers from the context and cites it." },
];
export const RAG_EVIDENCE = ["Pipeline built", "Context packed", "Cited answer"];

type Part = { kind: "text"; text: string } | { kind: "cite"; chunk: string; quote: string };

export type RagLabProps = {
  lessonId: string; path: string; docs: string; chunks: Chunk[]; search: (q: string, k?: number) => Hit[];
  questions: string[]; budget?: number; seed?: number;
};

export function RagLabView({ lessonId: ID, path, docs, chunks: CHUNKS, search, questions: QUESTIONS, budget: BUDGET = 200, seed = 11 }: RagLabProps) {
  const EV = RAG_EVIDENCE;
  const PIPELINE = useMemo(() => ragPipeline(docs), [docs]);
  const ev = useProgress().lessons[ID]?.evidence || [];
  const aiOn = useAi();
  const [q, setQ] = useState(QUESTIONS[0]);
  const [results, setResults] = useState<Hit[] | null>(null);
  const [place, setPlace] = useState<Record<string, string>>({});
  const [parts, setParts] = useState<Part[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const packed = useMemo(() => CHUNKS.filter(c => place[c.id] === "ctx"), [place]);
  const used = packed.reduce((n, c) => n + tokens(c), 0);

  const retrieve = () => { setResults(search(q, 6)); setPlace({}); setParts([]); };
  const generate = async () => {
    setBusy(true); setErr(""); setParts([]);
    let cites = 0;
    let pending: Part[] = [];
    await stream("/api/rag", { path, question: q, chunkIds: packed.map(c => c.id) }, e => {
      if (e.type === "text") setParts(p => { const last = p[p.length - 1]; return last?.kind === "text" ? [...p.slice(0, -1), { kind: "text", text: last.text + e.text }] : [...p, { kind: "text", text: e.text }]; });
      else if (e.type === "cite") { cites++; pending.push({ kind: "cite", chunk: e.chunk, quote: e.quote }); }
      else if (e.type === "block_end" && pending.length) { const add = pending; pending = []; setParts(p => [...p, ...add]); }
      else if (e.type === "error") setErr(e.message);
    }).catch(() => setErr("Couldn't reach the server."));
    setBusy(false);
    if (cites > 0) { finishPart(ID, EV[2], EV); earnBadge("grounded"); }
  };
  const citeList = parts.filter((p): p is Extract<Part, { kind: "cite" }> => p.kind === "cite");
  let n = 0;

  return (
    <>
      <LabCard title="A. Build the pipeline" done={ev.includes(EV[0])} sub="Put the RAG steps in order: ingestion first, then what happens for every question." right={<DragHint />}>
        <SortableSequence items={PIPELINE} seed={seed} onSolved={() => finishPart(ID, EV[0], EV)} />
      </LabCard>

      <LabCard title="B. Retrieve, then pack the context window" done={ev.includes(EV[1])} sub={<RichInline text={`Retrieval uses [[t|BM25]] keyword scoring so you can see every score. The [[c|context window]] here holds only ${BUDGET} tokens: choose what earns a place.`} />} right={<DragHint>Drag chunks into the context</DragHint>}>
        <div className="chips" style={{ marginBottom: 10 }}>{QUESTIONS.map(x => <button key={x} className="chip" onClick={() => { setQ(x); setResults(null); setParts([]); }} style={x === q ? { borderColor: "var(--ink)", borderStyle: "solid", fontWeight: 700 } : undefined}>{x}</button>)}</div>
        <div className="row" style={{ alignItems: "stretch" }}>
          <input className="field" style={{ flex: 1 }} value={q} onChange={e => setQ(e.target.value)} aria-label="Question" />
          <button className="btn primary" onClick={retrieve}>Retrieve top 6</button>
        </div>
        {results && (
          <div style={{ marginTop: 14 }}>
            {!results.length && <p className="feedback bad">No chunk matched those words. Try different terms: that's a retrieval failure, and the model would have nothing to ground on.</p>}
            <BucketBoard
              items={results.map(r => ({ ...r.chunk, score: r.score }))}
              buckets={[{ id: "ctx", title: "Context window", capacity: BUDGET, hint: "What the model will see" }]}
              columns={1} value={place} trayLabel="Retrieved chunks"
              weight={c => tokens(c)}
              onChange={p => { setPlace(p); setParts([]); if (Object.values(p).includes("ctx")) finishPart(ID, EV[1], EV, 15); }}
              render={c => (
                <div style={{ fontSize: ".86rem", maxWidth: 520 }}>
                  <div className="row" style={{ gap: 8, justifyContent: "space-between" }}><b>{c.id}</b><span className="mono muted">score {c.score} · {tokens(c)} tok</span></div>
                  <div className="muted">{c.text}</div>
                </div>
              )} />
            <p className="muted" style={{ fontSize: ".85rem" }}>{used}/{BUDGET} tokens used by {packed.length} chunk{packed.length === 1 ? "" : "s"}.</p>
          </div>
        )}
      </LabCard>

      <LabCard title="C. Generate a grounded answer" done={ev.includes(EV[2])} sub={<RichInline text="Claude receives **only** your packed chunks as documents with citations on, and is told not to use outside knowledge. Try packing the wrong chunks too: a good grounded answer admits what's missing." />}>
        {aiOn === false && <AiOffNotice what="Step C" />}
        <button className="btn yellow" onClick={generate} disabled={busy || !aiOn || !results}>{busy ? "Generating…" : packed.length ? `Ask Claude with ${packed.length} chunk${packed.length > 1 ? "s" : ""}` : "Ask Claude with an empty context"}</button>
        {err && <div className="banner err" style={{ marginTop: 10 }}>{err}</div>}
        {parts.length > 0 && (
          <div className="read" style={{ marginTop: 14, background: "var(--paper)", borderRadius: 12, padding: "14px 18px" }}>
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>
              {parts.map((p, i) => p.kind === "text" ? <RichInline key={i} text={p.text} /> : <sup key={i} title={p.quote} style={{ background: "var(--yellow)", borderRadius: 4, padding: "0 4px", margin: "0 1px", fontFamily: "var(--font-mono)", fontSize: ".7em" }}>{++n}</sup>)}
            </p>
          </div>
        )}
        {citeList.length > 0 && (
          <div className="stack" style={{ marginTop: 12, gap: 6 }}>
            <b style={{ fontSize: ".9rem" }}>Citations: check that each quote supports its claim</b>
            {citeList.map((c, i) => <div key={i} className="tool-ev"><span className="lbl">[{i + 1}] {c.chunk}</span> “{c.quote}”</div>)}
          </div>
        )}
        {!busy && parts.length > 0 && !citeList.length && <p className="feedback bad">No citations. If the answer says the documents don't cover it, the model stayed grounded and your retrieval or packing needs work.</p>}
      </LabCard>
    </>
  );
}
