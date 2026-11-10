import { useMemo, useState } from "react";
import { SortIntoBuckets, DragHint } from "../../components/dnd";
import { RichInline } from "../../components/Rich";
import { earnBadge, useProgress } from "../../lib/progress";
import { finishPart, LabCard } from "../common";

const ID = "cg-llm";
const EV = ["Tokenizer trace", "Temperature experiment", "Fact-check of the draft"];

// Illustrative tokenizer: common words stay whole; rare strings split into short pieces; DNA becomes k-mers.
const COMMON = new Set("the a of and to in is was for on with by gene genes variant variants sample samples report run coverage depth mean passed failed relapse remission diagnosis marrow patient patients carries carry mutation".split(" "));
function tokenizeIllustrative(text: string, k: number): { t: string; kind: "word" | "piece" | "kmer" | "punct" }[] {
  const out: { t: string; kind: "word" | "piece" | "kmer" | "punct" }[] = [];
  for (const raw of text.match(/[A-Za-z0-9]+|[^\sA-Za-z0-9]/g) || []) {
    if (/^[ACGT]{8,}$/.test(raw)) { for (let i = 0; i + k <= raw.length; i += k) out.push({ t: raw.slice(i, i + k), kind: "kmer" }); continue; }
    if (/^[^A-Za-z0-9]$/.test(raw)) { out.push({ t: raw, kind: "punct" }); continue; }
    if (COMMON.has(raw.toLowerCase()) || (/^[a-z]+$/.test(raw) && raw.length <= 7)) { out.push({ t: raw, kind: "word" }); continue; }
    // split rare strings at case/digit boundaries, then into <=3-char pieces
    for (const part of raw.match(/[a-z]+|[A-Z][a-z]*|[0-9]+/g) || [raw]) for (let i = 0; i < part.length; i += 3) out.push({ t: part.slice(i, i + 3), kind: "piece" });
  }
  return out;
}

// No report in the context: these are illustrative probabilities for genes often mentioned with AML.
const NEXT = [
  { tok: "FLT3", logit: 3.0 }, { tok: "NPM1", logit: 2.4 }, { tok: "DNMT3A", logit: 1.9 }, { tok: "IDH2", logit: 1.4 }, { tok: "TP53", logit: 1.0 },
];
const softmax = (T: number) => { const e = NEXT.map(n => Math.exp(n.logit / Math.max(T, 0.05))); const s = e.reduce((a, b) => a + b, 0); return e.map(x => x / s); };

const REPORT = `Patient AML-0412 (fictional). Samples: BM-DX (diagnosis), BM-REM (after induction), BM-REL (relapse), SKIN (cultured fibroblasts, germline control). DNMT3A p.R882H: DX 45%, REM 2%, REL 44%, SKIN 0%. NPM1 c.860_863dupTCTG (p.W288Cfs*12): DX 41%, REM 0%, REL 38%. FLT3-ITD: DX 30%, REM 0%, REL 0% (fragment analysis: positive at DX, negative at REL). IDH2 p.R140Q: DX 6%, REM 0%, REL 40%. DDX41 frameshift: DX 50%, REM 51%, REL 48%, SKIN 49%. KRAS p.G12D: REL 3% at 38x depth, strand-bias flag. All other calls at 790-930x.`;

const CLAIMS = [
  { id: "c1", label: "Four samples were sequenced, including a skin germline control.", bucket: "sup", why: "BM-DX, BM-REM, BM-REL and SKIN are listed." },
  { id: "c2", label: "All variant calls passed QC.", bucket: "fab", why: "KRAS p.G12D is at 38x with a strand-bias flag. The model smoothed over the exception." },
  { id: "c3", label: "FLT3-ITD persists at relapse and is the main driver.", bucket: "fab", why: "FLT3-ITD is 0% at relapse and negative by fragment analysis. FLT3 is a plausible AML word, not a supported fact." },
  { id: "c4", label: "IDH2 p.R140Q rose from 6% VAF at diagnosis to 40% at relapse.", bucket: "sup", why: "Both numbers are in the report." },
  { id: "c5", label: "A new somatic DDX41 mutation appeared at relapse.", bucket: "fab", why: "DDX41 is at ~50% in every sample, including the skin control: inherited, not new or somatic." },
  { id: "c6", label: "The NPM1 mutation was undetectable after induction.", bucket: "sup", why: "NPM1: REM 0%." },
  { id: "c7", label: "KRAS p.G12D is a confirmed relapse mutation.", bucket: "fab", why: "3% at 38x with strand bias is unconfirmed; the report confirms nothing about it." },
  { id: "c8", label: "Relapse was first detected by an MRD test on 1 August.", bucket: "fab", why: "No MRD test or date appears in the report. Plausible, unsupported." },
];

export default function LlmLab() {
  const p = useProgress().lessons[ID]?.evidence || [];
  const [text, setText] = useState("NPM1 c.860_863dupTCTG (p.W288Cfs*12); DNMT3A p.R882H. Read: ATGCGTACCGTTAGC");
  const [k, setK] = useState(3);
  const toks = useMemo(() => tokenizeIllustrative(text, k), [text, k]);
  const [T, setT] = useState(1);
  const probs = softmax(T);
  const [samples, setSamples] = useState<string[]>([]);
  const [tried, setTried] = useState({ low: false, high: false });
  const sample = () => {
    const draw = Array.from({ length: 10 }, () => { let r = Math.random(), i = 0; while (i < probs.length - 1 && (r -= probs[i]) > 0) i++; return NEXT[i].tok; });
    setSamples(draw);
    const t = { low: tried.low || T <= 0.4, high: tried.high || T >= 1.4 };
    setTried(t);
    if (t.low && t.high) finishPart(ID, EV[1], EV);
  };

  return (
    <>
      <LabCard title="A. Tokenizer bench" done={p.includes(EV[0])} sub="Type anything: a sentence, a gene name, a DNA read. This tokenizer is illustrative (Claude's real tokenizer differs), but the pattern is the same.">
        <input className="field mono" value={text} onChange={e => setText(e.target.value)} aria-label="Text to tokenize" />
        <div className="row" style={{ margin: "12px 0" }}>
          <label className="muted" htmlFor="k">DNA k-mer size: {k}</label>
          <input id="k" type="range" min={3} max={6} value={k} onChange={e => setK(+e.target.value)} />
          <span className="muted">{toks.length} tokens</span>
        </div>
        <div className="row" style={{ gap: 6 }}>
          {toks.map((t, i) => <span key={i} className={`k ${t.kind === "word" ? "k-c" : t.kind === "kmer" ? "k-b" : t.kind === "piece" ? "k-w" : ""}`} style={{ fontFamily: "var(--font-mono)" }}>{t.t}</span>)}
        </div>
        <p className="muted" style={{ fontSize: ".88rem" }}><span className="k k-c">whole word</span> <span className="k k-w">fragment of a rare string</span> <span className="k k-b">DNA k-mer</span>. Notice how variant notation shatters into fragments.</p>
        <button className="btn sm" onClick={() => finishPart(ID, EV[0], EV)} disabled={p.includes(EV[0])}>{p.includes(EV[0]) ? "Logged ✓" : "Log this trace as evidence"}</button>
      </LabCard>

      <LabCard title="B. Temperature experiment" done={p.includes(EV[1])} sub={<>Prompt: <i>"The relapse sample carries a mutation in ___"</i>, with no report in the context. Change the temperature and sample 10 completions.</>}>
        <div className="row"><label htmlFor="temp" className="muted">Temperature {T.toFixed(2)}</label><input id="temp" type="range" min={0.05} max={2} step={0.05} value={T} onChange={e => setT(+e.target.value)} style={{ flex: 1, maxWidth: 320 }} /></div>
        <div className="stack" style={{ margin: "14px 0", gap: 6 }}>
          {NEXT.map((n, i) => (
            <div key={n.tok} className="row" style={{ gap: 10 }}>
              <span className="mono" style={{ width: 90 }}>{n.tok}</span>
              <div className="meter" style={{ flex: 1, height: 14 }}><span style={{ width: `${probs[i] * 100}%`, background: i === 0 ? "var(--ink)" : "var(--muted)" }} /></div>
              <span className="mono" style={{ width: 52, textAlign: "right" }}>{(probs[i] * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
        <div className="row"><button className="btn primary sm" onClick={sample}>Sample 10</button><span className="tag">{tried.low ? "✓" : "○"} sampled at ≤ 0.4</span><span className="tag">{tried.high ? "✓" : "○"} sampled at ≥ 1.4</span></div>
        <div className="row" style={{ marginTop: 8 }}>{samples.length > 0 && <span className="mono" style={{ fontSize: ".85rem" }}>{samples.join(" · ")}</span>}</div>
        {samples.length > 0 && <p className="read" style={{ fontSize: ".95rem", marginTop: 10 }}><RichInline text={`Even the top choice, ${NEXT[0].tok}, is a [[w|guess]]: no report is in the context, and in this patient FLT3-ITD is actually gone at relapse. Low temperature repeats the guess; high temperature varies it. Neither makes it true. Try both ends, then sample again.`} /></p>}
      </LabCard>

      <LabCard title="C. Fact or fabrication?" done={p.includes(EV[2])} sub="Here is the QC report and the LLM's draft, sentence by sentence. Drag each sentence into the right bucket." right={<DragHint>Drag cards into buckets</DragHint>}>
        <div className="read" style={{ background: "var(--paper)", borderRadius: 10, padding: "12px 16px", fontSize: ".95rem", marginBottom: 14 }}><b>Source: variant report, AML-0412</b><br />{REPORT}</div>
        <SortIntoBuckets items={CLAIMS} buckets={[{ id: "sup", title: "✓ Supported by the report" }, { id: "fab", title: "✗ Not supported (hallucination)" }]}
          onSolved={n => { finishPart(ID, EV[2], EV, n === 1 ? 30 : 20); if (n === 1) earnBadge("fact-checker"); }} />
      </LabCard>
    </>
  );
}
