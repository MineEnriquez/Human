// The Pathogen Genomics case data must support exactly one defensible answer.
import { describe, expect, it } from "vitest";
import { search } from "./corpus";
import { ISOLATES, OUTBREAK_KEY, snpDistance } from "./dataset";
import { LESSONS } from "./lessons";

const ids = ISOLATES.map(i => i.id);
const cluster = OUTBREAK_KEY.cluster;
const excluded = Object.keys(OUTBREAK_KEY.excluded);

describe("SNP model", () => {
  it("is a metric: zero on the diagonal and symmetric", () => {
    for (const a of ids) {
      expect(snpDistance(a, a)).toBe(0);
      for (const b of ids) expect(snpDistance(a, b)).toBe(snpDistance(b, a));
    }
  });
  it("satisfies the triangle inequality within the ST258 lineage", () => {
    const st258 = ISOLATES.filter(i => i.st === "ST258").map(i => i.id);
    for (const a of st258) for (const b of st258) for (const c of st258)
      expect(snpDistance(a, c)).toBeLessThanOrEqual(snpDistance(a, b) + snpDistance(b, c));
  });
});

describe("answer key", () => {
  it("partitions all 12 isolates", () => {
    expect([...cluster, ...excluded].sort()).toEqual([...ids].sort());
  });
  it("cluster members share ST258 / blaKPC-3 and each is within 20 SNPs (GS-03) of another member", () => {
    for (const id of cluster) {
      const i = ISOLATES.find(x => x.id === id)!;
      expect(i.st).toBe("ST258");
      expect(i.carbapenemase).toBe("blaKPC-3");
      expect(Math.min(...cluster.filter(o => o !== id).map(o => snpDistance(id, o)))).toBeLessThanOrEqual(20);
    }
  });
  it("the sink drain (KP-12) is 1-5 SNPs from every ICU ST258 case", () => {
    for (const i of ISOLATES.filter(x => x.ward === "ICU" && cluster.includes(x.id))) {
      const d = snpDistance("KP-12", i.id);
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(5);
    }
  });
  it("every excluded isolate differs in ST/gene or is more than 50 SNPs from the whole cluster", () => {
    for (const id of excluded) {
      const i = ISOLATES.find(x => x.id === id)!;
      const far = cluster.every(c => snpDistance(id, c) > 50);
      expect(i.st !== "ST258" || far, id).toBe(true);
    }
    expect(cluster.every(c => snpDistance("KP-08", c) > 50)).toBe(true);
  });
  it("KP-07 is the only genome below the 30x QC threshold", () => {
    expect(ISOLATES.filter(i => i.coverage < 30).map(i => i.id)).toEqual(["KP-07"]);
  });
});

describe("RAG lab retrieval", () => {
  const cases: [string, string][] = [
    ["The bay 3 sink drain grew the outbreak strain. What must we do about the drain?", "EN07-2"],
    ["Who needs screening after a new CPE case, and for how long?", "IP14-3"],
    ["Can we interpret the SNP distances for KP-07?", "GS03-4"],
  ];
  it.each(cases)("%s -> %s in the top 3", (q, id) => {
    expect(search(q, 3).map(h => h.chunk.id)).toContain(id);
  });
});

describe("lesson facts that depend on the data", () => {
  it("the LLM lab says nine isolates are ST258 with blaKPC-3", () => {
    expect(ISOLATES.filter(i => i.st === "ST258" && i.carbapenemase === "blaKPC-3")).toHaveLength(9);
  });
  it("the vector lab seminar names the real top-3 neighbours of KP-13", async () => {
    const { QUERY_ISOLATE } = await import("./dataset");
    const top = ISOLATES.map(i => ({ id: i.id, d: Math.hypot(i.vec[0] - QUERY_ISOLATE.vec[0], i.vec[1] - QUERY_ISOLATE.vec[1]) }))
      .sort((a, b) => a.d - b.d).slice(0, 3).map(x => x.id);
    expect(top).toEqual(["KP-12", "KP-03", "KP-01"]);
    expect(LESSONS.find(l => l.id === "pg-vdb")!.seminar.question).toContain("KP-12 (the sink drain), KP-03 and KP-01");
  });
});
