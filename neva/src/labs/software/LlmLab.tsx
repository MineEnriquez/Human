import { useMemo, useState } from "react";
import { DragHint, SortIntoBuckets } from "../../components/dnd";
import { RichInline } from "../../components/Rich";
import { LLM_QUESTION, LLM_SNIPPET, LLM_SPEC, SPEC_FIELDS } from "../../content/software/data";
import { validateCode, type IssueCategory } from "../../content/software/validator";
import { earnBadge, useProgress } from "../../lib/progress";
import { finishPart, LabCard } from "../common";

const ID = "se-llm";
const EV = ["Spec reviewed", "Sampling experiment", "Validator findings sorted"];

// Next identifier after `networks=[el.` for a syphilis model, with no Epiloom docs in the context: illustrative
// probabilities. Each identifier is shown as one choice for simplicity; in reality it is several tokens.
const NEXT = [
  { tok: "MFNet", logit: 2.2, kind: "right" }, { tok: "SexualNetwork", logit: 2.1, kind: "invented" }, { tok: "RandomNet", logit: 1.9, kind: "wrong route" },
  { tok: "SexualNet", logit: 1.6, kind: "deprecated" }, { tok: "STINetwork", logit: 1.0, kind: "invented" },
];
const softmax = (T: number) => { const e = NEXT.map(n => Math.exp(n.logit / Math.max(T, 0.05))); const s = e.reduce((a, b) => a + b, 0); return e.map(x => x / s); };

const CATS: { id: IssueCategory; title: string }[] = [
  { id: "hallucinated-api", title: "Invented API" },
  { id: "unit", title: "Unit error" },
  { id: "requirement", title: "Misses the spec" },
  { id: "reliability", title: "Reliability risk" },
];
const WHY: Record<string, string> = {
  "missing-scenario": "The spec compares strategies against doing nothing; the code must build a labelled sim for every scenario, baseline included.",
  "unknown-symbol": "Not in Epiloom's API: a plausible name the model produced.",
  unit: "Rates need el.peryear()/el.freqperyear(), durations el.years(): a bare number or the wrong helper is ambiguous or wrong.",
  "sexual-network": "Syphilis is sexually transmitted; it needs el.MFNet.",
  "mtct-pregnancy": "Congenital syphilis needs el.Pregnancy(); el.Births() makes no mother-child links.",
  "maternal-needs-pregnancy": "el.MaternalNet() links nobody without el.Pregnancy().",
  "mtct-probability": "Without p_congenital > 0 no baby can be infected.",
  "mtct-beta": "The disease needs a 'maternal' transmission route.",
  deprecated: "Deprecated in Epiloom 2.0: a sign the model learned from old code.",
};
const ISSUES = validateCode(LLM_SNIPPET, LLM_SPEC).map((i, n) => ({ id: `i${n}`, label: `line ${i.line}: ${i.message}`, bucket: i.category, why: WHY[i.rule] || i.message }));
const BUCKETS = CATS.filter(c => ISSUES.some(i => i.bucket === c.id));

export default function LlmLab() {
  const p = useProgress().lessons[ID]?.evidence || [];
  const [T, setT] = useState(1);
  const probs = softmax(T);
  const [samples, setSamples] = useState<string[]>([]);
  const [tried, setTried] = useState({ low: false, high: false });
  const [code, setCode] = useState(LLM_SNIPPET);
  const [ran, setRan] = useState(false);
  const live = useMemo(() => validateCode(code, LLM_SPEC), [code]);
  const sample = () => {
    const draw = Array.from({ length: 10 }, () => { let r = Math.random(), i = 0; while (i < probs.length - 1 && (r -= probs[i]) > 0) i++; return NEXT[i].tok; });
    setSamples(draw);
    const t = { low: tried.low || T <= 0.4, high: tried.high || T >= 1.4 };
    setTried(t);
    if (t.low && t.high) finishPart(ID, EV[1], EV);
  };
  const right = samples.filter(s => NEXT.find(n => n.tok === s)!.kind === "right").length;

  return (
    <>
      <LabCard title="A. Review the model's spec" done={p.includes(EV[0])} sub="The question, then the fields an LLM extracted from it. Sort each one: captured correctly, wrong, or something it should have asked." right={<DragHint>Drag cards into buckets</DragHint>}>
        <div className="read" style={{ background: "var(--paper)", borderRadius: 10, padding: "12px 16px", fontSize: ".95rem", marginBottom: 14 }}><b>Researcher's question</b><br />"{LLM_QUESTION}"</div>
        <SortIntoBuckets items={SPEC_FIELDS} columns={3} buckets={[{ id: "ok", title: "✓ Captured correctly" }, { id: "wrong", title: "✗ Wrong" }, { id: "ask", title: "? Should be a clarifying question" }]}
          onSolved={n => { finishPart(ID, EV[0], EV, n === 1 ? 30 : 20); if (n === 1) earnBadge("fact-checker"); }} />
      </LabCard>

      <LabCard title="B. Sampling the next identifier" done={p.includes(EV[1])} sub={<>The model is writing <code>networks=[el.</code> for syphilis with <b>no Epiloom docs in the context</b>. Change the temperature and sample 10 completions. (An illustrative sampler: some current Claude and OpenAI reasoning models fix temperature instead of exposing it.)</>}>
        <div className="row"><label htmlFor="temp" className="muted">Temperature {T.toFixed(2)}</label><input id="temp" type="range" min={0.05} max={2} step={0.05} value={T} onChange={e => setT(+e.target.value)} style={{ flex: 1, maxWidth: 320 }} /></div>
        <div className="stack" style={{ margin: "14px 0", gap: 6 }}>
          {NEXT.map((n, i) => (
            <div key={n.tok} className="row" style={{ gap: 10 }}>
              <span className="mono" style={{ width: 130 }}>{n.tok}</span>
              <span className="tag" style={{ width: 96, justifyContent: "center" }}>{n.kind}</span>
              <div className="meter" style={{ flex: 1, height: 14 }}><span style={{ width: `${probs[i] * 100}%`, background: n.kind === "right" ? "var(--ok)" : "var(--muted)" }} /></div>
              <span className="mono" style={{ width: 52, textAlign: "right" }}>{(probs[i] * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
        <div className="row"><button className="btn primary sm" onClick={sample}>Sample 10</button><span className="tag">{tried.low ? "✓" : "○"} sampled at ≤ 0.4</span><span className="tag">{tried.high ? "✓" : "○"} sampled at ≥ 1.4</span></div>
        <div className="row" style={{ marginTop: 8 }}>{samples.length > 0 && <span className="mono" style={{ fontSize: ".85rem" }}>{samples.join(" · ")}</span>}</div>
        {samples.length > 0 && <p className="read" style={{ fontSize: ".95rem", marginTop: 10 }}><RichInline text={`${right} of 10 picked the right network. Without the docs, [[w|invented, deprecated and wrong-route names are all likely continuations]]. Low temperature repeats the top guess; high temperature tries rarer ones. Neither looks anything up. Identifiers are shown as one choice each for simplicity; really they are several tokens.`} /></p>}
      </LabCard>

      <LabCard title="C. Run the validator" done={p.includes(EV[2])} sub="This is the code the LLM wrote. The validator checks every el.X call against Epiloom's API and the spec. Edit the code and watch the findings change, then sort the original findings by kind." right={<DragHint>Drag findings into buckets</DragHint>}>
        <textarea className="answer mono" style={{ minHeight: 230, fontSize: ".82rem", fontFamily: "var(--font-mono)" }} value={code} onChange={e => setCode(e.target.value)} aria-label="Generated Epiloom code" spellCheck={false} />
        <div className="row" style={{ margin: "10px 0" }}><button className="btn primary sm" onClick={() => setRan(true)}>Validate</button><button className="btn sm ghost" onClick={() => setCode(LLM_SNIPPET)}>Reset code</button>{ran && <span className={`feedback ${live.length ? "bad" : "good"}`}>{live.length ? `${live.length} issue${live.length > 1 ? "s" : ""}` : "No issues"}</span>}</div>
        {ran && live.length > 0 && <div className="stack" style={{ gap: 4, marginBottom: 14 }}>{live.map((i, n) => <div key={n} className="tool-ev err"><span className="lbl">line {i.line} · {i.category}</span> {i.message}</div>)}</div>}
        {ran && <SortIntoBuckets items={ISSUES} columns={BUCKETS.length > 2 ? 2 : BUCKETS.length} buckets={BUCKETS} onSolved={() => finishPart(ID, EV[2], EV)} />}
      </LabCard>
    </>
  );
}
