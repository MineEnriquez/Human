// Browser side of the AI features. All calls go to our own /api routes; the key stays on the server.
import { useEffect, useState } from "react";

// Conversation turns are kept exactly as the API returned them (thinking blocks included)
// and sent back unchanged, so history is append-only.
export type ApiMessage = { role: "user" | "assistant"; content: unknown };

let statusP: Promise<boolean> | null = null;
export function aiStatus(): Promise<boolean> {
  return (statusP ??= fetch("/api/status").then(r => r.json()).then(j => Boolean(j.ai)).catch(() => false));
}
export function useAi(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => { aiStatus().then(setOn); }, []);
  return on;
}

/** POST and read an NDJSON stream, calling onEvent for each line. */
export async function stream(path: string, payload: unknown, onEvent: (e: any) => void, signal?: AbortSignal) {
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal });
  if (!r.ok || !r.body) {
    const j = await r.json().catch(() => ({}));
    onEvent({ type: "error", message: j.error || `Request failed (${r.status})` });
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
}

export async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const r = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const j = await r.json().catch(() => ({ error: "Bad response from server" }));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j as T;
}
