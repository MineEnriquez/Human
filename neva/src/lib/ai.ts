// Browser side of the AI features. All calls go to our own /api routes.
// AI runs on either the visitor's own Anthropic API key (kept only in this browser and sent with each request)
// or, as a free trial, on the site's key with a daily allowance.
import { useSyncExternalStore } from "react";

// Conversation turns are kept exactly as the API returned them (thinking blocks included)
// and sent back unchanged, so history is append-only.
export type ApiMessage = { role: "user" | "assistant"; content: unknown };

// ---------------------------------------------------------------- the visitor's key
const KEY = "neva:anthropic-key";
const KEY_HEADER = "x-anthropic-api-key";
export type KeyMode = "session" | "device";

function readKey(): { key: string; mode: KeyMode } | null {
  try {
    const s = sessionStorage.getItem(KEY); if (s) return { key: s, mode: "session" };
    const d = localStorage.getItem(KEY); if (d) return { key: d, mode: "device" };
  } catch { /* storage unavailable */ }
  return null;
}

// ---------------------------------------------------------------- status store
export type Trial = { enabled: boolean; limit: number; remaining: number };
type State = { loaded: boolean; serverAi: boolean; trial: Trial; userKey: { key: string; mode: KeyMode } | null };
let state: State = { loaded: false, serverAi: false, trial: { enabled: false, limit: 0, remaining: 0 }, userKey: readKey() };
const subs = new Set<() => void>();
const set = (p: Partial<State>) => { state = { ...state, ...p }; subs.forEach(f => f()); };
export const useAiState = () => useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => state);

let loading: Promise<void> | null = null;
export function refreshStatus(): Promise<void> {
  return (loading ??= fetch("/api/status")
    .then(r => r.json())
    .then(j => set({ loaded: true, serverAi: Boolean(j.ai), trial: j.trial || { enabled: false, limit: 0, remaining: 0 } }))
    .catch(() => set({ loaded: true }))
    .finally(() => { loading = null; }));
}
refreshStatus();

/** True when AI calls can run now: the visitor's own key, or free trial requests left. null while loading. */
export function useAi(): boolean | null {
  const s = useAiState();
  if (s.userKey) return true;
  if (!s.loaded) return null;
  return s.serverAi && s.trial.enabled && s.trial.remaining > 0;
}

/** Ask the server to check a key (a model lookup, no tokens spent), then keep it in this browser. */
export async function connectKey(key: string, mode: KeyMode): Promise<string | null> {
  const k = key.trim();
  const r = await fetch("/api/verify-key", { method: "POST", headers: { [KEY_HEADER]: k } }).catch(() => null);
  const j = r ? await r.json().catch(() => ({})) : {};
  if (!r || !r.ok) return j.error || "Couldn't check the key. Try again.";
  try {
    sessionStorage.removeItem(KEY); localStorage.removeItem(KEY);
    (mode === "device" ? localStorage : sessionStorage).setItem(KEY, k);
  } catch { /* fall back to memory only */ }
  set({ userKey: { key: k, mode } });
  return null;
}
export function disconnectKey() {
  try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch { /* ignore */ }
  set({ userKey: null });
  refreshStatus();
}

// ---------------------------------------------------------------- requests
const headers = (): Record<string, string> => ({ "content-type": "application/json", ...(state.userKey ? { [KEY_HEADER]: state.userKey.key } : {}) });
const after = () => { if (!state.userKey) refreshStatus(); }; // keep the trial counter in the top bar current

/** POST and read an NDJSON stream, calling onEvent for each line. */
export async function stream(path: string, payload: unknown, onEvent: (e: any) => void, signal?: AbortSignal) {
  const r = await fetch(path, { method: "POST", headers: headers(), body: JSON.stringify(payload), signal });
  if (!r.ok || !r.body) {
    const j = await r.json().catch(() => ({}));
    onEvent({ type: "error", message: j.error || `Request failed (${r.status})`, code: j.code });
    after();
    return;
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line) onEvent(JSON.parse(line));
    }
  }
  after();
}

export async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const r = await fetch(path, { method: "POST", headers: headers(), body: JSON.stringify(payload) });
  const j = await r.json().catch(() => ({ error: "Bad response from server" }));
  after();
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j as T;
}
