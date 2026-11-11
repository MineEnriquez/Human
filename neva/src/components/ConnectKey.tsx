// "Bring your own key": visitors connect their own Anthropic API key so Otto runs on their account.
// The key stays in this browser (session or device) and is sent with each AI request over HTTPS;
// the server uses it for that request only and never stores or logs it.
import { useEffect, useState, useSyncExternalStore } from "react";
import { connectKey, disconnectKey, useAiState, type KeyMode } from "../lib/ai";

// open/close state shared by every "Connect" button on the page
let open = false;
const subs = new Set<() => void>();
export const openConnect = () => { open = true; subs.forEach(f => f()); };
const closeConnect = () => { open = false; subs.forEach(f => f()); };
const useOpen = () => useSyncExternalStore(cb => { subs.add(cb); return () => subs.delete(cb); }, () => open);

const mask = (k: string) => `${k.slice(0, 7)}…${k.slice(-4)}`;

/** Top-bar status: connected, free trial left, or connect. */
export function ConnectButton() {
  const s = useAiState();
  if (!s.loaded && !s.userKey) return null;
  const [long, short] = s.userKey ? ["● Claude connected", "● Claude"] : s.unlimited ? ["● Claude (this computer)", "● Claude"] : s.trial.enabled ? [`Free trial · ${s.trial.remaining} left · Connect`, `Trial ${s.trial.remaining} · Connect`] : ["Connect Claude", "Connect"];
  // Two labels; CSS shows the short one when the top bar gets tight.
  return <button className={`theme-btn connect-btn ${s.userKey ? "connected" : ""}`} onClick={openConnect} title="Use Otto with your own Anthropic account" aria-label={long}><span className="lbl-long">{long}</span><span className="lbl-short" aria-hidden>{short}</span></button>;
}

/** Shown wherever an AI feature can't run right now. */
export function AiOffNotice({ what = "This feature" }: { what?: string }) {
  const s = useAiState();
  const why = s.serverAi && s.trial.enabled ? "You've used today's free Otto requests." : "AI is off on this server.";
  return (
    <div className="banner warn row" style={{ justifyContent: "space-between" }}>
      <span>{why} {what} needs Claude: connect your own Anthropic API key to keep going.</span>
      <button className="btn sm primary" onClick={openConnect}>Connect your key</button>
    </div>
  );
}

export function ConnectPanel() {
  const isOpen = useOpen();
  const s = useAiState();
  const [key, setKey] = useState("");
  const [mode, setMode] = useState<KeyMode>("session");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { if (!isOpen) { setKey(""); setErr(""); } }, [isOpen]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeConnect(); };
    if (isOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);
  if (!isOpen) return null;

  const submit = async () => {
    setBusy(true); setErr("");
    const e = await connectKey(key, mode);
    setBusy(false);
    if (e) setErr(e); else closeConnect();
  };

  return (
    <div className="modal-bg" onClick={closeConnect}>
      <div className="modal card" role="dialog" aria-modal="true" aria-labelledby="connect-h" onClick={e => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 id="connect-h" style={{ fontSize: "1.4rem" }}>Connect your Claude account</h2>
          <button className="btn sm ghost" onClick={closeConnect} aria-label="Close">✕</button>
        </div>
        <p className="read" style={{ fontSize: "1rem" }}>
          Otto runs on Anthropic's API. Connect your own API key and every Otto chat, cold call, grade and lab agent runs on <b>your</b> Anthropic account, without the free-trial limit.
        </p>

        {s.userKey ? (
          <div className="stack">
            <div className="banner" style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>Connected: <code>{mask(s.userKey.key)}</code> · kept {s.userKey.mode === "device" ? "on this device" : "for this browser session"}</div>
            <div><button className="btn" onClick={() => { disconnectKey(); closeConnect(); }}>Disconnect</button></div>
          </div>
        ) : (
          <form className="stack" onSubmit={e => { e.preventDefault(); submit(); }}>
            <ol className="read" style={{ fontSize: ".95rem", margin: 0 }}>
              <li>Sign in at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com → Settings → API keys</a> and create a key (add billing if you haven't).</li>
              <li>Paste it here. Tip: make a key just for Neva, and set a spend limit on your Anthropic workspace.</li>
            </ol>
            <label className="lbl" htmlFor="apikey">Anthropic API key</label>
            <input id="apikey" className="field mono" type="password" autoComplete="off" spellCheck={false} placeholder="sk-ant-…" value={key} onChange={e => setKey(e.target.value)} />
            <div className="row" style={{ gap: 16, fontSize: ".92rem" }}>
              <label><input type="radio" name="mode" checked={mode === "session"} onChange={() => setMode("session")} /> This browser session only</label>
              <label><input type="radio" name="mode" checked={mode === "device"} onChange={() => setMode("device")} /> Remember on this device</label>
            </div>
            {err && <div className="banner err">{err}</div>}
            <div className="row"><button className="btn primary" disabled={busy || key.trim().length < 20}>{busy ? "Checking the key…" : "Check and connect"}</button>
              {s.trial.enabled && <span className="muted" style={{ fontSize: ".88rem" }}>Or keep using the free trial: {s.trial.remaining} of {s.trial.limit} requests left today.</span>}</div>
          </form>
        )}

        <details style={{ marginTop: 6 }}>
          <summary className="muted" style={{ cursor: "pointer" }}>How your key is handled</summary>
          <ul className="read" style={{ fontSize: ".92rem" }}>
            <li>It is stored only in this browser ({mode === "device" ? "until you disconnect" : "until you close the tab"}), never on Neva's servers.</li>
            <li>It is sent over HTTPS with each AI request; the server uses it for that request only and doesn't log it.</li>
            <li>Connecting checks the key with a model lookup, which costs nothing.</li>
            <li>Usage is billed by Anthropic to your account. A Claude.ai Pro or Max subscription doesn't include API usage.</li>
            <li>You can revoke the key at any time in the Anthropic Console.</li>
          </ul>
        </details>
      </div>
    </div>
  );
}
