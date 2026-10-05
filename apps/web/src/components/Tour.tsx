import { useState } from 'react';
import { useApp, type View } from '../state';

type Dispatch = ReturnType<typeof useApp>['dispatch'];
type AppState = ReturnType<typeof useApp>['state'];
interface Step { title: string; body: string; view: View; employeeId?: string; focus?: string; desk?: boolean; doIt?: (d: Dispatch, s: AppState) => void; doItLabel?: string }

const PILOT = { from: '2026-12-21', to: '2027-01-08' };
/** Make sure Lena's Christmas leave is approved and her 29–30 Dec sickness is reported, then show it on the desk. */
function approveAndReportForMe(d: Dispatch, s: AppState) {
  const existing = s.inputs.requests.find((r) => r.employeeId === 'de-lena' && r.status === 'approved' && r.from <= PILOT.to && r.to >= PILOT.from);
  const id = existing?.id ?? 'req-de-lena-tour-pilot';
  if (!existing) d({ type: 'addRequest', request: { id, employeeId: 'de-lena', from: PILOT.from, to: PILOT.to, kind: 'annual', status: 'approved', submittedOn: '2026-10-02' } });
  d({ type: 'addSickness', record: { id: 's-de-lena-2026-12-29', employeeId: 'de-lena', from: '2026-12-29', to: '2026-12-30', certified: true, employeeAskedToReschedule: true } });
  d({ type: 'go', view: 'desk', employeeId: 'de-lena', focus: `sick:${id}` });
}

export const TOUR: Step[] = [
  { title: 'The decision', view: 'overview',
    body: 'One process, one ledger and one payroll export for every Groupon entity. Each country\'s law lives in its own cited rule pack. The nine stations show where local law plugs in.' },
  { title: 'Watch one real request', view: 'desk', employeeId: 'de-lena', desk: true,
    body: 'Lena in Berlin, the hardest law we model, books Christmas. Watch the nine stages run: the request is split across two leave years, Berlin holidays aren\'t charged, and the 24/31 December assumption is flagged. Then press "Approve as line manager".' },
  { title: 'The edge case', view: 'desk', employeeId: 'de-lena',
    body: 'She is sick on 29–30 December with a medical certificate. German law (BUrlG §9) gives the 2 days back, with the citation on the line. Untick the certificate and update the report: the ledger explains why nothing comes back.',
    doIt: approveAndReportForMe, doItLabel: 'Approve and report the sickness for me' },
  { title: 'What is left for HR', view: 'queue',
    body: 'Once requests, accruals and year-end run themselves, this is the work left for people: lapse warnings before 31 December, final-pay checks, a Polish replacement-day decision, and check-ins with two team leads who haven\'t taken a day off.' },
  { title: 'Leave that cannot lapse', view: 'ledger', employeeId: 'de-sophie',
    body: 'Sophie\'s 2025 leave should lapse on 31 March, but the legacy system has no written warning, so under CJEU C-684/16 it survives. Tick "Warning sent" and watch the ledger replay. This is the hidden migration liability.' },
  { title: 'Try to unify it anyway', view: 'unify',
    body: 'Use the presets. The simple global policy breaks local law 58 times. A generous one still leaves a UK part-timer 0.2 days short, because UK law counts in weeks. Zero breaches is possible, and the cost shows why rule packs win.' },
  { title: 'Fix a rule like a lawyer would', view: 'packs', focus: 'UK',
    body: 'Every rule is data with a citation and an owner. In "Try a correction", set "public holidays count toward leave" to "no" and see exactly who it changes. This is how feedback gets applied.' },
  { title: 'Next year, without guesswork', view: 'update', focus: 'ES-MD',
    body: 'Packs roll forward each year. Madrid published its 2027 decree on 1 October 2026, in the middle of this build. Loading it was one file, and the diff shows San José as new. Until a calendar is published, the engine refuses to guess.' },
  { title: 'The decision and the people plan', view: 'docs',
    body: 'The written decision, the Change & Culture Plan, with an honest headcount case and an unsoftened downsides analysis, and every assumption with its owner.' },
];

export function goToStep(dispatch: ReturnType<typeof useApp>['dispatch'], i: number) {
  const s = TOUR[i];
  dispatch({ type: 'tour', step: i });
  dispatch({ type: 'go', view: s.view, employeeId: s.employeeId, focus: s.focus, deskPreset: s.desk ? { ...PILOT, autorun: true } : undefined });
}

export function Tour() {
  const { state, dispatch } = useApp();
  const [min, setMin] = useState(false);
  if (state.tour === null) return null;
  const i = state.tour;
  const s = TOUR[i];
  if (min) return (
    <aside className="tour min" role="dialog" aria-label="Guided tour">
      <button className="btn btn-quiet small" onClick={() => setMin(false)}>Show the guided tour, step {i + 1} of {TOUR.length}: {s.title}</button>
    </aside>
  );
  return (
    <aside className="tour reveal" role="dialog" aria-label="Guided tour" aria-live="polite">
      <div className="tour-inner">
        <div>
          <div className="row" style={{ gap: '0.5rem' }}>
            <span className="small muted">Guided tour, step {i + 1} of {TOUR.length}</span>
            <strong>{s.title}</strong>
          </div>
          <div className="tour-bar" aria-hidden><span style={{ width: `${((i + 1) / TOUR.length) * 100}%` }} /></div>
          <p className="small" style={{ margin: '0.35rem 0 0', maxWidth: '110ch' }}>{s.body}</p>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {s.doIt && <button className="btn" onClick={() => s.doIt!(dispatch, state)}>{s.doItLabel}</button>}
          <button className="btn btn-quiet" disabled={i === 0} onClick={() => goToStep(dispatch, i - 1)}>Back</button>
          {i < TOUR.length - 1
            ? <button className="btn btn-primary" onClick={() => goToStep(dispatch, i + 1)}>Next: {TOUR[i + 1].title}</button>
            : <button className="btn btn-primary" onClick={() => dispatch({ type: 'tour', step: null })}>Finish the tour</button>}
          <button className="btn btn-quiet small" onClick={() => setMin(true)} aria-label="Minimise the tour">Minimise</button>
          <button className="btn btn-quiet small" onClick={() => dispatch({ type: 'tour', step: null })} aria-label="Close the tour">Close</button>
        </div>
      </div>
    </aside>
  );
}
