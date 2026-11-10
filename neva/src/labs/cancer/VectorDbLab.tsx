import { useMemo, useState } from "react";
import { BucketBoard, DragHint, SortIntoBuckets } from "../../components/dnd";
import { RichInline } from "../../components/Rich";
import { ATLAS, MARKERS, QUERY_CELLS, dist, labelTransfer, type CellType, type RefCell } from "../../content/cancer/dataset";
import { earnBadge, useProgress } from "../../lib/progress";
import { finishPart, LabCard } from "../common";

const ID = "cg-vdb";
const EV = ["Record anatomy", "Label transfer", "Filtered search"];
const TYPE_COLOR: Record<CellType, string> = {
  "HSC/MPP": "var(--st-147)", "Myeloid progenitor": "var(--st-307)", Monocyte: "var(--yellow)", Erythroid: "var(--st-11)",
  "T cell": "var(--ink)", "NK cell": "var(--muted)", "B cell": "var(--ok)",
};

const FIELDS = [
  { id: "f1", label: "`A05`", bucket: "id", why: "A unique key for the record." },
  { id: "f2", label: "`[0.44, 0.69, ...]`", bucket: "vec", why: "The embedding: the part similarity search compares." },
  { id: "f3", label: "cell type: Myeloid progenitor", bucket: "meta", why: "The label that label transfer copies to a query cell." },
  { id: "f4", label: "markers: CD34, KIT, MPO", bucket: "meta", why: "Marker genes explain why the type was assigned." },
  { id: "f5", label: "tissue: Bone marrow", bucket: "meta", why: "A structured fact to filter on." },
  { id: "f6", label: "donor: HD-2 (healthy)", bucket: "meta", why: "Donor ids let you check for donor or batch effects." },
];

type Filter = { id: string; label: string; field: "tissue" | "donor"; test: (c: RefCell) => boolean };
const FILTERS: Filter[] = [
  { id: "bm", label: "tissue = Bone marrow", field: "tissue", test: c => c.tissue === "Bone marrow" },
  { id: "pb", label: "tissue = Peripheral blood", field: "tissue", test: c => c.tissue === "Peripheral blood" },
  { id: "hd1", label: "donor = HD-1", field: "donor", test: c => c.donor === "HD-1" },
  { id: "hd2", label: "donor = HD-2", field: "donor", test: c => c.donor === "HD-2" },
];

export default function VectorDbLab() {
  const ev = useProgress().lessons[ID]?.evidence || [];
  const [k, setK] = useState(3);
  const [q, setQ] = useState(QUERY_CELLS[0].id);
  const [place, setPlace] = useState<Record<string, string>>({});
  const [annotated, setAnnotated] = useState<string[]>([]);
  const [ran, setRan] = useState<ReturnType<typeof labelTransfer> & { filtered: boolean; q: string } | null>(null);
  const active = FILTERS.filter(f => place[f.id] === "query");
  // Within one field filters are OR-ed (HD-1 or HD-2); across fields they are AND-ed.
  const keep = useMemo(() => (c: RefCell) => {
    const byField = new Map<string, Filter[]>();
    for (const f of active) byField.set(f.field, [...(byField.get(f.field) || []), f]);
    return [...byField.values()].every(fs => fs.some(f => f.test(c)));
  }, [place]); // eslint-disable-line
  const query = QUERY_CELLS.find(c => c.id === q)!;

  const run = () => {
    const r = labelTransfer(query.vec, k, keep);
    setRan({ ...r, filtered: active.length > 0, q });
    if (!active.length) {
      const next = annotated.includes(q) ? annotated : [...annotated, q];
      setAnnotated(next);
      if (next.length >= 3) finishPart(ID, EV[1], EV);
    } else {
      finishPart(ID, EV[2], EV);
      if (ev.includes(EV[1])) earnBadge("nearest-neighbor");
    }
  };
  const shown = new Set(ran?.neighbours.map(n => n.c.id) || []);
  const X = (v: number) => 20 + v * 460, Y = (v: number) => 380 - v * 360;

  return (
    <>
      <LabCard title="A. Anatomy of a reference cell" done={ev.includes(EV[0])} sub="Build reference cell A05's record. Drag each value to the part of the record it belongs in." right={<DragHint>Drag cards into buckets</DragHint>}>
        <SortIntoBuckets items={FIELDS} columns={3} buckets={[{ id: "id", title: "id" }, { id: "vec", title: "vector" }, { id: "meta", title: "metadata" }]} onSolved={() => finishPart(ID, EV[0], EV)} />
      </LabCard>

      <LabCard title="B. Annotate relapse cells by label transfer" done={ev.includes(EV[1]) && ev.includes(EV[2])} sub={<RichInline text="Pick an unlabelled cell from the relapse marrow, choose k, and let its nearest **healthy reference** cells vote. Annotate at least three cells without filters, then drag a filter chip in and try again. Toy 2-D [[c|embeddings]]; real ones have tens to thousands of dimensions." />}>
        <div className="chips" style={{ marginBottom: 12 }}>{QUERY_CELLS.map(c => <button key={c.id} className="chip" onClick={() => { setQ(c.id); setRan(null); }} style={c.id === q ? { borderColor: "var(--ink)", borderStyle: "solid", fontWeight: 700 } : undefined}>{annotated.includes(c.id) ? "✓ " : ""}{c.id}</button>)}</div>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 20 }} className="vdb-grid">
          <svg viewBox="0 0 500 400" className="svgbox" role="img" aria-label="Embedding map of reference cells">
            {[0.25, 0.5, 0.75].map(g => <g key={g}><line x1={X(g)} x2={X(g)} y1={Y(0)} y2={Y(1)} style={{ stroke: "var(--line)" }} strokeDasharray="3 5" /><line y1={Y(g)} y2={Y(g)} x1={X(0)} x2={X(1)} style={{ stroke: "var(--line)" }} strokeDasharray="3 5" /></g>)}
            {ran && ran.neighbours.map(n => <line key={n.c.id} x1={X(query.vec[0])} y1={Y(query.vec[1])} x2={X(n.c.vec[0])} y2={Y(n.c.vec[1])} style={{ stroke: "var(--yellow)" }} strokeWidth={4} />)}
            {ATLAS.map(c => (
              <g key={c.id} opacity={keep(c) ? 1 : 0.15}>
                <circle cx={X(c.vec[0])} cy={Y(c.vec[1])} r={shown.has(c.id) ? 9 : 7} style={{ fill: TYPE_COLOR[c.type], stroke: shown.has(c.id) ? "var(--yellow)" : "var(--sheet)" }} strokeWidth={2} />
                <text x={X(c.vec[0]) + 10} y={Y(c.vec[1]) + 4} fontSize={10} fontFamily="IBM Plex Mono" style={{ fill: "var(--ink)" }}>{c.id}</text>
              </g>
            ))}
            {QUERY_CELLS.map(c => <text key={c.id} x={X(c.vec[0]) - 8} y={Y(c.vec[1]) + 6} fontSize={c.id === q ? 20 : 13} opacity={c.id === q ? 1 : 0.45} style={{ fill: "var(--ink)" }}>★</text>)}
          </svg>
          <div className="stack">
            <div className="row"><label className="muted" htmlFor="topk">k = {k}</label><input id="topk" type="range" min={1} max={7} value={k} onChange={e => { setK(+e.target.value); setRan(null); }} /></div>
            <BucketBoard items={FILTERS} buckets={[{ id: "query", title: "Active filters", hint: "Same field = OR, different fields = AND" }]} columns={1} value={place} onChange={p => { setPlace(p); setRan(null); }} trayLabel="Filter chips" render={f => <span className="mono" style={{ fontSize: ".82rem" }}>{f.label}</span>} />
            <button className="btn primary" onClick={run}>Annotate {q} {active.length ? `with ${active.length} filter${active.length > 1 ? "s" : ""}` : "(no filters)"}</button>
          </div>
        </div>
        <div className="legend" style={{ marginTop: 10 }}>{(Object.keys(TYPE_COLOR) as CellType[]).map(t => <span key={t} className="row" style={{ gap: 4 }}><svg width="10" height="10"><circle cx="5" cy="5" r="5" style={{ fill: TYPE_COLOR[t] }} /></svg>{t} <span className="mono">({MARKERS[t].join(", ")})</span></span>)}</div>
        {ran && (
          <div className="scroll-x" style={{ marginTop: 14 }}>
            <p style={{ margin: "0 0 8px" }}><b>{ran.q} → {ran.label ?? "no neighbours"}</b> <span className="muted">· agreement {Math.round(ran.agreement * 100)}% of {ran.neighbours.length}{ran.tie ? " · tie" : ""}</span></p>
            <table className="t">
              <thead><tr><th>rank</th><th>id</th><th>distance</th><th>cell type</th><th>tissue</th><th>donor</th></tr></thead>
              <tbody>{ran.neighbours.map((n, i) => <tr key={n.c.id}><td>{i + 1}</td><td><b>{n.c.id}</b></td><td className="mono">{dist(query.vec, n.c.vec).toFixed(3)}</td><td>{n.c.type}</td><td>{n.c.tissue}</td><td>{n.c.donor}</td></tr>)}</tbody>
            </table>
            {!ran.neighbours.length && <p className="feedback bad">No reference cells pass these filters.</p>}
            <p className="read" style={{ fontSize: ".95rem", marginTop: 10 }}>
              <RichInline text={ran.filtered
                ? "Filters decide which reference cells may vote. Did the label change? A filter that removes the right type (for example peripheral blood has no marrow progenitors) forces the vote onto the next-closest type: [[w|a confident wrong answer]]."
                : ran.agreement < 0.8
                  ? "Low agreement: this cell sits **between** reference types. Change k and watch the label. Report it as uncertain rather than forcing a type."
                  : "A confident label, but the reference holds only **healthy** cells. A progenitor-like relapse cell may well be a leukemic blast: [[w|nearest neighbour is a lead, not a diagnosis]]."} />
            </p>
          </div>
        )}
      </LabCard>
    </>
  );
}
