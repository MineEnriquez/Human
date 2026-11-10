import { useState } from "react";
import { BucketBoard, DragHint } from "../../components/dnd";
import { RichInline } from "../../components/Rich";
import { KEY, STUDIES } from "../../content/research/papers";
import { FILTERS, PRESETS, applyFilters, hybridSearch, keywordSearch, vectorSearch, type Preset } from "../../content/research/semantic";
import { useProgress } from "../../lib/progress";
import { finishPart, LabCard } from "../common";

// Fit the map to the data (studies + query points) so clustered studies don't overlap.
const PTS = [...STUDIES.map(s => s.vec), ...PRESETS.map(q => q.vec)];
const pad = 0.04;
const B = {
  x0: Math.min(...PTS.map(v => v[0])) - pad, x1: Math.max(...PTS.map(v => v[0])) + pad,
  y0: Math.min(...PTS.map(v => v[1])) - pad, y1: Math.max(...PTS.map(v => v[1])) + pad,
};

const ID = "ri-vdb";
export const EVIDENCE = ["Synonym gap found", "Hybrid ranking", "Filtered search"];
const title = (id: string) => STUDIES.find(s => s.id === id)!;
const eligible = (id: string) => KEY.included.includes(id);

function ResultList({ title: h, rows, unit }: { title: string; rows: { id: string; score: number }[]; unit: string }) {
  return (
    <div className="card pad" style={{ padding: 14 }}>
      <b style={{ fontSize: ".9rem" }}>{h}</b>
      {!rows.length && <p className="feedback bad" style={{ fontSize: ".85rem" }}>No results.</p>}
      <ol style={{ margin: "8px 0 0", paddingLeft: "1.3em", fontSize: ".84rem" }}>
        {rows.map(r => (
          <li key={r.id} style={{ marginBottom: 4 }}>
            <b>{r.id}</b> <span className="mono muted">{unit} {unit === "cos" ? r.score.toFixed(3) : r.score}</span>{eligible(r.id) && <span className="tag live" style={{ marginLeft: 6, padding: "0 6px" }}>eligible</span>}
            <div className="muted">{title(r.id).title}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function SemanticLab() {
  const ev = useProgress().lessons[ID]?.evidence || [];
  const [p, setP] = useState<Preset>(PRESETS[0]);
  const [ran, setRan] = useState(false);
  const [fused, setFused] = useState(false);
  const [place, setPlace] = useState<Record<string, string>>({});
  const [filteredRun, setFilteredRun] = useState(false);
  const active = FILTERS.filter(f => place[f.id] === "query");
  const keep = (s: (typeof STUDIES)[number]) => applyFilters(active, s);
  const kw = keywordSearch(p.text, 6);
  const vec = vectorSearch(p.vec, 6);
  const X = (v: number) => 30 + ((v - B.x0) / (B.x1 - B.x0)) * 420, Y = (v: number) => 350 - ((v - B.y0) / (B.y1 - B.y0)) * 320;

  const run = (q: Preset) => {
    setP(q); setRan(true); setFused(false); setFilteredRun(false);
    if (q.id === "q1") finishPart(ID, EVIDENCE[0], EVIDENCE);
  };
  const shownVec = new Set(ran ? vec.map(r => r.id) : []);

  return (
    <>
      <LabCard title="A. Keyword vs vector search" done={ev.includes(EVIDENCE[0])} sub={<RichInline text="Run the same query through [[t|BM25]] keyword search and through vector search over toy 2-D [[c|embeddings]]. Start with **bacteremia**." />}>
        <div className="chips" style={{ marginBottom: 12 }}>
          {PRESETS.map(q => <button key={q.id} className="chip" onClick={() => run(q)} style={ran && q.id === p.id ? { borderColor: "var(--ink)", borderStyle: "solid", fontWeight: 700 } : undefined}>{q.text}</button>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 14 }} className="vdb-grid">
          <svg viewBox="0 0 500 380" className="svgbox" role="img" aria-label="Embedding map of studies">
            {ran && STUDIES.filter(s => shownVec.has(s.id)).map(s => <line key={s.id} x1={X(p.vec[0])} y1={Y(p.vec[1])} x2={X(s.vec[0])} y2={Y(s.vec[1])} style={{ stroke: "var(--yellow)" }} strokeWidth={3} />)}
            {STUDIES.map(s => (
              <g key={s.id}>
                <circle cx={X(s.vec[0])} cy={Y(s.vec[1])} r={6} style={{ fill: eligible(s.id) ? "var(--k-b)" : "var(--muted)", stroke: "var(--sheet)" }} strokeWidth={2} />
                <text x={X(s.vec[0]) + 8} y={Y(s.vec[1]) + 4} fontSize={10} fontFamily="IBM Plex Mono" style={{ fill: "var(--ink)" }}>{s.id.slice(3)}</text>
              </g>
            ))}
            {ran && <text x={X(p.vec[0]) - 9} y={Y(p.vec[1]) + 7} fontSize={22} style={{ fill: "var(--ink)" }}>★</text>}
            <text x={20} y={374} fontSize={11} fontFamily="IBM Plex Mono" style={{ fill: "var(--muted)" }}>● eligible   ● other   ★ query</text>
          </svg>
          {ran ? (
            <div className="stack">
              <ResultList title={`Keyword (BM25): "${p.text}"`} rows={kw} unit="bm25" />
              <ResultList title="Vector (cosine of toy embeddings)" rows={vec} unit="cos" />
            </div>
          ) : <p className="muted">Pick a query above.</p>}
        </div>
        {ran && <p className="read" style={{ fontSize: ".95rem", marginTop: 10 }}><RichInline text={`${p.note} ${p.id === "q1" ? "BM25's only match, MS-13, mentions bacteremia to say it was **absent**: [[w|a keyword match isn't a meaning match]]. Vector search surfaces bloodstream-infection trials. But notice it also ranks ineligible neighbours highly: [[w|semantically similar isn't eligible]]." : ""}`} /></p>}
      </LabCard>

      <LabCard title="B. Hybrid ranking with reciprocal rank fusion" done={ev.includes(EVIDENCE[1])} sub={<RichInline text="Fuse the two rankings: each study scores Σ 1/(60 + rank). No score calibration needed." />}>
        <button className="btn primary" disabled={!ran} onClick={() => { setFused(true); finishPart(ID, EVIDENCE[1], EVIDENCE); }}>{ran ? `Fuse rankings for "${p.text}"` : "Run a query in part A first"}</button>
        {fused && (
          <div className="scroll-x" style={{ marginTop: 12 }}>
            <table className="t">
              <thead><tr><th>hybrid rank</th><th>study</th><th>BM25 rank</th><th>vector rank</th><th>RRF score</th></tr></thead>
              <tbody>{hybridSearch(p).map((r, i) => <tr key={r.id}><td>{i + 1}</td><td><b>{r.id}</b> {eligible(r.id) && <span className="tag live" style={{ padding: "0 6px" }}>eligible</span>}</td><td>{r.kwRank ?? "–"}</td><td>{r.vecRank ?? "–"}</td><td className="mono">{r.score.toFixed(4)}</td></tr>)}</tbody>
            </table>
            <p className="muted" style={{ fontSize: ".88rem" }}>A study near the top of both lists beats one that only a single system likes. Try the exact-term query "mass spectrometry…" and see where keywords help.</p>
          </div>
        )}
      </LabCard>

      <LabCard title="C. Add metadata filters" done={ev.includes(EVIDENCE[2])} sub="Drag filter chips into the query, then run the hybrid search again. Same field = OR, different fields = AND." right={<DragHint>Drag chips</DragHint>}>
        <BucketBoard items={FILTERS} buckets={[{ id: "query", title: "Active filters" }]} columns={1} value={place} onChange={v => { setPlace(v); setFilteredRun(false); }} trayLabel="Filter chips" render={f => <span className="mono" style={{ fontSize: ".82rem" }}>{f.label}</span>} />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn primary" disabled={!ran || !active.length} onClick={() => { setFilteredRun(true); finishPart(ID, EVIDENCE[2], EVIDENCE); }}>{!ran ? "Run a query in part A first" : active.length ? `Search with ${active.length} filter${active.length > 1 ? "s" : ""}` : "Add a filter first"}</button>
        </div>
        {filteredRun && (
          <div style={{ marginTop: 12 }}>
            <ResultList title={`Hybrid, filtered: ${active.map(f => f.label).join(" · ")}`} rows={hybridSearch(p, 6, keep).map(r => ({ id: r.id, score: Math.round(r.score * 10000) / 10000 }))} unit="rrf" />
            <p className="read" style={{ fontSize: ".93rem", marginTop: 8 }}><RichInline text="Filters remove candidates before ranking. **design = RCT** keeps MS-18, which is randomized but measured the wrong outcome: filters narrow the pile, and screening still decides eligibility." /></p>
          </div>
        )}
      </LabCard>
    </>
  );
}
