import { describe, expect, it } from "vitest";
import { makeSearch, tokenEstimate, tokenize } from "./search";

const chunks = [
  { id: "a", doc: "d", title: "Drain response", text: "Disinfect the drain and replace the trap." },
  { id: "b", doc: "d", title: "Screening", text: "Weekly rectal screens for contacts." },
  { id: "c", doc: "d", title: "Drains", text: "Sink drains need a trap; drain drain drain." },
];
const search = makeSearch(chunks);

describe("BM25 search", () => {
  it("drops stop words and punctuation", () => {
    expect(tokenize("What is the IDH2-R140Q result?")).toEqual(["idh2-r140q", "result"]);
  });
  it("ranks matching chunks and ignores non-matching ones", () => {
    const r = search("screens for contacts");
    expect(r.map(x => x.chunk.id)).toEqual(["b"]);
    expect(search("nothing matches here")).toEqual([]);
  });
  it("saturates term frequency rather than counting it linearly", () => {
    const r = search("drain");
    expect(r.map(x => x.chunk.id).sort()).toEqual(["a", "c"]);
    const [x, y] = r;
    expect(x.score / y.score).toBeLessThan(2.5);
  });
  it("respects k and estimates tokens", () => {
    expect(search("drain", 1)).toHaveLength(1);
    expect(tokenEstimate(chunks[0])).toBe(Math.ceil(7 * 1.35));
  });
});
