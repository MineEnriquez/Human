import { useMemo, useState } from "react";
import { ProfessorChat } from "../components/ProfessorChat";
import { Legend } from "../components/Rich";
import { PATHS } from "../content/paths";
import { lessonDone, levelOf, useProgress } from "../lib/progress";

export function OfficeHours() {
  const p = useProgress();
  const live = PATHS.filter(x => x.status === "live");
  const [pathId, setPathId] = useState(live[0].id);
  const context = useMemo(() => {
    const path = PATHS.find(x => x.id === pathId)!;
    const solved = path.lessons.filter(l => lessonDone(p, l.id, l.boss)).map(l => l.caseTitle);
    return [
      `Open office hours for the ${path.title} path (${path.area}), not tied to one lesson. ${path.setting}`,
      `Path cases: ${path.lessons.map(l => `${l.n}. ${l.caseTitle} (${l.topic})`).join("; ")}.`,
      `Cases the learner has solved: ${solved.join(", ") || "none yet"}.`,
      `Learner level: ${levelOf(p.xp).title}.`,
      p.misconceptions.length ? `Known misconceptions: ${p.misconceptions.join("; ")}.` : "",
    ].filter(Boolean).join("\n");
  }, [pathId]); // eslint-disable-line
  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <div className="eyebrow">Office hours</div>
      <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 800, margin: "6px 0 10px" }}>Talk to Professor Neva</h1>
      <p className="read">Bring a question from any case, a concept you'd like re-explained, or an idea from your own lab. The professor teaches Socratically: expect questions back.</p>
      <div className="row" style={{ margin: "14px 0 10px" }}>{live.map(x => <button key={x.id} className={`btn sm ${x.id === pathId ? "primary" : "ghost"}`} onClick={() => setPathId(x.id)}>{x.title}</button>)}</div>
      <div style={{ margin: "0 0 20px" }}><Legend /></div>
      <div className="card pad">
        <ProfessorChat key={pathId} convoKey={`office-hours:${pathId}`} context={context}
          intro="Welcome to office hours. What are you working on, or what's been confusing you?"
          starters={[`How do LLMs, vector databases, RAG and MCP fit together in ${PATHS.find(x => x.id === pathId)!.area.toLowerCase()}?`, "What's the most common mistake people make in this field with AI?", "When should I not use an LLM here?", "Help me plan how to study this path"]} />
      </div>
    </div>
  );
}
