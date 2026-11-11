import { useMemo, useState } from "react";
import { AiOffNotice } from "../../components/ConnectKey";
import { AgentConsole } from "../../components/AgentConsole";
import { BucketBoard, DragHint } from "../../components/dnd";
import { Rich, RichInline } from "../../components/Rich";
import { CODE_VERSIONS, SHIP_VERSION } from "../../content/software/data";
import { ENGINE_NOTE, runModel } from "../../content/software/engine";
import { DRAFT_SPEC, REFERENCE_SPEC, REQUIREMENTS, RESEARCH_QUESTION, type ReqClass } from "../../content/software/spec";
import { validateCode } from "../../content/software/validator";
import { postJson, useAi } from "../../lib/ai";
import { addEvidence, award, completeStage, earnBadge, recordBest, useProgress } from "../../lib/progress";
import { LabCard } from "../common";

const ID = "se-capstone";
const TOOL_EVIDENCE: Record<string, string> = { search_docs: "Docs looked up", get_api: "Docs looked up", validate_code: "Code validated", run_model: "Model run", find_examples: "Examples found" };
const CLASSES: { id: ReqClass; title: string }[] = [
  { id: "captured", title: "Captured in the draft spec" },
  { id: "wrong", title: "Captured, but wrong" },
  { id: "missing", title: "Missing from the draft spec" },
];
type Grade = { score: number; headline: string; strengths: string[]; improvements: string[] };

export default function ModelBuilder() {
  const ev = useProgress().lessons[ID]?.evidence || [];
  const aiOn = useAi();
  const [place, setPlace] = useState<Record<string, string>>({});
  const [ship, setShip] = useState("");
  const [shown, setShown] = useState("v1");
  const [canCant, setCanCant] = useState("");
  const [questions, setQuestions] = useState("");
  const [checks, setChecks] = useState("");
  const [trace, setTrace] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [check, setCheck] = useState<{ correct: number; wrong: string[]; shipOk: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const issues = useMemo(() => Object.fromEntries(CODE_VERSIONS.map(v => [v.id, validateCode(v.code, REFERENCE_SPEC)])), []);
  const engine = useMemo(() => runModel(REFERENCE_SPEC), []);

  const sorted = REQUIREMENTS.filter(r => place[r.id] && place[r.id] !== "tray").length;
  const ready = sorted === REQUIREMENTS.length && ship && canCant.trim() && questions.trim() && checks.trim() && trace.trim().length > 40;

  const submit = async () => {
    const wrong = REQUIREMENTS.filter(r => place[r.id] !== r.key).map(r => r.id);
    const shipOk = ship === SHIP_VERSION;
    const c = { correct: REQUIREMENTS.length - wrong.length, wrong, shipOk };
    setCheck(c); setBusy(true); setErr("");
    try {
      const review = REQUIREMENTS.map(r => `${r.label} → ${CLASSES.find(x => x.id === place[r.id])?.title}`).join("; ");
      const g = await postJson<Grade>("/api/capstone-grade", {
        path: "software-engineering",
        autoCheck: `Requirement review: ${c.correct}/${REQUIREMENTS.length} correct (misclassified: ${wrong.join(", ") || "none"}). Code to ship: ${ship} (${shipOk ? "correct: passes every check" : "not the version that passes every check against the reviewed spec"}).`,
        report: { "Requirement review": review, "Code version to ship": ship, "What the model can and can't answer": canCant, "Clarifying questions for the researcher": questions, "Reliability checks performed": checks, "Traceability and reasoning": trace },
      });
      setGrade(g);
      recordBest(ID, "seminarBest", g.score);
      completeStage(ID, "lab");
      award(`${ID}:submit`, 50, "Model review filed");
      award(`${ID}:score${g.score}`, g.score * 15, `Capstone score ${g.score}/10`);
      if (g.score >= 7 && !wrong.length && shipOk) earnBadge("model-builder");
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  const evidence = [...new Set(Object.values(TOOL_EVIDENCE))];
  const code = CODE_VERSIONS.find(v => v.id === shown)!;

  return (
    <>
      <LabCard title="1. The question and the agent's draft spec" sub="Read the researcher's question, then the spec the Model Builder drafted from it.">
        <div className="read" style={{ background: "var(--paper)", borderRadius: 10, padding: "12px 16px", fontSize: ".95rem" }}><b>Researcher's question</b><br />"{RESEARCH_QUESTION}"</div>
        <pre className="mono" style={{ whiteSpace: "pre-wrap", fontSize: ".78rem", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px", marginTop: 10 }}>{JSON.stringify({ ...DRAFT_SPEC, question: "…" }, null, 2)}</pre>
      </LabCard>

      <LabCard title="2. Investigate with the Model Builder" sub={<RichInline text="It runs real [[t|tool calls]] against Epiloom's docs, API, examples, validator and the course's simplified engine. Ask it to look things up, validate a version or run the spec. Evidence collected:" />}
        right={<div className="evidence">{evidence.map(e => <span key={e} className={`ev ${ev.includes(e) ? "got" : ""}`}>{ev.includes(e) ? "✓ " : ""}{e}</span>)}</div>}>
        <AgentConsole path="software-engineering" toolNames={["get_draft", "search_docs", "get_api", "find_examples", "validate_code", "run_model"]} height={520} placeholder="Ask the Model Builder…"
          starters={["Look up el.CoinfectionEffect: which way round are source and target?", "Read code version v3 and validate it against the reviewed spec.", "Run the reference spec and summarise the scenarios with their assumptions.", "Find examples with mother-to-child transmission on a sexual network."]}
          onToolCall={name => { const e = TOOL_EVIDENCE[name]; if (e) { addEvidence(ID, e); award(`${ID}:ev:${e}`, 15, `Evidence: ${e}`); } }} />
      </LabCard>

      <LabCard title="3. Review: requirements, code, results" sub="Sort every requirement by how the draft spec handled it, then choose the code you would ship. Both are checked exactly; Otto grades the rest." right={<DragHint>Drag requirements</DragHint>}>
        <BucketBoard items={REQUIREMENTS} columns={3} value={place} onChange={p => { setPlace(p); setCheck(null); }} trayLabel="Requirements from the question"
          buckets={CLASSES}
          stateOf={r => (check ? (place[r.id] === r.key ? "right" : "wrong") : undefined)}
          render={r => <span style={{ fontSize: ".82rem" }}>{r.label}</span>} />

        <div style={{ marginTop: 18 }}>
          <div className="row" style={{ gap: 6, marginBottom: 8 }}>{CODE_VERSIONS.map(v => <button key={v.id} className={`btn sm ${shown === v.id ? "primary" : "ghost"}`} onClick={() => setShown(v.id)}>{v.label}</button>)}</div>
          <pre className="mono" style={{ whiteSpace: "pre-wrap", fontSize: ".76rem", background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px", maxHeight: 320, overflow: "auto" }}>{code.code}</pre>
          <details><summary className="muted" style={{ cursor: "pointer" }}>Validator on {code.id} against the reviewed spec: {issues[code.id].length} issue{issues[code.id].length === 1 ? "" : "s"}</summary>
            <div className="stack" style={{ gap: 4, marginTop: 6 }}>{issues[code.id].length ? issues[code.id].map((i, n) => <div key={n} className="tool-ev err"><span className="lbl">line {i.line} · {i.category}</span> {i.message}</div>) : <div className="tool-ev res"><span className="lbl">✓</span> No issues.</div>}</div>
          </details>
          <label className="lbl" style={{ marginTop: 12 }}>Which version would you ship?</label>
          <div className="stack" style={{ gap: 6 }}>{CODE_VERSIONS.map(v => <label key={v.id} className="row" style={{ gap: 8, fontSize: ".95rem" }}><input type="radio" name="ship" checked={ship === v.id} onChange={() => { setShip(v.id); setCheck(null); }} />{v.label}</label>)}</div>
        </div>

        <details style={{ marginTop: 14 }}>
          <summary className="muted" style={{ cursor: "pointer" }}>Simplified engine: the reference spec's scenarios</summary>
          <p className="muted" style={{ fontSize: ".85rem" }}>{ENGINE_NOTE}</p>
          <table className="t"><thead><tr><th>Scenario</th><th>Congenital cases 2027-2037</th><th>People treated</th><th>Syphilis prevalence, last year</th></tr></thead>
            <tbody>{engine.results.map(r => <tr key={r.scenario}><td><b>{r.scenario}</b></td><td className="mono">{r.congenitalTotal}</td><td className="mono">{r.treatedTotal.toLocaleString()}</td><td className="mono">{(r.prevalenceEnd * 100).toFixed(2)}%</td></tr>)}</tbody></table>
          <ul className="read" style={{ fontSize: ".88rem" }}>{engine.assumptions.map(a => <li key={a}>{a}</li>)}</ul>
        </details>

        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 12 }}>
          <div><label className="lbl" htmlFor="cc">What the model can and can't answer</label><textarea id="cc" className="answer" style={{ minHeight: 90 }} value={canCant} onChange={e => setCanCant(e.target.value)} placeholder="Which comparison is supported, under which assumptions; what isn't?" /></div>
          <div><label className="lbl" htmlFor="cq">Clarifying questions for the researcher</label><textarea id="cq" className="answer" style={{ minHeight: 90 }} value={questions} onChange={e => setQuestions(e.target.value)} placeholder="What only she can decide or supply" /></div>
        </div>
        <div style={{ marginTop: 12 }}><label className="lbl" htmlFor="rc">Reliability checks you performed (and would add)</label><input id="rc" className="field" value={checks} onChange={e => setChecks(e.target.value)} placeholder="API lookups, validator, same seed, baseline, several seeds, calibration, review…" /></div>
        <div style={{ marginTop: 12 }}><label className="lbl" htmlFor="tr">Traceability: how each requirement is met and checked</label><textarea id="tr" className="answer" value={trace} onChange={e => setTrace(e.target.value)} placeholder="Requirement → line of code → check (validator rule, test, review)" /></div>

        {aiOn === false && <div style={{ marginTop: 10 }}><AiOffNotice what="Grading" /></div>}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn yellow" onClick={submit} disabled={!ready || busy || !aiOn}>{busy ? "Otto is reading your review…" : "Submit model review"}</button>
          {!ready && <span className="muted" style={{ fontSize: ".85rem" }}>Sort all {REQUIREMENTS.length} requirements ({sorted}/{REQUIREMENTS.length}), pick a version and fill every field.</span>}
        </div>
        {err && <div className="banner err" style={{ marginTop: 10 }}>{err}</div>}
        {check && <p className={`feedback ${check.wrong.length || !check.shipOk ? "bad" : "good"}`}>Requirement review: {check.correct}/{REQUIREMENTS.length} correct{check.wrong.length ? " (recheck the red cards)" : ""}. Code: {check.shipOk ? "right version." : "not the version that passes every check against the reviewed spec."}</p>}
        {grade && (
          <div className="grade" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}><div className="pts">{grade.score}/10</div>{grade.score >= 7 && !check?.wrong.length && check?.shipOk && <span className="tag live">🧬 Model builder</span>}</div>
            <Rich text={grade.headline} />
            <Rich text={"#### Strengths\n" + grade.strengths.map(s => "- " + s).join("\n") + "\n\n#### To improve\n" + grade.improvements.map(s => "- " + s).join("\n")} />
            {check?.wrong.length === 0 && check.shipOk && <details><summary className="muted">Show the answer key</summary><Rich text={REQUIREMENTS.map(r => `- **${r.label}**: ${r.key}. ${r.why}`).join("\n") + `\n\n**Ship ${SHIP_VERSION}.** v1 fails 8 checks; v3 looks clean but gives each scenario a different seed and drops the targeted eligibility rule.`} /></details>}
          </div>
        )}
      </LabCard>
    </>
  );
}
