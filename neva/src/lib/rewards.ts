// What each stage of a lesson is worth, so learners see the rewards up front.
// Values mirror the award() calls in the stages and labs.
import type { Lesson } from "../content/types";
import type { StageId } from "./progress";

export const XP = {
  brief: 10,
  check: 10,
  lecture: 20,
  coldCallPoint: 5, // per rubric point, max 3 per segment
  evidence: 20,
  lab: 30,
  seminarPoint: 15,
  quizQuestion: 10,
  challenge: 20,
  debrief: 15,
  capstoneEvidence: 15,
  capstoneReport: 50,
  capstonePoint: 15, // per point of the /10 score
};

export type Reward = { xp: number; how: string };

export function stageRewards(l: Lesson): Partial<Record<StageId, Reward>> {
  const checks = l.lecture.filter(s => s.check).length;
  const segs = l.lecture.length;
  if (l.boss) {
    return {
      brief: { xp: XP.brief, how: "Open the case" },
      lecture: { xp: segs * 3 * XP.coldCallPoint, how: "Cold-call points" },
      lab: { xp: l.brief.evidence.length * XP.capstoneEvidence + XP.capstoneReport + 10 * XP.capstonePoint, how: `${XP.capstoneEvidence} per evidence, ${XP.capstoneReport} for the report, ${XP.capstonePoint} per point scored` },
      debrief: { xp: XP.debrief, how: "Close the case" },
    };
  }
  return {
    brief: { xp: XP.brief, how: "Open the case" },
    lecture: { xp: checks * XP.check + XP.lecture + segs * 3 * XP.coldCallPoint, how: `${XP.check} per check, ${XP.lecture} to finish, up to ${3 * XP.coldCallPoint} per cold call` },
    lab: { xp: l.brief.evidence.length * XP.evidence + XP.lab, how: `${XP.evidence} per piece of evidence, ${XP.lab} to finish` },
    seminar: { xp: 3 * XP.seminarPoint, how: `${XP.seminarPoint} per rubric point` },
    quiz: { xp: l.quiz.length * XP.quizQuestion, how: `${XP.quizQuestion} per correct answer, +${XP.challenge} per AI challenge question` },
    debrief: { xp: XP.debrief, how: "Close the case" },
  };
}

export const totalXp = (l: Lesson) => Object.values(stageRewards(l)).reduce((n, r) => n + (r?.xp || 0), 0);
