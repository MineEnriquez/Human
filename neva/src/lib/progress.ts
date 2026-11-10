// Gamification state: XP, levels, badges, streak, per-lesson stage progress, evidence and
// misconceptions (fed back to Professor Neva so tutoring adapts). Persisted in localStorage.
import { useSyncExternalStore } from "react";

export const LEVELS = [
  { at: 0, title: "Lab Intern" },
  { at: 150, title: "Research Assistant" },
  { at: 400, title: "Genomic Analyst" },
  { at: 800, title: "Outbreak Investigator" },
  { at: 1300, title: "Principal Investigator" },
];

export const BADGES: Record<string, { icon: string; name: string; how: string }> = {
  "first-case": { icon: "📂", name: "Case Opened", how: "Open your first case file" },
  "fact-checker": { icon: "🔎", name: "Fact Checker", how: "Catch every fabricated claim in the LLM lab" },
  "nearest-neighbor": { icon: "🧭", name: "Nearest Neighbor", how: "Annotate cells by nearest-neighbour search in the reference atlas" },
  grounded: { icon: "⚓", name: "Grounded", how: "Get a cited RAG answer from chunks you packed" },
  toolsmith: { icon: "🛠️", name: "Toolsmith", how: "Put the MCP handshake in order" },
  gatekeeper: { icon: "🛡️", name: "Gatekeeper", how: "Sort every tool by the approval it needs" },
  seminar: { icon: "🎓", name: "Seminar Star", how: "Score Excellent on a seminar question" },
  perfect: { icon: "💯", name: "Perfect Recall", how: "Ace a quiz with no mistakes" },
  streak3: { icon: "🔥", name: "On a Roll", how: "Learn three days in a row" },
  "case-closed": { icon: "🏆", name: "Case Closed", how: "Pass the Tumor Board capstone" },
  "curve-shaper": { icon: "📈", name: "Curve Shaper", how: "Fit an epidemic model to the observed cases" },
  "briefing-done": { icon: "🏛️", name: "Briefing Delivered", how: "Pass the Briefing Room capstone" },
  "second-reviewer": { icon: "🧾", name: "Second Reviewer", how: "Reach substantial agreement (κ > 0.60) with Claude when screening" },
  "review-board": { icon: "📚", name: "Review Board", how: "Pass the Review Board capstone" },
};

export type StageId = "brief" | "lecture" | "lab" | "seminar" | "quiz" | "debrief";
type LessonProgress = { stages: Partial<Record<StageId, boolean>>; seminarBest?: number; quizBest?: number; evidence: string[] };
type State = {
  xp: number;
  badges: string[];
  lessons: Record<string, LessonProgress>;
  misconceptions: string[];
  awarded: string[]; // idempotency keys so the same action never pays XP twice
  streak: { last: string; count: number };
};

const KEY = "neva:v1";
const empty = (): State => ({ xp: 0, badges: [], lessons: {}, misconceptions: [], awarded: [], streak: { last: "", count: 0 } });
let state: State = (() => {
  try { return { ...empty(), ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return empty(); }
})();
const subs = new Set<() => void>();
function commit(next: State) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
  subs.forEach(f => f());
}
export function useProgress(): State {
  return useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => state);
}

// ---- toasts
export type Toast = { id: number; kind: "xp" | "badge" | "level"; text: string; plus?: string };
const toastSubs = new Set<(t: Toast) => void>();
let tid = 0;
export const onToast = (f: (t: Toast) => void) => { toastSubs.add(f); return () => { toastSubs.delete(f); }; };
const toast = (t: Omit<Toast, "id">) => toastSubs.forEach(f => f({ ...t, id: ++tid }));

export function levelOf(xp: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].at) i++;
  const next = LEVELS[i + 1];
  return { index: i, ...LEVELS[i], next, pct: next ? (xp - LEVELS[i].at) / (next.at - LEVELS[i].at) : 1 };
}

/** Award XP once per key. Returns true if it was new. */
export function award(key: string, xp: number, label: string): boolean {
  if (state.awarded.includes(key)) return false;
  const before = levelOf(state.xp).index;
  commit({ ...state, xp: state.xp + xp, awarded: [...state.awarded, key] });
  touchStreak();
  toast({ kind: "xp", text: label, plus: `+${xp} XP` });
  const after = levelOf(state.xp);
  if (after.index > before) toast({ kind: "level", text: `Level up: ${after.title}`, plus: "★" });
  return true;
}

export function earnBadge(id: string) {
  if (state.badges.includes(id) || !BADGES[id]) return;
  commit({ ...state, badges: [...state.badges, id] });
  toast({ kind: "badge", text: `Badge: ${BADGES[id].name}`, plus: BADGES[id].icon });
}

function touchStreak() {
  const today = new Date().toISOString().slice(0, 10);
  const s = state.streak;
  if (s.last === today) return;
  const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  const count = s.last === y ? s.count + 1 : 1;
  commit({ ...state, streak: { last: today, count } });
  if (count >= 3) earnBadge("streak3");
}

const lp = (id: string): LessonProgress => state.lessons[id] || { stages: {}, evidence: [] };
export function lessonProgress(id: string) { return lp(id); }

export function completeStage(lesson: string, stage: StageId) {
  const cur = lp(lesson);
  if (cur.stages[stage]) return;
  commit({ ...state, lessons: { ...state.lessons, [lesson]: { ...cur, stages: { ...cur.stages, [stage]: true } } } });
}
export function addEvidence(lesson: string, item: string) {
  const cur = lp(lesson);
  if (cur.evidence.includes(item)) return;
  commit({ ...state, lessons: { ...state.lessons, [lesson]: { ...cur, evidence: [...cur.evidence, item] } } });
}
export function recordBest(lesson: string, field: "seminarBest" | "quizBest", value: number) {
  const cur = lp(lesson);
  if ((cur[field] ?? -1) >= value) return;
  commit({ ...state, lessons: { ...state.lessons, [lesson]: { ...cur, [field]: value } } });
}
export function noteMisconception(m: string | null | undefined) {
  if (!m || state.misconceptions.includes(m)) return;
  commit({ ...state, misconceptions: [...state.misconceptions.slice(-9), m] });
}
export function resetProgress() { commit(empty()); }

/** A lesson is complete when its lab, seminar and quiz are done (the capstone: when its report is filed). */
export const lessonDone = (s: State, id: string, boss = false) => {
  const st = s.lessons[id]?.stages || {};
  return boss ? Boolean(st.lab) : Boolean(st.lab && st.seminar && st.quiz);
};
