// Shared content types. Markup in strings: [[c|concept]] [[b|biology/data]] [[t|tool/system]] [[w|pitfall]], **bold**, `code`.

export type Check = { q: string; options: string[]; answer: number; explain: string };
export type Segment = { title: string; body: string; check?: Check };
export type QuizQ = Check;
export type Lesson = {
  id: string;
  n: number;
  topic: string; // the AI topic
  title: string;
  caseTitle: string;
  boss?: boolean;
  brief: { role: string; situation: string; question: string; objectives: string[]; evidence: string[] };
  lecture: Segment[];
  lab: string; // key in src/labs/registry.ts
  seminar: { question: string; rubric: string[] };
  quiz: QuizQ[];
  takeaways: string[];
  summary: string; // for AI-generated questions and the professor's context
};
export type Path = {
  id: string; area: string; title: string; tagline: string; color: string; status: "live" | "soon";
  blurb: string; cases: string[]; lessons: Lesson[];
  /** One paragraph the AI professor gets as background for every conversation in this path. */
  setting: string;
};
