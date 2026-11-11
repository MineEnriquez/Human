import { useState } from "react";
import { AiOffNotice } from "../../components/ConnectKey";
import { AgentConsole } from "../../components/AgentConsole";
import { Rich, RichInline } from "../../components/Rich";
import { STRATEGY_EVIDENCE } from "../../content/modeling/lessons";
import { BUDGET_PER_YEAR, HORIZON, START_YEAR, STRATEGIES, STRATEGY_KEY, type Strategy } from "../../content/modeling/model";
import { postJson, useAi } from "../../lib/ai";
import { addEvidence, award, completeStage, earnBadge, recordBest, useProgress } from "../../lib/progress";
import { LabCard } from "../common";

const ID = "dm-capstone";
const TOOL_EVIDENCE: Record<string, string> = { get_notifications: STRATEGY_EVIDENCE[0], fit_tb_model: STRATEGY_EVIDENCE[1], run_tb_model: STRATEGY_EVIDENCE[2], search_evidence: STRATEGY_EVIDENCE[3] };
const SINGLE: Strategy[] = ["acf", "tpt", "treatment"];
type Grade = { score: number; headline: string; strengths: string[]; improvements: string[] };

/** Deterministic part of the grade: the 2025 incidence estimate and the strongest single strategy. */
export function checkStrategy(incidencePerHundredK: number, largestSingle: string) {
  const k = STRATEGY_KEY;
  const incOk = Number.isFinite(incidencePerHundredK) && Math.abs(incidencePerHundredK - k.incidence2025PerHundredK) <= k.incidenceTolerance * k.incidence2025PerHundredK;
  return { incOk, strategyOk: largestSingle === k.largestSingle };
}

const usd = (x: number) => "$" + Math.round(x).toLocaleString("en-US");

export default function StrategyRoom() {
  const ev = useProgress().lessons[ID]?.evidence || [];
  const aiOn = useAi();
  const [inc, setInc] = useState("");
  const [largest, setLargest] = useState("");
  const [projection, setProjection] = useState("");
  const [rec, setRec] = useState("");
  const [uncert, setUncert] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [check, setCheck] = useState<{ incOk: boolean; strategyOk: boolean } | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ready = inc.trim() && largest && projection.trim() && rec.trim() && uncert.trim() && reasoning.trim().length > 40;
  const k = STRATEGY_KEY;

  const submit = async () => {
    const c = checkStrategy(parseFloat(inc), largest);
    setCheck(c); setBusy(true); setErr("");
    try {
      const g = await postJson<Grade>("/api/capstone-grade", {
        path: "disease-modeling",
        autoCheck: `2025 incidence estimate ${inc}/100k is ${c.incOk ? "within" : "outside"} ±${k.incidenceTolerance * 100}% of the model's ${Math.round(k.incidence2025PerHundredK)}/100k. Strongest single strategy by 2035 chosen: ${largest} (${c.strategyOk ? "correct" : `key: ${k.largestSingle}`}).`,
        report: { "2025 incidence per 100,000": inc, "Strongest single strategy by 2035": STRATEGIES[largest as Strategy]?.label || largest, "Projections to 2035": projection, Recommendation: rec, "Assumptions and uncertainty": uncert, Reasoning: reasoning },
      });
      setGrade(g);
      recordBest(ID, "seminarBest", g.score);
      completeStage(ID, "lab");
      award(`${ID}:submit`, 50, "Strategy briefing filed");
      award(`${ID}:score${g.score}`, g.score * 15, `Capstone score ${g.score}/10`);
      if (g.score >= 7 && c.incOk && c.strategyOk) earnBadge("briefing-done");
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  return (
    <>
      <LabCard title="1. Run the analysis with your modelling assistant" sub={<RichInline text="It makes real [[t|tool calls]] against the district's data and the TB model. Expand any call to see the raw result. Evidence collected:" />}
        right={<div className="evidence">{STRATEGY_EVIDENCE.map(e => <span key={e} className={`ev ${ev.includes(e) ? "got" : ""}`}>{ev.includes(e) ? "✓ " : ""}{e}</span>)}</div>}>
        <AgentConsole path="disease-modeling" toolNames={Object.keys(TOOL_EVIDENCE)} height={520} placeholder="Ask the modelling assistant…"
          starters={["Show me the notifications for 2015-2025.", "Fit the model to the notifications only. How confident should we be?", "What did the prevalence survey find?", `Run the model to ${HORIZON} with preventive treatment for household contacts.`]}
          onToolCall={name => { const e = TOOL_EVIDENCE[name]; if (e) { addEvidence(ID, e); award(`${ID}:ev:${e}`, 15, `Evidence: ${e}`); } }} />
      </LabCard>

      <LabCard title="2. Brief the director" sub={`Two answers are checked exactly; Otto grades the whole briefing. Budget: up to ${usd(BUDGET_PER_YEAR)} a year from ${START_YEAR}.`}>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label className="lbl" htmlFor="inc">Estimated 2025 TB incidence (per 100,000)</label><input id="inc" className="field" inputMode="decimal" value={inc} onChange={e => { setInc(e.target.value); setCheck(null); }} placeholder="e.g. 150" /></div>
          <div><label className="lbl" htmlFor="lg">Single strategy with the largest {HORIZON} reduction</label>
            <select id="lg" className="field" value={largest} onChange={e => { setLargest(e.target.value); setCheck(null); }}>
              <option value="">Choose…</option>
              {SINGLE.map(s => <option key={s} value={s}>{STRATEGIES[s].label}</option>)}
            </select></div>
        </div>
        <div style={{ marginTop: 12 }}><label className="lbl" htmlFor="pj">Projections to {HORIZON}</label><input id="pj" className="field" value={projection} onChange={e => setProjection(e.target.value)} placeholder={`Baseline vs each option: ${HORIZON} incidence, cases averted, cost per case averted`} /></div>
        <div style={{ marginTop: 12 }}><label className="lbl" htmlFor="rec">Recommendation within the budget</label><input id="rec" className="field" value={rec} onChange={e => setRec(e.target.value)} placeholder="What should the district fund, and what should it expect to see in the first years?" /></div>
        <div style={{ marginTop: 12 }}><label className="lbl" htmlFor="un">Assumptions and uncertainty</label><input id="un" className="field" value={uncert} onChange={e => setUncert(e.target.value)} placeholder="What could make these projections wrong?" /></div>
        <div style={{ marginTop: 12 }}><label className="lbl" htmlFor="why">Your reasoning</label><textarea id="why" className="answer" value={reasoning} onChange={e => setReasoning(e.target.value)} placeholder="How did you estimate incidence, and why is that fit identified? How did you compare the options?" /></div>
        {aiOn === false && <div style={{ marginTop: 10 }}><AiOffNotice what="Grading" /></div>}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn yellow" onClick={submit} disabled={!ready || busy || !aiOn}>{busy ? "Otto is reading your briefing…" : "Submit briefing"}</button>
          {!ready && <span className="muted" style={{ fontSize: ".85rem" }}>Fill every field.</span>}
        </div>
        {err && <div className="banner err" style={{ marginTop: 10 }}>{err}</div>}
        {check && <p className={`feedback ${check.incOk && check.strategyOk ? "good" : "bad"}`}>Incidence: {check.incOk ? `within ±${k.incidenceTolerance * 100}% ✓` : "too far from the identified estimate ✗"} · Strongest single strategy: {check.strategyOk ? "✓" : "✗"}</p>}
        {grade && (
          <div className="grade" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}><div className="pts">{grade.score}/10</div>{grade.score >= 7 && check?.incOk && check.strategyOk && <span className="tag live">🏛️ Briefing delivered</span>}</div>
            <Rich text={grade.headline} />
            <Rich text={"#### Strengths\n" + grade.strengths.map(s => "- " + s).join("\n") + "\n\n#### To improve\n" + grade.improvements.map(s => "- " + s).join("\n")} />
            {check?.incOk && check.strategyOk && <details><summary className="muted">Show the model answer</summary><Rich text={`Notifications alone don't identify the burden; with the ${k.prevalence2019}/100k prevalence survey the fit gives 2025 incidence ≈ **${Math.round(k.incidence2025PerHundredK)}/100k** (≈ ${Math.round(k.incidence2025)} cases), so notifications equal ≈ ${Math.round(k.caseDetection2025 * 100)}% of estimated incidence (notifications include people restarting treatment after an unsuccessful course; WHO calls notifications ÷ incidence *treatment coverage*).\n\n${k.strategies.map(s => `- **${STRATEGIES[s.strategy].label}** (${usd(STRATEGIES[s.strategy].costPerYear)}/yr): ${HORIZON} incidence ≈ ${Math.round(s.perHundredK)}/100k (${Math.round(s.reduction * 100)}% below baseline), ≈ ${Math.round(s.casesAverted)} cases averted ${START_YEAR}-${HORIZON}, ≈ ${usd(s.costPerCaseAverted)} per case averted`).join("\n")}\n\nWithin the budget, **${STRATEGIES[k.largestWithinBudget].label}** gives the largest reduction and the most cases averted; **${STRATEGIES[k.bestValue].label}** alone is the best value per case averted. These are projections with illustrative effect sizes; drug resistance and HIV are not modelled.`} /></details>}
          </div>
        )}
      </LabCard>
    </>
  );
}
