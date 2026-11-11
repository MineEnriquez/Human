import { useMemo, useState } from "react";
import { BucketBoard, DragHint, SortIntoBuckets } from "../../components/dnd";
import { RichInline } from "../../components/Rich";
import { ANALOGUES, METRICS, QUERY, rank, type Analogue, type Metric } from "../../content/modeling/analogues";
import { VDB_EVIDENCE as EV } from "../../content/modeling/lessons";
import { useProgress } from "../../lib/progress";
import { finishPart, LabCard } from "../common";

const ID = "dm-vdb";

type Filter = { id: string; label: string; field: string; test: (a: Analogue) => boolean };
export const FILTERS: Filter[] = [
  { id: "hivlow", label: "HIV band = low", field: "hiv", test: a => a.hiv === "low" },
  { id: "mixed", label: "setting = mixed", field: "setting", test: a => a.setting === "mixed" },
  { id: "rural", label: "setting = rural", field: "setting", test: a => a.setting === "rural" },
  { id: "acf", label: "ran case finding = yes", field: "acf", test: a => a.acf },
  { id: "pop", label: "population ≥ 300,000", field: "population", test: a => a.population >= 300_000 },
];

export const STATEMENTS = [
  { id: "s1", label: "If we fund case finding, expect notifications to rise for a year or two before they fall, as Harrow Flats saw.", bucket: "ok", why: "Finding missed cases raises notifications first: a pattern worth anticipating in the briefing." },
  { id: "s2", label: "Harrow Flats' notifications fell 20% after case finding, so ours will too.", bucket: "over", why: "Effect sizes depend on local reach, services and costs; use them as a prior, not a promise." },
  { id: "s3", label: "Filter on HIV band before borrowing anything: HIV changes how often infection becomes disease.", bucket: "ok", why: "HIV strongly raises the risk of progression, so it is a hard requirement for comparing TB dynamics." },
  { id: "s4", label: "Sable Coast's flat curve shows it detects as large a share of its cases as we do.", bucket: "over", why: "A flat trajectory says nothing about detection: notifications are not incidence anywhere." },
  { id: "s5", label: "Pell Marsh's rising notifications may reflect its new laboratory rather than more TB.", bucket: "ok", why: "Better diagnosis raises notifications without any change in incidence." },
  { id: "s6", label: "Skip the metadata: the vector already captures everything that matters.", bucket: "over", why: "The trajectory knows nothing about HIV, setting or programme history." },
  { id: "s7", label: "Calloway Town's survey suggested about 7 in 10 cases are detected, a useful sanity check for our own estimate.", bucket: "ok", why: "A comparable district's independent estimate is a reasonable prior to compare against, not a substitute for ours." },
  { id: "s8", label: "Write down which districts you used and why, so others can challenge the choice.", bucket: "ok", why: "Transparent assumptions are part of a defensible projection." },
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
      <LabCard title="A + B. Search the district library" done={ev.includes(EV[0]) && ev.includes(EV[1])} sub={<RichInline text={`Query: **${QUERY.name}**, notifications per 100,000, 2015-2025 [${QUERY.vec.join(", ")}]. Run the search with at least two metrics, then drag filter chips into the query and search again.`} />}>
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
              <thead><tr><th>rank</th><th>district</th><th>2015-2025</th><th>{m.higherIsCloser ? "similarity" : "distance"}</th><th>metadata</th></tr></thead>
              <tbody>{results.map((r, i) => (
                <tr key={r.a.id}><td>{i + 1}</td><td><b>{r.a.name}</b><div className="muted" style={{ fontSize: ".78rem" }}>{r.a.outcome}</div></td><td><Spark v={r.a.vec} /></td><td className="mono">{r.s.toFixed(5)}</td><td style={{ fontSize: ".8rem" }}>HIV {r.a.hiv}, {r.a.setting}, {r.a.acf ? "ran ACF" : "no ACF"}, {r.a.population.toLocaleString()}</td></tr>
              ))}</tbody>
            </table>
            {!results.length && <p className="feedback bad">No records pass these filters.</p>}
            <p className="muted" style={{ fontSize: ".85rem" }}>Query curve: <Spark v={QUERY.vec} /></p>
          </div>
        </div>
        {tried.length >= 2 && <p className="read" style={{ fontSize: ".95rem", marginTop: 10 }}><RichInline text={"Cosine ranks Sable Coast (about 420 per 100,000) at the top because it compares **shape** only: its decade is as flat as ours. Raw Euclidean ranks Calloway Town first because it is dominated by **level**. Unit-length Euclidean agrees with cosine, as |a−b|² = 2 − 2cos θ predicts."} /></p>}
        {ranFiltered && <p className="read" style={{ fontSize: ".95rem" }}><RichInline text={"Filters removed records **before** ranking. Did the high-HIV districts survive your filters? Try **ran case finding = yes** to see the rise-then-fall shape. [[w|Filter on what must match, rank on what should be similar.]]"} /></p>}
      </LabCard>

      <LabCard title="C. Vet the analogues" done={ev.includes(EV[2])} sub="The programme team drafted statements about using the analogues. Which are reasonable, and which overreach?" right={<DragHint>Drag cards into buckets</DragHint>}>
        <SortIntoBuckets items={STATEMENTS} buckets={[{ id: "ok", title: "✓ Reasonable use" }, { id: "over", title: "✗ Overreach" }]} onSolved={() => finishPart(ID, EV[2], EV)} />
      </LabCard>
    </>
  );
}
