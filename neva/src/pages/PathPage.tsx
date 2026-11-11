import { Link, useParams } from "react-router-dom";
import { DossierPanel } from "../components/Dossier";
import { Legend, RichInline } from "../components/Rich";
import { totalXp } from "../lib/rewards";
import { PATHS } from "../content/paths";
import { lessonDone, useProgress } from "../lib/progress";

export function PathPage() {
  const { id } = useParams();
  const path = PATHS.find(p => p.id === id) || PATHS[0];
  const p = useProgress();
  const firstOpen = path.lessons.findIndex(l => !lessonDone(p, l.id, l.boss));
  return (
    <div className="page">
      <div className="row" style={{ marginBottom: 24 }}>
        {PATHS.map(x => <Link key={x.id} to={`/paths/${x.id}`} className={`btn sm ${x.id === path.id ? "primary" : "ghost"}`}>{x.title}{x.status === "soon" ? " · soon" : ""}</Link>)}
      </div>
      <div className="path-head">
        <div>
          <div className="eyebrow">{path.area} path</div>
          <h1>{path.title}</h1>
          <p>{path.blurb}</p>
          <Legend />
        </div>
        <div className="card pad">
          <b>How you progress</b>
          <ul className="read" style={{ fontSize: ".95rem", marginTop: 8 }}>
            <li>Each case unlocks the next once its <b>lab, seminar and quiz</b> are done.</li>
            <li>Earn XP for checks, evidence, seminar points and quiz answers. Level up from Lab Intern to Principal Investigator.</li>
            <li>The final case is a capstone: you lead the investigation with a live AI agent.</li>
          </ul>
        </div>
      </div>

      {path.dossier && <div style={{ marginBottom: 28 }}><DossierPanel path={path} dossier={path.dossier} /></div>}

      {path.status === "soon" ? (
        <div className="card pad">
          <h3>Syllabus</h3>
          <p className="read">This path teaches the same AI stack through {path.area.toLowerCase()} cases. Start with Cancer Genomics if you are new.</p>
          <ol className="read">{path.cases.map(c => <li key={c}>{c}</li>)}</ol>
          <Link className="btn primary" to="/paths/cancer-genomics">Start with Cancer Genomics →</Link>
        </div>
      ) : (
        <div className="map">
          {path.lessons.map((l, i) => {
            const done = lessonDone(p, l.id, l.boss);
            const open = !done && (i === firstOpen || firstOpen === -1);
            const locked = !done && !open;
            const st = p.lessons[l.id]?.stages || {};
            const body = (
              <>
                <div className="node">{done ? "✓" : l.boss ? "★" : l.n}</div>
                <div>
                  <div className="eyebrow">{l.topic}</div>
                  <h3>{l.title}</h3>
                  <div className="case">Case: {l.caseTitle}{l.brief.when ? ` · ${l.brief.when}` : ""}</div>
                  {l.brief.from && <div className="muted" style={{ fontSize: ".85rem", marginTop: 4 }}>Brought by {l.brief.from.name}, {l.brief.from.role.charAt(0).toLowerCase() + l.brief.from.role.slice(1)}</div>}
                  <div className="meta">
                    <span className="tag soon">up to {totalXp(l)} XP</span>{(l.boss ? ["brief", "lab"] : ["brief", "lecture", "lab", "seminar", "quiz"]).map(s => <span key={s} className={`tag ${st[s as keyof typeof st] ? "live" : ""}`}>{st[s as keyof typeof st] ? "✓" : "○"} {s}</span>)}
                  </div>
                </div>
                <div>{locked ? <span className="muted">🔒 Locked</span> : <span className={`btn sm ${open ? "yellow" : ""}`}>{done ? "Review" : Object.keys(st).length ? "Continue" : "Start"} →</span>}</div>
              </>
            );
            return locked
              ? <div key={l.id} className={`card mod locked ${l.boss ? "boss" : ""}`} title="Finish the previous case to unlock">{body}</div>
              : <Link key={l.id} to={`/lesson/${l.id}`} className={`card mod ${done ? "done" : "open"} ${l.boss ? "boss" : ""}`}>{body}</Link>;
          })}
        </div>
      )}
      <p className="muted" style={{ marginTop: 20, fontSize: ".85rem" }}><RichInline text="All cases, people, institutions and data are [[w|fictional]]; the science, methods and AI concepts are real and described accurately." /></p>
    </div>
  );
}
