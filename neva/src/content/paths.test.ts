// Integrity checks for every path's content: structure, quiz answers, markup, lab wiring.
import { describe, expect, it } from "vitest";
import { LABS } from "../labs/registry";
import { PATHS, findLesson } from "./paths";
import type { Check, Lesson } from "./types";

const live = PATHS.filter(p => p.status === "live");
const all: Lesson[] = live.flatMap(p => p.lessons);

/** Collect every string in a lesson (deep) so markup can be validated everywhere. */
function strings(o: unknown, out: string[] = []): string[] {
  if (typeof o === "string") out.push(o);
  else if (Array.isArray(o)) o.forEach(x => strings(x, out));
  else if (o && typeof o === "object") Object.values(o).forEach(x => strings(x, out));
  return out;
}
const checkOk = (c: Check, where: string) => {
  expect(c.options.length, `${where}: options`).toBeGreaterThanOrEqual(3);
  expect(Number.isInteger(c.answer), `${where}: answer index`).toBe(true);
  expect(c.answer, `${where}: answer in range`).toBeGreaterThanOrEqual(0);
  expect(c.answer, `${where}: answer in range`).toBeLessThan(c.options.length);
  expect(new Set(c.options).size, `${where}: duplicate options`).toBe(c.options.length);
  expect(c.explain.length, `${where}: explanation`).toBeGreaterThan(20);
};

describe("course registry", () => {
  it("has four paths with unique ids, AI for Software Engineers first", () => {
    expect(PATHS).toHaveLength(4);
    expect(new Set(PATHS.map(p => p.id)).size).toBe(4);
    expect(PATHS[0].id).toBe("software-engineering");
  });
  it("live paths have five lessons ending in a capstone, and a setting for the professor", () => {
    for (const p of live) {
      expect(p.lessons, p.id).toHaveLength(5);
      expect(p.lessons[4].boss, p.id).toBe(true);
      expect(p.lessons.map(l => l.n), p.id).toEqual([1, 2, 3, 4, 5]);
      expect(p.setting.length, p.id).toBeGreaterThan(40);
      expect(p.cases, p.id).toHaveLength(5);
    }
  });
  it("lesson ids are unique across paths and findLesson resolves them", () => {
    const ids = all.map(l => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(findLesson(id)?.lesson.id).toBe(id);
    expect(findLesson("nope")).toBeNull();
  });
});

describe.each(all.map(l => [l.id, l] as const))("lesson %s", (id, l) => {
  it("has a lab that exists in the registry", () => {
    expect(LABS[l.lab], `lab "${l.lab}"`).toBeDefined();
  });
  it("has a complete case brief", () => {
    expect(l.brief.objectives.length).toBeGreaterThanOrEqual(3);
    expect(l.brief.evidence.length).toBeGreaterThanOrEqual(3);
    expect(l.brief.question.length).toBeGreaterThan(20);
    expect(l.takeaways.length).toBeGreaterThanOrEqual(3);
    expect(l.summary.length).toBeGreaterThan(40);
  });
  it("teaches in depth", () => {
    if (l.boss) return expect(l.lecture.length).toBeGreaterThanOrEqual(1);
    expect(l.lecture.length, "lecture segments").toBeGreaterThanOrEqual(5);
    expect(l.lecture.filter(s => s.check).length, "checks").toBeGreaterThanOrEqual(3);
    for (const s of l.lecture) expect(s.body.split(/\s+/).length, `"${s.title}" length`).toBeGreaterThan(60);
  });
  it("has a seminar and quiz with valid answers", () => {
    if (l.boss) return;
    expect(l.seminar.question.length).toBeGreaterThan(40);
    expect(l.seminar.rubric.length).toBeGreaterThanOrEqual(3);
    expect(l.quiz.length).toBeGreaterThanOrEqual(5);
    l.quiz.forEach((q, i) => checkOk(q, `${id} quiz ${i + 1}`));
    l.lecture.forEach((s, i) => s.check && checkOk(s.check, `${id} check ${i + 1}`));
  });
  it("uses only valid colour markup", () => {
    for (const t of strings(l)) {
      for (const m of t.matchAll(/\[\[([^|\]]*)\|/g)) expect(["c", "b", "t", "w"], `markup kind in: ${t.slice(0, 60)}`).toContain(m[1]);
      const open = (t.match(/\[\[/g) || []).length, close = (t.match(/\]\]/g) || []).length;
      expect(close, `unbalanced [[ ]] in: ${t.slice(0, 80)}`).toBe(open);
      expect((t.match(/\*\*/g) || []).length % 2, `unbalanced ** in: ${t.slice(0, 80)}`).toBe(0);
    }
  });
});
