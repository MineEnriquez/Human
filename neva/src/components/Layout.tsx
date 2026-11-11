import { useEffect, useState } from "react";
import { ConnectButton, ConnectPanel } from "./ConnectKey";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { levelOf, onToast, useProgress, type Toast } from "../lib/progress";

type Theme = "system" | "light" | "dark";
const THEMES: Theme[] = ["system", "light", "dark"];
const LABEL: Record<Theme, string> = { system: "◐ System", light: "☀ Light", dark: "☾ Dark" };
function useTheme(): [Theme, () => void] {
  const [t, setT] = useState<Theme>(() => (localStorage.getItem("neva:theme") as Theme) || "system");
  useEffect(() => {
    if (t === "system") { delete document.documentElement.dataset.theme; localStorage.removeItem("neva:theme"); }
    else { document.documentElement.dataset.theme = t; localStorage.setItem("neva:theme", t); }
  }, [t]);
  return [t, () => setT(x => THEMES[(THEMES.indexOf(x) + 1) % THEMES.length])];
}

export function Layout() {
  const [theme, cycleTheme] = useTheme();
  const p = useProgress();
  const lv = levelOf(p.xp);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { pathname } = useLocation();
  useEffect(() => onToast(t => { setToasts(x => [...x, t]); setTimeout(() => setToasts(x => x.filter(y => y.id !== t.id)), 3300); }), []);
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <>
      <header className="topbar">
        <div className="topbar-in">
          <Link to="/" className="logo"><span className="logo-mark" role="img" aria-label="Neva logo: Minerva with Otto the owl" />Neva</Link>
          <nav className="nav">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/paths/software-engineering">Paths</NavLink>
            <NavLink to="/office-hours">Office hours</NavLink>
            <NavLink to="/dashboard">Progress</NavLink>
          </nav>
          <span className="spacer" />
          <ConnectButton />
          <button className="theme-btn" onClick={cycleTheme} title="Theme: system, light or dark" aria-label={`Theme: ${theme}. Click to change.`}>{LABEL[theme]}</button>
          {p.streak.count > 0 && <span className="streak" title="Days in a row">🔥 {p.streak.count}</span>}
          <Link to="/dashboard" className="xp-pill" title={`${p.xp} XP`}>
            <span className="lvl">L{lv.index + 1}</span>
            <span>{lv.title}</span>
            <span className="bar"><span style={{ width: `${lv.pct * 100}%` }} /></span>
            <span className="mono">{p.xp} XP</span>
          </Link>
        </div>
      </header>
      <main><Outlet /></main>
      <ConnectPanel />
      <footer className="footer">Neva · Learn AI by solving real cases. Companies, institutions, people, patients, data and studies are fictional teaching material. Not medical advice.</footer>
      <div className="toasts" aria-live="polite">
        {toasts.map(t => <div key={t.id} className={`toast ${t.kind}`}><span className="plus">{t.plus}</span>{t.text}</div>)}
      </div>
    </>
  );
}
