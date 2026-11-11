import { describe, expect, it } from "vitest";
import { stageRewards, totalXp } from "../../lib/rewards";
import { DOSSIER, SCENES } from "./dossier";
import { PATH } from "./lessons";

describe("AI for Software Engineers case dossier", () => {
  it("pins every case to the timeline once, in order", () => {
    const pinned = DOSSIER.timeline.filter(t => t.lesson).map(t => t.lesson);
    expect(pinned).toEqual(PATH.lessons.map(l => l.id));
  });
  it("gives every case a scene: who asks, when, the deliverable, success criteria and a hook", () => {
    for (const l of PATH.lessons) {
      const sc = SCENES[l.id];
      expect(sc, l.id).toBeDefined();
      expect(l.hook).toBe(sc.hook);
      expect(l.brief.from?.name).toBe(sc.from.name);
      expect(l.brief.deliverable).toBe(sc.deliverable);
      expect(l.brief.success?.length).toBeGreaterThanOrEqual(3);
      expect(DOSSIER.cast.map(c => c.name)).toContain(sc.from.name);
      expect(DOSSIER.timeline.find(t => t.lesson === l.id)!.when.slice(0, 8)).toBe(sc.when.slice(0, 8));
    }
  });
  it("ends with the demo deadline after the last case", () => {
    expect(DOSSIER.deadline).toMatch(/Fri 12 Feb 2027/);
    expect(DOSSIER.timeline.at(-1)!.when).toMatch(/Fri 12 Feb/);
  });
  it("shows sensible rewards for every stage", () => {
    for (const l of PATH.lessons) {
      expect(Object.keys(stageRewards(l))).toContain("lab");
      expect(totalXp(l)).toBeGreaterThan(200);
    }
  });
});
