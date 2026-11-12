import { useMemo, useState } from "react";
import { BucketBoard, DragHint, SortIntoBuckets } from "../../components/dnd";
import { RichInline } from "../../components/Rich";
import { EXAMPLE_QUERY, RIGHT_EXAMPLE, topExamples, type Example } from "../../content/software/data";
import { EXAMPLES } from "../../content/software/epiloom";
import { earnBadge, useProgress } from "../../lib/progress";
import { finishPart, LabCard } from "../common";

const ID = "se-vdb";
const EV = ["Record anatomy", "Similarity search", "Right example chosen"];
const LEVEL_COLOR: Record<Example["level"], string> = { "agent-based": "var(--ok)", metapopulation: "var(--st-307)", compartmental: "var(--st-147)" };

const FIELDS = [
  { id: "f1", label: "`EX-03`", bucket: "id", why: "A unique key for the record." },
  { id: "f2", label: "`[0.70, 0.40, ...]`", bucket: "vec", why: "The embedding of the example's description and code: what similarity compares." },
  { id: "f3", label: "features: sexual-network, mtct", bucket: "meta", why: "Structured properties to filter on." },
  { id: "f4", label: "module kinds: disease, network, demographics", bucket: "meta", why: "Filterable." },
  { id: "f5", label: "level: agent-based", bucket: "meta", why: "Level of detail is a structured property." },
  { id: "f6", label: "code: `import epiloom as el …`", bucket: "meta", why: "The payload stored with the record (returned, not compared)." },
];

type Filter = { id: string; label: string; field: "feature" | "level"; test: (e: Example) => boolean };
const FILTERS: Filter[] = [
  { id: "mtct", label: "feature = mtct", field: "feature", test: e => e.features.includes("mtct") },
  { id: "sex", label: "feature = sexual-network", field: "feature", test: e => e.features.includes("sexual-network") },
  { id: "co", label: "feature = co-transmission", field: "feature", test: e => e.features.includes("co-transmission") },
  { id: "abm", label: "level = agent-based", field: "level", test: e => e.level === "agent-based" },
  { id: "cmp", label: "level = compartmental", field: "level", test: e => e.level === "compartmental" },
];

export default function VectorDbLab() {
  const ev = useProgress().lessons[ID]?.evidence || [];
  const [k, setK] = useState(3);
  const [place, setPlace] = useState<Record<string, string>>({});
  const [ran, setRan] = useState<{ rows: ReturnType<typeof topExamples>; filtered: boolean } | null>(null);
  const [runs, setRuns] = useState({ plain: false, filtered: false });
  const [pick, setPick] = useState<string | null>(null);
  const active = FILTERS.filter(f => place[f.id] === "query");
  // Filters are AND-ed: every active filter must hold (two feature filters mean "has both features").
  const keep = useMemo(() => (e: Example) => active.every(f => f.test(e)), [place]); // eslint-disable-line

  const run = () => {
    const rows = topExamples(EXAMPLE_QUERY.vec, k, keep);
    setRan({ rows, filtered: active.length > 0 });
    const r = { plain: runs.plain || !active.length, filtered: runs.filtered || active.length > 0 };
    setRuns(r);
    if (r.plain && r.filtered) finishPart(ID, EV[1], EV);
  };
  const choose = (id: string) => {
    setPick(id);
    if (id === RIGHT_EXAMPLE) { finishPart(ID, EV[2], EV); earnBadge("right-example"); }
  };
  const shown = new Set(ran?.rows.map(r => r.e.id) || []);
  const X = (v: number) => 20 + v * 460, Y = (v: number) => 380 - v * 360;
  const candidates = topExamples(EXAMPLE_QUERY.vec, 4).map(r => r.e);

  return (
    <>
      <LabCard title="A. Anatomy of an example record" done={ev.includes(EV[0])} sub="Build EX-03's record. Drag each value to the part of the record it belongs in." right={<DragHint>Drag cards into buckets</DragHint>}>
        <SortIntoBuckets items={FIELDS} columns={3} buckets={[{ id: "id", title: "id" }, { id: "vec", title: "vector" }, { id: "meta", title: "metadata / payload" }]} onSolved={() => finishPart(ID, EV[0], EV)} />
      </LabCard>

      <LabCard title="B. Search the examples library" done={ev.includes(EV[1])} sub={<RichInline text={`Query: **"${EXAMPLE_QUERY.text}"**. Search once with no filters, then drag filter chips into the query and search again. Toy 2-D [[c|embeddings]]; real ones have hundreds to thousands of dimensions.`} />}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: 20 }} className="vdb-grid">
          <svg viewBox="0 0 500 400" className="svgbox" role="img" aria-label="Embedding map of examples">
            {[0.25, 0.5, 0.75].map(g => <g key={g}><line x1={X(g)} x2={X(g)} y1={Y(0)} y2={Y(1)} style={{ stroke: "var(--line)" }} strokeDasharray="3 5" /><line y1={Y(g)} y2={Y(g)} x1={X(0)} x2={X(1)} style={{ stroke: "var(--line)" }} strokeDasharray="3 5" /></g>)}
            {ran && EXAMPLES.filter(e => shown.has(e.id)).map(e => <line key={e.id} x1={X(EXAMPLE_QUERY.vec[0])} y1={Y(EXAMPLE_QUERY.vec[1])} x2={X(e.vec[0])} y2={Y(e.vec[1])} style={{ stroke: "var(--yellow)" }} strokeWidth={4} />)}
            {EXAMPLES.map(e => (
              <g key={e.id} opacity={keep(e) ? 1 : 0.18}>
                <circle cx={X(e.vec[0])} cy={Y(e.vec[1])} r={shown.has(e.id) ? 9 : 7} style={{ fill: LEVEL_COLOR[e.level], stroke: shown.has(e.id) ? "var(--yellow)" : "var(--sheet)" }} strokeWidth={2} />
                <text x={X(e.vec[0]) + 11} y={Y(e.vec[1]) + 4} fontSize={11} fontFamily="IBM Plex Mono" style={{ fill: "var(--ink)" }}>{e.id.slice(3)}</text>
              </g>
            ))}
            <text x={X(EXAMPLE_QUERY.vec[0]) - 9} y={Y(EXAMPLE_QUERY.vec[1]) + 7} fontSize={22} style={{ fill: "var(--ink)" }}>★</text>
            {Object.entries(LEVEL_COLOR).map(([lv, c], n) => <g key={lv}><circle cx={30 + n * 130} cy={392} r={5} style={{ fill: c }} /><text x={40 + n * 130} y={396} fontSize={11} fontFamily="IBM Plex Mono" style={{ fill: "var(--ink)" }}>{lv}</text></g>)}
          </svg>
          <div className="stack">
            <div className="row"><label className="muted" htmlFor="topk">top-k = {k}</label><input id="topk" type="range" min={1} max={6} value={k} onChange={e => setK(+e.target.value)} /></div>
            <BucketBoard items={FILTERS} buckets={[{ id: "query", title: "Active filters", hint: "All active filters must hold" }]} columns={1} value={place} onChange={setPlace} trayLabel="Filter chips" render={f => <span className="mono" style={{ fontSize: ".82rem" }}>{f.label}</span>} />
            <button className="btn primary" onClick={run}>Search {active.length ? `with ${active.length} filter${active.length > 1 ? "s" : ""}` : "(no filters)"}</button>
          </div>
        </div>
        {ran && (
          <div className="scroll-x" style={{ marginTop: 14 }}>
            <table className="t">
              <thead><tr><th>rank</th><th>id</th><th>score</th><th>title</th><th>features</th><th>level</th></tr></thead>
              <tbody>{ran.rows.map((r, n) => <tr key={r.e.id}><td>{n + 1}</td><td><b>{r.e.id}</b></td><td className="mono">{r.s.toFixed(3)}</td><td>{r.e.title}</td><td className="mono" style={{ fontSize: ".8rem" }}>{r.e.features.join(", ")}</td><td>{r.e.level}</td></tr>)}</tbody>
            </table>
            {!ran.rows.length && <p className="feedback bad">No records pass these filters.</p>}
            <p className="read" style={{ fontSize: ".95rem", marginTop: 10 }}>
              <RichInline text={ran.filtered
                ? "Filters removed records that don't have the required features. Did the closest look-alike survive? A filter answers *must have*; similarity answers *what is it like*."
                : "The closest match is a workshop look-alike. Its score says it is **near** the query, not that it **fits** the spec. Read part C before you adapt anything."} />
            </p>
          </div>
        )}
      </LabCard>

      <LabCard title="C. Which example should the agent adapt?" done={ev.includes(EV[2])} sub="The spec: syphilis on a sexual network, with congenital syphilis via mother-to-child transmission. Read the top candidates' code and pick the one that fits.">
        <div className="stack" style={{ gap: 8 }}>
          {candidates.map(e => (
            <button key={e.id} className={`opt ${pick === e.id ? (e.id === RIGHT_EXAMPLE ? "right" : "wrong") : ""}`} onClick={() => choose(e.id)} disabled={pick === RIGHT_EXAMPLE}>
              <b>{e.id}</b> {e.title} <span className="muted" style={{ fontSize: ".85rem" }}>· {e.features.join(", ")}</span>
              <pre className="mono" style={{ whiteSpace: "pre-wrap", fontSize: ".75rem", margin: "6px 0 0", textAlign: "left" }}>{e.code}</pre>
            </button>
          ))}
        </div>
        {pick && <p className={`feedback ${pick === RIGHT_EXAMPLE ? "good" : "bad"}`}><RichInline text={pick === RIGHT_EXAMPLE
          ? "Right: EX-03 uses el.MFNet for sexual transmission and el.Pregnancy with el.MaternalNet, so babies can be infected. The closest look-alike (EX-10) uses a random network and has no Pregnancy, so its maternal network links nobody."
          : pick === "EX-10" ? "That's the closest match, and it's wrong twice: el.RandomNet is the wrong route for syphilis, and el.MaternalNet without el.Pregnancy creates no mother-child links." : "Close, but it doesn't include mother-to-child transmission (no el.Pregnancy or el.MaternalNet)."} /></p>}
      </LabCard>
    </>
  );
}
