import { useMemo, useState } from "react";
import { DragHint, SortIntoBuckets } from "../../components/dnd";
import { RichInline } from "../../components/Rich";
import { LLM_EVIDENCE as EV } from "../../content/modeling/lessons";
import { CITY, OBSERVED, TODAY, expectedReported, growthFromR0, logFitError, simulateSEIR } from "../../content/modeling/model";
import { earnBadge, useProgress } from "../../lib/progress";
import { finishPart, LabCard } from "../common";

const ID = "om-llm";
export const FIT_THRESHOLD = 0.2;

const EXCERPT = `Methods (Harbourside Household Study and Viral Culture Substudy, fictional). We followed 212 Port Calder households with a confirmed CRV case. Among contacts with a single exposure day, the mean incubation period was 4.1 days. Daily cultures first grew live virus a mean of 3.0 days after exposure (latent period), and virus could be cultured for a mean of 4.0 days after that (infectious period). The household secondary attack rate was 18%. A blood-donor antibody pilot suggests about 30% of infections in the city (population 250,000) are reported.`;

const CARDS = [
  { id: "x1", label: "Mean latent period: **3.0 days**", bucket: "ok", why: "Stated: cultures first grew virus 3.0 days after exposure." },
  { id: "x2", label: "Latent rate σ = **3 per day**", bucket: "bad", why: "A 3-day mean means σ = 1/3 ≈ 0.33 per day. The duration was copied into a rate field." },
  { id: "x3", label: "Mean infectious period: **4.0 days**", bucket: "ok", why: "Stated directly." },
  { id: "x4", label: "Recovery rate γ = **0.25 per day**", bucket: "ok", why: "Correctly derived: 1 / 4.0 days." },
  { id: "x5", label: "Incubation period: **3.0 days**", bucket: "bad", why: "The source says 4.1 days. 3.0 days is the latent period: two 'time after infection' numbers swapped." },
  { id: "x6", label: "Basic reproduction number R0 = **2.6**", bucket: "missing", why: "The excerpt never reports R0. The model filled a row it was asked for." },
  { id: "x7", label: "Transmission rate β = **0.65 per day**", bucket: "missing", why: "β = R0·γ needs R0, which the source doesn't give. The value rests on the invented R0." },
  { id: "x8", label: "Household secondary attack rate: **18%**", bucket: "ok", why: "Stated directly." },
  { id: "x9", label: "Reported fraction of infections: **30%**", bucket: "ok", why: "Stated (about 30%)." },
  { id: "x10", label: "City population: **2.5 million**", bucket: "bad", why: "The source says 250,000. One digit of scale is easy for a fluent model to slip." },
];

const CODE = [
  { id: "k1", label: "`gamma = 1 / infectious_days`", bucket: "ok", why: "Rate = 1 / mean duration." },
  { id: "k2", label: "`sigma = latent_days`", bucket: "bug", why: "Should be `1 / latent_days`." },
  { id: "k3", label: "`beta = R0 * gamma`", bucket: "ok", why: "From R0 = β/γ." },
  { id: "k4", label: "`dS = -beta * S * I`", bucket: "bug", why: "Missing `/ N`: this turns frequency-dependent transmission into density-dependent transmission." },
  { id: "k5", label: "`dE = beta * S * I / N - sigma * E`", bucket: "ok", why: "New infections enter E and leave at rate σ." },
  { id: "k6", label: "`dI = sigma * E - gamma * S`", bucket: "bug", why: "Recovery removes infectious people: `- gamma * I`, not `S`." },
  { id: "k7", label: "`dR = gamma * I`", bucket: "ok", why: "Recovered people come from I at rate γ." },
  { id: "k8", label: "`assert abs(S + E + I + R - N) < 1e-6`", bucket: "ok", why: "A conservation check: it catches the mismatched `/N` and the `gamma * S` term, but not a wrong parameter value like `sigma = latent_days` (a wrong rate still conserves people)." },
];

const W = 560, H = 260, PAD = 34;

export default function ParameterLab() {
  const ev = useProgress().lessons[ID]?.evidence || [];
  const [R0, setR0] = useState(2.8);
  const [lat, setLat] = useState(2);
  const [inf, setInf] = useState(6);
  const [rep, setRep] = useState(0.15);
  const [logScale, setLogScale] = useState(true);
  const model = useMemo(() => expectedReported(simulateSEIR({ N: CITY.population, E0: 12, R0, latentDays: lat, infectiousDays: inf, days: 70 }), rep), [R0, lat, inf, rep]);
  const err = logFitError(OBSERVED, model.slice(0, TODAY));
  const fitted = err < FIT_THRESHOLD;
  const r = growthFromR0(R0, lat, inf);
  const maxY = Math.max(...OBSERVED, ...(logScale ? model : model.slice(0, TODAY))) * 1.15;
  const X = (d: number) => PAD + (d / 70) * (W - PAD - 10);
  const Y = (v: number) => logScale ? H - PAD - (Math.log10(1 + v) / Math.log10(1 + Math.max(maxY, 10))) * (H - PAD - 10) : H - PAD - (v / maxY) * (H - PAD - 10);
  const path = model.map((v, d) => `${d ? "L" : "M"}${X(d).toFixed(1)},${Math.max(4, Y(Math.min(v, maxY * 4))).toFixed(1)}`).join(" ");
  const slider = (label: string, v: number, set: (n: number) => void, min: number, max: number, step: number, fmt = (x: number) => x.toFixed(2)) => (
    <label className="row" style={{ gap: 10, fontSize: ".9rem" }}><span style={{ width: 170 }}>{label}: <b className="mono">{fmt(v)}</b></span><input type="range" min={min} max={max} step={step} value={v} onChange={e => set(+e.target.value)} style={{ flex: 1 }} /></label>
  );

  return (
    <>
      <LabCard title="A. Check the LLM's parameter table" done={ev.includes(EV[0])} sub="Read the source excerpt, then sort each extracted row." right={<DragHint>Drag cards into buckets</DragHint>}>
        <div className="read" style={{ background: "var(--paper)", borderRadius: 10, padding: "12px 16px", fontSize: ".95rem", marginBottom: 14 }}><b>Source excerpt</b><br />{EXCERPT}</div>
        <SortIntoBuckets items={CARDS} columns={3} buckets={[{ id: "ok", title: "✓ Matches source (or correctly derived)" }, { id: "bad", title: "✗ Wrong value, unit or conversion" }, { id: "missing", title: "∅ Not in the source" }]}
          onSolved={n => finishPart(ID, EV[0], EV, n === 1 ? 30 : 20)} />
      </LabCard>

      <LabCard title="B. Fit the SEIR model by hand" done={ev.includes(EV[1])} sub={<RichInline text={`Move the sliders until the model's reported cases (line) match Port Calder's first ${TODAY} days (dots). Fit error is the mean |ln(1+observed) − ln(1+model)|; get it under ${FIT_THRESHOLD}.`} />}>
        <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)", gap: 18 }}>
          <svg viewBox={`0 0 ${W} ${H}`} className="svgbox" role="img" aria-label="Observed reported cases and model curve">
            <line x1={PAD} y1={H - PAD} x2={W - 10} y2={H - PAD} style={{ stroke: "var(--line)" }} />
            <line x1={X(TODAY)} y1={10} x2={X(TODAY)} y2={H - PAD} style={{ stroke: "var(--line)" }} strokeDasharray="4 4" />
            <text x={X(TODAY) + 4} y={20} fontSize={11} style={{ fill: "var(--muted)" }}>today (day {TODAY})</text>
            {[0, 14, 28, 42, 56, 70].map(d => <text key={d} x={X(d)} y={H - PAD + 16} fontSize={10} textAnchor="middle" style={{ fill: "var(--muted)" }}>{d}</text>)}
            <path d={path} fill="none" strokeWidth={2.5} style={{ stroke: fitted ? "var(--ok)" : "var(--ink)" }} />
            {OBSERVED.map((v, d) => <circle key={d} cx={X(d)} cy={Y(v)} r={3} style={{ fill: "var(--yellow)", stroke: "var(--ink)" }} strokeWidth={0.8} />)}
            <text x={8} y={16} fontSize={11} style={{ fill: "var(--muted)" }}>reported/day {logScale ? "(log)" : ""}</text>
          </svg>
          <div className="stack" style={{ gap: 8 }}>
            {slider("R0", R0, setR0, 1, 3.5, 0.05)}
            {slider("Mean latent (days)", lat, setLat, 1, 6, 0.25)}
            {slider("Mean infectious (days)", inf, setInf, 1, 8, 0.25)}
            {slider("Reporting fraction", rep, setRep, 0.05, 0.6, 0.01, x => `${Math.round(x * 100)}%`)}
            <label className="row" style={{ fontSize: ".85rem" }}><input type="checkbox" checked={logScale} onChange={e => setLogScale(e.target.checked)} /> log scale</label>
            <div className={`banner ${fitted ? "" : "warn"}`} style={fitted ? { background: "var(--ok-soft)", color: "var(--ok)" } : undefined}>
              Fit error <b className="mono">{err.toFixed(3)}</b>{fitted ? " ✓ good fit" : ""}<br />
              <span style={{ fontSize: ".85rem" }}>Implied growth rate r = {r.toFixed(3)}/day, doubling every {(Math.log(2) / r).toFixed(1)} days</span>
            </div>
            <button className="btn primary sm" disabled={!fitted || ev.includes(EV[1])} onClick={() => { finishPart(ID, EV[1], EV, 30); earnBadge("curve-shaper"); }}>{ev.includes(EV[1]) ? "Logged ✓" : fitted ? "Log this fit as evidence" : "Fit the curve first"}</button>
          </div>
        </div>
        {ev.includes(EV[1]) && <p className="read" style={{ fontSize: ".95rem", marginTop: 12 }}><RichInline text={"Now try R0 = 2.0 with latent 2 days and infectious 5 days, then R0 = 2.4 with longer periods. Several combinations fit almost equally well, because six weeks of growth pin down **r**, not R0 and the durations separately. That's [[w|identifiability]], and why the cell needs the culture study's durations."} /></p>}
      </LabCard>

      <LabCard title="C. Review the LLM's model code" done={ev.includes(EV[2])} sub="An LLM drafted the SEIR update step. Sort each line." right={<DragHint>Drag cards into buckets</DragHint>}>
        <SortIntoBuckets items={CODE} columns={2} buckets={[{ id: "ok", title: "✓ Correct" }, { id: "bug", title: "🐞 Bug" }]} onSolved={() => finishPart(ID, EV[2], EV)} />
      </LabCard>
    </>
  );
}
