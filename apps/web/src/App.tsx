import { useEffect, useState } from 'react';
import { useApp, people, type View } from './state';
const personByIdSafe = (id: string) => people.find((p) => p.id === id);
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
  { id: 'unify', label: 'Force-unify' },
  { id: 'packs', label: 'Rule packs' },
  { id: 'update', label: 'Annual update' },
  { id: 'docs', label: 'Decision & plan' },
];
const VIEWS = NAV.map((n) => n.id);

export function App() {
  const { state, dispatch } = useApp();
  const [resetMsg, setResetMsg] = useState(false);
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(() => {
    try { return (localStorage.getItem('spine-theme') as any) || 'system'; } catch { return 'system'; }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', theme);
    try { localStorage.setItem('spine-theme', theme); } catch { /* ignore */ }
  }, [theme]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [state.view]);

  // Hash routing (#/ledger/de-sophie): Back, reload and shared links land on the same page and person.
  useEffect(() => {
    const read = () => {
      const [, v, who] = window.location.hash.split('/');
      if (v && (VIEWS as string[]).includes(v) && (v !== state.view || (who && who !== state.employeeId)))
        dispatch({ type: 'go', view: v as View, employeeId: who && personByIdSafe(who) ? who : undefined });
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  useEffect(() => {
    const perPerson = state.view === 'desk' || state.view === 'ledger';
    const h = `#/${state.view}${perPerson ? `/${state.employeeId}` : ''}`;
    if (window.location.hash !== h) window.history.pushState(null, '', h);
  }, [state.view, state.employeeId]);

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
          <button className="btn btn-quiet small" onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')} title={`Theme: ${theme}. Click to change.`} aria-label={`Colour theme: ${theme}. Change theme`}>
            Theme: {theme === 'system' ? 'auto' : theme}
          </button>
          <button className="btn btn-quiet small" onClick={() => { dispatch({ type: 'reset' }); setResetMsg(true); window.setTimeout(() => setResetMsg(false), 2200); }} title="Discard your requests, sickness records and rule corrections">Reset demo</button>
        </div>
      </header>
      {state.overrides.length > 0 && (
        <div className="draft-banner" role="status">
          Draft correction active for {state.overrides.map((o) => `${o.id} ${o.year}`).join(', ')}. Every page reflects it.
          <button className="btn btn-quiet small" onClick={() => state.overrides.forEach((o) => dispatch({ type: 'override', id: o.id, year: o.year, pack: null }))}>Discard all</button>
          <button className="btn btn-quiet small" onClick={() => dispatch({ type: 'go', view: 'packs', focus: state.overrides[0].id })}>Open</button>
        </div>
      )}
      {resetMsg && <div className="toast" role="status">Demo reset to the scenario of 2 Oct 2026</div>}
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
