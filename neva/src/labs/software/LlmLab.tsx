import { useMemo, useState } from "react";
import { DragHint, SortIntoBuckets } from "../../components/dnd";
import { RichInline } from "../../components/Rich";
import { LEDGER_DOCS, PR_CLAIMS, PR_SOURCE } from "../../content/software/data";
import { earnBadge, useProgress } from "../../lib/progress";
import { finishPart, LabCard } from "../common";

const ID = "se-llm";
const EV = ["Tokenizer trace", "Temperature experiment", "PR claims checked"];

// Illustrative tokenizer for code: keywords and common words stay whole; identifiers split at
// underscores, dots and case changes, then into short pieces. Real tokenizers differ by model.
const COMMON = new Set("def return if else for in import from class async await const let var function true false none null self this the a to of and is with new".split(" "));
type Tok = { t: string; kind: "word" | "piece" | "punct" | "num" };
function tokenizeIllustrative(text: string): Tok[] {
  const out: Tok[] = [];
  for (const raw of text.match(/[A-Za-z]+[A-Za-z0-9]*|[0-9]+|[^\sA-Za-z0-9]/g) || []) {
    if (/^[0-9]+$/.test(raw)) { out.push({ t: raw, kind: "num" }); continue; }
    if (/^[^A-Za-z0-9]$/.test(raw)) { out.push({ t: raw, kind: "punct" }); continue; }
    if (COMMON.has(raw.toLowerCase())) { out.push({ t: raw, kind: "word" }); continue; }
    for (const part of raw.match(/[a-z]+|[A-Z][a-z]*|[A-Z]+(?![a-z])|[0-9]+/g) || [raw]) {
      if (part.length <= 4) out.push({ t: part, kind: "piece" });
      else for (let i = 0; i < part.length; i += 4) out.push({ t: part.slice(i, i + 4), kind: "piece" });
    }
  }
  return out;
}

// Next identifier after `ledger.` with no docs in the context: illustrative probabilities from patterns in other
// libraries. Each identifier is shown as one choice for simplicity; in reality it is several tokens.
const NEXT = [
  { tok: "post_entry", logit: 2.6, real: true }, { tok: "transfer", logit: 2.3, real: false }, { tok: "get_balance", logit: 2.0, real: true },
  { tok: "transfer_atomic", logit: 1.8, real: false }, { tok: "commit", logit: 0.9, real: false },
];
const softmax = (T: number) => { const e = NEXT.map(n => Math.exp(n.logit / Math.max(T, 0.05))); const s = e.reduce((a, b) => a + b, 0); return e.map(x => x / s); };

export default function LlmLab() {
  const p = useProgress().lessons[ID]?.evidence || [];
  const [text, setText] = useState("ledger.transfer_atomic(fromAccount, toAccount, amount_cents) # LEDGER_TIMEOUT_MS=5");
  const toks = useMemo(() => tokenizeIllustrative(text), [text]);
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
  const invented = samples.filter(s => !NEXT.find(n => n.tok === s)!.real).length;

  return (
    <>
      <LabCard title="A. Tokenizer bench" done={p.includes(EV[0])} sub="Type any code. This tokenizer is illustrative (real ones differ by model), but the pattern is the same: keywords stay whole, identifiers shatter.">
        <input className="field mono" value={text} onChange={e => setText(e.target.value)} aria-label="Code to tokenize" />
        <div className="row" style={{ margin: "12px 0", gap: 6 }}>
          {toks.map((t, i) => <span key={i} className={`k ${t.kind === "word" ? "k-c" : t.kind === "num" ? "k-b" : t.kind === "piece" ? "k-w" : ""}`} style={{ fontFamily: "var(--font-mono)" }}>{t.t}</span>)}
        </div>
        <p className="muted" style={{ fontSize: ".88rem" }}><span className="k k-c">keyword / common word</span> <span className="k k-w">fragment of an identifier</span> <span className="k k-b">number</span> · {toks.length} tokens. Notice how `transfer_atomic` and `LEDGER_TIMEOUT_MS` become several separate predictions.</p>
        <button className="btn sm" onClick={() => finishPart(ID, EV[0], EV)} disabled={p.includes(EV[0])}>{p.includes(EV[0]) ? "Logged ✓" : "Log this trace as evidence"}</button>
      </LabCard>

      <LabCard title="B. Temperature experiment" done={p.includes(EV[1])} sub={<>Completion after <code>ledger.</code> with <b>no docs in the context</b>. Change the temperature and sample 10 completions. Grey bars are functions that <b>don't exist</b> in ledgerkit v2.4.</>}>
        <div className="row"><label htmlFor="temp" className="muted">Temperature {T.toFixed(2)}</label><input id="temp" type="range" min={0.05} max={2} step={0.05} value={T} onChange={e => setT(+e.target.value)} style={{ flex: 1, maxWidth: 320 }} /></div>
        <div className="stack" style={{ margin: "14px 0", gap: 6 }}>
          {NEXT.map((n, i) => (
            <div key={n.tok} className="row" style={{ gap: 10 }}>
              <span className="mono" style={{ width: 130 }}>{n.tok}{n.real ? "" : " ✗"}</span>
              <div className="meter" style={{ flex: 1, height: 14 }}><span style={{ width: `${probs[i] * 100}%`, background: n.real ? "var(--ink)" : "var(--muted)" }} /></div>
              <span className="mono" style={{ width: 52, textAlign: "right" }}>{(probs[i] * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
        <div className="row"><button className="btn primary sm" onClick={sample}>Sample 10</button><span className="tag">{tried.low ? "✓" : "○"} sampled at ≤ 0.4</span><span className="tag">{tried.high ? "✓" : "○"} sampled at ≥ 1.4</span></div>
        <div className="row" style={{ marginTop: 8 }}>{samples.length > 0 && <span className="mono" style={{ fontSize: ".85rem" }}>{samples.join(" · ")}</span>}</div>
        {samples.length > 0 && <p className="read" style={{ fontSize: ".95rem", marginTop: 10 }}><RichInline text={`${invented} of 10 completions call a function that doesn't exist. Without the docs in context, [[w|invented APIs are ordinary likely continuations]]. Low temperature makes the top guess repeatable; high temperature makes rarer guesses (often invented ones) more frequent. Neither checks the library. Try both ends.`} /></p>}
      </LabCard>

      <LabCard title="C. Check the PR description" done={p.includes(EV[2])} sub="The assistant's PR description, claim by claim. Check each one against the library docs, the diff and CI, then drag it into the right bucket." right={<DragHint>Drag cards into buckets</DragHint>}>
        <div className="read" style={{ background: "var(--paper)", borderRadius: 10, padding: "12px 16px", fontSize: ".93rem", marginBottom: 10 }}><b>Docs: ledgerkit v2.4 (fictional)</b><br />{LEDGER_DOCS}</div>
        <div className="read" style={{ background: "var(--paper)", borderRadius: 10, padding: "12px 16px", fontSize: ".93rem", marginBottom: 14 }}><b>Diff and CI: PR #482</b><br />{PR_SOURCE}</div>
        <SortIntoBuckets items={PR_CLAIMS} buckets={[{ id: "sup", title: "✓ Supported by the docs, diff or CI" }, { id: "fab", title: "✗ Invented or contradicted" }]}
          onSolved={n => { finishPart(ID, EV[2], EV, n === 1 ? 30 : 20); if (n === 1) earnBadge("fact-checker"); }} />
      </LabCard>
    </>
  );
}
