import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { levelOf, onToast, useProgress, type Toast } from "../lib/progress";

export function Layout() {
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
          <Link to="/" className="logo"><span className="logo-mark">N</span>Neva</Link>
          <nav className="nav">
            <NavLink to="/" end>Home</NavLink>
            <NavLink to="/paths/pathogen-genomics">Paths</NavLink>
            <NavLink to="/office-hours">Office hours</NavLink>
            <NavLink to="/dashboard">Progress</NavLink>
          </nav>
          <span className="spacer" />
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
      <footer className="footer">Neva · AI for the life sciences. Cases, hospitals, patients and isolates are fictional teaching material. Not medical advice.</footer>
      <div className="toasts" aria-live="polite">
        {toasts.map(t => <div key={t.id} className={`toast ${t.kind}`}><span className="plus">{t.plus}</span>{t.text}</div>)}
      </div>
    </>
  );
}
