// Course registry. Three paths teach the same AI stack (LLMs -> vector databases -> RAG -> MCP -> capstone)
// through a different field each. Each path lives in its own folder under src/content/.
import { PATH as cancer } from "./cancer/lessons";
import { PATH as modeling } from "./modeling/lessons";
import { PATH as research } from "./research/lessons";
import type { Path } from "./types";

export type { Check, Lesson, Path, QuizQ, Segment } from "./types";

export const PATHS: Path[] = [cancer, modeling, research];

export const findLesson = (id: string) => {
  for (const p of PATHS) for (const l of p.lessons) if (l.id === id) return { path: p, lesson: l };
  return null;
};
export const findPath = (id: string) => PATHS.find(p => p.id === id);
