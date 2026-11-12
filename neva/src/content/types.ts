// Shared content types. Markup in strings: [[c|concept]] [[b|biology/data]] [[t|tool/system]] [[w|pitfall]], **bold**, `code`.

export type Check = { q: string; options: string[]; answer: number; explain: string };
/** A link to official documentation or the primary source (paper, specification, guideline) behind a claim. */
export type Ref = { title: string; url: string; publisher: string };
export type Segment = { title: string; body: string; check?: Check; refs?: Ref[] };
export type QuizQ = Check;
export type Lesson = {
  id: string;
  n: number;
  topic: string; // the AI topic
  title: string;
  caseTitle: string;
  boss?: boolean;
  brief: {
    role: string; situation: string; question: string; objectives: string[]; evidence: string[];
    /** Who brings you this case, and when it happens on the dossier timeline. */
    from?: { name: string; role: string; ask: string };
    when?: string;
    /** What you must hand over at the end, and how it will be judged. */
    deliverable?: string;
    success?: string[];
  };
  /** Otto's opening line for the case, shown in the case file. */
  hook?: string;
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
  /** The fictional case dossier the whole path follows. */
  dossier?: Dossier;
};

export type Dossier = {
  headline: string;
  summary: string;
  /** The clinical or project timeline; `lesson` marks the step each case happens at. */
  timeline: { when: string; what: string; lesson?: string }[];
  cast: { name: string; role: string; needs: string }[];
  facts: { label: string; value: string }[];
  stakes: string;
  deadline: string;
};
