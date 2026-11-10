import type { ReactNode } from "react";
import { addEvidence, award, completeStage, lessonProgress } from "../lib/progress";

/** Each lab has parts; finishing a part collects its evidence + XP; finishing all completes the lab stage. */
export function finishPart(lessonId: string, evidence: string, allEvidence: string[], xp = 20) {
  addEvidence(lessonId, evidence);
  award(`${lessonId}:lab:${evidence}`, xp, `Evidence: ${evidence}`);
  const got = lessonProgress(lessonId).evidence;
  if (allEvidence.every(e => got.includes(e))) {
    completeStage(lessonId, "lab");
    award(`${lessonId}:lab`, 30, "Lab complete");
  }
}

export function LabCard({ title, sub, done, children, right }: { title: string; sub?: ReactNode; done?: boolean; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="lab">
      <div className="lab-h">
        <div><h3>{done ? "✓ " : ""}{title}</h3>{sub && <p>{sub}</p>}</div>
        {right}
      </div>
      {children}
    </section>
  );
}
