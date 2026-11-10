import { describe, expect, it } from "vitest";
import { stageRewards, totalXp } from "../../lib/rewards";
import { SAMPLES } from "./dataset";
import { DOSSIER, SCENES } from "./dossier";
import { PATH } from "./lessons";

describe("Cancer Genomics case dossier", () => {
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
      expect(l.brief.success?.length).toBeGreaterThanOrEqual(3);
      expect(DOSSIER.cast.map(c => c.name)).toContain(sc.from.name);
      expect(DOSSIER.timeline.find(t => t.lesson === l.id)!.when.slice(0, 8)).toBe(sc.when.slice(0, 8));
    }
  });
  it("matches the sample data (purities quoted in the key facts)", () => {
    const facts = DOSSIER.facts.find(f => f.label === "Samples")!.value;
    for (const s of SAMPLES.filter(x => x.purity != null)) expect(facts, s.id).toMatch(new RegExp(`${s.id} \\((purity )?${s.purity!.toFixed(2)}\\)`));
  });
  it("shows sensible rewards for every stage", () => {
    for (const l of PATH.lessons) {
      const r = stageRewards(l);
      expect(Object.keys(r)).toContain("lab");
      expect(totalXp(l)).toBeGreaterThan(200);
    }
  });
});
