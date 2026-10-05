import { useMemo, useState } from 'react';
import { buildLedger, getPack, resolvePackId, type LedgerEvent } from '@spine/engine';
import { useApp, personById, TODAY } from '../state';
import { Amount, Citation, Ent, fmt, fmtDate } from '../components/bits';
import { PeoplePicker } from './Desk';

const ISSUE_LABEL: Record<string, string> = { NEGATIVE_BALANCE: 'Overdrawn', LEGACY_CONFLICT: 'Reconcile', NEGATIVE_AT_TERMINATION: 'Overdrawn at leaving', CALENDAR_NOT_LOADED: 'No calendar', KIND_NOT_ALLOWED: 'Leave type' };
const TYPE_LABEL: Record<string, string> = {
  OPENING: 'Migrated', GRANT: 'Granted', ACCRUE: 'Accrued', DEBIT: 'Taken', RESTORE: 'Restored', CARRY_OVER: 'Carried over',
  EXPIRE: 'Lapsed', EXPIRY_BLOCKED: 'Lapse blocked', PAYOUT: 'Paid out', ADJUST: 'Adjusted',
};

export function LedgerView() {
  const { state, dispatch } = useApp();
  const e = personById(state.employeeId);
  const [asOf, setAsOf] = useState('2026-12-31');
  const [open, setOpen] = useState<string | null>(null);
  const [bucket, setBucket] = useState<string>('all');

  let err = '';
  try { resolvePackId(e); } catch (x) { err = (x as Error).message.replace(/^[A-Z_]+: /, ''); }
  const ledger = useMemo(() => (err ? null : buildLedger(e, state.inputs, asOf, { today: TODAY })), [e.id, asOf, state.rev, err]);
  const pack = getPack(e.packId, 2026);
  const hasNotice = pack.buckets.some((b) => b.carryOver.conditionalOnNotice);

  const events = (ledger?.events ?? []).filter((x) => bucket === 'all' || x.bucket === bucket);
  const years = [...new Set(events.map((x) => Number(x.date.slice(0, 4))))].sort();
  const multi = ledger && Object.keys(ledger.balances).length > 1;

  return (
    <div>
      <h1 className="h2">Ledger</h1>
      <p className="muted" style={{ marginTop: 0 }}>Nothing here is typed in. Every balance is replayed from the employee's facts and the rule packs, and every line says which rule produced it.</p>
      <div className="desk" style={{ gridTemplateColumns: 'minmax(220px, 260px) minmax(0, 1fr)' }}>
        <PeoplePicker value={e.id} onChange={(id) => { setOpen(null); setBucket('all'); dispatch({ type: 'select', employeeId: id }); }} />
        <div className="stack">
          <div className="panel">
            <div className="row">
              <Ent id={e.packId} /><strong>{e.name}</strong><span className="muted small">{e.title}</span>
              <span className="spacer" />
              <label className="field" style={{ gridAutoFlow: 'column', alignItems: 'center', gap: '0.5rem' }}>
                Balance as of
                <input type="date" value={asOf} min="2026-01-01" max="2027-12-31" onChange={(x) => { const v = x.target.value; if (v) setAsOf(v < '2026-01-01' ? '2026-01-01' : v > '2027-12-31' ? '2027-12-31' : v); }} />
              </label>
              <div className="seg" role="group" aria-label="Quick dates">
                {[[TODAY, 'Today'], ['2026-12-31', 'End of 2026'], ['2027-12-31', 'End of 2027']].map(([d, l]) => <button key={d} aria-pressed={asOf === d} onClick={() => setAsOf(d)}>{l}</button>)}
              </div>
            </div>
            {e.persona && <p className="persona" style={{ marginBottom: 0 }}>{e.persona}</p>}
          </div>

          {err && <div className="callout bad">{err}</div>}

          {ledger && (
            <>
              <div className="tiles">
                {Object.entries(ledger.balances).map(([id, b]) => (
                  <button key={id} className="tile" style={{ textAlign: 'left', cursor: multi ? 'pointer' : 'default', outline: bucket === id ? '2px solid var(--spine)' : undefined }}
                    onClick={() => multi && setBucket(bucket === id ? 'all' : id)} aria-pressed={bucket === id}>
                    <div className="small muted">{b.label}</div>
                    {b.unlimited ? (
                      <div><span className="tile-v">Unlimited</span><span className="tile-u">{Object.entries(b.usedByYear ?? {}).map(([y, v]) => `${fmt(v)} h used in ${y}`).join(', ') || 'none used yet'}</span></div>
                    ) : (
                      <div><span className="tile-v">{fmt(b.available)}</span><span className="tile-u">{b.unit} on {fmtDate(asOf)}</span></div>
                    )}
                    {!b.unlimited && Object.keys(b.byYear).length > 0 && (
                      <div className="small muted">{Object.entries(b.byYear).map(([y, v]) => `${fmt(v)} from ${y}`).join(', ')}</div>
                    )}
                  </button>
                ))}
              </div>

              {(ledger.issues.length > 0 || ledger.tasks.length > 0 || hasNotice) && (
                <div className="grid cols-2">
                  {hasNotice && (
                    <div className="panel">
                      <h2 className="h3">Written warnings before leave lapses</h2>
                      <p className="small muted" style={{ marginTop: 0 }}>German leave only lapses on 31 March if the employer warned the employee in writing (CJEU C-684/16). Toggle a warning and watch the ledger replay.</p>
                      {[2025, 2026].map((y) => {
                        const n = state.inputs.notices.find((x) => x.employeeId === e.id && x.leaveYear === y);
                        return (
                          <label key={y} className="check" style={{ display: 'flex', marginTop: '0.35rem' }}>
                            <input type="checkbox" checked={!!n} onChange={() => dispatch({ type: 'toggleNotice', employeeId: e.id, leaveYear: y, sentOn: y === 2025 ? '2026-01-12' : '2026-09-30' })} />
                            Warning sent for {y} leave{n ? ` on ${fmtDate(n.sentOn)}` : ''}
                          </label>
                        );
                      })}
                    </div>
                  )}
                  {(ledger.issues.length > 0 || ledger.tasks.length > 0) && (
                    <div className="panel">
                      <h2 className="h3">Needs a person</h2>
                      <ul className="small" style={{ margin: 0, paddingLeft: '1.1rem' }}>
                        {ledger.issues.map((i, k) => <li key={`i${k}`}><span className="chip v-breach">{ISSUE_LABEL[i.code] ?? 'Check'}</span> {i.message}</li>)}
                        {ledger.tasks.map((t, k) => <li key={`t${k}`}>{fmtDate(t.date)}: {t.title}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="panel">
                <div className="row"><h2 className="h3" style={{ margin: 0 }}>Events</h2><span className="muted small">Faded rows are scheduled after {fmtDate(TODAY)}. Click a row for its rule.</span></div>
                {events.length === 0 && <p className="muted">No events in this window.</p>}
                {years.map((y) => (
                  <div key={y}>
                    <div className="tl-year">{y}</div>
                    <ul className="tl">
                      {events.filter((x) => x.date.startsWith(String(y))).map((ev) => <Row key={ev.id} ev={ev} open={open === ev.id} onToggle={() => setOpen(open === ev.id ? null : ev.id)} showBucket={!!multi} bucketLabel={ledger?.balances[ev.bucket]?.label.split('(')[0].trim()} />)}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ ev, open, onToggle, showBucket, bucketLabel }: { ev: LedgerEvent; open: boolean; onToggle: () => void; showBucket: boolean; bucketLabel?: string }) {
  return (
    <li>
      <button className={`tl-row ${ev.projected ? 'projected' : ''}`} aria-expanded={open} onClick={onToggle}>
        <span className="tl-date">{fmtDate(ev.date)}</span>
        <span>
          <span className={`evt evt-${ev.type}`}>{TYPE_LABEL[ev.type]}</span>
          {showBucket && <span className="muted small" style={{ display: 'block' }}>{bucketLabel}</span>}
          {ev.leaveYear !== Number(ev.date.slice(0, 4)) && <span className="muted small" style={{ display: 'block' }}>{ev.leaveYear} leave</span>}
        </span>
        <span className="tl-amt"><Amount n={ev.amount} unit={ev.unit} /></span>
        <span className="small">{ev.explanation}</span>
        <span className="tl-bal" title="Balance after this event">{ev.balanceAfter !== undefined ? fmt(ev.balanceAfter) : ''}</span>
      </button>
      {open && <div className="tl-detail reveal"><Citation rule={ev.rule} /></div>}
    </li>
  );
}
