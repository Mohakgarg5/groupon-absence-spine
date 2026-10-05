import { useState } from 'react';
import { useApp, type View } from '../state';

interface Step { title: string; body: string; view: View; employeeId?: string; focus?: string; desk?: boolean }

export const TOUR: Step[] = [
  { title: 'The decision', view: 'overview',
    body: 'One process, one ledger and one payroll export for every Groupon entity. Each country\'s law lives in its own cited rule pack. The nine stations show where local law plugs in.' },
  { title: 'Watch one real request', view: 'desk', employeeId: 'de-lena', desk: true,
    body: 'Lena in Berlin books Christmas. Watch the nine stages run. Her request is split across two leave years, the Berlin holidays aren\'t charged, and the 24/31 December assumption is flagged. Then press "Approve as manager".' },
  { title: 'The edge case', view: 'desk', employeeId: 'de-lena',
    body: 'After approving, report her sick on 29–30 December with a medical certificate. German law (BUrlG §9) gives the 2 days back, with the citation on the line. Untick the certificate and the ledger explains why nothing comes back.' },
  { title: 'Leave that cannot lapse', view: 'ledger', employeeId: 'de-sophie',
    body: 'Sophie\'s 2025 leave should lapse on 31 March, but the legacy system has no written warning, so under CJEU C-684/16 it survives. Tick "Warning sent" and watch the ledger replay. This is the hidden migration liability.' },
  { title: 'Try to unify it anyway', view: 'unify',
    body: 'Use the presets. The simple global policy breaks local law 58 times. A generous one still leaves a UK part-timer 0.2 days short, because UK law counts in weeks. Zero breaches is possible, and the cost shows why rule packs win.' },
  { title: 'Fix a rule like a lawyer would', view: 'packs', focus: 'UK',
    body: 'Every rule is data with a citation and an owner. In "Try a correction", set "public holidays count toward leave" to "no" and see exactly who it changes. This is how feedback gets applied.' },
  { title: 'Next year, without guesswork', view: 'update', focus: 'ES-MD',
    body: 'Packs roll forward each year. Madrid hasn\'t published its 2027 holiday decree, so the Spanish pack is blocked and Carmen\'s January request can\'t be processed. The engine refuses to guess.' },
  { title: 'The decision and the people plan', view: 'docs',
    body: 'The written decision, the Change & Culture Plan, with an honest headcount case and an unsoftened downsides analysis, and every assumption with its owner.' },
];

export function goToStep(dispatch: ReturnType<typeof useApp>['dispatch'], i: number) {
  const s = TOUR[i];
  dispatch({ type: 'tour', step: i });
  dispatch({ type: 'go', view: s.view, employeeId: s.employeeId, focus: s.focus, deskPreset: s.desk ? { from: '2026-12-21', to: '2027-01-08', autorun: true } : undefined });
}

export function Tour() {
  const { state, dispatch } = useApp();
  const [min, setMin] = useState(false);
  if (state.tour === null) return null;
  const i = state.tour;
  const s = TOUR[i];
  if (min) return (
    <aside className="tour min" role="dialog" aria-label="Guided tour">
      <button className="btn btn-quiet small" onClick={() => setMin(false)}>Show tour, step {i + 1} of {TOUR.length}</button>
    </aside>
  );
  return (
    <aside className="tour reveal" role="dialog" aria-label="Guided tour" aria-live="polite">
      <div className="row">
        <span className="small muted">Guided tour, step {i + 1} of {TOUR.length}</span>
        <span className="spacer" />
        <button className="btn btn-quiet small" onClick={() => setMin(true)} aria-label="Minimise the tour">Minimise</button>
        <button className="btn btn-quiet small" onClick={() => dispatch({ type: 'tour', step: null })} aria-label="Close the tour">Close</button>
      </div>
      <div className="tour-bar" aria-hidden><span style={{ width: `${((i + 1) / TOUR.length) * 100}%` }} /></div>
      <h2 className="h3" style={{ margin: '0.5rem 0 0.3rem' }}>{s.title}</h2>
      <p className="small" style={{ margin: 0 }}>{s.body}</p>
      <div className="row" style={{ marginTop: '0.8rem' }}>
        <button className="btn btn-quiet" disabled={i === 0} onClick={() => goToStep(dispatch, i - 1)}>Back</button>
        <span className="spacer" />
        {i < TOUR.length - 1
          ? <button className="btn btn-primary" onClick={() => goToStep(dispatch, i + 1)}>Next: {TOUR[i + 1].title}</button>
          : <button className="btn btn-primary" onClick={() => dispatch({ type: 'tour', step: null })}>Finish the tour</button>}
      </div>
    </aside>
  );
}
