import { useState } from "react";
import { AgentConsole } from "../../components/AgentConsole";
import { BucketBoard, DragHint } from "../../components/dnd";
import { Rich, RichInline } from "../../components/Rich";
import { TUMOR_BOARD_KEY, VARIANTS, type VariantClass } from "../../content/cancer/dataset";
import { postJson, useAi } from "../../lib/ai";
import { addEvidence, award, completeStage, earnBadge, recordBest, useProgress } from "../../lib/progress";
import { LabCard } from "../common";

const ID = "cg-capstone";
const TOOL_EVIDENCE: Record<string, string> = { search_variants: "Variant list", get_vaf_timeline: "VAF timeline", get_sample_qc: "Sample QC", search_sops: "SOP lookup" };
const CLASSES: { id: VariantClass; title: string }[] = [
  { id: "founder", title: "Founder / truncal clone" },
  { id: "lost", title: "Diagnostic subclone lost at relapse" },
  { id: "relapse", title: "Subclone that drove relapse" },
  { id: "germline", title: "Germline (inherited)" },
  { id: "artifact", title: "Artifact / not reportable" },
];
type Grade = { score: number; headline: string; strengths: string[]; improvements: string[] };

export default function TumorBoard() {
  const ev = useProgress().lessons[ID]?.evidence || [];
  const aiOn = useAi();
  const [place, setPlace] = useState<Record<string, string>>({});
  const [relapse, setRelapse] = useState("");
  const [germline, setGermline] = useState("");
  const [reporting, setReporting] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [check, setCheck] = useState<{ correct: number; wrong: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const sorted = VARIANTS.filter(v => place[v.id] && place[v.id] !== "tray").length;
  const ready = sorted === VARIANTS.length && relapse.trim() && germline.trim() && reporting.trim() && reasoning.trim().length > 40;

  const submit = async () => {
    const wrong = VARIANTS.filter(v => place[v.id] !== TUMOR_BOARD_KEY.classes[v.id]).map(v => v.id);
    const c = { correct: VARIANTS.length - wrong.length, wrong };
    setCheck(c); setBusy(true); setErr("");
    try {
      const classification = VARIANTS.map(v => `${v.id} → ${CLASSES.find(x => x.id === place[v.id])?.title}`).join("; ");
      const g = await postJson<Grade>("/api/capstone-grade", {
        path: "cancer-genomics",
        autoCheck: `Variant classification: ${c.correct}/${VARIANTS.length} correct. Misclassified: ${wrong.join(", ") || "none"}.`,
        report: { "Variant classification": classification, "Relapse explanation": relapse, "Germline action": germline, "Reporting and QC decisions": reporting, Reasoning: reasoning },
      });
      setGrade(g);
      recordBest(ID, "seminarBest", g.score);
      completeStage(ID, "lab");
      award(`${ID}:submit`, 50, "Tumor board report filed");
      award(`${ID}:score${g.score}`, g.score * 15, `Capstone score ${g.score}/10`);
      if (g.score >= 7 && !wrong.length) earnBadge("case-closed");
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  return (
    <>
      <LabCard title="1. Analyse with your lab assistant" sub={<RichInline text="It runs real [[t|tool calls]] against the variant data and SOPs. Expand any call to see the raw result. Evidence collected:" />}
        right={<div className="evidence">{Object.values(TOOL_EVIDENCE).map(e => <span key={e} className={`ev ${ev.includes(e) ? "got" : ""}`}>{ev.includes(e) ? "✓ " : ""}{e}</span>)}</div>}>
        <AgentConsole path="cancer-genomics" toolNames={Object.keys(TOOL_EVIDENCE)} height={520}
          starters={["List every variant with its VAF in each sample.", "What are the purity estimates for the diagnosis and relapse samples?", "Show me the IDH2 R140Q timeline.", "What does our germline policy say?"]}
          onToolCall={name => { const e = TOOL_EVIDENCE[name]; if (e) { addEvidence(ID, e); award(`${ID}:ev:${e}`, 15, `Evidence: ${e}`); } }} />
      </LabCard>

      <LabCard title="2. File your tumor board report" sub="Classify every variant, then explain the relapse, the germline action and your reporting decisions. Classification is checked exactly; Professor Neva grades your reasoning. Interpret, don't prescribe: no treatment advice." right={<DragHint>Drag variants</DragHint>}>
        <BucketBoard items={VARIANTS} columns={3} value={place} onChange={p => { setPlace(p); setCheck(null); }} trayLabel="Variants"
          buckets={CLASSES}
          stateOf={v => (check ? (place[v.id] === TUMOR_BOARD_KEY.classes[v.id] ? "right" : "wrong") : undefined)}
          render={v => <span style={{ fontSize: ".82rem" }}><b>{v.gene}</b> <span className="muted">{v.hgvsP === "ITD" || v.hgvsP === "frameshift" ? v.hgvsC : v.hgvsP}</span></span>} />
        <div style={{ marginTop: 16 }}><label className="lbl" htmlFor="rel">Relapse explanation</label><input id="rel" className="field" value={relapse} onChange={e => setRelapse(e.target.value)} placeholder="Which clone came back, and how do you know?" /></div>
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 12 }}>
          <div><label className="lbl" htmlFor="germ">Germline finding: what must happen</label><input id="germ" className="field" value={germline} onChange={e => setGermline(e.target.value)} placeholder="What does the policy require?" /></div>
          <div><label className="lbl" htmlFor="rep">Reporting and QC decisions</label><input id="rep" className="field" value={reporting} onChange={e => setReporting(e.target.value)} placeholder="What is reported, what isn't, and why?" /></div>
        </div>
        <div style={{ marginTop: 12 }}><label className="lbl" htmlFor="why">Your reasoning</label><textarea id="why" className="answer" value={reasoning} onChange={e => setReasoning(e.target.value)} placeholder="Explain the evidence: VAFs across timepoints, purity and CCF (with assumptions), the skin control, QC flags." /></div>
        {aiOn === false && <div className="banner warn" style={{ marginTop: 10 }}>Grading needs Claude (ANTHROPIC_API_KEY on the server).</div>}
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn yellow" onClick={submit} disabled={!ready || busy || !aiOn}>{busy ? "Professor Neva is reading your report…" : "Submit tumor board report"}</button>
          {!ready && <span className="muted" style={{ fontSize: ".85rem" }}>Classify all {VARIANTS.length} variants ({sorted}/{VARIANTS.length}) and fill every field.</span>}
        </div>
        {err && <div className="banner err" style={{ marginTop: 10 }}>{err}</div>}
        {check && <p className={`feedback ${check.wrong.length ? "bad" : "good"}`}>Classification: {check.correct}/{VARIANTS.length} correct{check.wrong.length ? `. Recheck ${check.wrong.join(", ")} (red cards).` : ". Every variant is right."}</p>}
        {grade && (
          <div className="grade" style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}><div className="pts">{grade.score}/10</div>{grade.score >= 7 && !check?.wrong.length && <span className="tag live">🏆 Case closed</span>}</div>
            <Rich text={grade.headline} />
            <Rich text={"#### Strengths\n" + grade.strengths.map(s => "- " + s).join("\n") + "\n\n#### To improve\n" + grade.improvements.map(s => "- " + s).join("\n")} />
            {check?.wrong.length === 0 && <details><summary className="muted">Show the answer key</summary><Rich text={`**Classification**:\n${VARIANTS.map(v => `- ${v.gene} ${v.hgvsP}: ${CLASSES.find(x => x.id === TUMOR_BOARD_KEY.classes[v.id])?.title}`).join("\n")}\n\n**Relapse**: ${TUMOR_BOARD_KEY.relapse}\n\n**Germline**: ${TUMOR_BOARD_KEY.germline}\n\n**Reporting**: ${TUMOR_BOARD_KEY.reporting}`} /></details>}
          </div>
        )}
      </LabCard>
    </>
  );
}
