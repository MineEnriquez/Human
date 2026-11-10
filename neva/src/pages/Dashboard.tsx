import { Link } from "react-router-dom";
import { PATHS } from "../content/paths";
import { BADGES, LEVELS, lessonDone, levelOf, resetProgress, useProgress } from "../lib/progress";

export function Dashboard() {
  const p = useProgress();
  const lv = levelOf(p.xp);
  const live = PATHS.filter(x => x.status === "live");
  const all = live.flatMap(x => x.lessons);
  return (
    <div className="page stack" style={{ gap: 24 }}>
      <div className="section-h"><div><div className="eyebrow">Your progress</div><h2>{lv.title}</h2></div><div className="score-big">{p.xp} <span style={{ fontSize: "1.2rem" }}>XP</span></div></div>
      <div className="card pad stack">
        <div className="levels">{LEVELS.map((l, i) => <div key={l.title} className={i <= lv.index ? "on" : ""}>L{i + 1} · {l.title}<br /><span className="mono">{l.at} XP</span></div>)}</div>
        {lv.next ? <p className="muted" style={{ margin: 0 }}>{lv.next.at - p.xp} XP to <b>{lv.next.title}</b>.</p> : <p style={{ margin: 0 }}>Top level reached.</p>}
        <div className="row"><span className="tag">🔥 Streak: {p.streak.count} day{p.streak.count === 1 ? "" : "s"}</span><span className="tag">🏅 {p.badges.length}/{Object.keys(BADGES).length} badges</span><span className="tag">📂 {all.filter(l => lessonDone(p, l.id, l.boss)).length}/{all.length} cases solved</span></div>
      </div>

      <div><h3 style={{ marginBottom: 12 }}>Badges</h3>
        <div className="badges">{Object.entries(BADGES).map(([id, b]) => <div key={id} className={`badge-c ${p.badges.includes(id) ? "got" : ""}`}><div className="ico">{b.icon}</div><b>{b.name}</b><small>{b.how}</small></div>)}</div>
      </div>

      {live.map(path => (<div key={path.id} className="card pad">
        <h3 style={{ marginBottom: 10 }}>Case log: {path.title}</h3>
        <table className="t"><thead><tr><th>Case</th><th>Status</th><th>Evidence</th><th>Seminar</th><th>Quiz</th></tr></thead>
          <tbody>{path.lessons.map(l => { const lp = p.lessons[l.id]; return (
            <tr key={l.id}><td><Link to={`/lesson/${l.id}`}><b>{l.caseTitle}</b></Link> <span className="muted">· {l.topic}</span></td><td>{lessonDone(p, l.id, l.boss) ? "✓ Solved" : lp ? "In progress" : "Not started"}</td><td>{lp?.evidence.length || 0}/{l.brief.evidence.length}</td><td>{lp?.seminarBest != null ? `${lp.seminarBest}/${l.boss ? 10 : 3}` : "–"}</td><td>{lp?.quizBest != null ? `${lp.quizBest}/${l.quiz.length}` : "–"}</td></tr>
          ); })}</tbody></table>
      </div>))}

      <div className="card pad">
        <h3 style={{ marginBottom: 8 }}>What Professor Neva has noticed</h3>
        <p className="muted" style={{ marginTop: 0 }}>Misconceptions spotted while grading your seminar answers. The professor uses these to target questions.</p>
        {p.misconceptions.length ? <ul className="read">{p.misconceptions.map(m => <li key={m}>{m}</li>)}</ul> : <p className="muted">Nothing yet.</p>}
      </div>
      <div><button className="btn ghost sm" onClick={() => { if (confirm("Reset all XP, badges and progress?")) resetProgress(); }}>Reset progress</button></div>
    </div>
  );
}
