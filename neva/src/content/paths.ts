// Course registry. Four paths teach the same AI stack (LLMs -> vector databases -> RAG -> MCP -> capstone)
// through a different field each; AI for Software Engineers comes first as the general-audience entry point. Each path lives in its own folder under src/content/.
import { PATH as software } from "./software/lessons";
import { PATH as cancer } from "./cancer/lessons";
import { PATH as modeling } from "./modeling/lessons";
import { PATH as research } from "./research/lessons";
import type { Path } from "./types";

export type { Check, Lesson, Path, QuizQ, Segment } from "./types";

export const PATHS: Path[] = [software, cancer, modeling, research];

export const findLesson = (id: string) => {
  for (const p of PATHS) for (const l of p.lessons) if (l.id === id) return { path: p, lesson: l };
  return null;
};
export const findPath = (id: string) => PATHS.find(p => p.id === id);
