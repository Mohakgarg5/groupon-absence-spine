import { useEffect, useState } from 'react';
import { useApp, type View } from './state';
import { SpineMark } from './components/bits';
import { Overview } from './views/Overview';
import { Desk } from './views/Desk';
import { LedgerView } from './views/Ledger';
import { Unify } from './views/Unify';
import { Packs } from './views/Packs';
import { Update } from './views/Update';
import { Docs } from './views/Docs';
import { Queue } from './views/Queue';
import { Tour } from './components/Tour';

const NAV: { id: View; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'desk', label: 'Request desk' },
  { id: 'ledger', label: 'Ledger' },
  { id: 'queue', label: 'HR queue' },
  { id: 'unify', label: 'Force-unify test' },
  { id: 'packs', label: 'Rule packs' },
  { id: 'update', label: 'Annual update' },
  { id: 'docs', label: 'Decision & plan' },
];

export function App() {
  const { state, dispatch } = useApp();
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(() => {
    try { return (localStorage.getItem('spine-theme') as any) || 'system'; } catch { return 'system'; }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
    try { localStorage.setItem('spine-theme', theme); } catch { /* ignore */ }
  }, [theme]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [state.view]);

  return (
    <div className="shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={(e) => { e.preventDefault(); dispatch({ type: 'go', view: 'overview' }); }}>
          <SpineMark />
          <span>
            <span className="brand-name">Spine</span>
            <span className="brand-sub"> absence management, Groupon entities</span>
          </span>
        </a>
        <nav className="nav" aria-label="Sections">
          {NAV.map((n) => (
            <button key={n.id} aria-current={state.view === n.id ? 'page' : undefined} onClick={() => dispatch({ type: 'go', view: n.id })}>{n.label}</button>
          ))}
        </nav>
        <div className="topbar-tools">
          <span className="topbar-date" title="All dates are evaluated as of the scenario date">Scenario date 2 Oct 2026</span>
          <button className="btn btn-quiet small" onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')} aria-label="Change colour theme">
            {theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'Auto'} theme
          </button>
          <button className="btn btn-quiet small" onClick={() => dispatch({ type: 'reset' })} title="Discard your requests, sickness records and rule corrections">Reset demo</button>
        </div>
      </header>
      <main className="main" id="main">
        {state.view === 'overview' && <Overview />}
        {state.view === 'desk' && <Desk />}
        {state.view === 'ledger' && <LedgerView />}
        {state.view === 'queue' && <Queue />}
        {state.view === 'unify' && <Unify />}
        {state.view === 'packs' && <Packs />}
        {state.view === 'update' && <Update />}
        {state.view === 'docs' && <Docs />}
      </main>
      <Tour />
      <footer className="footer">
        Prototype for the Groupon HR Transformation case study. All employees are fictional. Rules come from public sources and are marked
        by verification status; nothing here has been signed off by Groupon legal.
      </footer>
    </div>
  );
}
