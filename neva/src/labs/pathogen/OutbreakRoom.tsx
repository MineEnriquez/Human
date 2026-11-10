import { useState } from "react";
import { AgentConsole } from "../../components/AgentConsole";
import { BucketBoard, DragHint } from "../../components/dnd";
import { Rich, RichInline } from "../../components/Rich";
import { ISOLATES, OUTBREAK_KEY } from "../../content/pathogen/dataset";
import { postJson, useAi } from "../../lib/ai";
import { addEvidence, award, completeStage, earnBadge, recordBest, useProgress } from "../../lib/progress";
import { LabCard } from "../common";

const ID = "pg-capstone";
const TOOL_EVIDENCE: Record<string, string> = { search_isolates: "Isolate list", get_snp_distances: "SNP matrix", get_ward_transfers: "Transfer history", search_protocols: "Protocol lookup" };
type Grade = { score: number; headline: string; strengths: string[]; improvements: string[] };

export default function OutbreakRoom() {
  const prog = useProgress().lessons[ID];
  const ev = prog?.evidence || [];
  const aiOn = useAi();
  const [place, setPlace] = useState<Record<string, string>>({});
  const [reservoir, setReservoir] = useState("");
  const [route, setRoute] = useState("");
  const [action, setAction] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [check, setCheck] = useState<{ correct: number; wrong: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const sorted = ISOLATES.filter(i => place[i.id] && place[i.id] !== "tray").length;
  const ready = sorted === ISOLATES.length && reservoir.trim() && route.trim() && action.trim() && reasoning.trim().length > 40;

  const submit = async () => {
    const cluster = ISOLATES.filter(i => place[i.id] === "in").map(i => i.id);
    const wrong = ISOLATES.filter(i => (place[i.id] === "in") !== OUTBREAK_KEY.cluster.includes(i.id)).map(i => i.id);
    const c = { correct: ISOLATES.length - wrong.length, wrong };
    setCheck(c); setBusy(true); setErr("");
    try {
      const g = await postJson<Grade>("/api/capstone-grade", { path: "pathogen-genomics", autoCheck: `Cluster membership: ${c.correct}/12 isolates classified correctly. Misclassified: ${wrong.join(", ") || "none"}.`, report: { "Chosen cluster": cluster.join(", "), Reservoir: reservoir, Route: route, "Next action": action, Reasoning: reasoning } });
      setGrade(g);
      recordBest(ID, "seminarBest", g.score);
      completeStage(ID, "lab");
      award(`${ID}:submit`, 50, "Case report filed");
      award(`${ID}:score${g.score}`, g.score * 15, `Capstone score ${g.score}/10`);
      if (g.score >= 7 && !wrong.length) earnBadge("case-closed");
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  return (
    <>
      <LabCard title="1. Investigate with your lab assistant" sub={<RichInline text="It runs real [[t|tool calls]] against the lab data. Expand any call to see the raw result. Evidence collected:" />}
        right={<div className="evidence">{Object.values(TOOL_EVIDENCE).map(e => <span key={e} className={`ev ${ev.includes(e) ? "got" : ""}`}>{ev.includes(e) ? "✓ " : ""}{e}</span>)}</div>}>
        <AgentConsole path="pathogen-genomics" toolNames={Object.keys(TOOL_EVIDENCE)} height={520}
          starters={["List every isolate with its ST, gene, ward and date.", "Get SNP distances for all the ST258 isolates.", "Which patients moved between wards?", "What does GS-03 say about SNP thresholds?"]}
          onToolCall={name => { const e = TOOL_EVIDENCE[name]; if (e) { addEvidence(ID, e); award(`${ID}:ev:${e}`, 15, `Evidence: ${e}`); } }} />
      </LabCard>

      <LabCard title="2. File your case report" sub="Sort all 12 isolates, then state the reservoir, the route and the next actions. The cluster is checked exactly; Professor Neva grades your reasoning." right={<DragHint>Drag isolates</DragHint>}>
        <BucketBoard items={ISOLATES} columns={2} value={place} onChange={p => { setPlace(p); setCheck(null); }} trayLabel="Isolates"
          buckets={[{ id: "in", title: "Outbreak cluster" }, { id: "out", title: "Not part of this cluster" }]}
          stateOf={i => (check ? ((place[i.id] === "in") === OUTBREAK_KEY.cluster.includes(i.id) ? "right" : "wrong") : undefined)}
          render={i => <span style={{ fontSize: ".82rem" }}><b>{i.id}</b> <span className="muted">{i.ward} · {i.st} · {i.carbapenemase}</span></span>} />
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 16 }}>
          <div><label className="lbl" htmlFor="res">Likely reservoir</label><input id="res" className="field" value={reservoir} onChange={e => setReservoir(e.target.value)} placeholder="Where is the strain persisting?" /></div>
          <div><label className="lbl" htmlFor="route">Route of spread</label><input id="route" className="field" value={route} onChange={e => setRoute(e.target.value)} placeholder="How did it reach other wards?" /></div>
        </div>
        <div style={{ marginTop: 12 }}><label className="lbl" htmlFor="act">Next actions (cite protocols)</label><input id="act" className="field" value={action} onChange={e => setAction(e.target.value)} placeholder="What must infection prevention and the lab do now?" /></div>
        <div style={{ marginTop: 12 }}><label className="lbl" htmlFor="why">Your reasoning</label><textarea id="why" className="answer" value={reasoning} onChange={e => setReasoning(e.target.value)} placeholder="Explain the evidence: SNP distances, STs and genes, QC, transfers. Why did you exclude what you excluded?" /></div>
        {aiOn === false && <div className="banner warn" style={{ marginTop: 10 }}>Grading needs Claude (ANTHROPIC_API_KEY on the server).</div>}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn yellow" onClick={submit} disabled={!ready || busy || !aiOn}>{busy ? "Professor Neva is reading your report…" : "Submit case report"}</button>
          {!ready && <span className="muted" style={{ fontSize: ".85rem" }}>Sort all 12 isolates ({sorted}/12) and fill every field.</span>}
        </div>
        {err && <div className="banner err" style={{ marginTop: 10 }}>{err}</div>}
        {check && <p className={`feedback ${check.wrong.length ? "bad" : "good"}`}>Cluster: {check.correct}/12 isolates classified correctly{check.wrong.length ? `. Recheck ${check.wrong.join(", ")} (red cards).` : ". Every isolate is right."}</p>}
        {grade && (
          <div className="grade" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}><div className="pts">{grade.score}/10</div>{grade.score >= 7 && !check?.wrong.length && <span className="tag live">🏆 Case closed</span>}</div>
            <Rich text={grade.headline} />
            <Rich text={"#### Strengths\n" + grade.strengths.map(s => "- " + s).join("\n") + "\n\n#### To improve\n" + grade.improvements.map(s => "- " + s).join("\n")} />
            {check?.wrong.length === 0 && <details><summary className="muted">Show the answer key</summary><Rich text={`**Cluster**: ${OUTBREAK_KEY.cluster.join(", ")}\n\n**Excluded**:\n${Object.entries(OUTBREAK_KEY.excluded).map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n\n**Reservoir**: ${OUTBREAK_KEY.reservoir}\n\n**Route**: ${OUTBREAK_KEY.route}`} /></details>}
          </div>
        )}
      </LabCard>
    </>
  );
}
