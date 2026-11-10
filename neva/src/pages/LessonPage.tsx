import { Suspense, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { askProfessor, ProfessorChat } from "../components/ProfessorChat";
import { CaseBrief, Debrief, Lecture, Quiz, Seminar } from "../components/stages";
import { findLesson, type Lesson, type Path } from "../content/paths";
import { LABS } from "../labs/registry";
import { stageRewards } from "../lib/rewards";
import { levelOf, lessonDone, useProgress, type StageId } from "../lib/progress";


const STAGES: { id: StageId; label: string; sub: string }[] = [
  { id: "brief", label: "Case file", sub: "The situation" },
  { id: "lecture", label: "Lecture", sub: "With checks" },
  { id: "lab", label: "Lab", sub: "Hands-on" },
  { id: "seminar", label: "Seminar", sub: "AI-graded" },
  { id: "quiz", label: "Quiz", sub: "Apply it" },
  { id: "debrief", label: "Debrief", sub: "Takeaways" },
];
const BOSS_STAGES: { id: StageId; label: string; sub: string }[] = [
  { id: "brief", label: "Case file", sub: "The situation" },
  { id: "lecture", label: "Briefing", sub: "From Otto" },
  { id: "lab", label: "Capstone", sub: "Investigate + report" },
  { id: "debrief", label: "Debrief", sub: "Takeaways" },
];

const plain = (t: string) => t.replace(/\[\[\w\|([^\]]+)\]\]/g, "$1").replace(/\*\*/g, "");
function lessonContext(p: Path, l: Lesson, level: string, misconceptions: string[]) {
  const b = l.brief;
  return [
    `Path: ${p.title} (${p.area}). ${p.setting}`,
    p.dossier ? `Case dossier: ${p.dossier.headline} ${plain(p.dossier.summary)} People: ${p.dossier.cast.map(c => `${c.name} (${c.role})`).join("; ")}. Deadline: ${p.dossier.deadline}.` : "",
    b.from ? `This case's scene (${b.when}): ${b.from.name}, ${b.from.role}, asks: "${b.from.ask}" Deliverable: ${b.deliverable} Judged on: ${(b.success || []).join("; ")}.` : "",
    `Lesson ${l.n}: ${l.title} (topic: ${l.topic}). Case: "${l.caseTitle}".`,
    `Situation: ${l.brief.situation.replace(/\[\[\w\|([^\]]+)\]\]/g, "$1")}`,
    `Case question: ${l.brief.question}`,
    `What the lesson teaches: ${l.summary}`,
    l.seminar.question ? `Seminar question (don't give the full answer away; coach): ${l.seminar.question}` : "",
    `Learner level: ${level}.`,
    misconceptions.length ? `Misconceptions this learner has shown before: ${misconceptions.join("; ")}.` : "No misconceptions recorded yet.",
  ].filter(Boolean).join("\n");
}

export function LessonPage() {
  const { id = "" } = useParams();
  const found = findLesson(id);
  const p = useProgress();
  const [stageSel, setStage] = useState<StageId | null>(null);
  const [drawer, setDrawer] = useState(false);
  const context = useMemo(() => (found ? lessonContext(found.path, found.lesson, levelOf(p.xp).title, p.misconceptions) : ""), [id]); // frozen per lesson visit // eslint-disable-line
  if (!found) return <div className="page"><h1>Case not found</h1><Link to="/">Home</Link></div>;
  const { path, lesson } = found;
  const idx = path.lessons.indexOf(lesson);
  const prev = path.lessons[idx - 1];
  const next = path.lessons[idx + 1];
  const unlocked = !prev || lessonDone(p, prev.id, prev.boss);
  const rewards = stageRewards(lesson);
  const stages = lesson.boss ? BOSS_STAGES.map(s => (s.id === "lab" ? { ...s, label: lesson.title } : s)) : STAGES;
  const st = p.lessons[lesson.id]?.stages || {};
  const stage = stageSel || stages.find(s => !st[s.id])?.id || "brief";
  const go = (s: StageId) => { setStage(s); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const nextOf = (s: StageId) => stages[Math.min(stages.findIndex(x => x.id === s) + 1, stages.length - 1)].id;
  const convoKey = `lesson:${lesson.id}`;
  const ask = (q: string) => { setDrawer(true); askProfessor(convoKey, context, q, `[Learner is on the ${stage} stage]`); };

  if (!unlocked) return (
    <div className="page"><div className="card pad stack" style={{ maxWidth: 640 }}>
      <div className="eyebrow">Locked</div><h1>{lesson.title}</h1>
      <p className="read">Finish <b>{prev!.caseTitle}</b> (lab, seminar and quiz) to open this case.</p>
      <div className="row"><Link className="btn primary" to={`/lesson/${prev!.id}`}>Go to {prev!.caseTitle} →</Link><Link className="btn" to={`/paths/${path.id}`}>Path map</Link></div>
    </div></div>
  );

  const Lab = LABS[lesson.lab];
  if (!Lab) return <div className="page"><h1>Lab "{lesson.lab}" is missing</h1></div>;
  return (
    <div className="page">
      <div className="row" style={{ marginBottom: 18, fontSize: ".9rem" }}><Link to={`/paths/${path.id}`} className="muted">← {path.title}</Link><span className="muted">/ Case {lesson.n} of {path.lessons.length}</span></div>
      <div className="lesson">
        <nav className="stepper" aria-label="Lesson stages">
          {stages.map((s, i) => (
            <button key={s.id} className={`step ${stage === s.id ? "on" : ""} ${st[s.id] ? "done" : ""}`} onClick={() => go(s.id)} aria-current={stage === s.id ? "step" : undefined}>
              <span className="dot">{st[s.id] ? "✓" : i + 1}</span><span>{s.label}<small>{s.sub}{rewards[s.id] ? ` · +${rewards[s.id]!.xp} XP` : ""}</small></span>
            </button>
          ))}
        </nav>
        <div className="lesson-main">
          <div className="lesson-title"><div className="eyebrow">{lesson.topic} · Case {lesson.n}: {lesson.caseTitle}</div><h1>{lesson.title}</h1></div>
          <section className="card pad">
            <div className="stage-h"><h2>{stages.find(s => s.id === stage)!.label}</h2>{stage === "lab" && <span className="muted" style={{ fontSize: ".9rem" }}>Collect every piece of evidence to complete the lab</span>}</div>
            {stage === "brief" && <CaseBrief path={path} lesson={lesson} onNext={() => go(nextOf("brief"))} />}
            {stage === "lecture" && <Lecture pathId={path.id} lesson={lesson} onNext={() => go(nextOf("lecture"))} onAsk={ask} />}
            {stage === "lab" && <Suspense fallback={<p className="thinking">Loading the lab…</p>}><Lab /></Suspense>}
            {stage === "lab" && !lesson.boss && <div className="row" style={{ marginTop: 18 }}><button className="btn primary" disabled={!st.lab} onClick={() => go("seminar")}>{st.lab ? "To the seminar →" : "Finish all lab parts to continue"}</button></div>}
            {stage === "seminar" && <Seminar pathId={path.id} lesson={lesson} onNext={() => go("quiz")} />}
            {stage === "quiz" && <Quiz pathId={path.id} lesson={lesson} onNext={() => go("debrief")} />}
            {stage === "debrief" && <Debrief lesson={lesson} nextHref={next && lessonDone(p, lesson.id, lesson.boss) ? `/lesson/${next.id}` : null} onAsk={ask} />}
          </section>
        </div>
      </div>

      {!drawer && <button className="prof-fab" onClick={() => setDrawer(true)}><span className="avatar bot" role="img" aria-label="Otto" />Ask Otto</button>}
      {drawer && (
        <aside className="drawer" aria-label="Otto">
          <div className="drawer-h"><div className="who" style={{ margin: 0 }}><span className="avatar bot" role="img" aria-label="Otto" /><div><b>Otto</b><div className="muted" style={{ fontWeight: 500 }}>Office hours · {lesson.caseTitle}</div></div></div><button className="btn sm ghost" onClick={() => setDrawer(false)} aria-label="Close">✕</button></div>
          <div className="drawer-b">
            <ProfessorChat convoKey={convoKey} context={context} note={`[Learner is on the ${stage} stage]`}
              intro={`We're on **${lesson.caseTitle}**. Ask about anything in the case, or explain an idea back to me and I'll tell you where it holds and where it doesn't.`}
              starters={["Explain this lesson like I know the science but am new to AI", "Quiz me with one question", "What's the most common mistake here?", "How does this show up in a real lab?"]} />
          </div>
        </aside>
      )}
    </div>
  );
}
