import { Link } from "react-router-dom";
import { Legend, RichInline } from "../components/Rich";
import { PATHS } from "../content/paths";
import { lessonDone, useProgress } from "../lib/progress";

export function Home() {
  const p = useProgress();
  const live = PATHS[0];
  const done = live.lessons.filter(l => lessonDone(p, l.id, l.boss)).length;
  const next = live.lessons.find(l => !lessonDone(p, l.id, l.boss)) || live.lessons[0];
  return (
    <>
      <section className="hero">
        <div className="hero-in">
          <div>
            <div className="eyebrow" style={{ color: "var(--on-band-muted)" }}>AI for the life sciences</div>
            <h1>Learn AI by <em>solving real cases</em>.</h1>
            <p className="lede">LLMs, vector databases, retrieval-augmented generation and MCP, taught by an AI professor through casework in genomics, disease modeling and research.</p>
            <div className="row">
              <Link className="btn yellow" to={`/lesson/${next.id}`}>{done ? "Continue your case" : "Open your first case"} →</Link>
              <Link className="btn" style={{ background: "transparent", color: "var(--on-band)", borderColor: "var(--on-band)" }} to="/paths/cancer-genomics">See the path</Link>
            </div>
            <div className="stat-row">
              <div><b>3</b>paths</div><div><b>5</b>cases per path</div><div><b>6</b>AI features</div><div><b>{p.xp}</b>your XP</div>
            </div>
          </div>
          <div className="hero-card">
            <div className="who" style={{ color: "var(--on-band)" }}><span className="avatar bot" role="img" aria-label="Professor Neva" />Professor Neva</div>
            <p className="q">"A relapse cell's nearest neighbours in the reference atlas are normal myeloid progenitors. Your colleague calls it a healthy cell. <b>What would you check before you agree?</b>"</p>
            <p style={{ color: "var(--on-band-muted)", fontSize: ".9rem", margin: 0 }}>Socratic tutoring, AI-graded seminars, live tool-using agents, and answers that cite their sources.</p>
          </div>
        </div>
      </section>

      <div className="page">
        <div className="section-h"><h2>Choose a path</h2><Legend /></div>
        <div className="grid paths">
          {PATHS.map(path => {
            const n = path.lessons.filter(l => lessonDone(p, l.id, l.boss)).length;
            const inner = (
              <>
                <span className="band" style={{ background: path.color }} />
                <div className="row" style={{ justifyContent: "space-between" }}><span className="eyebrow">{path.area}</span>{path.status === "live" ? <span className="tag live">● Open</span> : <span className="tag soon">Coming next</span>}</div>
                <h3>{path.title}</h3>
                <p>{path.tagline}</p>
                <ul>{path.cases.map(c => <li key={c}>{c}</li>)}</ul>
                <div className="foot">
                  {path.status === "live" ? <><span className="muted">{n}/{path.lessons.length} cases solved</span><span className="btn primary sm">Enter →</span></> : <span className="muted">Syllabus ready · cases in production</span>}
                </div>
              </>
            );
            return path.status === "live"
              ? <Link key={path.id} to={`/paths/${path.id}`} className="card path-card">{inner}</Link>
              : <div key={path.id} className="card path-card locked" aria-disabled>{inner}</div>;
          })}
        </div>

        <div className="section-h" style={{ marginTop: 56 }}><h2>How a case works</h2></div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          {[
            ["📂", "Case file", "A realistic situation, your role, the question you must answer, and the evidence to collect."],
            ["🎓", "Lecture with checks", "Short segments from Professor Neva, each followed by a check for understanding."],
            ["🧪", "Hands-on lab", "Drag-and-drop exercises and live AI: tokenizers, vector search, RAG with citations, MCP tool calls."],
            ["💬", "Seminar", "Answer an open question in your own words. [[c|AI grading]] against a rubric, with a Socratic nudge."],
            ["✅", "Quiz", "Case-based questions, plus fresh challenge questions written by AI on demand."],
            ["🏆", "Capstone", "Direct a [[t|tool-using AI agent]] through the outbreak and file a report graded by the professor."],
          ].map(([ico, h, t]) => (
            <div key={h} className="card pad"><div style={{ fontSize: "1.6rem" }}>{ico}</div><h3 style={{ fontSize: "1.1rem", margin: "6px 0" }}>{h}</h3><p className="read" style={{ fontSize: ".98rem", margin: 0 }}><RichInline text={t} /></p></div>
          ))}
        </div>
      </div>
    </>
  );
}
