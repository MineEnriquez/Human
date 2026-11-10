import { useMemo, useState } from "react";
import { BucketBoard, DragHint, SortIntoBuckets } from "../../components/dnd";
import { RichInline } from "../../components/Rich";
import { ISOLATES, QUERY_ISOLATE, type Isolate } from "../../content/pathogen/dataset";
import { earnBadge, useProgress } from "../../lib/progress";
import { finishPart, LabCard } from "../common";

const ID = "pg-vdb";
const EV = ["Record anatomy", "Top-k search", "Filtered search"];
const ST_COLOR: Record<string, string> = { ST258: "var(--st-258)", ST307: "var(--st-307)", ST11: "var(--st-11)", ST147: "var(--st-147)" };

const FIELDS = [
  { id: "f1", label: "`KP-04`", bucket: "id", why: "A unique key for the record." },
  { id: "f2", label: "`[0.66, 0.76, ...]`", bucket: "vec", why: "The embedding: the part similarity search compares." },
  { id: "f3", label: "ward: Surgical", bucket: "meta", why: "A structured fact to filter on." },
  { id: "f4", label: "collected: 2026-03-11", bucket: "meta", why: "Dates are metadata: great for time-window filters." },
  { id: "f5", label: "st: ST258", bucket: "meta", why: "Sequence type is a categorical attribute, so metadata." },
  { id: "f6", label: "carbapenemase: blaKPC-3", bucket: "meta", why: "Gene calls are attributes you filter on." },
];

type Filter = { id: string; label: string; field: keyof Isolate; test: (i: Isolate) => boolean };
const FILTERS: Filter[] = [
  { id: "icu", label: "ward = ICU", field: "ward", test: i => i.ward === "ICU" },
  { id: "surg", label: "ward = Surgical", field: "ward", test: i => i.ward === "Surgical" },
  { id: "env", label: "ward = Environment", field: "ward", test: i => i.ward === "Environment" },
  { id: "kpc3", label: "carbapenemase = blaKPC-3", field: "carbapenemase", test: i => i.carbapenemase === "blaKPC-3" },
  { id: "after10", label: "collected ≥ 2026-03-10", field: "collected", test: i => i.collected >= "2026-03-10" },
];

const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const score = (i: Isolate) => 1 / (1 + 10 * dist(i.vec, QUERY_ISOLATE.vec));

export default function VectorDbLab() {
  const ev = useProgress().lessons[ID]?.evidence || [];
  const [k, setK] = useState(3);
  const [place, setPlace] = useState<Record<string, string>>({});
  const [ran, setRan] = useState<{ ids: string[]; filtered: boolean } | null>(null);
  const active = FILTERS.filter(f => place[f.id] === "query");
  // Within one field filters are OR-ed (ward = ICU or Surgical); across fields they are AND-ed.
  const passes = (i: Isolate) => {
    const byField = new Map<string, Filter[]>();
    for (const f of active) byField.set(String(f.field), [...(byField.get(String(f.field)) || []), f]);
    return [...byField.values()].every(fs => fs.some(f => f.test(i)));
  };
  const ranked = useMemo(() => ISOLATES.filter(passes).map(i => ({ i, s: score(i) })).sort((a, b) => b.s - a.s).slice(0, k), [place, k]); // eslint-disable-line
  const run = () => {
    setRan({ ids: ranked.map(r => r.i.id), filtered: active.length > 0 });
    if (!active.length && k >= 3) { finishPart(ID, EV[1], EV); }
    if (active.length) { finishPart(ID, EV[2], EV); }
    if (ev.includes(EV[1]) && active.length) earnBadge("nearest-neighbor");
  };
  const shown = ran ? new Set(ran.ids) : new Set<string>();
  const X = (v: number) => 20 + v * 460, Y = (v: number) => 380 - v * 360;

  return (
    <>
      <LabCard title="A. Anatomy of a record" done={ev.includes(EV[0])} sub="Build KP-04's record. Drag each value to the part of the record it belongs in." right={<DragHint>Drag cards into buckets</DragHint>}>
        <SortIntoBuckets items={FIELDS} columns={3} buckets={[{ id: "id", title: "id" }, { id: "vec", title: "vector" }, { id: "meta", title: "metadata" }]} onSolved={() => finishPart(ID, EV[0], EV)} />
      </LabCard>

      <LabCard title="B. Search the genome database" done={ev.includes(EV[1]) && ev.includes(EV[2])} sub={<RichInline text="Query: the new isolate **KP-13** (ICU, 22 March). First search with no filters, then drag filter chips into the query and search again. Toy 2-D [[c|embeddings]]; real ones have hundreds of dimensions." />}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 20 }} className="vdb-grid">
          <svg viewBox="0 0 500 400" className="svgbox" role="img" aria-label="Embedding map of isolates">
            {[0.25, 0.5, 0.75].map(g => <g key={g}><line x1={X(g)} x2={X(g)} y1={Y(0)} y2={Y(1)} style={{ stroke: "var(--line)" }} strokeDasharray="3 5" /><line y1={Y(g)} y2={Y(g)} x1={X(0)} x2={X(1)} style={{ stroke: "var(--line)" }} strokeDasharray="3 5" /></g>)}
            {ran && ISOLATES.filter(i => shown.has(i.id)).map(i => <line key={i.id} x1={X(QUERY_ISOLATE.vec[0])} y1={Y(QUERY_ISOLATE.vec[1])} x2={X(i.vec[0])} y2={Y(i.vec[1])} style={{ stroke: "var(--yellow)" }} strokeWidth={4} />)}
            {ISOLATES.map(i => {
              const on = passes(i);
              return (
                <g key={i.id} opacity={on ? 1 : 0.18}>
                  {i.ward === "Environment" ? <rect x={X(i.vec[0]) - 7} y={Y(i.vec[1]) - 7} width={14} height={14} style={{ fill: ST_COLOR[i.st] }} /> : <circle cx={X(i.vec[0])} cy={Y(i.vec[1])} r={shown.has(i.id) ? 9 : 7} style={{ fill: ST_COLOR[i.st], stroke: shown.has(i.id) ? "var(--yellow)" : "var(--sheet)" }} strokeWidth={2} />}
                  <text x={X(i.vec[0]) + 11} y={Y(i.vec[1]) + 4} fontSize={11} fontFamily="IBM Plex Mono" style={{ fill: "var(--ink)" }}>{i.id.slice(3)}</text>
                </g>
              );
            })}
            <text x={X(QUERY_ISOLATE.vec[0]) - 9} y={Y(QUERY_ISOLATE.vec[1]) + 7} fontSize={22} style={{ fill: "var(--ink)" }}>★</text>
            {Object.entries(ST_COLOR).map(([st, c], n) => <g key={st}><circle cx={30 + n * 80} cy={392} r={5} style={{ fill: c }} /><text x={40 + n * 80} y={396} fontSize={11} fontFamily="IBM Plex Mono" style={{ fill: "var(--ink)" }}>{st}</text></g>)}
          </svg>
          <div className="stack">
            <div className="row"><label className="muted" htmlFor="topk">top-k = {k}</label><input id="topk" type="range" min={1} max={8} value={k} onChange={e => setK(+e.target.value)} /></div>
            <BucketBoard items={FILTERS} buckets={[{ id: "query", title: "Active filters", hint: "Same field = OR, different fields = AND" }]} columns={1} value={place} onChange={setPlace} trayLabel="Filter chips" render={f => <span className="mono" style={{ fontSize: ".82rem" }}>{f.label}</span>} />
            <button className="btn primary" onClick={run}>Search {active.length ? `with ${active.length} filter${active.length > 1 ? "s" : ""}` : "(no filters)"}</button>
          </div>
        </div>
        {ran && (
          <div className="scroll-x" style={{ marginTop: 14 }}>
            <table className="t">
              <thead><tr><th>rank</th><th>id</th><th>score</th><th>ward</th><th>ST</th><th>gene</th><th>collected</th></tr></thead>
              <tbody>{ran.ids.map((id, n) => { const i = ISOLATES.find(x => x.id === id)!; return <tr key={id}><td>{n + 1}</td><td><b>{id}</b></td><td className="mono">{score(i).toFixed(3)}</td><td>{i.ward}</td><td>{i.st}</td><td className="mono">{i.carbapenemase}</td><td>{i.collected}</td></tr>; })}</tbody>
            </table>
            {!ran.ids.length && <p className="feedback bad">No records pass these filters.</p>}
            <p className="read" style={{ fontSize: ".95rem", marginTop: 10 }}>
              <RichInline text={ran.filtered
                ? "Filters removed candidates **before** ranking. Did KP-13's best match survive? A filter answers *where/when*; similarity answers *what is it like*."
                : "The nearest neighbours are all [[b|ST258]] and include the sink drain, KP-12. That's a **lead**. [[w|Similar is not transmitted]]: next you'd check SNP distance and epidemiology."} />
            </p>
          </div>
        )}
      </LabCard>
    </>
  );
}
