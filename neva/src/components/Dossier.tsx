// The path's case dossier: summary, timeline (cases pinned to it), the people involved, key facts and stakes.
import { Link } from "react-router-dom";
import type { Dossier as D, Path } from "../content/types";
import { lessonDone, useProgress } from "../lib/progress";
import { Rich, RichInline } from "./Rich";

const initials = (n: string) => n.replace(/^Dr\.\s*/, "").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();
export const Avatar = ({ name }: { name: string }) => <span className="avatar person" aria-hidden>{name === "You" ? "★" : initials(name)}</span>;

export function DossierPanel({ path, dossier: d, current, open = true }: { path: Path; dossier: D; current?: string; open?: boolean }) {
  const p = useProgress();
  const caseNo = (id?: string) => path.lessons.find(l => l.id === id)?.n;
  return (
    <details className="dossier" open={open}>
      <summary className="dossier-h">
        <span><span className="eyebrow" style={{ color: "var(--on-band-muted)" }}>Case dossier · fictional</span><b>{d.headline}</b></span>
        <span className="deadline">⏱ {d.deadline}</span>
      </summary>
      <div className="dossier-b">
        <div className="stack">
          <Rich text={d.summary} />
          <div className="stakes"><div className="eyebrow">What's at stake</div><Rich text={d.stakes} /></div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Key facts</div>
            <table className="t"><tbody>{d.facts.map(f => <tr key={f.label}><th style={{ width: 130 }}>{f.label}</th><td><RichInline text={f.value} /></td></tr>)}</tbody></table>
          </div>
        </div>
        <div className="stack">
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Timeline</div>
            <ol className="timeline">
              {d.timeline.map((t, i) => {
                const n = caseNo(t.lesson);
                const now = Boolean(t.lesson) && t.lesson === current;
                const done = t.lesson && lessonDone(p, t.lesson, path.lessons.find(l => l.id === t.lesson)?.boss);
                return (
                  <li key={i} className={`${t.lesson ? "case" : ""} ${now ? "now" : ""} ${done ? "done" : ""}`}>
                    <span className="when">{t.when}</span>
                    <span><RichInline text={t.what} />{n && <> {now ? <span className="tag soon">You are here · case {n}</span> : <Link className="tag" to={`/lesson/${t.lesson}`}>{done ? "✓ " : ""}Case {n}</Link>}</>}</span>
                  </li>
                );
              })}
            </ol>
          </div>
          <div>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Who's involved</div>
            <div className="cast">
              {d.cast.map(c => (
                <div key={c.name} className="person-card">
                  <Avatar name={c.name} />
                  <div><b>{c.name}</b><div className="muted" style={{ fontSize: ".8rem" }}>{c.role}</div><div style={{ fontSize: ".85rem", marginTop: 4 }}>Needs: {c.needs}</div></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </details>
  );
}
