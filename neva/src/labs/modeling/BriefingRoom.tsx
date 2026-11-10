import { useState } from "react";
import { AgentConsole } from "../../components/AgentConsole";
import { Rich, RichInline } from "../../components/Rich";
import { BRIEFING_EVIDENCE } from "../../content/modeling/lessons";
import { BRIEFING_KEY } from "../../content/modeling/model";
import { postJson, useAi } from "../../lib/ai";
import { addEvidence, award, completeStage, earnBadge, recordBest, useProgress } from "../../lib/progress";
import { LabCard } from "../common";

const ID = "om-capstone";
const TOOL_EVIDENCE: Record<string, string> = { get_case_counts: BRIEFING_EVIDENCE[0], fit_growth_rate: BRIEFING_EVIDENCE[1], run_seir: BRIEFING_EVIDENCE[2], search_evidence: BRIEFING_EVIDENCE[3] };
type Grade = { score: number; headline: string; strengths: string[]; improvements: string[] };

/** Deterministic part of the grade: the two numbers have defensible ranges. */
export function checkBriefing(r0: number, peakDay: number) {
  const k = BRIEFING_KEY;
  const r0ok = Number.isFinite(r0) && r0 >= k.R0Range[0] && r0 <= k.R0Range[1];
  const peakOk = Number.isFinite(peakDay) && Math.abs(peakDay - k.peakDayUnmitigated) <= k.peakDayTolerance;
  return { r0ok, peakOk };
}

export default function BriefingRoom() {
  const ev = useProgress().lessons[ID]?.evidence || [];
  const aiOn = useAi();
  const [r0, setR0] = useState("");
  const [peak, setPeak] = useState("");
  const [closure, setClosure] = useState("");
  const [rec, setRec] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [check, setCheck] = useState<{ r0ok: boolean; peakOk: boolean } | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ready = r0.trim() && peak.trim() && closure.trim() && rec.trim() && reasoning.trim().length > 40;

  const submit = async () => {
    const c = checkBriefing(parseFloat(r0), parseFloat(peak));
    setCheck(c); setBusy(true); setErr("");
    const k = BRIEFING_KEY;
    try {
      const g = await postJson<Grade>("/api/capstone-grade", {
        path: "outbreak-modeling",
        autoCheck: `R0 estimate ${r0} is ${c.r0ok ? "within" : "outside"} the accepted range ${k.R0Range.join("-")}. Unmitigated peak day ${peak} is ${c.peakOk ? "within" : "outside"} ±${k.peakDayTolerance} days of the model's day ${k.peakDayUnmitigated}.`,
        report: { "R0 estimate": r0, "Unmitigated peak day": peak, "Effect of school closure from day 45": closure, Recommendation: rec, Reasoning: reasoning },
      });
      setGrade(g);
      recordBest(ID, "seminarBest", g.score);
      completeStage(ID, "lab");
      award(`${ID}:submit`, 50, "Briefing filed");
      award(`${ID}:score${g.score}`, g.score * 15, `Capstone score ${g.score}/10`);
      if (g.score >= 7 && c.r0ok && c.peakOk) earnBadge("briefing-done");
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  const k = BRIEFING_KEY;
  return (
    <>
      <LabCard title="1. Run the analysis with your modeling assistant" sub={<RichInline text="It makes real [[t|tool calls]] against the city's data and the SEIR model. Expand any call to see the raw result. Evidence collected:" />}
        right={<div className="evidence">{BRIEFING_EVIDENCE.map(e => <span key={e} className={`ev ${ev.includes(e) ? "got" : ""}`}>{ev.includes(e) ? "✓ " : ""}{e}</span>)}</div>}>
        <AgentConsole path="outbreak-modeling" toolNames={Object.keys(TOOL_EVIDENCE)} height={520} placeholder="Ask the modeling assistant…"
          starters={["Show me the reported cases for all 42 days.", "Fit the growth rate over days 14 to 41.", "What do our studies say about the latent and infectious periods?", "What does the contact survey say about closing schools?"]}
          onToolCall={name => { const e = TOOL_EVIDENCE[name]; if (e) { addEvidence(ID, e); award(`${ID}:ev:${e}`, 15, `Evidence: ${e}`); } }} />
      </LabCard>

      <LabCard title="2. Brief the director" sub="Two numbers are checked against their defensible ranges; Professor Neva grades the whole briefing.">
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label className="lbl" htmlFor="r0">Your R0 estimate</label><input id="r0" className="field" inputMode="decimal" value={r0} onChange={e => { setR0(e.target.value); setCheck(null); }} placeholder="e.g. 1.6" /></div>
          <div><label className="lbl" htmlFor="pk">Unmitigated peak (day number)</label><input id="pk" className="field" inputMode="numeric" value={peak} onChange={e => { setPeak(e.target.value); setCheck(null); }} placeholder="e.g. 120" /></div>
        </div>
        <div style={{ marginTop: 12 }}><label className="lbl" htmlFor="cl">Effect of closing schools from day 45</label><input id="cl" className="field" value={closure} onChange={e => setClosure(e.target.value)} placeholder="Peak timing, peak size, share infected, under which assumption?" /></div>
        <div style={{ marginTop: 12 }}><label className="lbl" htmlFor="rec">Recommendation</label><input id="rec" className="field" value={rec} onChange={e => setRec(e.target.value)} placeholder="What should the director decide, and what else should happen?" /></div>
        <div style={{ marginTop: 12 }}><label className="lbl" htmlFor="why">Your reasoning</label><textarea id="why" className="answer" value={reasoning} onChange={e => setReasoning(e.target.value)} placeholder="Which window did you fit, which evidence gave the durations, how did you get R0, what are the main uncertainties?" /></div>
        {aiOn === false && <div className="banner warn" style={{ marginTop: 10 }}>Grading needs Claude (ANTHROPIC_API_KEY on the server).</div>}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn yellow" onClick={submit} disabled={!ready || busy || !aiOn}>{busy ? "Professor Neva is reading your briefing…" : "Submit briefing"}</button>
          {!ready && <span className="muted" style={{ fontSize: ".85rem" }}>Fill every field.</span>}
        </div>
        {err && <div className="banner err" style={{ marginTop: 10 }}>{err}</div>}
        {check && <p className={`feedback ${check.r0ok && check.peakOk ? "good" : "bad"}`}>R0: {check.r0ok ? "within the defensible range ✓" : "outside the defensible range ✗"} · Peak day: {check.peakOk ? `within ±${k.peakDayTolerance} days ✓` : "too far from the model's projection ✗"}</p>}
        {grade && (
          <div className="grade" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}><div className="pts">{grade.score}/10</div>{grade.score >= 7 && check?.r0ok && check.peakOk && <span className="tag live">🏛️ Briefing delivered</span>}</div>
            <Rich text={grade.headline} />
            <Rich text={"#### Strengths\n" + grade.strengths.map(s => "- " + s).join("\n") + "\n\n#### To improve\n" + grade.improvements.map(s => "- " + s).join("\n")} />
            {check?.r0ok && check.peakOk && <details><summary className="muted">Show the model answer</summary><Rich text={`Fit r over days 14-41: **${k.r.toFixed(3)}/day** (doubling ≈ ${k.doublingDays.toFixed(1)} days). Latent 3.0 d (VCS-1), infectious 4.0 d (VCS-2): R0 = (1 + 3r)(1 + 4r) ≈ **${k.R0FromData.toFixed(2)}** (the data were generated with R0 = ${k.R0True}).\n\nUnmitigated: peak ≈ **day ${k.peakDayUnmitigated}**, ≈ ${k.peakReportedUnmitigated} reported/day, ≈ ${Math.round(k.attackRateUnmitigated * 100)}% ever infected.\n\nSchools closed from day 45 (25% contact reduction, CON-2): peak ≈ **day ${k.closurePeakDay}**, ≈ ${Math.round(k.peakReduction * 100)}% lower, ≈ ${Math.round(k.closureAttackRate * 100)}% ever infected, **assuming schools stay closed to day 180**; a time-limited closure mainly delays and flattens the peak and saves fewer infections. These are projections under stated assumptions; the 20-30% range should be shown as scenarios.`} /></details>}
          </div>
        )}
      </LabCard>
    </>
  );
}
