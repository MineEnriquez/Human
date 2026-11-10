import { useMemo } from "react";
import { ProfessorChat } from "../components/ProfessorChat";
import { Legend } from "../components/Rich";
import { PATHS } from "../content/paths";
import { lessonDone, levelOf, useProgress } from "../lib/progress";

export function OfficeHours() {
  const p = useProgress();
  const context = useMemo(() => {
    const path = PATHS[0];
    const solved = path.lessons.filter(l => lessonDone(p, l.id, l.boss)).map(l => l.caseTitle);
    return [
      "Open office hours for the Pathogen Genomics path (not tied to one lesson).",
      `Path cases: ${path.lessons.map(l => `${l.n}. ${l.caseTitle} (${l.topic})`).join("; ")}.`,
      `Cases the learner has solved: ${solved.join(", ") || "none yet"}.`,
      `Learner level: ${levelOf(p.xp).title}.`,
      p.misconceptions.length ? `Known misconceptions: ${p.misconceptions.join("; ")}.` : "",
    ].filter(Boolean).join("\n");
  }, []); // eslint-disable-line
  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <div className="eyebrow">Office hours</div>
      <h1 style={{ fontSize: "clamp(2rem, 5vw, 3.2rem)", fontWeight: 800, margin: "6px 0 10px" }}>Talk to Professor Neva</h1>
      <p className="read">Bring a question from any case, a concept you'd like re-explained, or an idea from your own lab. The professor teaches Socratically: expect questions back.</p>
      <div style={{ margin: "14px 0 20px" }}><Legend /></div>
      <div className="card pad">
        <ProfessorChat convoKey="office-hours" context={context}
          intro="Welcome to office hours. What are you working on, or what's been confusing you?"
          starters={["How do LLMs, vector databases, RAG and MCP fit together in a genomics lab?", "Why isn't a small SNP distance proof of transmission?", "When should I not use an LLM in the lab?", "Help me plan how to study this path"]} />
      </div>
    </div>
  );
}
