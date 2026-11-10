// The Cancer Genomics case data must support exactly one defensible answer.
import { describe, expect, it } from "vitest";
import { search } from "./corpus";
import { ATLAS, MARKERS, QC, QUERY_CELLS, SAMPLES, TUMOR_BOARD_KEY, VARIANTS, ccf, labelTransfer, reportable, sample } from "./dataset";
import { LESSONS } from "./lessons";

const v = (id: string) => VARIANTS.find(x => x.id === id)!;
const purity = (id: string) => sample(id)!.purity;
const cls = TUMOR_BOARD_KEY.classes;

describe("cancer cell fraction", () => {
  it("is 2 x VAF / purity, capped at 1, and null without purity", () => {
    expect(ccf(0.2, 0.8)).toBeCloseTo(0.5);
    expect(ccf(0.45, 0.85)).toBe(1);
    expect(ccf(0.3, null)).toBeNull();
    expect(ccf(0.3, 0)).toBeNull();
  });
});

describe("answer key vs variant data", () => {
  it("classifies every variant exactly once", () => {
    expect(Object.keys(cls).sort()).toEqual(VARIANTS.map(x => x.id).sort());
  });
  it("founder variants are clonal (CCF ≥ 0.9) at diagnosis and relapse and absent from the skin control", () => {
    for (const [id, c] of Object.entries(cls)) if (c === "founder") {
      expect(ccf(v(id).calls["BM-DX"].vaf, purity("BM-DX"))!, id).toBeGreaterThanOrEqual(0.9);
      expect(ccf(v(id).calls["BM-REL"].vaf, purity("BM-REL"))!, id).toBeGreaterThanOrEqual(0.9);
      expect(v(id).calls.SKIN.vaf, id).toBe(0);
    }
  });
  it("the lost subclone is subclonal at diagnosis and absent at relapse", () => {
    const f = v("FLT3-ITD");
    expect(cls["FLT3-ITD"]).toBe("lost");
    expect(ccf(f.calls["BM-DX"].vaf, purity("BM-DX"))!).toBeLessThan(0.9);
    expect(f.calls["BM-REL"].vaf).toBe(0);
  });
  it("the relapse subclone is minor at diagnosis and clonal at relapse", () => {
    const i = v("IDH2-R140Q");
    expect(cls["IDH2-R140Q"]).toBe("relapse");
    expect(ccf(i.calls["BM-DX"].vaf, purity("BM-DX"))!).toBeLessThan(0.3);
    expect(ccf(i.calls["BM-REL"].vaf, purity("BM-REL"))!).toBeGreaterThanOrEqual(0.9);
  });
  it("the germline variant is ~50% in every sample, including the skin control, and does not fall in remission", () => {
    expect(cls["DDX41-fs"]).toBe("germline");
    for (const s of SAMPLES) expect(Math.abs(v("DDX41-fs").calls[s.id].vaf - 0.5)).toBeLessThanOrEqual(0.05);
    for (const [id, c] of Object.entries(cls)) if (c !== "germline") expect(v(id).calls.SKIN.vaf, id).toBe(0);
  });
  it("the artifact fails the QC SOP thresholds and is the only unreportable positive call", () => {
    const k = v("KRAS-G12D").calls["BM-REL"];
    expect(cls["KRAS-G12D"]).toBe("artifact");
    expect(reportable(k)).toBe(false);
    expect(k.depth).toBeLessThan(QC.minDepth);
    expect(k.vaf).toBeLessThan(QC.confirmBelowVaf);
    const positives = VARIANTS.flatMap(x => SAMPLES.map(s => ({ id: x.id, s: s.id, c: x.calls[s.id] }))).filter(r => r.c.vaf >= QC.confirmBelowVaf);
    expect(positives.every(r => reportable(r.c))).toBe(true);
  });
  it("DNMT3A persists at low level in remission while NPM1 clears (the MRD point)", () => {
    expect(v("DNMT3A-R882H").calls["BM-REM"].vaf).toBeGreaterThan(0);
    expect(v("NPM1-W288Cfs").calls["BM-REM"].vaf).toBe(0);
  });
});

describe("single-cell label transfer", () => {
  it("every reference cell type has its documented markers", () => {
    expect(new Set(ATLAS.map(c => c.type))).toEqual(new Set(Object.keys(MARKERS)));
    expect(MARKERS["Myeloid progenitor"]).toEqual(["CD34", "KIT", "MPO"]);
  });
  it("gives the labels the lessons describe", () => {
    const q = (id: string) => QUERY_CELLS.find(c => c.id === id)!.vec;
    expect(labelTransfer(q("Q1"), 3)).toMatchObject({ label: "Myeloid progenitor", agreement: 1 });
    expect(labelTransfer(q("Q2"), 3).label).toBe("Monocyte");
    expect(labelTransfer(q("Q3"), 3).label).toBe("T cell");
  });
  it("Q4 is a boundary cell whose label depends on k", () => {
    const q4 = QUERY_CELLS.find(c => c.id === "Q4")!.vec;
    expect(labelTransfer(q4, 1).label).toBe("HSC/MPP");
    const k3 = labelTransfer(q4, 3);
    expect(k3.label).toBe("Myeloid progenitor");
    expect(k3.agreement).toBeCloseTo(2 / 3);
  });
  it("a peripheral-blood filter mislabels the progenitor-like Q1 as a monocyte", () => {
    const r = labelTransfer(QUERY_CELLS[0].vec, 3, c => c.tissue === "Peripheral blood");
    expect(r.label).toBe("Monocyte");
  });
});

describe("RAG lab retrieval", () => {
  const cases: [string, string][] = [
    ["A DDX41 variant is at 50% VAF in the marrow and 49% in the skin sample. What must we do?", "GL01-3"],
    ["Can we report the KRAS G12D call at 3% VAF with 38x depth and strand bias?", "QC05-2"],
    ["Can we report the KRAS G12D call at 3% VAF with 38x depth and strand bias?", "QC05-1"],
    ["How do we classify a variant whose clinical significance is unknown?", "VC02-3"],
  ];
  it.each(cases)("%s -> %s in the top 3", (q, id) => {
    expect(search(q, 3).map(h => h.chunk.id)).toContain(id);
  });
});

describe("lesson facts that depend on the data", () => {
  it("the LLM lab report quotes the dataset's VAFs", async () => {
    expect(v("IDH2-R140Q").calls["BM-DX"].vaf).toBe(0.06);
    expect(v("IDH2-R140Q").calls["BM-REL"].vaf).toBe(0.4);
    expect(v("KRAS-G12D").calls["BM-REL"].depth).toBe(38);
  });
  it("the vector-database seminar's claim about Q1 matches the data", () => {
    expect(LESSONS.find(l => l.id === "cg-vdb")!.seminar.question).toContain("100% neighbour agreement");
  });
});
