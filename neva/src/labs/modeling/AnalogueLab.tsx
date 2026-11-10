import { useMemo, useState } from "react";
import { BucketBoard, DragHint, SortIntoBuckets } from "../../components/dnd";
import { RichInline } from "../../components/Rich";
import { ANALOGUES, METRICS, QUERY, rank, type Analogue, type Metric } from "../../content/modeling/analogues";
import { VDB_EVIDENCE as EV } from "../../content/modeling/lessons";
import { useProgress } from "../../lib/progress";
import { finishPart, LabCard } from "../common";

const ID = "om-vdb";

type Filter = { id: string; label: string; field: string; test: (a: Analogue) => boolean };
export const FILTERS: Filter[] = [
  { id: "resp", label: "family = respiratory", field: "family", test: a => a.family === "respiratory" },
  { id: "city", label: "setting = city", field: "setting", test: a => a.setting === "city" },
  { id: "island", label: "setting = island", field: "setting", test: a => a.setting === "island" },
  { id: "pop", label: "population ≥ 100,000", field: "population", test: a => a.population >= 100_000 },
  { id: "recent", label: "year ≥ 2020", field: "year", test: a => a.year >= 2020 },
];

const STATEMENTS = [
  { id: "s1", label: "Use Marrow Vale's R0 range as a starting prior, then update it with Port Calder's data.", bucket: "ok", why: "Analogues are good priors when they match on route, setting and growth." },
  { id: "s2", label: "Port Calder will peak in the same week Marrow Vale did.", bucket: "over", why: "Timing depends on seeding, population and behaviour, not just early shape." },
  { id: "s3", label: "Check pathogen family and setting before borrowing any parameter.", bucket: "ok", why: "Those are hard requirements: put them in the filter." },
  { id: "s4", label: "A cosine similarity of 0.999 proves the same virus is circulating.", bucket: "over", why: "Six noisy weekly counts can't identify a pathogen." },
  { id: "s5", label: "Similar shape implies a similar early growth rate and doubling time.", bucket: "ok", why: "Same week-to-week ratios mean the same exponential growth." },
  { id: "s6", label: "Skip the metadata: the vector already captures everything that matters.", bucket: "over", why: "The curve says nothing about transmission route or setting." },
  { id: "s7", label: "Kellen Island's hospital numbers can be used directly for Port Calder.", bucket: "over", why: "A 40,000-person island is far smaller. Cosine ignored size; demand estimates need it." },
  { id: "s8", label: "Write down which analogues you used and why, so others can challenge the choice.", bucket: "ok", why: "Transparent assumptions are part of a defensible forecast." },
];

function Spark({ v, w = 90, h = 26 }: { v: number[]; w?: number; h?: number }) {
  const m = Math.max(...v, 1);
  return <svg width={w} height={h} aria-hidden><polyline fill="none" strokeWidth={2} style={{ stroke: "var(--ink)" }} points={v.map((x, i) => `${(i / (v.length - 1)) * (w - 4) + 2},${h - 2 - (x / m) * (h - 4)}`).join(" ")} /></svg>;
}

export default function AnalogueLab() {
  const ev = useProgress().lessons[ID]?.evidence || [];
  const [metric, setMetric] = useState<Metric>("cosine");
  const [tried, setTried] = useState<Metric[]>([]);
  const [place, setPlace] = useState<Record<string, string>>({});
  const [ranFiltered, setRanFiltered] = useState(false);
  const active = FILTERS.filter(f => place[f.id] === "query");
  // Same field = OR, different fields = AND.
  const passes = (a: Analogue) => {
    const by = new Map<string, Filter[]>();
    for (const f of active) by.set(f.field, [...(by.get(f.field) || []), f]);
    return [...by.values()].every(fs => fs.some(f => f.test(a)));
  };
  const results = useMemo(() => rank(metric, ANALOGUES.filter(passes)).slice(0, 4), [metric, place]); // eslint-disable-line
  const m = METRICS.find(x => x.id === metric)!;
  const run = () => {
    const t = tried.includes(metric) ? tried : [...tried, metric];
    setTried(t);
    if (t.length >= 2) finishPart(ID, EV[0], EV);
    if (active.length) { setRanFiltered(true); finishPart(ID, EV[1], EV); }
  };

  return (
    <>
      <LabCard title="A + B. Search the outbreak library" done={ev.includes(EV[0]) && ev.includes(EV[1])} sub={<RichInline text={`Query: **${QUERY.name}**, weekly reported cases [${QUERY.vec.join(", ")}]. Run the search with at least two metrics, then drag filter chips into the query and search again.`} />}>
        <div className="row" style={{ marginBottom: 12 }}>
          {METRICS.map(x => <button key={x.id} className={`btn sm ${metric === x.id ? "primary" : "ghost"}`} onClick={() => setMetric(x.id)}>{x.label}{tried.includes(x.id) ? " ✓" : ""}</button>)}
        </div>
        <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.3fr)", gap: 18 }}>
          <div className="stack">
            <BucketBoard items={FILTERS} buckets={[{ id: "query", title: "Active filters", hint: "Same field = OR, different fields = AND" }]} columns={1} value={place} onChange={p => { setPlace(p); }} trayLabel="Filter chips" render={f => <span className="mono" style={{ fontSize: ".82rem" }}>{f.label}</span>} />
            <button className="btn primary" onClick={run}>Search: {m.label}{active.length ? ` + ${active.length} filter${active.length > 1 ? "s" : ""}` : ""}</button>
            <DragHint>Drag chips into Active filters</DragHint>
          </div>
          <div className="scroll-x">
            <table className="t">
              <thead><tr><th>rank</th><th>outbreak</th><th>curve</th><th>{m.higherIsCloser ? "similarity" : "distance"}</th><th>metadata</th></tr></thead>
              <tbody>{results.map((r, i) => (
                <tr key={r.a.id}><td>{i + 1}</td><td><b>{r.a.name}</b><div className="muted" style={{ fontSize: ".78rem" }}>{r.a.outcome}</div></td><td><Spark v={r.a.vec} /></td><td className="mono">{r.s.toFixed(4)}</td><td style={{ fontSize: ".8rem" }}>{r.a.family}, {r.a.setting}, {r.a.population.toLocaleString()}, {r.a.year}</td></tr>
              ))}</tbody>
            </table>
            {!results.length && <p className="feedback bad">No records pass these filters.</p>}
            <p className="muted" style={{ fontSize: ".85rem" }}>Query curve: <Spark v={QUERY.vec} /></p>
          </div>
        </div>
        {tried.length >= 2 && <p className="read" style={{ fontSize: ".95rem", marginTop: 10 }}><RichInline text={"Cosine ranks Kellen Island (40,000 people) at the top because it compares **shape** only. Raw Euclidean ranks Marrow Vale first because it is dominated by **size**. Unit-length Euclidean agrees with cosine, as |a−b|² = 2 − 2cos θ predicts."} /></p>}
        {ranFiltered && <p className="read" style={{ fontSize: ".95rem" }}><RichInline text={"Filters removed records **before** ranking. Did the island or the mosquito-borne outbreak survive your filters? [[w|Filter on what must match, rank on what should be similar.]]"} /></p>}
      </LabCard>

      <LabCard title="C. Vet the analogues" done={ev.includes(EV[2])} sub="The director's team drafted statements about using the analogues. Which are reasonable, and which overreach?" right={<DragHint>Drag cards into buckets</DragHint>}>
        <SortIntoBuckets items={STATEMENTS} buckets={[{ id: "ok", title: "✓ Reasonable use" }, { id: "over", title: "✗ Overreach" }]} onSolved={() => finishPart(ID, EV[2], EV)} />
      </LabCard>
    </>
  );
}
