// @vitest-environment node
// Vercel runs api/*.ts as unbundled ES modules, where Node requires explicit file extensions on relative
// imports. This test walks the server's import graph and fails on any extensionless relative import.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { describe, expect, it } from "vitest";

const SPEC = /(?:from|import)\s+["'](\.{1,2}\/[^"']+)["']/g;

function walk(entry: string, seen = new Set<string>(), bad: string[] = []) {
  if (seen.has(entry)) return bad;
  seen.add(entry);
  for (const m of readFileSync(entry, "utf8").matchAll(SPEC)) {
    const spec = m[1];
    if (!/\.(js|mjs|json)$/.test(spec)) { bad.push(`${entry}: "${spec}"`); continue; }
    const ts = normalize(join(dirname(entry), spec.replace(/\.js$/, ".ts")));
    if (existsSync(ts)) walk(ts, seen, bad);
  }
  return bad;
}

describe("server ESM imports", () => {
  it("use explicit .js extensions everywhere Vercel will load them", () => {
    const entries = ["status", "professor", "grade", "quiz", "coldcall", "screen", "rag", "agent", "capstone-grade", "verify-key"].map(e => `api/${e}.ts`);
    const bad = entries.flatMap(e => walk(e));
    expect(bad).toEqual([]);
  });
});
