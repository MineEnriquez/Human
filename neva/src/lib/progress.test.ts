import { beforeEach, describe, expect, it } from "vitest";
import { award, BADGES, completeStage, earnBadge, LEVELS, lessonDone, levelOf, lessonProgress, noteMisconception, onToast, resetProgress, type Toast } from "./progress";

let state: { xp: number; badges: string[]; lessons: Record<string, { stages: Record<string, boolean> }>; misconceptions: string[] };
beforeEach(() => { resetProgress(); });
const read = () => (state = JSON.parse(localStorage.getItem("neva:v1")!));

describe("XP and levels", () => {
  it("levels start at Lab Intern and climb at the thresholds", () => {
    expect(levelOf(0).title).toBe("Lab Intern");
    expect(levelOf(LEVELS[1].at - 1).index).toBe(0);
    expect(levelOf(LEVELS[1].at).index).toBe(1);
    expect(levelOf(99999).title).toBe("Principal Investigator");
    expect(levelOf(99999).pct).toBe(1);
  });
  it("awards XP once per key and emits toasts, including level-ups", () => {
    const toasts: Toast[] = [];
    const off = onToast(t => toasts.push(t));
    expect(award("k1", 100, "first")).toBe(true);
    expect(award("k1", 100, "again")).toBe(false);
    expect(read().xp).toBe(100);
    award("k2", 60, "second");
    expect(toasts.some(t => t.kind === "level")).toBe(true);
    off();
  });
});

describe("badges, stages and misconceptions", () => {
  it("earns a known badge once and ignores unknown ones", () => {
    earnBadge("perfect"); earnBadge("perfect"); earnBadge("not-a-badge");
    expect(read().badges).toEqual(["perfect"]);
    expect(Object.keys(BADGES).length).toBeGreaterThanOrEqual(14);
  });
  it("lessonDone needs lab + seminar + quiz, or just the lab for a capstone", () => {
    completeStage("L", "lab"); completeStage("L", "seminar");
    expect(lessonDone(read() as never, "L")).toBe(false);
    expect(lessonDone(state as never, "L", true)).toBe(true);
    completeStage("L", "quiz");
    expect(lessonDone(read() as never, "L")).toBe(true);
    expect(lessonProgress("L").stages.lab).toBe(true);
  });
  it("keeps the last ten distinct misconceptions", () => {
    for (let i = 0; i < 12; i++) noteMisconception("m" + i);
    noteMisconception("m11"); noteMisconception(null);
    expect(read().misconceptions).toHaveLength(10);
    expect(state.misconceptions.at(-1)).toBe("m11");
  });
});
