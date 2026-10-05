import { useEffect, useMemo, useState } from 'react';
import { annualUpdateImpact, getPack } from '@spine/engine';
import { useApp, people, personById, ENTITY_ORDER } from '../state';
import { Citation, Ent, fmtDate } from '../components/bits';

export function Update() {
  const { state, dispatch } = useApp();
  const [id, setId] = useState(state.focus && ENTITY_ORDER.includes(state.focus) ? state.focus : 'PL');
  useEffect(() => { if (state.focus && ENTITY_ORDER.includes(state.focus)) setId(state.focus); }, [state.focus]);
  const imp = useMemo(() => annualUpdateImpact(id, 2026, 2027, people, state.inputs), [id, state.rev]);
  const all = useMemo(() => ENTITY_ORDER.map((e) => annualUpdateImpact(e, 2026, 2027, people, state.inputs)), [state.rev]);
  const next = getPack(id, 2027);
  const steps = [
    next.holidays.source.verification === 'assumption'
      ? { label: '2027 holiday calendar loaded (a placeholder: no official source for company holidays)', done: next.holidays.loaded ? 'placeholder' : false }
      : { label: '2027 holiday calendar loaded from the official source', done: next.holidays.loaded },
    { label: 'Rule changes reviewed against new legislation', done: imp.diff.ruleChanges.length === 0 ? 'none found' : false },
    ...(imp.seniorityCrossings.length ? [{ label: `${imp.seniorityCrossings.length} seniority ${imp.seniorityCrossings.length === 1 ? 'step' : 'steps'} in 2027, each topped up automatically (art. 158)`, done: 'automatic' as const }] : []),
    { label: `Legal sign-off: ${next.owner.role}`, done: next.owner.signOff.status === 'signed' },
  ];

  return (
    <div>
      <h1 className="h2">Annual update, 2026 to 2027</h1>
      <p className="muted" style={{ marginTop: 0, maxWidth: '70ch' }}>
        Every autumn, today's process re-keys holidays and seniority by hand in each country. Here each pack rolls forward as a new version,
        and the impact is visible before anything goes live. Nothing activates without the owner's sign-off.
      </p>

      <div className="grid cols-3" style={{ marginBottom: '1.25rem' }}>
        {all.map((a) => (
          <button key={a.packId} className="pack-cart" aria-pressed={a.packId === id} onClick={() => setId(a.packId)}
            style={a.packId === id ? { borderColor: 'var(--spine)', borderTopColor: 'var(--spine)' } : undefined}>
            <span className="row"><Ent id={a.packId} /><span className={`chip ${a.diff.blocked ? 'v-breach' : 'v-review'}`}>{a.diff.blocked ? 'Blocked' : 'Awaiting sign-off'}</span></span>
            <span className="muted" style={{ display: 'block', marginTop: '0.4rem' }}>
              {a.diff.moved.length} {a.diff.moved.length === 1 ? 'holiday moves' : 'holidays move'}, {a.diff.unchanged} unchanged{a.diff.added.length ? `, ${a.diff.added.length} new` : ''}{a.seniorityCrossings.length ? `, ${a.seniorityCrossings.length} seniority step` : ''}{a.affectedRequests.some((r) => r.status === 'blocked') ? ', a booked request is stuck' : ''}
            </span>
          </button>
        ))}
      </div>

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="stack">
          {imp.diff.blocked && (
            <div className="callout bad">
              <strong>Blocked.</strong> {imp.diff.reason}
            </div>
          )}
          <div className="panel">
            <h2 className="h3">Before go-live</h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {steps.map((s) => (
                <li key={s.label} className="row" style={{ padding: '0.35rem 0' }}>
                  <span className={`chip ${s.done === true || s.done === 'automatic' || s.done === 'none found' ? 'v-ok' : s.done ? 'v-overspend' : 'v-breach'}`}>{s.done === true ? 'Done' : s.done ? String(s.done).replace(/^./, (c) => c.toUpperCase()) : 'Open'}</span>
                  <span className="small">{s.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="panel">
            <h2 className="h3">Holidays</h2>
            {imp.diff.blocked ? <p className="muted small">The 2027 dates are unknown until the decree is published. Nothing is guessed.</p> : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>Holiday</th><th className="n">2026</th><th className="n">2027</th></tr></thead>
                  <tbody>
                    {imp.diff.moved.map((m) => <tr key={m.name}><td>{m.name} <span className="chip v-review">moves</span></td><td className="n">{fmtDate(m.from)}</td><td className="n">{fmtDate(m.to)}</td></tr>)}
                    {imp.diff.added.map((m) => <tr key={m.name}><td>{m.name} <span className="chip v-review">new</span></td><td className="n">none</td><td className="n">{fmtDate(m.date)}</td></tr>)}
                    {imp.diff.removed.map((m) => <tr key={m.name}><td>{m.name} <span className="chip v-breach">dropped</span></td><td className="n">{fmtDate(m.date)}</td><td className="n">none</td></tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="panel">
            <h2 className="h3">Rule changes</h2>
            {imp.diff.ruleChanges.length === 0 ? <p className="small muted" style={{ margin: 0 }}>No rule values differ between v2026.1 and v2027.1. If a correction is drafted on the Rule packs page, it shows here.</p> : (
              <ul className="small">{imp.diff.ruleChanges.map((c) => <li key={c.path}><code>{c.path}</code>: {String(c.from)} to <strong>{String(c.to)}</strong></li>)}</ul>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="panel">
            <h2 className="h3">People affected</h2>
            {imp.seniorityCrossings.length === 0 && imp.entitlementChanges.length === 0 && <p className="small muted" style={{ marginTop: 0 }}>No entitlement changes for this entity's sample people.</p>}
            {imp.seniorityCrossings.map((s) => (
              <p key={s.employeeId} className="small" style={{ marginTop: 0 }}>
                <button className="btn btn-quiet small" onClick={() => dispatch({ type: 'go', view: 'ledger', employeeId: s.employeeId })}>{personById(s.employeeId).name}</button>
                reaches 10 years of statutory seniority on {fmtDate(s.date)}: {s.from} to {s.to} days, topped up on that date.
              </p>
            ))}
            {imp.entitlementChanges.filter((c) => !imp.seniorityCrossings.some((s) => s.employeeId === c.employeeId)).map((c) => (
              <p key={c.employeeId} className="small" style={{ marginTop: 0 }}>{personById(c.employeeId).name}: {c.from} to {c.to} {c.unit} a year.</p>
            ))}
          </div>
          <div className="panel">
            <h2 className="h3">Work for HR</h2>
            <ul className="small" style={{ margin: 0, paddingLeft: '1.1rem' }}>
              {imp.tasks.map((t, i) => <li key={i} style={{ marginBottom: '0.4rem' }}>{t.date.endsWith('01-01') ? '' : `${fmtDate(t.date)}: `}{t.title}<Citation rule={t.rule} compact /></li>)}
            </ul>
          </div>
          <div className="panel">
            <h2 className="h3">Requests already booked for 2027</h2>
            {imp.affectedRequests.length === 0 ? <p className="small muted" style={{ margin: 0 }}>None in the sample data.</p> : (
              <ul className="small" style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {imp.affectedRequests.map((r) => (
                  <li key={r.requestId}>
                    {personById(r.employeeId).name}, {fmtDate(r.from)} to {fmtDate(r.to)}:{' '}
                    {r.status === 'blocked' ? <span className="chip v-breach">cannot be processed</span> : <>charges {r.charged}{r.holidaysInside?.length ? `; holidays inside: ${r.holidaysInside.join(', ')}` : ''}</>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
