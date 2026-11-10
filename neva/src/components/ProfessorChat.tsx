// Chat with Otto (/api/professor). One conversation per key (a lesson, or office hours).
// The lesson context is frozen when the conversation starts so the system prompt never changes mid-chat;
// the learner's current stage travels with each new user message instead.
import { useRef, useState, useSyncExternalStore } from "react";
import { Rich } from "./Rich";
import { stream, useAi, type ApiMessage } from "../lib/ai";

type Turn = { me: string; prof: string; error?: string };
type Convo = { context: string; history: ApiMessage[]; turns: Turn[]; busy: boolean };

const convos = new Map<string, Convo>();
const subs = new Set<() => void>();
const get = (k: string) => convos.get(k);
const set = (k: string, c: Convo) => { convos.set(k, c); subs.forEach(f => f()); };
const useConvo = (k: string) => useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => get(k));

/** Send a message from anywhere (e.g. "Ask Otto about this" buttons). */
export async function askProfessor(key: string, context: string, text: string, note = "") {
  let c = get(key) || { context, history: [], turns: [], busy: false };
  if (c.busy) return;
  const user: ApiMessage = { role: "user", content: note ? `${note}\n\n${text}` : text };
  c = { ...c, busy: true, turns: [...c.turns, { me: text, prof: "" }] };
  set(key, c);
  const patch = (f: (t: Turn) => Turn) => { const cur = get(key)!; const turns = [...cur.turns]; turns[turns.length - 1] = f(turns[turns.length - 1]); set(key, { ...cur, turns }); };
  let content: unknown = null;
  await stream("/api/professor", { context: c.context, messages: [...c.history, user] }, e => {
    if (e.type === "text") patch(t => ({ ...t, prof: t.prof + e.text }));
    else if (e.type === "error") patch(t => ({ ...t, error: e.message }));
    else if (e.type === "done") content = e.content;
  }).catch(() => patch(t => ({ ...t, error: "Couldn't reach the server." })));
  const cur = get(key)!;
  // Only a completed exchange joins the history, exactly as the API returned it.
  set(key, { ...cur, busy: false, history: content ? [...cur.history, user, { role: "assistant", content }] : cur.history });
}

export function ProfessorChat({ convoKey, context, starters, note = "", intro }: { convoKey: string; context: string; starters: string[]; note?: string; intro?: string }) {
  const c = useConvo(convoKey);
  const aiOn = useAi();
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const send = (t: string) => { if (!t.trim()) return; setText(""); askProfessor(convoKey, context, t, note).then(() => end.current?.scrollIntoView({ block: "end" })); requestAnimationFrame(() => end.current?.scrollIntoView({ block: "end" })); };

  if (aiOn === false) return <div className="banner warn">Otto needs Claude. Set <code>ANTHROPIC_API_KEY</code> on the server (see README) and restart it. Everything else on the site still works.</div>;
  return (
    <div className="stack">
      <div className="chat">
        <div className="bubble prof"><div className="who"><span className="avatar bot" role="img" aria-label="Otto" />Otto</div><Rich text={intro || "Ask me anything about this case. I'll usually answer with a question first: that's on purpose."} /></div>
        {c?.turns.map((t, i) => (
          <div key={i} className="stack">
            <div className="bubble me">{t.me}</div>
            <div className="bubble prof"><div className="who"><span className="avatar bot" role="img" aria-label="Otto" />Otto</div>{t.prof ? <Rich text={t.prof} /> : !t.error && <p className="thinking">Thinking…</p>}{t.error && <div className="banner err">{t.error}</div>}</div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {!c?.turns.length && <div className="chips">{starters.map(s => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}</div>}
      <form className="composer" onSubmit={e => { e.preventDefault(); send(text); }}>
        <textarea rows={1} value={text} placeholder="Ask Otto, or explain it back in your own words…" onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} aria-label="Message to Otto" />
        <button className="btn primary sm" disabled={c?.busy || !text.trim() || aiOn === null}>{c?.busy ? "…" : "Send"}</button>
      </form>
    </div>
  );
}
