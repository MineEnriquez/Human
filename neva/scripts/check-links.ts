// Checks every "Further reading" link in the course content resolves (2xx/3xx).
// Run: npm run check:links            (all paths)
//      npm run check:links -- software-engineering   (one path)
import { PATHS } from "../src/content/paths";

const only = process.argv[2];
const refs = PATHS.filter(p => !only || p.id === only).flatMap(p => p.lessons.flatMap(l => l.lecture.flatMap(s => (s.refs || []).map(r => ({ ...r, where: `${l.id} · ${s.title}` })))));
const unique = [...new Map(refs.map(r => [r.url, r])).values()];

async function check(url: string): Promise<number> {
  const opts = { redirect: "follow" as const, headers: { "user-agent": "Mozilla/5.0 (link check for an educational site)", accept: "text/html,application/pdf,*/*" } };
  try {
    const head = await fetch(url, { ...opts, method: "HEAD", signal: AbortSignal.timeout(15000) });
    if (head.ok) return head.status;
    const get = await fetch(url, { ...opts, method: "GET", signal: AbortSignal.timeout(20000) });
    return get.status;
  } catch { return 0; }
}

let bad = 0;
for (const r of unique) {
  const status = await check(r.url);
  const ok = status >= 200 && status < 400;
  if (!ok) bad++;
  console.log(`${ok ? "ok " : "BAD"} ${status || "ERR"}  ${r.url}  (${r.where})`);
}
console.log(`\n${unique.length} links, ${bad} failing`);
process.exit(bad ? 1 : 0);
