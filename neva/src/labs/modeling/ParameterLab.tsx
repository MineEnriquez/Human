import { useMemo, useState } from "react";
import { DragHint, SortIntoBuckets } from "../../components/dnd";
import { RichInline } from "../../components/Rich";
import { LLM_EVIDENCE as EV } from "../../content/modeling/lessons";
import { NOTIFICATIONS, PREVALENCE_SURVEY, fitError, per100k, runTb } from "../../content/modeling/model";
import { earnBadge, useProgress } from "../../lib/progress";
import { finishPart, LabCard } from "../common";

const ID = "dm-llm";
/** Root-mean-square relative error of modelled vs observed notifications that counts as a good fit. */
export const FIT_THRESHOLD = 0.03;

const EXCERPT = `Kestrel Contact Cohort (fictional). We followed 1,840 household contacts of people with pulmonary TB in Kestrel Valley District (population 600,000) for five years. Among contacts who were newly infected, about 7% developed active TB, most of them within two years. The programme's model uses a progression rate of 0.07 per year from recent infection and a stabilisation rate of 0.93 per year to remote latent infection, and a reactivation rate of 0.0006 per year for remote infection. Treatment for drug-susceptible TB lasts six months; in 2025, 80% of people who started treatment completed it successfully.`;

const CARDS = [
  { id: "x1", label: "Progression rate from recent infection: **0.07 per year**", bucket: "ok", why: "Stated." },
  { id: "x2", label: "Risk of active TB after recent infection: **7% per year**", bucket: "bad", why: "7% is the share who progressed overall, mostly within two years: a risk over a period, not a rate per year." },
  { id: "x3", label: "Stabilisation rate: **0.93 per month**", bucket: "bad", why: "The source says 0.93 per year. Per month would be 12 times faster." },
  { id: "x4", label: "Reactivation rate of remote infection: **0.0006 per year**", bucket: "ok", why: "Stated." },
  { id: "x5", label: "Reactivation risk within 40 years: **about 2.4%**", bucket: "ok", why: "Correctly derived: 1 − e^(−0.0006×40) ≈ 0.024." },
  { id: "x6", label: "Treatment exit rate τ: **6 per year**", bucket: "bad", why: "Six months of treatment means τ = 1/0.5 = 2 per year. The duration was copied into a rate field." },
  { id: "x7", label: "Treatment exit rate τ: **2 per year**", bucket: "ok", why: "Correctly derived from six months: 1 / 0.5 years." },
  { id: "x8", label: "Treatment success: **80%**", bucket: "ok", why: "Stated for 2025." },
  { id: "x9", label: "Case detection rate: **0.70 per year**", bucket: "missing", why: "The cohort report never mentions detection. The model filled a row it was asked for." },
  { id: "x10", label: "District population: **6 million**", bucket: "bad", why: "The source says 600,000. One digit of scale is easy for a fluent model to slip." },
];

const CODE = [
  { id: "k1", label: "`tau = 1 / 0.5  # six months of treatment`", bucket: "ok", why: "Rate = 1 / mean duration in years." },
  { id: "k2", label: "`tau = treatment_months`", bucket: "bug", why: "A duration (and in months) used as a rate per year. Should be `12 / treatment_months`." },
  { id: "k3", label: "`lam = beta * I / N`", bucket: "ok", why: "Force of infection: transmission from active cases, per person." },
  { id: "k4", label: "`dS = births - lam * S`", bucket: "bug", why: "Missing the background death outflow `- mu * S`: the population drifts upward." },
  { id: "k5", label: "`incidence = eps * Lr + nu * Lt + rho * R`", bucket: "ok", why: "New and relapse active TB: progression, reactivation and relapse." },
  { id: "k6", label: "`incidence += (1 - s) * tau * T`", bucket: "bug", why: "People returning from incomplete treatment are infectious again but are not new cases: this double counts." },
  { id: "k7", label: "`births = mu * total + muTB * I`", bucket: "ok", why: "Births replace all deaths, keeping the population constant." },
  { id: "k8", label: "`assert abs(total - N) < 1e-6`", bucket: "ok", why: "A conservation check: it catches the missing death outflow, but not a wrong rate value or the incidence double count (neither changes the total)." },
];

const W = 560, H = 260, PAD = 40;
const YEARS = NOTIFICATIONS.map(n => n.year);

export default function ParameterLab() {
  const ev = useProgress().lessons[ID]?.evidence || [];
  const [beta, setBeta] = useState(12);
  const [delta, setDelta] = useState(0.9);
  const run = useMemo(() => runTb({ params: { beta, delta }, endYear: 2025 }), [beta, delta]);
  const err = fitError(run);
  const fitted = err < FIT_THRESHOLD;
  const prev2019 = per100k(run.find(y => y.year === 2019)!.I);
  const inc2025 = per100k(run.find(y => y.year === 2025)!.incidence);
  const cdr = run.find(y => y.year === 2025)!.notifications / run.find(y => y.year === 2025)!.incidence;
  const obs = NOTIFICATIONS.map(n => n.notified), model = run.map(y => y.notifications);
  const maxY = Math.max(...obs, ...model) * 1.25, minY = 0;
  const X = (yr: number) => PAD + ((yr - YEARS[0]) / (YEARS[YEARS.length - 1] - YEARS[0])) * (W - PAD - 16);
  const Y = (v: number) => H - PAD - ((v - minY) / (maxY - minY)) * (H - PAD - 12);
  const path = run.map((y, i) => `${i ? "L" : "M"}${X(y.year).toFixed(1)},${Y(y.notifications).toFixed(1)}`).join(" ");
  const slider = (label: string, v: number, set: (n: number) => void, min: number, max: number, step: number, fmt = (x: number) => x.toFixed(2)) => (
    <label className="row" style={{ gap: 10, fontSize: ".9rem" }}><span style={{ width: 200 }}>{label}: <b className="mono">{fmt(v)}</b></span><input type="range" min={min} max={max} step={step} value={v} onChange={e => set(+e.target.value)} style={{ flex: 1 }} /></label>
  );

  return (
    <>
      <LabCard title="A. Check the LLM's parameter table" done={ev.includes(EV[0])} sub="Read the source excerpt, then sort each extracted row." right={<DragHint>Drag cards into buckets</DragHint>}>
        <div className="read" style={{ background: "var(--paper)", borderRadius: 10, padding: "12px 16px", fontSize: ".95rem", marginBottom: 14 }}><b>Source excerpt</b><br />{EXCERPT}</div>
        <SortIntoBuckets items={CARDS} columns={3} buckets={[{ id: "ok", title: "✓ Matches source (or correctly derived)" }, { id: "bad", title: "✗ Wrong value, unit or conversion" }, { id: "missing", title: "∅ Not in the source" }]}
          onSolved={n => finishPart(ID, EV[0], EV, n === 1 ? 30 : 20)} />
      </LabCard>

      <LabCard title="B. Fit the TB model to the notifications" done={ev.includes(EV[1])} sub={<RichInline text={`Move the sliders until the model's annual notifications (line) match Kestrel Valley's 2015-2025 notifications (dots). Fit error is the root-mean-square relative error; get it under ${FIT_THRESHOLD * 100}%.`} />}>
        <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1.3fr) minmax(0, 1fr)", gap: 18 }}>
          <svg viewBox={`0 0 ${W} ${H}`} className="svgbox" role="img" aria-label="Observed notifications and model curve">
            <line x1={PAD} y1={H - PAD} x2={W - 10} y2={H - PAD} style={{ stroke: "var(--line)" }} />
            {YEARS.filter((_, i) => i % 2 === 0).map(yr => <text key={yr} x={X(yr)} y={H - PAD + 16} fontSize={10} textAnchor="middle" style={{ fill: "var(--muted)" }}>{yr}</text>)}
            {[0.25, 0.5, 0.75].map(f => <text key={f} x={PAD - 6} y={Y(maxY * f) + 3} fontSize={10} textAnchor="end" style={{ fill: "var(--muted)" }}>{Math.round(maxY * f)}</text>)}
            <path d={path} fill="none" strokeWidth={2.5} style={{ stroke: fitted ? "var(--ok)" : "var(--ink)" }} />
            {NOTIFICATIONS.map(n => <circle key={n.year} cx={X(n.year)} cy={Y(n.notified)} r={4} style={{ fill: "var(--yellow)", stroke: "var(--ink)" }} strokeWidth={0.8} />)}
            <text x={8} y={14} fontSize={11} style={{ fill: "var(--muted)" }}>people notified per year</text>
          </svg>
          <div className="stack" style={{ gap: 8 }}>
            {slider("Transmission β (contacts/case/yr)", beta, setBeta, 6, 20, 0.25)}
            {slider("Case detection rate δ (per yr)", delta, setDelta, 0.3, 1.6, 0.05)}
            <div className={`banner ${fitted ? "" : "warn"}`} style={fitted ? { background: "var(--ok-soft)", color: "var(--ok)" } : undefined}>
              Fit error <b className="mono">{(err * 100).toFixed(1)}%</b>{fitted ? " ✓ good fit" : ""}<br />
              <span style={{ fontSize: ".85rem" }}>Implied 2025 incidence {Math.round(inc2025)}/100k · detecting {Math.round(cdr * 100)}% of cases · 2019 prevalence {Math.round(prev2019)}/100k</span>
            </div>
            <button className="btn primary sm" disabled={!fitted || ev.includes(EV[1])} onClick={() => { finishPart(ID, EV[1], EV, 30); earnBadge("curve-shaper"); }}>{ev.includes(EV[1]) ? "Logged ✓" : fitted ? "Log this fit as evidence" : "Fit the curve first"}</button>
          </div>
        </div>
        {ev.includes(EV[1]) && <p className="read" style={{ fontSize: ".95rem", marginTop: 12 }}><RichInline text={`Now find a **second** fit: lower β and lower δ, or higher β and higher δ. Several pairs match the notifications almost equally well, yet imply very different incidence. That's [[w|identifiability]]. The ${PREVALENCE_SURVEY.year} prevalence survey (about **${PREVALENCE_SURVEY.perHundredK}/100k** active TB not on treatment) breaks the tie: which of your fits matches it?`} /></p>}
      </LabCard>

      <LabCard title="C. Review the LLM's model code" done={ev.includes(EV[2])} sub="An LLM drafted the TB model's update step. Sort each line." right={<DragHint>Drag cards into buckets</DragHint>}>
        <SortIntoBuckets items={CODE} columns={2} buckets={[{ id: "ok", title: "✓ Correct" }, { id: "bug", title: "🐞 Bug" }]} onSolved={() => finishPart(ID, EV[2], EV)} />
      </LabCard>
    </>
  );
}
