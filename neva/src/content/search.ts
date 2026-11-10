// Shared retrieval for every path's document library: a small BM25 index, so retrieval is
// transparent (learners see every score). Production systems usually combine this kind of
// keyword scoring with vector search ("hybrid search").

export type Chunk = { id: string; doc: string; title: string; text: string };
export type Hit = { chunk: Chunk; score: number };

const STOP = new Set("a an and are as at be by can do does for from has have how in is it its of on or our should that the their this to was we what when which who why will with".split(" "));
export const tokenize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\- ]+/g, " ").split(/\s+/).filter(w => w && !STOP.has(w));

/** Build a BM25 search function over a fixed set of chunks (k1 = 1.4, b = 0.75). */
export function makeSearch(chunks: Chunk[]) {
  const docs = chunks.map(c => tokenize(c.title + " " + c.text));
  const avg = docs.reduce((n, d) => n + d.length, 0) / Math.max(docs.length, 1);
  const df = new Map<string, number>();
  for (const d of docs) for (const w of new Set(d)) df.set(w, (df.get(w) || 0) + 1);
  const N = docs.length, k1 = 1.4, b = 0.75;
  return function search(query: string, k = 5): Hit[] {
    const q = tokenize(query);
    return docs
      .map((d, i) => {
        let s = 0;
        for (const w of q) {
          const f = d.filter(x => x === w).length;
          if (!f) continue;
          const n = df.get(w) || 0;
          const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
          s += idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * d.length / avg));
        }
        return { chunk: chunks[i], score: Math.round(s * 100) / 100 };
      })
      .filter(r => r.score > 0)
      .sort((x, y) => y.score - x.score)
      .slice(0, k);
  };
}

/** Rough token estimate used by the context-window packing labs (~1.35 tokens per English word). */
export const tokenEstimate = (c: Chunk) => Math.ceil(c.text.split(/\s+/).length * 1.35);
