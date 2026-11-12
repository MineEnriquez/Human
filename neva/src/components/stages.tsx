import { useState } from "react";
import { AiOffNotice } from "./ConnectKey";
import { Link } from "react-router-dom";
import { Legend, Rich, RichInline } from "./Rich";
import type { Check, Lesson, Path, QuizQ } from "../content/paths";
import { stageRewards, totalXp, XP } from "../lib/rewards";
import { Avatar, DossierPanel } from "./Dossier";
import { postJson, useAi } from "../lib/ai";
import { award, completeStage, earnBadge, noteMisconception, recordBest, useProgress } from "../lib/progress";

// ------------------------------------------------------------------ Case brief
export function CaseBrief({ path, lesson, onNext }: { path: Path; lesson: Lesson; onNext: () => void }) {
  const ev = useProgress().lessons[lesson.id]?.evidence || [];
  const b = lesson.brief;
  const rewards = stageRewards(lesson);
  const STAGE_NAMES: Record<string, string> = { brief: "Case file", lecture: lesson.boss ? "Briefing" : "Lecture", lab: lesson.boss ? lesson.title : "Lab", seminar: "Seminar", quiz: "Quiz", debrief: "Debrief" };
  return (
    <div className="stack" style={{ gap: 18 }}>
      {lesson.hook && (
        <div className="hook"><span className="avatar bot" role="img" aria-label="Otto" /><div><div className="who" style={{ marginBottom: 2 }}>Otto opens the case</div><Rich text={`"${lesson.hook}"`} /></div></div>
      )}
      <div className="casefile">
        <div className="casefile-h"><b>Case file {String(lesson.n).padStart(2, "0")}: {lesson.caseTitle}</b><span className="row" style={{ gap: 10 }}>{b.when && <span className="deadline">🕑 {b.when}</span>}<span className="stamp">CONFIDENTIAL · FICTIONAL</span></span></div>
        <div className="casefile-b">
          <div className="stack">
            {b.from && (
              <div className="scene">
                <Avatar name={b.from.name} />
                <div><div><b>{b.from.name}</b> <span className="muted">· {b.from.role}</span></div><p className="read" style={{ margin: "4px 0 0", fontStyle: "italic" }}>"{b.from.ask}"</p></div>
              </div>
            )}
            <div><div className="eyebrow">Your role</div><b>{b.role}</b></div>
            <Rich text={b.situation} />
            <div style={{ borderLeft: "4px solid var(--yellow)", paddingLeft: 14 }}><div className="eyebrow">The question you must answer</div><Rich text={`**${b.question}**`} /></div>
            {b.deliverable && (
              <div className="deliverable">
                <div className="eyebrow">What you hand over</div>
                <Rich text={b.deliverable} />
                {b.success && <><div className="eyebrow" style={{ marginTop: 8 }}>How you'll be judged</div><ul className="read" style={{ fontSize: ".95rem", margin: "4px 0 0" }}>{b.success.map(x => <li key={x}><RichInline text={x} /></li>)}</ul></>}
              </div>
            )}
          </div>
          <div className="stack">
            <div className="objectives"><b>By the end you will be able to</b><ol>{b.objectives.map(o => <li key={o}><RichInline text={o} /></li>)}</ol></div>
            <div><div className="eyebrow" style={{ marginBottom: 8 }}>Evidence to collect</div><div className="evidence">{b.evidence.map(e => <span key={e} className={`ev ${ev.includes(e) ? "got" : ""}`}>{ev.includes(e) ? "✓ " : "○ "}{e}</span>)}</div></div>
            <div className="missions">
              <div className="eyebrow" style={{ marginBottom: 6 }}>Missions & rewards · up to {totalXp(lesson)} XP</div>
              {Object.entries(rewards).map(([id, r]) => <div key={id} className="mission"><span>{STAGE_NAMES[id]}<small>{r!.how}</small></span><b className="mono">+{r!.xp}</b></div>)}
            </div>
          </div>
        </div>
      </div>
      {path.dossier && <DossierPanel path={path} dossier={path.dossier} current={lesson.id} open={false} />}
      <Legend />
      <div><button className="btn primary" onClick={() => { completeStage(lesson.id, "brief"); award(`${lesson.id}:brief`, XP.brief, "Case opened"); earnBadge("first-case"); onNext(); }}>Accept the case →</button></div>
    </div>
  );
}

// ------------------------------------------------------------------ Cold call: Otto asks you about a segment (AI)
type ColdQ = { question: string; rubric: string[] };
function ColdCall({ pathId, lesson, index }: { pathId: string; lesson: Lesson; index: number }) {
  const aiOn = useAi();
  const seg = lesson.lecture[index];
  const [q, setQ] = useState<ColdQ | null>(null);
  const [answer, setAnswer] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!aiOn) return null;
  const ask = async () => {
    setBusy(true); setErr("");
    try { setQ(await postJson<ColdQ>("/api/coldcall", { path: pathId, lesson: lesson.title, caseTitle: lesson.caseTitle, segmentTitle: seg.title, segmentBody: seg.body })); }
    catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  const submit = async () => {
    if (!q) return;
    setBusy(true); setErr("");
    try {
      const g = await postJson<Grade>("/api/grade", { path: pathId, lesson: lesson.title, question: q.question, rubric: q.rubric, answer });
      setGrade(g); noteMisconception(g.misconception);
      for (let p = 1; p <= g.score; p++) award(`${lesson.id}:cold${index}:${p}`, XP.coldCallPoint, `Cold call point ${p}/3`);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  if (!q) return <button className="btn sm" style={{ marginTop: 10 }} onClick={ask} disabled={busy}>{busy ? "Otto is choosing a question…" : `🎯 Take the cold call (up to +${3 * XP.coldCallPoint} XP)`}</button>;
  return (
    <div className="coldcall">
      <div className="who"><span className="avatar bot" role="img" aria-label="Otto" />Otto, cold-calling you</div>
      <Rich text={`**${q.question}**`} />
      {!grade && <>
        <textarea className="answer" style={{ minHeight: 90 }} value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Answer in 2-4 sentences, as you would in class…" aria-label="Your answer to the cold call" />
        <button className="btn yellow sm" onClick={submit} disabled={busy || answer.trim().length < 20}>{busy ? "Grading…" : "Answer"}</button>
      </>}
      {grade && <div className="grade" style={{ marginTop: 8 }}><div className="pts">{grade.score}/3 · {grade.verdict}</div><Rich text={`**What worked:** ${grade.strengths}${grade.gap ? `\n\n**What's missing:** ${grade.gap}` : ""}\n\n**Follow-up:** ${grade.nudge}`} /></div>}
      {err && <div className="banner err">{err}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ Lecture with checks for understanding
function CheckQ({ c, onAnswered }: { c: Check; onAnswered: (right: boolean) => void }) {
  const [pick, setPick] = useState<number | null>(null);
  return (
    <div className="check">
      <div className="q">✋ Check: <RichInline text={c.q} /></div>
      <div className="opts">{c.options.map((o, i) => (
        <button key={i} className={`opt ${pick !== null && i === c.answer ? "right" : ""} ${pick === i && i !== c.answer ? "wrong" : ""}`} disabled={pick !== null} onClick={() => { setPick(i); onAnswered(i === c.answer); }}><RichInline text={o} /></button>
      ))}</div>
      {pick !== null && <div className={`feedback ${pick === c.answer ? "good" : "bad"}`}><RichInline text={(pick === c.answer ? "Right. " : "Not quite. ") + c.explain} /></div>}
    </div>
  );
}
export function Lecture({ pathId, lesson, onNext, onAsk }: { pathId: string; lesson: Lesson; onNext: () => void; onAsk: (q: string) => void }) {
  const checks = lesson.lecture.filter(s => s.check).length;
  const [answered, setAnswered] = useState(0);
  const done = answered >= checks;
  return (
    <div>
      {lesson.lecture.map((s, i) => (
        <div key={i} className="segment">
          <h3>{s.title}</h3>
          <Rich text={s.body} />
          {s.refs && s.refs.length > 0 && (
            <div className="refs">
              <div className="eyebrow">Further reading</div>
              <ul>{s.refs.map(r => <li key={r.url}><a href={r.url} target="_blank" rel="noopener noreferrer">{r.title}</a> <span className="muted">· {r.publisher}</span></li>)}</ul>
            </div>
          )}
          {s.check && <CheckQ c={s.check} onAnswered={right => { setAnswered(n => n + 1); if (right) award(`${lesson.id}:check${i}`, XP.check, "Check passed"); }} />}
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => onAsk(`Can you explain "${s.title.replace(/^\d+\.\s*/, "")}" another way, using the case?`)}>🎓 Ask Otto about this</button>
          </div>
          <ColdCall pathId={pathId} lesson={lesson} index={i} />
        </div>
      ))}
      <button className="btn primary" disabled={!done} onClick={() => { completeStage(lesson.id, "lecture"); award(`${lesson.id}:lecture`, XP.lecture, "Lecture complete"); onNext(); }}>{done ? "To the lab →" : `Answer the ${checks - answered} remaining check${checks - answered > 1 ? "s" : ""} to continue`}</button>
    </div>
  );
}

// ------------------------------------------------------------------ Seminar (AI-graded open answer)
type Grade = { score: number; verdict: string; strengths: string; gap: string; nudge: string; misconception: string | null };
export function Seminar({ pathId, lesson, onNext }: { pathId: string; lesson: Lesson; onNext: () => void }) {
  const aiOn = useAi();
  const best = useProgress().lessons[lesson.id]?.seminarBest;
  const [answer, setAnswer] = useState("");
  const [grade, setGrade] = useState<Grade | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [tries, setTries] = useState(0);
  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const g = await postJson<Grade>("/api/grade", { path: pathId, lesson: lesson.title, question: lesson.seminar.question, rubric: lesson.seminar.rubric, answer });
      setGrade(g); setTries(t => t + 1);
      noteMisconception(g.misconception);
      recordBest(lesson.id, "seminarBest", g.score);
      for (let s = 1; s <= g.score; s++) award(`${lesson.id}:seminar:${s}`, 15, `Seminar point ${s}/3`);
      if (g.score >= 2) completeStage(lesson.id, "seminar");
      if (g.score === 3) earnBadge("seminar");
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="check" style={{ background: "var(--yellow-soft)" }}><div className="eyebrow">Seminar question</div><Rich text={`**${lesson.seminar.question}**`} /></div>
      <p className="muted" style={{ margin: 0 }}>Answer in your own words, like you would in a seminar. Otto grades against a 3-point rubric; 2+ points completes the stage, and each point earns XP once. {best != null && `Your best so far: ${best}/3.`}</p>
      {aiOn === false && <AiOffNotice what="Seminar grading (you can skip to the quiz)" />}
      <textarea className="answer" value={answer} onChange={e => setAnswer(e.target.value)} placeholder="Your answer…" aria-label="Your seminar answer" />
      <div className="row">
        <button className="btn yellow" onClick={submit} disabled={busy || answer.trim().length < 30 || !aiOn}>{busy ? "Grading…" : tries ? "Revise and resubmit" : "Submit to Otto"}</button>
        {(grade && grade.score >= 2) || aiOn === false ? <button className="btn primary" onClick={onNext}>To the quiz →</button> : null}
      </div>
      {err && <div className="banner err">{err}</div>}
      {grade && (
        <div className="grade">
          <div className="row" style={{ justifyContent: "space-between" }}><div className="pts">{grade.score}/3 · {grade.verdict}</div><div className="row" style={{ gap: 4 }}>{[1, 2, 3].map(i => <span key={i} style={{ fontSize: "1.4rem", opacity: i <= grade.score ? 1 : 0.2 }}>★</span>)}</div></div>
          <Rich text={`**What worked:** ${grade.strengths}${grade.gap ? `\n\n**What's missing:** ${grade.gap}` : ""}\n\n**Think about this:** ${grade.nudge}`} />
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Quiz (static + AI-generated)
export function Quiz({ pathId, lesson, onNext }: { pathId: string; lesson: Lesson; onNext: () => void }) {
  const aiOn = useAi();
  const [qs, setQs] = useState<QuizQ[]>(lesson.quiz);
  const [picks, setPicks] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const base = lesson.quiz.length;
  const answeredBase = Object.keys(picks).filter(k => +k < base).length;
  const correctBase = lesson.quiz.filter((q, i) => picks[i] === q.answer).length;
  const pick = (i: number, o: number) => {
    if (picks[i] !== undefined) return;
    const next = { ...picks, [i]: o };
    setPicks(next);
    if (o === qs[i].answer) award(`${lesson.id}:quiz:${i < base ? i : qs[i].q.slice(0, 40)}`, i < base ? 10 : 20, i < base ? "Correct" : "Challenge question");
    const ab = Object.keys(next).filter(k => +k < base);
    if (ab.length === base) {
      const c = lesson.quiz.filter((q, j) => next[j] === q.answer).length;
      recordBest(lesson.id, "quizBest", c);
      completeStage(lesson.id, "quiz");
      if (c === base) earnBadge("perfect");
    }
  };
  const more = async () => {
    setBusy(true); setErr("");
    try {
      const q = await postJson<{ question: string; options: string[]; answer: number; explanation: string }>("/api/quiz", { path: pathId, lesson: lesson.title, summary: lesson.summary, avoid: qs.map(x => x.q), difficulty: "challenge" });
      setQs(x => [...x, { q: q.question, options: q.options, answer: q.answer, explain: q.explanation }]);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  return (
    <div className="stack" style={{ gap: 16 }}>
      {qs.map((q, i) => (
        <div key={i} className="check">
          <div className="q">{i < base ? `Q${i + 1}.` : "★ Challenge."} <RichInline text={q.q} /></div>
          <div className="opts">{q.options.map((o, j) => (
            <button key={j} className={`opt ${picks[i] !== undefined && j === q.answer ? "right" : ""} ${picks[i] === j && j !== q.answer ? "wrong" : ""}`} disabled={picks[i] !== undefined} onClick={() => pick(i, j)}><RichInline text={o} /></button>
          ))}</div>
          {picks[i] !== undefined && <div className={`feedback ${picks[i] === q.answer ? "good" : "bad"}`}><RichInline text={(picks[i] === q.answer ? "Correct. " : "Not this time. ") + q.explain} /></div>}
        </div>
      ))}
      {answeredBase === base && <div className="banner warn"><b>{correctBase}/{base}</b> on the core questions. {correctBase === base ? "Perfect recall." : "Review the explanations above, then try a challenge question."}</div>}
      {err && <div className="banner err">{err}</div>}
      <div className="row">
        {aiOn && <button className="btn" onClick={more} disabled={busy}>{busy ? "Writing a new question…" : "✨ Otto, give me a challenge question (+20 XP)"}</button>}
        {answeredBase === base && <button className="btn primary" onClick={onNext}>To the debrief →</button>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Debrief
export function Debrief({ lesson, nextHref, onAsk }: { lesson: Lesson; nextHref: string | null; onAsk: (q: string) => void }) {
  const p = useProgress().lessons[lesson.id];
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="casefile">
        <div className="casefile-h"><b>Debrief: {lesson.caseTitle}</b><span className="stamp">{p?.stages.lab ? "CASE ADVANCED" : "IN PROGRESS"}</span></div>
        <div className="casefile-b" style={{ gridTemplateColumns: "1fr" }}>
          <div><div className="eyebrow">The question was</div><Rich text={`**${lesson.brief.question}**`} /></div>
          <div><div className="eyebrow">What a professor wants you to leave with</div><Rich text={lesson.takeaways.map(t => "- " + t).join("\n")} /></div>
          <div className="row">
            {p?.seminarBest != null && <span className="tag">Seminar best: {p.seminarBest}/{lesson.boss ? 10 : 3}</span>}
            {p?.quizBest != null && <span className="tag">Quiz best: {p.quizBest}/{lesson.quiz.length}</span>}
            <span className="tag">Evidence: {p?.evidence.length || 0}/{lesson.brief.evidence.length}</span>
          </div>
        </div>
      </div>
      <div className="row">
        <button className="btn" onClick={() => onAsk("Summarise what I should take away from this case, then ask me one question to test it.")}>🎓 Exit interview with Otto</button>
        <button className="btn primary" onClick={() => { completeStage(lesson.id, "debrief"); award(`${lesson.id}:debrief`, 15, "Debrief complete"); }}>Mark debrief done (+15 XP)</button>
        {nextHref && <Link className="btn yellow" to={nextHref}>Next case →</Link>}
      </div>
    </div>
  );
}
