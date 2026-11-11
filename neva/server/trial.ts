// Free trial on the site owner's API key: a per-visitor daily allowance plus a site-wide daily cap.
// Visitors who connect their own Anthropic API key never touch this.
//
// Counters live in memory by default. On serverless hosts (Vercel) memory is per instance, so limits are
// approximate; set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to keep them exact across instances.
//   TRIAL_PER_VISITOR  AI requests per visitor (IP) per UTC day   (default 10; 0 disables the trial)
//   TRIAL_DAILY_CAP    AI requests across all trial visitors/day  (default 300)
import type { IncomingMessage } from "node:http";

export const trialLimits = () => ({
  perVisitor: Math.max(0, Number(process.env.TRIAL_PER_VISITOR ?? 10)),
  dailyCap: Math.max(0, Number(process.env.TRIAL_DAILY_CAP ?? 300)),
});

const day = () => new Date().toISOString().slice(0, 10);
const DAY_SECONDS = 60 * 60 * 26; // a little over a day so keys always outlive their date

/** The visitor's IP as seen through the proxy (first X-Forwarded-For hop), else the socket address. */
export function visitorId(req: IncomingMessage): string {
  const fwd = req.headers?.["x-forwarded-for"];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim();
  return first || req.socket?.remoteAddress || "unknown";
}

// ---------------------------------------------------------------- stores
type Store = { incr(key: string): Promise<number>; get(key: string): Promise<number> };

const memory = new Map<string, number>();
const memoryStore: Store = {
  async incr(key) { const n = (memory.get(key) || 0) + 1; memory.set(key, n); return n; },
  async get(key) { return memory.get(key) || 0; },
};

function upstashStore(url: string, token: string): Store {
  const call = async (cmds: (string | number)[][]) => {
    const r = await fetch(url.replace(/\/$/, "") + "/pipeline", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(cmds) });
    if (!r.ok) throw new Error(`counter store error ${r.status}`);
    return (await r.json()) as { result: unknown }[];
  };
  return {
    async incr(key) { const [a] = await call([["INCR", key], ["EXPIRE", key, DAY_SECONDS]]); return Number(a.result) || 0; },
    async get(key) { const [a] = await call([["GET", key]]); return Number(a.result) || 0; },
  };
}

const store = (): Store => {
  const { UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: token } = process.env;
  return url && token ? upstashStore(url, token) : memoryStore;
};

/** Test hook. */
export function resetTrialCounters() { memory.clear(); }

// ---------------------------------------------------------------- API
const keys = (visitor: string) => ({ visitor: `neva:trial:${day()}:v:${visitor}`, global: `neva:trial:${day()}:all` });

/** How many trial requests this visitor has left today. */
export async function trialRemaining(visitor: string): Promise<number> {
  const { perVisitor, dailyCap } = trialLimits();
  if (!perVisitor || !dailyCap) return 0;
  try {
    const k = keys(visitor), s = store();
    const [mine, all] = await Promise.all([s.get(k.visitor), s.get(k.global)]);
    return Math.max(0, Math.min(perVisitor - mine, dailyCap - all));
  } catch {
    return 0; // if the counter store is down, fail closed: no free requests
  }
}

/** Use one trial request. Returns false (and uses nothing more) when the visitor or the site is over its limit. */
export async function consumeTrial(visitor: string): Promise<boolean> {
  const { perVisitor, dailyCap } = trialLimits();
  if (!perVisitor || !dailyCap) return false;
  try {
    if ((await trialRemaining(visitor)) <= 0) return false;
    const k = keys(visitor), s = store();
    const [mine, all] = await Promise.all([s.incr(k.visitor), s.incr(k.global)]);
    return mine <= perVisitor && all <= dailyCap;
  } catch {
    return false;
  }
}
