import { useState } from "react";
import { AiOffNotice } from "../../components/ConnectKey";
import { AgentConsole } from "../../components/AgentConsole";
import { BucketBoard, DragHint } from "../../components/dnd";
import { Rich, RichInline } from "../../components/Rich";
import { EVENTS, INCIDENT_KEY, MITIGATIONS, failedRequests, type EventClass } from "../../content/software/data";
import { postJson, useAi } from "../../lib/ai";
import { addEvidence, award, completeStage, earnBadge, recordBest, useProgress } from "../../lib/progress";
import { LabCard } from "../common";

const ID = "se-capstone";
const TOOL_EVIDENCE: Record<string, string> = { search_logs: "Log search", get_metrics: "Metrics", list_deploys: "Deploy history", search_runbooks: "Runbook lookup" };
const CLASSES: { id: EventClass; title: string }[] = [
  { id: "cause", title: "Cause" },
  { id: "symptom", title: "Symptom" },
  { id: "unrelated", title: "Red herring / unrelated" },
];
type Grade = { score: number; headline: string; strengths: string[]; improvements: string[] };

export default function IncidentRoom() {
  const ev = useProgress().lessons[ID]?.evidence || [];
  const aiOn = useAi();
  const [place, setPlace] = useState<Record<string, string>>({});
  const [mitigation, setMitigation] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [impact, setImpact] = useState("");
  const [followUps, setFollowUps] = useState("");
  const [postmortem, setPostmortem] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [check, setCheck] = useState<{ correct: number; wrong: string[]; mitigationOk: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const sorted = EVENTS.filter(e => place[e.id] && place[e.id] !== "tray").length;
  const ready = sorted === EVENTS.length && mitigation && rootCause.trim() && impact.trim() && followUps.trim() && postmortem.trim().length > 40;

  const submit = async () => {
    const wrong = EVENTS.filter(e => place[e.id] !== INCIDENT_KEY.classes[e.id]).map(e => e.id);
    const mitigationOk = mitigation === INCIDENT_KEY.mitigation;
    const c = { correct: EVENTS.length - wrong.length, wrong, mitigationOk };
    setCheck(c); setBusy(true); setErr("");
    try {
      const classification = EVENTS.map(e => `${e.label} → ${CLASSES.find(x => x.id === place[e.id])?.title}`).join("; ");
      const g = await postJson<Grade>("/api/capstone-grade", {
        path: "software-engineering",
        autoCheck: `Event classification: ${c.correct}/${EVENTS.length} correct (misclassified: ${wrong.join(", ") || "none"}). Mitigation chosen: "${MITIGATIONS.find(m => m.id === mitigation)?.label}" (${mitigationOk ? "correct" : "not the best first mitigation"}).`,
        report: { "Event classification": classification, "Immediate mitigation": MITIGATIONS.find(m => m.id === mitigation)?.label || "", "Root cause": rootCause, Impact: impact, "Follow-ups": followUps, "Blameless postmortem summary and reasoning": postmortem },
      });
      setGrade(g);
      recordBest(ID, "seminarBest", g.score);
      completeStage(ID, "lab");
      award(`${ID}:submit`, 50, "Incident report filed");
      award(`${ID}:score${g.score}`, g.score * 15, `Capstone score ${g.score}/10`);
      if (g.score >= 7 && !wrong.length && mitigationOk) earnBadge("incident-commander");
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  return (
    <>
      <LabCard title="1. Investigate with your on-call assistant" sub={<RichInline text="It runs real [[t|tool calls]] against the (fictional) logs, metrics, deploys and runbooks. Expand any call to see the raw result. Evidence collected:" />}
        right={<div className="evidence">{Object.values(TOOL_EVIDENCE).map(e => <span key={e} className={`ev ${ev.includes(e) ? "got" : ""}`}>{ev.includes(e) ? "✓ " : ""}{e}</span>)}</div>}>
        <AgentConsole path="software-engineering" toolNames={Object.keys(TOOL_EVIDENCE)} height={520} placeholder="Ask the on-call assistant…"
          starters={["Show the payouts-api error rate and p99 latency from 02:00 to 03:25.", "List every deploy between 01:00 and 03:30.", "Search the logs for ERROR lines in payouts-api.", "What does our runbook say about a 5xx spike?"]}
          onToolCall={name => { const e = TOOL_EVIDENCE[name]; if (e) { addEvidence(ID, e); award(`${ID}:ev:${e}`, 15, `Evidence: ${e}`); } }} />
      </LabCard>

      <LabCard title="2. File your incident report" sub="Classify every event, pick the immediate mitigation, then write the root cause, impact, follow-ups and a blameless summary. Classification and mitigation are checked exactly; Otto grades the rest." right={<DragHint>Drag events</DragHint>}>
        <BucketBoard items={EVENTS} columns={3} value={place} onChange={p => { setPlace(p); setCheck(null); }} trayLabel="Timeline events"
          buckets={CLASSES}
          stateOf={e => (check ? (place[e.id] === INCIDENT_KEY.classes[e.id] ? "right" : "wrong") : undefined)}
          render={e => <span style={{ fontSize: ".82rem" }}>{e.label}</span>} />
        <div style={{ marginTop: 16 }}>
          <label className="lbl">Immediate mitigation</label>
          <div className="stack" style={{ gap: 6 }}>
            {MITIGATIONS.map(m => <label key={m.id} className="row" style={{ gap: 8, fontSize: ".95rem" }}><input type="radio" name="mitigation" checked={mitigation === m.id} onChange={() => { setMitigation(m.id); setCheck(null); }} />{m.label}</label>)}
          </div>
        </div>
        <div style={{ marginTop: 12 }}><label className="lbl" htmlFor="rc">Root cause</label><input id="rc" className="field" value={rootCause} onChange={e => setRootCause(e.target.value)} placeholder="What changed, and how did it cause the failures?" /></div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 12 }}>
          <div><label className="lbl" htmlFor="imp">Customer impact</label><input id="imp" className="field" value={impact} onChange={e => setImpact(e.target.value)} placeholder="When, what failed, roughly how much?" /></div>
          <div><label className="lbl" htmlFor="fu">Follow-ups</label><input id="fu" className="field" value={followUps} onChange={e => setFollowUps(e.target.value)} placeholder="What stops this happening again? (owners, guardrails)" /></div>
        </div>
        <div style={{ marginTop: 12 }}><label className="lbl" htmlFor="pm">Blameless postmortem summary and your reasoning</label><textarea id="pm" className="answer" value={postmortem} onChange={e => setPostmortem(e.target.value)} placeholder="Timeline, what the system allowed, why you ruled out the red herrings, what went well." /></div>
        {aiOn === false && <div style={{ marginTop: 10 }}><AiOffNotice what="Grading" /></div>}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn yellow" onClick={submit} disabled={!ready || busy || !aiOn}>{busy ? "Otto is reading your report…" : "Submit incident report"}</button>
          {!ready && <span className="muted" style={{ fontSize: ".85rem" }}>Classify all {EVENTS.length} events ({sorted}/{EVENTS.length}), pick a mitigation and fill every field.</span>}
        </div>
        {err && <div className="banner err" style={{ marginTop: 10 }}>{err}</div>}
        {check && <p className={`feedback ${check.wrong.length || !check.mitigationOk ? "bad" : "good"}`}>Classification: {check.correct}/{EVENTS.length} correct{check.wrong.length ? ` (recheck the red cards)` : ""}. Mitigation: {check.mitigationOk ? "right first move." : "not the best first move; look at what changed right before the errors."}</p>}
        {grade && (
          <div className="grade" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}><div className="pts">{grade.score}/10</div>{grade.score >= 7 && !check?.wrong.length && check?.mitigationOk && <span className="tag live">🚨 Incident commander</span>}</div>
            <Rich text={grade.headline} />
            <Rich text={"#### Strengths\n" + grade.strengths.map(s => "- " + s).join("\n") + "\n\n#### To improve\n" + grade.improvements.map(s => "- " + s).join("\n")} />
            {check?.wrong.length === 0 && check.mitigationOk && <details><summary className="muted">Show the answer key</summary><Rich text={`**Root cause**: ${INCIDENT_KEY.rootCause}\n\n**Why not the others**: ${INCIDENT_KEY.whyNotOthers}\n\n**Impact** (from the metrics, 02:40 to 03:25): about ${failedRequests().toLocaleString()} failed payout requests.`} /></details>}
          </div>
        )}
      </LabCard>
    </>
  );
}
