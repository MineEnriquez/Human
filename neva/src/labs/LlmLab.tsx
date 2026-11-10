import { useMemo, useState } from "react";
import { SortIntoBuckets, DragHint } from "../components/dnd";
import { RichInline } from "../components/Rich";
import { earnBadge, useProgress } from "../lib/progress";
import { finishPart, LabCard } from "./common";

const ID = "pg-llm";
const EV = ["Tokenizer trace", "Temperature experiment", "Fact-check of the draft"];

// Illustrative tokenizer: common words stay whole; rare strings split into short pieces; DNA becomes k-mers.
const COMMON = new Set("the a of and to in is was for on with by isolate isolates gene genes resistance sample samples report run coverage depth mean passed failed icu outbreak patient patients carries carry ward".split(" "));
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

const NEXT = [
  { tok: "blaKPC-3", logit: 3.1 }, { tok: "blaKPC-2", logit: 1.9 }, { tok: "blaNDM-1", logit: 1.5 }, { tok: "blaOXA-48", logit: 1.1 }, { tok: "mcr-1", logit: 0.1 },
];
const softmax = (T: number) => { const e = NEXT.map(n => Math.exp(n.logit / Math.max(T, 0.05))); const s = e.reduce((a, b) => a + b, 0); return e.map(x => x / s); };

const REPORT = `Run R-0319, 19 March 2026. 12 K. pneumoniae isolates sequenced on a short-read platform. 11 of 12 genomes passed QC (mean depth 55x-81x, no contamination). KP-07 reached 18x, below the 30x threshold; its typing (ST11, blaNDM-1) is provisional and it is queued for re-sequencing. Isolates KP-01 to KP-05, KP-08, KP-09, KP-11 and KP-12 are ST258 carrying blaKPC-3. KP-12 is an environmental isolate from the ICU bay 3 sink drain.`;

const CLAIMS = [
  { id: "c1", label: "11 of 12 genomes passed QC.", bucket: "sup", why: "Stated directly in the report." },
  { id: "c2", label: "All 12 genomes had a mean depth of at least 55x.", bucket: "fab", why: "KP-07 had 18x. The model smoothed over the exception." },
  { id: "c3", label: "KP-07's NDM-1 result confirms an NDM outbreak in the ICU.", bucket: "fab", why: "KP-07 failed QC, its typing is provisional, and one isolate can't confirm an outbreak." },
  { id: "c4", label: "KP-12 came from the ICU bay 3 sink drain.", bucket: "sup", why: "Stated in the report." },
  { id: "c5", label: "The sink drain was disinfected on 20 March.", bucket: "fab", why: "The report says nothing about disinfection. Plausible, unsupported." },
  { id: "c6", label: "Nine isolates are ST258 with blaKPC-3.", bucket: "sup", why: "KP-01..05, 08, 09, 11, 12 = nine isolates." },
  { id: "c7", label: "KP-07 will be re-sequenced.", bucket: "sup", why: "\"queued for re-sequencing\"." },
  { id: "c8", label: "The isolates were sequenced with long-read nanopore technology.", bucket: "fab", why: "The report says short-read." },
];

export default function LlmLab() {
  const p = useProgress().lessons[ID]?.evidence || [];
  const [text, setText] = useState("KP-07 carries blaNDM-1; KP-04 carries blaKPC-3. Read: ATGCGTACCGTTAGC");
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
        <p className="muted" style={{ fontSize: ".88rem" }}><span className="k k-c">whole word</span> <span className="k k-w">fragment of a rare string</span> <span className="k k-b">DNA k-mer</span>. Notice how gene names shatter into fragments.</p>
        <button className="btn sm" onClick={() => finishPart(ID, EV[0], EV)} disabled={p.includes(EV[0])}>{p.includes(EV[0]) ? "Logged ✓" : "Log this trace as evidence"}</button>
      </LabCard>

      <LabCard title="B. Temperature experiment" done={p.includes(EV[1])} sub={<>Prompt: <i>"The ICU isolates all carry the carbapenemase gene ___"</i>, with no report in the context. Change the temperature and sample 10 completions.</>}>
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
        {samples.length > 0 && <p className="read" style={{ fontSize: ".95rem", marginTop: 10 }}><RichInline text={`Even the top choice, ${NEXT[0].tok}, is a [[w|guess]]: no report is in the context. Low temperature repeats the guess; high temperature varies it. Neither makes it true. Try both ends, then sample again.`} /></p>}
      </LabCard>

      <LabCard title="C. Fact or fabrication?" done={p.includes(EV[2])} sub="Here is the QC report and the LLM's draft, sentence by sentence. Drag each sentence into the right bucket." right={<DragHint>Drag cards into buckets</DragHint>}>
        <div className="read" style={{ background: "var(--paper)", borderRadius: 10, padding: "12px 16px", fontSize: ".95rem", marginBottom: 14 }}><b>Source: QC report R-0319</b><br />{REPORT}</div>
        <SortIntoBuckets items={CLAIMS} buckets={[{ id: "sup", title: "✓ Supported by the report" }, { id: "fab", title: "✗ Not supported (hallucination)" }]}
          onSolved={n => { finishPart(ID, EV[2], EV, n === 1 ? 30 : 20); if (n === 1) earnBadge("fact-checker"); }} />
      </LabCard>
    </>
  );
}
