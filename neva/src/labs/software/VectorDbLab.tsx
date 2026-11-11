import { useMemo, useState } from "react";
import { BucketBoard, DragHint, SortIntoBuckets } from "../../components/dnd";
import { RichInline } from "../../components/Rich";
import { DUPLICATE_OF_NEW, NEW_TICKET, TICKETS, similarity, topK, type Area, type Ticket } from "../../content/software/data";
import { earnBadge, useProgress } from "../../lib/progress";
import { finishPart, LabCard } from "../common";

const ID = "se-vdb";
const EV = ["Record anatomy", "Similarity search", "Duplicate found"];
const AREA_COLOR: Record<Area, string> = { Payouts: "var(--ok)", Checkout: "var(--st-307)", Login: "var(--st-147)", "Mobile app": "var(--ink)" };

const FIELDS = [
  { id: "f1", label: "`T-108`", bucket: "id", why: "A unique key for the record." },
  { id: "f2", label: "`[0.71, 0.70, ...]`", bucket: "vec", why: "The embedding of the ticket text: the part similarity search compares." },
  { id: "f3", label: "area: Payouts", bucket: "meta", why: "A structured field to filter on." },
  { id: "f4", label: "version: web 5.3", bucket: "meta", why: "Versions let you match bugs to releases." },
  { id: "f5", label: "status: open", bucket: "meta", why: "Open vs closed matters when you link a duplicate." },
  { id: "f6", label: "severity: S2", bucket: "meta", why: "Structured, filterable." },
];

type Filter = { id: string; label: string; field: "area" | "version" | "status"; test: (t: Ticket) => boolean };
const FILTERS: Filter[] = [
  { id: "pay", label: "area = Payouts", field: "area", test: t => t.area === "Payouts" },
  { id: "chk", label: "area = Checkout", field: "area", test: t => t.area === "Checkout" },
  { id: "v53", label: "version = web 5.3", field: "version", test: t => t.version === "web 5.3" },
  { id: "open", label: "status = open", field: "status", test: t => t.status === "open" },
];

export default function VectorDbLab() {
  const ev = useProgress().lessons[ID]?.evidence || [];
  const [k, setK] = useState(3);
  const [place, setPlace] = useState<Record<string, string>>({});
  const [ran, setRan] = useState<{ rows: ReturnType<typeof topK>; filtered: boolean } | null>(null);
  const [runs, setRuns] = useState({ plain: false, filtered: false });
  const [pick, setPick] = useState<string | null>(null);
  const active = FILTERS.filter(f => place[f.id] === "query");
  // Within one field filters are OR-ed; across fields they are AND-ed.
  const keep = useMemo(() => (t: Ticket) => {
    const byField = new Map<string, Filter[]>();
    for (const f of active) byField.set(f.field, [...(byField.get(f.field) || []), f]);
    return [...byField.values()].every(fs => fs.some(f => f.test(t)));
  }, [place]); // eslint-disable-line

  const run = () => {
    const rows = topK(NEW_TICKET.vec, k, keep);
    setRan({ rows, filtered: active.length > 0 });
    const r = { plain: runs.plain || !active.length, filtered: runs.filtered || active.length > 0 };
    setRuns(r);
    if (r.plain && r.filtered) finishPart(ID, EV[1], EV);
  };
  const choose = (id: string) => {
    setPick(id);
    if (id === DUPLICATE_OF_NEW) { finishPart(ID, EV[2], EV); earnBadge("dedupe"); }
  };
  const shown = new Set(ran?.rows.map(r => r.t.id) || []);
  const X = (v: number) => 20 + v * 460, Y = (v: number) => 380 - v * 360;
  const candidates = TICKETS.filter(t => t.area === "Payouts").sort((a, b) => a.id.localeCompare(b.id));

  return (
    <>
      <LabCard title="A. Anatomy of a ticket record" done={ev.includes(EV[0])} sub="Build ticket T-108's record. Drag each value to the part of the record it belongs in." right={<DragHint>Drag cards into buckets</DragHint>}>
        <SortIntoBuckets items={FIELDS} columns={3} buckets={[{ id: "id", title: "id" }, { id: "vec", title: "vector" }, { id: "meta", title: "metadata" }]} onSolved={() => finishPart(ID, EV[0], EV)} />
      </LabCard>

      <LabCard title="B. Search for similar tickets" done={ev.includes(EV[1])} sub={<RichInline text={`New ticket: **"${NEW_TICKET.title}"** (Payouts, web 5.3). Search once with no filters, then drag filter chips in and search again. Toy 2-D [[c|embeddings]] with a distance-based score; real ones have hundreds to thousands of dimensions.`} />}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 20 }} className="vdb-grid">
          <svg viewBox="0 0 500 400" className="svgbox" role="img" aria-label="Embedding map of tickets">
            {[0.25, 0.5, 0.75].map(g => <g key={g}><line x1={X(g)} x2={X(g)} y1={Y(0)} y2={Y(1)} style={{ stroke: "var(--line)" }} strokeDasharray="3 5" /><line y1={Y(g)} y2={Y(g)} x1={X(0)} x2={X(1)} style={{ stroke: "var(--line)" }} strokeDasharray="3 5" /></g>)}
            {ran && ran.rows.map(r => <line key={r.t.id} x1={X(NEW_TICKET.vec[0])} y1={Y(NEW_TICKET.vec[1])} x2={X(r.t.vec[0])} y2={Y(r.t.vec[1])} style={{ stroke: "var(--yellow)" }} strokeWidth={4} />)}
            {TICKETS.map(t => (
              <g key={t.id} opacity={keep(t) ? 1 : 0.15}>
                <circle cx={X(t.vec[0])} cy={Y(t.vec[1])} r={shown.has(t.id) ? 9 : 7} style={{ fill: AREA_COLOR[t.area], stroke: shown.has(t.id) ? "var(--yellow)" : "var(--sheet)" }} strokeWidth={2} />
                <text x={X(t.vec[0]) + 10} y={Y(t.vec[1]) + 4} fontSize={10} fontFamily="IBM Plex Mono" style={{ fill: "var(--ink)" }}>{t.id.slice(2)}</text>
              </g>
            ))}
            <text x={X(NEW_TICKET.vec[0]) - 9} y={Y(NEW_TICKET.vec[1]) + 7} fontSize={22} style={{ fill: "var(--ink)" }}>★</text>
          </svg>
          <div className="stack">
            <div className="row"><label className="muted" htmlFor="topk">top-k = {k}</label><input id="topk" type="range" min={1} max={6} value={k} onChange={e => { setK(+e.target.value); setRan(null); }} /></div>
            <BucketBoard items={FILTERS} buckets={[{ id: "query", title: "Active filters", hint: "Same field = OR, different fields = AND" }]} columns={1} value={place} onChange={p => { setPlace(p); setRan(null); }} trayLabel="Filter chips" render={f => <span className="mono" style={{ fontSize: ".82rem" }}>{f.label}</span>} />
            <button className="btn primary" onClick={run}>Search {active.length ? `with ${active.length} filter${active.length > 1 ? "s" : ""}` : "(no filters)"}</button>
          </div>
        </div>
        <div className="legend" style={{ marginTop: 10 }}>{(Object.keys(AREA_COLOR) as Area[]).map(a => <span key={a} className="row" style={{ gap: 4 }}><svg width="10" height="10"><circle cx="5" cy="5" r="5" style={{ fill: AREA_COLOR[a] }} /></svg>{a}</span>)}</div>
        {ran && (
          <div className="scroll-x" style={{ marginTop: 14 }}>
            <table className="t">
              <thead><tr><th>rank</th><th>id</th><th>score</th><th>title</th><th>area</th><th>version</th><th>status</th></tr></thead>
              <tbody>{ran.rows.map((r, i) => <tr key={r.t.id}><td>{i + 1}</td><td><b>{r.t.id}</b></td><td className="mono">{r.s.toFixed(3)}</td><td>{r.t.title}</td><td>{r.t.area}</td><td>{r.t.version}</td><td>{r.t.status}</td></tr>)}</tbody>
            </table>
            {!ran.rows.length && <p className="feedback bad">No tickets pass these filters.</p>}
            <p className="read" style={{ fontSize: ".95rem", marginTop: 10 }}>
              <RichInline text={ran.filtered
                ? "Filters decide which tickets are eligible. Filter to the wrong area and the search still returns its closest matches, with [[w|confident scores for the wrong bug]]."
                : "The nearest tickets are all about payouts and bank changes. They are **leads**: next, decide which one is the same bug."} />
            </p>
          </div>
        )}
      </LabCard>

      <LabCard title="C. Which ticket is the duplicate?" done={ev.includes(EV[2])} sub="Read the Payouts tickets near the new report. Pick the one that is the same bug, not just the most similar-sounding.">
        <div className="stack" style={{ gap: 8 }}>
          {candidates.map(t => (
            <button key={t.id} className={`opt ${pick === t.id ? (t.id === DUPLICATE_OF_NEW ? "right" : "wrong") : ""}`} onClick={() => choose(t.id)}>
              <b>{t.id}</b> · {t.title} <span className="muted">· {t.version} · {t.status} · score {similarity(NEW_TICKET.vec, t.vec).toFixed(3)}</span>
            </button>
          ))}
        </div>
        {pick && <p className={`feedback ${pick === DUPLICATE_OF_NEW ? "good" : "bad"}`}><RichInline text={pick === DUPLICATE_OF_NEW
          ? "Right: T-108 is open, on the same version, with the same steps (bank details changed, payout stuck in processing). Link the new report to it."
          : pick === "T-115" ? "Close, but T-115 is the payouts page showing the old bank account: a display bug, not a stuck payout. [[w|Similar is not the same bug]]."
          : pick === "T-112" ? "T-112 reads alike, but it was a bank-holiday delay on an older version, and it's closed. Merging into it would hide a real bug."
          : "This one is a different symptom. Compare what actually happens to the customer, the version and the status."} /></p>}
      </LabCard>
    </>
  );
}
