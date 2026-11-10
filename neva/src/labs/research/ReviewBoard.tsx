import { useState } from "react";
import { AgentConsole } from "../../components/AgentConsole";
import { BucketBoard, DragHint } from "../../components/dnd";
import { Rich, RichInline } from "../../components/Rich";
import { KEY, STUDIES, SYNTHESIS_KEY } from "../../content/research/papers";
import { postJson, useAi } from "../../lib/ai";
import { addEvidence, award, completeStage, earnBadge, recordBest, useProgress } from "../../lib/progress";
import { LabCard } from "../common";

const ID = "ri-capstone";
const PATH = "research-intelligence";
export const TOOL_EVIDENCE: Record<string, string> = { search_studies: "Study search", get_study: "Study records", get_risk_of_bias: "Risk of bias", search_protocol: "Protocol lookup" };
type Grade = { score: number; headline: string; strengths: string[]; improvements: string[] };

export default function ReviewBoard() {
  const ev = useProgress().lessons[ID]?.evidence || [];
  const aiOn = useAi();
  const [place, setPlace] = useState<Record<string, string>>({});
  const [direction, setDirection] = useState("");
  const [certainty, setCertainty] = useState("");
  const [limitations, setLimitations] = useState("");
  const [conclusion, setConclusion] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [check, setCheck] = useState<{ wrong: string[]; direction: boolean; certainty: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const sorted = STUDIES.filter(s => place[s.id] && place[s.id] !== "tray").length;
  const ready = sorted === STUDIES.length && direction && certainty && limitations.trim() && conclusion.trim() && reasoning.trim().length > 40;

  const submit = async () => {
    const included = STUDIES.filter(s => place[s.id] === "in").map(s => s.id);
    const wrong = STUDIES.filter(s => (place[s.id] === "in") !== KEY.included.includes(s.id)).map(s => s.id);
    const c = { wrong, direction: direction === SYNTHESIS_KEY.direction, certainty: certainty === SYNTHESIS_KEY.certainty };
    setCheck(c); setBusy(true); setErr("");
    try {
      const g = await postJson<Grade>("/api/capstone-grade", {
        path: PATH,
        autoCheck: `Inclusion decisions: ${STUDIES.length - wrong.length}/${STUDIES.length} correct; misclassified: ${wrong.join(", ") || "none"}. Direction ${c.direction ? "matches" : "does not match"} the key. GRADE certainty ${c.certainty ? "matches" : "does not match"} the key.`,
        report: { "Included studies": included.join(", "), "Direction of effect": direction, "GRADE certainty": certainty, Limitations: limitations, Conclusion: conclusion, Reasoning: reasoning },
      });
      setGrade(g);
      recordBest(ID, "seminarBest", g.score);
      completeStage(ID, "lab");
      award(`${ID}:submit`, 50, "Review report filed");
      award(`${ID}:score${g.score}`, g.score * 15, `Capstone score ${g.score}/10`);
      if (g.score >= 7 && !wrong.length && c.direction && c.certainty) earnBadge("review-board");
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  return (
    <>
      <LabCard title="1. Investigate with your research assistant" sub={<RichInline text="It runs real [[t|tool calls]] against the study database and protocol. Expand any call to see the raw result. Evidence collected:" />}
        right={<div className="evidence">{Object.values(TOOL_EVIDENCE).map(e => <span key={e} className={`ev ${ev.includes(e) ? "got" : ""}`}>{ev.includes(e) ? "✓ " : ""}{e}</span>)}</div>}>
        <AgentConsole path={PATH} toolNames={Object.keys(TOOL_EVIDENCE)} height={520} placeholder="Ask the research assistant…"
          starters={["List every study in the database with its design.", "What are the protocol's eligible designs?", "Show me the full record for MS-14.", "What risk-of-bias judgments did the trials get?"]}
          onToolCall={name => { const e = TOOL_EVIDENCE[name]; if (e) { addEvidence(ID, e); award(`${ID}:ev:${e}`, 15, `Evidence: ${e}`); } }} />
      </LabCard>

      <LabCard title="2. File your review report" sub="Decide every record, then state the direction of effect, the GRADE certainty for the randomized evidence, the limitations and your conclusion. Inclusion and certainty are checked exactly; Otto grades your reasoning." right={<DragHint>Drag records</DragHint>}>
        <BucketBoard items={STUDIES} columns={2} value={place} onChange={p => { setPlace(p); setCheck(null); }} trayLabel="Study records"
          buckets={[{ id: "in", title: "Included in the review" }, { id: "out", title: "Excluded" }]}
          stateOf={s => (check ? ((place[s.id] === "in") === KEY.included.includes(s.id) ? "right" : "wrong") : undefined)}
          render={s => <span style={{ fontSize: ".8rem" }}><b>{s.id}</b> <span className="muted">{s.design} · {s.year} · n={s.n ?? "–"}</span></span>} />
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 16 }}>
          <div><label className="lbl" htmlFor="dir">Direction of effect on time to optimal therapy</label>
            <select id="dir" className="field" value={direction} onChange={e => setDirection(e.target.value)}>
              <option value="">Choose…</option><option value="reduces">Rapid molecular identification reduces it</option><option value="no clear difference">No clear difference</option><option value="increases">It increases it</option>
            </select></div>
          <div><label className="lbl" htmlFor="cert">GRADE certainty (randomized evidence)</label>
            <select id="cert" className="field" value={certainty} onChange={e => setCertainty(e.target.value)}>
              <option value="">Choose…</option><option value="high">High</option><option value="moderate">Moderate</option><option value="low">Low</option><option value="very low">Very low</option>
            </select></div>
        </div>
        <div style={{ marginTop: 12 }}><label className="lbl" htmlFor="lim">Main limitations</label><input id="lim" className="field" value={limitations} onChange={e => setLimitations(e.target.value)} placeholder="Which GRADE domains concern you, and why?" /></div>
        <div style={{ marginTop: 12 }}><label className="lbl" htmlFor="con">Conclusion</label><input id="con" className="field" value={conclusion} onChange={e => setConclusion(e.target.value)} placeholder="One or two sentences a guideline panel could use" /></div>
        <div style={{ marginTop: 12 }}><label className="lbl" htmlFor="why">Your reasoning</label><textarea id="why" className="answer" value={reasoning} onChange={e => setReasoning(e.target.value)} placeholder="Why did you exclude what you excluded? How did you rate certainty, domain by domain?" /></div>
        {aiOn === false && <div className="banner warn" style={{ marginTop: 10 }}>Grading needs Claude (ANTHROPIC_API_KEY on the server).</div>}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn yellow" onClick={submit} disabled={!ready || busy || !aiOn}>{busy ? "Otto is reading your report…" : "Submit review report"}</button>
          {!ready && <span className="muted" style={{ fontSize: ".85rem" }}>Decide all {STUDIES.length} records ({sorted}/{STUDIES.length}) and fill every field.</span>}
        </div>
        {err && <div className="banner err" style={{ marginTop: 10 }}>{err}</div>}
        {check && (
          <div className="stack" style={{ marginTop: 10, gap: 4 }}>
            <p className={`feedback ${check.wrong.length ? "bad" : "good"}`} style={{ margin: 0 }}>Inclusion: {STUDIES.length - check.wrong.length}/{STUDIES.length} correct{check.wrong.length ? `. Recheck ${check.wrong.join(", ")} (red cards).` : "."}</p>
            <p className={`feedback ${check.direction ? "good" : "bad"}`} style={{ margin: 0 }}>Direction: {check.direction ? "matches the evidence." : "doesn't match what the included trials show."}</p>
            <p className={`feedback ${check.certainty ? "good" : "bad"}`} style={{ margin: 0 }}>Certainty: {check.certainty ? "matches the GRADE rating." : "reconsider: start from the design, then each downgrading domain."}</p>
          </div>
        )}
        {grade && (
          <div className="grade" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}><div className="pts">{grade.score}/10</div>{grade.score >= 7 && check && !check.wrong.length && check.direction && check.certainty && <span className="tag live">📚 Review board passed</span>}</div>
            <Rich text={grade.headline} />
            <Rich text={"#### Strengths\n" + grade.strengths.map(s => "- " + s).join("\n") + "\n\n#### To improve\n" + grade.improvements.map(s => "- " + s).join("\n")} />
            {check && !check.wrong.length && <details><summary className="muted">Show the answer key</summary><Rich text={`**Included**: ${KEY.included.join(", ")}\n\n**Excluded**:\n${Object.entries(KEY.excluded).map(([k, v]) => `- ${k} (${v.fails}): ${v.reason}`).join("\n")}\n\n**Direction**: ${SYNTHESIS_KEY.direction}. **Certainty**: ${SYNTHESIS_KEY.certainty}.\n\n${SYNTHESIS_KEY.rationale}`} /></details>}
          </div>
        )}
      </LabCard>
    </>
  );
}
