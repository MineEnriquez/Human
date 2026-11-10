// Chat with the tool-using lab assistant (/api/agent). Shows every tool call and result as an MCP host would log it.
import { useRef, useState } from "react";
import { Rich } from "./Rich";
import { stream, useAi, type ApiMessage } from "../lib/ai";

type Item =
  | { kind: "me"; text: string }
  | { kind: "ai"; text: string }
  | { kind: "call"; id: string; name: string; input: unknown }
  | { kind: "result"; id: string; name: string; ok: boolean; output: unknown }
  | { kind: "error"; text: string };

let rpcId = 1;

export function AgentConsole({ starters, onToolCall, showRpc = false, placeholder = "Ask the lab assistant…", height = 460 }: {
  starters: string[]; onToolCall?: (name: string) => void; showRpc?: boolean; placeholder?: string; height?: number;
}) {
  const aiOn = useAi();
  const [items, setItems] = useState<Item[]>([]);
  const [history, setHistory] = useState<ApiMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const scroll = () => requestAnimationFrame(() => box.current?.scrollTo({ top: box.current.scrollHeight }));

  const send = async (msg: string) => {
    if (!msg.trim() || busy) return;
    setText(""); setBusy(true);
    const userMsg: ApiMessage = { role: "user", content: msg };
    setItems(x => [...x, { kind: "me", text: msg }, { kind: "ai", text: "" }]); scroll();
    let added: ApiMessage[] = [];
    await stream("/api/agent", { messages: [...history, userMsg] }, e => {
      if (e.type === "text") setItems(x => { const l = x[x.length - 1]; return l?.kind === "ai" ? [...x.slice(0, -1), { kind: "ai", text: l.text + e.text }] : [...x, { kind: "ai", text: e.text }]; });
      else if (e.type === "tool_call") { setItems(x => [...x.filter(i => !(i.kind === "ai" && !i.text)), { kind: "call", id: e.id, name: e.name, input: e.input }]); onToolCall?.(e.name); }
      else if (e.type === "tool_result") setItems(x => [...x, { kind: "result", id: e.id, name: e.name, ok: e.ok, output: e.output }]);
      else if (e.type === "turn") setItems(x => [...x, { kind: "ai", text: "" }]);
      else if (e.type === "error") setItems(x => [...x, { kind: "error", text: e.message }]);
      else if (e.type === "done") added = e.messages || [];
      scroll();
    }).catch(() => setItems(x => [...x, { kind: "error", text: "Couldn't reach the server." }]));
    setItems(x => x.filter(i => !(i.kind === "ai" && !i.text)));
    // Keep the exact turns the server returned so the next request extends history unchanged.
    if (added.length) setHistory(h => [...h, userMsg, ...added]);
    setBusy(false); scroll();
  };

  if (aiOn === false) return <div className="banner warn">The lab assistant needs Claude. Set ANTHROPIC_API_KEY on the server and restart it.</div>;
  return (
    <div className="stack">
      <div ref={box} className="chat" style={{ maxHeight: height, overflowY: "auto", padding: "4px 2px" }}>
        {!items.length && <p className="muted" style={{ margin: 0 }}>The assistant can call: <code>search_isolates</code>, <code>get_snp_distances</code>, <code>get_ward_transfers</code>, <code>search_protocols</code>. Start with a question.</p>}
        {items.map((it, i) => {
          if (it.kind === "me") return <div key={i} className="bubble me">{it.text}</div>;
          if (it.kind === "ai") return <div key={i} className="bubble prof"><div className="who"><span className="avatar">⚗</span>Lab assistant</div>{it.text ? <Rich text={it.text} /> : <p className="thinking">Thinking…</p>}</div>;
          if (it.kind === "error") return <div key={i} className="banner err">{it.text}</div>;
          if (it.kind === "call") return (
            <details key={i} className="tool-ev call" open={showRpc}>
              <summary><span className="lbl">→ tools/call</span> {it.name}({compact(it.input)})</summary>
              {showRpc && <pre>{JSON.stringify({ jsonrpc: "2.0", id: rpcId++, method: "tools/call", params: { name: it.name, arguments: it.input } }, null, 2)}</pre>}
            </details>
          );
          return (
            <details key={i} className={`tool-ev ${it.ok ? "res" : "err"}`}>
              <summary><span className="lbl">← {it.ok ? "result" : "error"}</span> {it.name} {summary(it.output)}</summary>
              <pre>{JSON.stringify(it.output, null, 2)}</pre>
            </details>
          );
        })}
      </div>
      {!items.length && <div className="chips">{starters.map(s => <button key={s} className="chip" onClick={() => send(s)} disabled={busy}>{s}</button>)}</div>}
      <form className="composer" onSubmit={e => { e.preventDefault(); send(text); }}>
        <textarea rows={1} value={text} placeholder={placeholder} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(text); } }} aria-label="Message to the lab assistant" />
        <button className="btn primary sm" disabled={busy || !text.trim() || aiOn === null}>{busy ? "…" : "Send"}</button>
      </form>
    </div>
  );
}

const compact = (v: unknown) => { const s = JSON.stringify(v); return s.length > 70 ? s.slice(0, 67) + "…" : s; };
const summary = (v: unknown) => Array.isArray(v) ? `(${v.length} rows)` : typeof v === "object" && v ? "" : String(v).slice(0, 60);
