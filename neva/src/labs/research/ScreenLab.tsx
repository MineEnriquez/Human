import { useState } from "react";
import { AiOffNotice } from "../../components/ConnectKey";
import { BucketBoard, DragHint, SortableSequence } from "../../components/dnd";
import { RichInline } from "../../components/Rich";
import { CRITERIA, KEY, STUDIES, cohenKappa, kappaLabel } from "../../content/research/papers";
import { postJson, useAi } from "../../lib/ai";
import { earnBadge, useProgress } from "../../lib/progress";
import { finishPart, LabCard } from "../common";

const ID = "ri-llm";
export const EVIDENCE = ["Abstracts screened", "Second reviewer compared", "PRISMA flow ordered"];
const SAMPLE = ["MS-01", "MS-03", "MS-05", "MS-09", "MS-10", "MS-11", "MS-14", "MS-18"];
const sample = SAMPLE.map(id => STUDIES.find(s => s.id === id)!);
const keyOf = (id: string) => (KEY.included.includes(id) ? "include" : "exclude");
type Decision = { id: string; decision: "include" | "exclude" | "unsure"; criterion: string; reason: string };

const PRISMA = [
  { id: "f1", label: "**Identify** records by searching databases and registers", why: "The flow diagram starts with the number of records found per source." },
  { id: "f2", label: "**Remove** duplicate records before screening", why: "Duplicates (and any records removed by automation tools) are counted and removed." },
  { id: "f3", label: "**Screen** titles and abstracts; exclude clearly ineligible records", why: "Two reviewers independently; inclusive when unsure. AI tools used here must be reported." },
  { id: "f4", label: "**Retrieve** full-text reports of the remaining records", why: "Reports that can't be retrieved are counted." },
  { id: "f5", label: "**Assess** full texts for eligibility, recording a reason for each exclusion", why: "PRISMA 2020 asks for the reasons reports were excluded at this stage." },
  { id: "f6", label: "**Include** studies, linking multiple reports of the same study", why: "The diagram ends with the studies (and reports) included in the review." },
];

const fmt = (k: number) => (Number.isFinite(k) ? k.toFixed(2) : "–");

export default function ScreenLab() {
  const ev = useProgress().lessons[ID]?.evidence || [];
  const aiOn = useAi();
  const [place, setPlace] = useState<Record<string, string>>({});
  const [claude, setClaude] = useState<Decision[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [useKey, setUseKey] = useState(false);
  const placed = SAMPLE.filter(id => place[id] && place[id] !== "tray").length;
  const mine = SAMPLE.map(id => place[id] || "tray");

  const onPlace = (p: Record<string, string>) => {
    setPlace(p);
    setClaude(null); setUseKey(false);
    if (SAMPLE.every(id => p[id] && p[id] !== "tray")) finishPart(ID, EVIDENCE[0], EVIDENCE);
  };
  const compare = async () => {
    setBusy(true); setErr("");
    try {
      const r = await postJson<{ decisions: Decision[] }>("/api/screen", { path: "research-intelligence", criteria: CRITERIA, abstracts: sample.map(s => ({ id: s.id, text: `${s.title}. ${s.abstract}` })) });
      const byId = new Map(r.decisions.map(d => [d.id, d]));
      const ds = SAMPLE.map(id => byId.get(id) || { id, decision: "unsure" as const, criterion: "-", reason: "No decision returned." });
      setClaude(ds);
      finishPart(ID, EVIDENCE[1], EVIDENCE);
      const k = cohenKappa(mine, ds.map(d => d.decision));
      if (k > 0.6) earnBadge("second-reviewer");
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  const compareKey = () => { setUseKey(true); finishPart(ID, EVIDENCE[1], EVIDENCE); };

  const kYouKey = placed === SAMPLE.length ? cohenKappa(mine, SAMPLE.map(keyOf)) : NaN;
  const kYouAi = claude ? cohenKappa(mine, claude.map(d => d.decision)) : NaN;
  const kAiKey = claude ? cohenKappa(claude.map(d => d.decision), SAMPLE.map(keyOf)) : NaN;
  const missed = (labels: string[]) => SAMPLE.filter((id, i) => keyOf(id) === "include" && labels[i] === "exclude");

  return (
    <>
      <LabCard title="A. Screen eight abstracts yourself" done={ev.includes(EVIDENCE[0])} sub="Apply the criteria below. Drag each record into include, exclude or unsure. Decide before you see anyone else's answer." right={<DragHint>Drag records into buckets</DragHint>}>
        <details className="read" style={{ background: "var(--paper)", borderRadius: 10, padding: "10px 14px", fontSize: ".92rem", marginBottom: 12 }} open>
          <summary><b>Eligibility criteria</b></summary>
          <div style={{ whiteSpace: "pre-wrap", marginTop: 6 }}>{CRITERIA}</div>
        </details>
        <BucketBoard items={sample} columns={3} value={place} onChange={onPlace} trayLabel="Records to screen"
          buckets={[{ id: "include", title: "Include" }, { id: "exclude", title: "Exclude" }, { id: "unsure", title: "Unsure → full text" }]}
          render={s => (
            <details style={{ fontSize: ".84rem", maxWidth: 420 }} onPointerDown={e => e.stopPropagation()}>
              <summary style={{ cursor: "pointer" }}><b>{s.id}</b> {s.title}</summary>
              <div className="muted" style={{ marginTop: 6 }}>{s.abstract}</div>
            </details>
          )} />
        <p className="muted" style={{ fontSize: ".85rem" }}>Tip: click a card's title to read its abstract; drag it by the ⋮⋮ grip. {placed}/{SAMPLE.length} placed.</p>
      </LabCard>

      <LabCard title="B. Compare with a second reviewer" done={ev.includes(EVIDENCE[1])} sub={<RichInline text="Claude screens the same eight abstracts independently with [[c|structured outputs]] (decision, criterion, reason). Then you'll measure agreement with [[c|Cohen's kappa]]." />}>
        {aiOn === false && <AiOffNotice what="Comparing with Claude" />}
        <div className="row">
          <button className="btn yellow" onClick={compare} disabled={busy || placed < SAMPLE.length || !aiOn}>{busy ? "Claude is screening…" : "Compare with Claude"}</button>
          {aiOn === false && <button className="btn" onClick={compareKey} disabled={placed < SAMPLE.length}>Compare with the answer key</button>}
          {placed < SAMPLE.length && <span className="muted" style={{ fontSize: ".85rem" }}>Place all eight records first.</span>}
        </div>
        {err && <div className="banner err" style={{ marginTop: 10 }}>{err}</div>}
        {(claude || useKey) && (
          <div className="scroll-x" style={{ marginTop: 14 }}>
            <table className="t">
              <thead><tr><th>record</th><th>you</th>{claude && <th>Claude</th>}{claude && <th>Claude's reason</th>}<th>answer key</th></tr></thead>
              <tbody>{SAMPLE.map((id, i) => {
                const c = claude?.[i];
                const k = keyOf(id);
                return (
                  <tr key={id}>
                    <td><b>{id}</b></td>
                    <td style={{ color: mine[i] === k ? "var(--ok)" : "var(--bad)", fontWeight: 600 }}>{mine[i]}</td>
                    {c && <td style={{ color: c.decision === k ? "var(--ok)" : "var(--bad)", fontWeight: 600 }}>{c.decision}</td>}
                    {c && <td style={{ fontSize: ".82rem" }}><b>{c.criterion}:</b> {c.reason}</td>}
                    <td>{k}{k === "exclude" ? <span className="muted" style={{ fontSize: ".8rem" }}> ({KEY.excluded[id]?.fails})</span> : null}</td>
                  </tr>
                );
              })}</tbody>
            </table>
            <div className="row" style={{ marginTop: 12 }}>
              {claude && <span className="tag">κ you vs Claude = <b>{fmt(kYouAi)}</b> ({kappaLabel(kYouAi)})</span>}
              {claude && <span className="tag">κ Claude vs key = <b>{fmt(kAiKey)}</b></span>}
              <span className="tag">κ you vs key = <b>{fmt(kYouKey)}</b></span>
              {claude && kYouAi > 0.6 && <span className="tag live">🧾 Substantial agreement</span>}
            </div>
            <p className="read" style={{ fontSize: ".95rem", marginTop: 10 }}>
              <RichInline text={`Eligible studies you excluded: **${missed(mine).join(", ") || "none"}**${claude ? `. Eligible studies Claude excluded: **${missed(claude.map(d => d.decision)).join(", ") || "none"}**` : ""}. That's the error that matters most. "Unsure" counts as disagreement in kappa here, but in a real screen it sends the record to full-text review, which is the safe choice.`} />
            </p>
          </div>
        )}
      </LabCard>

      <LabCard title="C. Where screening sits: the PRISMA 2020 flow" done={ev.includes(EVIDENCE[2])} sub="Order the stages a record passes through, from search to inclusion." right={<DragHint />}>
        <SortableSequence items={PRISMA} seed={3} onSolved={() => finishPart(ID, EVIDENCE[2], EVIDENCE)} />
      </LabCard>
    </>
  );
}
