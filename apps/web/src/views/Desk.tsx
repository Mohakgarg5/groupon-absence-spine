import { useEffect, useMemo, useRef, useState } from 'react';
import {
  approveRequest, buildLedger, expandDays, getPack, STAGES, submitRequest, resolvePackId,
  addDays, dow, endOfMonth, iso, yearOf,
  type DayLine, type Employee, type PipelineResult, type RequestKind,
} from '@spine/engine';
import { useApp, people, personById, TODAY, ENTITY_ORDER } from '../state';
import { Amount, Citation, Ent, fmt, fmtDate, Toast } from '../components/bits';

const LOCAL_STAGES = new Set(['jurisdiction', 'expand', 'policy', 'balance']);
const KIND_LABEL: Record<RequestKind, string> = { annual: 'Annual leave', 'on-demand': 'Leave on demand', 'sick-bank': 'Paid sick leave' };
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function PeoplePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="panel people" role="group" aria-label="Choose an employee">
      {ENTITY_ORDER.map((ent) => {
        const group = people.filter((p) => p.packId === ent);
        let entity = '';
        try { entity = getPack(ent, 2026).entity.split('(')[0].trim(); } catch { /* */ }
        return (
          <div className="people-group" key={ent}>
            <h4><Ent id={ent} /> {entity}</h4>
            {group.map((p) => (
              <button key={p.id} className="person" aria-pressed={p.id === value} onClick={() => onChange(p.id)}>
                <div className="person-name">{p.name}</div>
                <div className="person-title">{p.title}</div>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function monthDays(e: Employee, y: number, m: number): { lines: DayLine[] | null; error?: string } {
  try { return { lines: expandDays(e, iso(y, m, 1), endOfMonth(iso(y, m, 1))) }; } catch (err) { return { lines: null, error: (err as Error).message.replace(/^[A-Z_]+: /, '') }; }
}

function Month({ e, y, m, from, to, booked, onPick }: {
  e: Employee; y: number; m: number; from?: string; to?: string;
  booked: Map<string, 'approved' | 'pending'>; onPick: (d: string) => void;
}) {
  const { lines, error } = useMemo(() => monthDays(e, y, m), [e.id, y, m, e]);
  const first = iso(y, m, 1);
  const lead = (dow(first) + 6) % 7; // Monday-first grid
  const days = Number(endOfMonth(first).slice(8));
  const title = new Date(first + 'T00:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return (
    <div>
      <div className="cal-head"><span className="cal-title">{title}</span></div>
      {error && <p className="callout warn small" style={{ margin: '0 0 0.5rem' }}>No holiday calendar for this year. {error.split('(')[0]}</p>}
      <div className="cal" role="grid" aria-label={title}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="cal-dow" role="columnheader">{d}</div>)}
        {Array.from({ length: lead }, (_, i) => <div key={`b${i}`} className="day blank" aria-hidden />)}
        {Array.from({ length: days }, (_, i) => {
          const date = iso(y, m, i + 1);
          const line = lines?.[i];
          const out = date < e.hireDate || (!!e.terminationDate && date > e.terminationDate) || yearOf(date) > 2027;
          const sel = !!from && date >= from && date <= (to ?? from);
          const b = booked.get(date);
          const cls = ['day',
            line?.kind === 'holiday' || (line?.holidayName && line.kind === 'counted') ? 'hol' : '',
            line && line.kind !== 'counted' && line.kind !== 'holiday' ? 'off' : '',
            !line && [0, 6].includes(dow(date)) ? 'off' : '',
            b ? `booked ${b}` : '', sel ? 'sel' : '', out ? 'out' : ''].join(' ');
          const tag = line?.holidayName ?? (b === 'approved' ? 'booked' : b === 'pending' ? 'pending' : line?.kind === 'non-working' ? 'off' : '');
          return (
            <button key={date} className={cls} disabled={out} onClick={() => onPick(date)}
              aria-label={`${fmtDate(date)}${line?.holidayName ? `, ${line.holidayName}` : ''}${line?.kind === 'non-working' ? ', not a working day' : ''}${b ? `, ${b} leave` : ''}`}
              aria-pressed={sel}>
              <span className="day-n">{i + 1}</span>
              <span className="day-tag" title={tag}>{tag}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function StageRail({ result, shown }: { result: PipelineResult | null; shown: number }) {
  const byId = new Map(result?.stages.map((s) => [s.id, s]));
  const done = result ? Math.min(shown, result.stages.length) : 0;
  const pct = result ? (done / STAGES.length) * 100 : 0;
  return (
    <ol className={`rail ${result ? (done >= result.stages.length ? 'done' : 'running') : ''}`} style={{ ['--progress' as any]: `${pct}%` }} aria-live="polite">
      {STAGES.map((st, i) => {
        const s = i < done ? byId.get(st.id) : undefined;
        const status = s?.status ?? 'pending';
        return (
          <li key={st.id} className={`rail-step ${status} ${LOCAL_STAGES.has(st.id) ? 'local' : ''}`}>
            <span className="rail-dot" aria-hidden>{status === 'ok' ? '✓' : status === 'warn' ? '!' : status === 'fail' ? '×' : ''}</span>
            <div className="rail-label">{i + 1}. {st.label}</div>
            {s ? (
              <div className="reveal">
                <div className="rail-detail">{s.detail}</div>
                {s.rules.length > 0 && <div className="rail-rules">{s.rules.slice(0, 3).map((r, k) => <Citation key={r.ruleId + k} rule={r} compact />)}</div>}
              </div>
            ) : (
              <div className="rail-detail">{result && i >= result.stages.length && done >= result.stages.length ? 'Not reached' : ''}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function Desk() {
  const { state, dispatch } = useApp();
  const e = personById(state.employeeId);
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [kind, setKind] = useState<RequestKind>('annual');
  const [result, setResult] = useState<PipelineResult | null>(null);
  const [shown, setShown] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ y: number; m: number }>({ y: 2026, m: 10 });
  const [approvedId, setApprovedId] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  let jurisdictionError = '';
  try { resolvePackId(e); } catch (err) { jurisdictionError = (err as Error).message.replace(/^[A-Z_]+: /, ''); }

  const pack = useMemo(() => { try { return getPack(e.packId, from ? Math.min(2027, Math.max(2026, yearOf(from))) : 2026); } catch { return null; } }, [e.packId, from, state.rev]);
  const kinds = useMemo(() => [...new Set(pack?.buckets.flatMap((b) => b.requestKinds) ?? ['annual'])] as RequestKind[], [pack]);

  const booked = useMemo(() => {
    const m = new Map<string, 'approved' | 'pending'>();
    for (const r of state.inputs.requests.filter((x) => x.employeeId === e.id && x.status !== 'rejected'))
      for (let d = r.from; d <= r.to; d = addDays(d, 1)) m.set(d, r.status === 'approved' ? 'approved' : 'pending');
    return m;
  }, [state.inputs.requests, e.id]);

  const ledger = useMemo(() => (jurisdictionError ? null : buildLedger(e, state.inputs, TODAY, { today: TODAY })), [e.id, state.rev, jurisdictionError]);
  const myRequests = state.inputs.requests.filter((r) => r.employeeId === e.id).sort((a, b) => a.from.localeCompare(b.from));

  function clearRun() {
    if (timer.current) window.clearInterval(timer.current);
    setResult(null); setShown(0); setApprovedId(null);
  }

  // Reset when the person changes.
  useEffect(() => {
    clearRun(); setFrom(undefined); setTo(undefined); setKind('annual');
    setCursor({ y: 2026, m: 10 });
  }, [e.id]);

  // Overview "Run the Berlin pilot" preset.
  useEffect(() => {
    const p = state.deskPreset;
    if (!p) return;
    dispatch({ type: 'consumePreset' });
    setFrom(p.from); setTo(p.to); setKind('annual'); setCursor({ y: yearOf(p.from), m: Number(p.from.slice(5, 7)) });
    if (p.autorun) setTimeout(() => run(p.from, p.to, 'annual'), 250);
  }, [state.deskPreset]);

  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);

  function pick(d: string) {
    clearRun();
    if (!from || (from && to && from !== to) || d < from) { setFrom(d); setTo(d); return; }
    setTo(d);
  }

  function run(f = from, t = to, k = kind, existingId?: string) {
    if (!f || !t) return;
    if (timer.current) window.clearInterval(timer.current);
    // New requests get a unique id; re-processing a pending one keeps its id so approval replaces it.
    const id = existingId ?? `req-${e.id}-${f}-${t}-${k}-${Date.now().toString(36)}`;
    const r = submitRequest(e, { id, employeeId: e.id, from: f, to: t, kind: k, submittedOn: TODAY }, state.inputs, TODAY);
    setResult(r); setApprovedId(null);
    if (reduceMotion()) { setShown(r.stages.length); return; }
    setShown(0);
    let i = 0;
    timer.current = window.setInterval(() => {
      i++; setShown(i);
      if (i >= r.stages.length && timer.current) window.clearInterval(timer.current);
    }, 160);
  }

  function approve() {
    if (!result?.ok) return;
    const req = approveRequest(result);
    dispatch({ type: 'addRequest', request: req });
    setApprovedId(req.id);
    flash(`Approved and posted to ${e.name.split(' ')[0]}'s ledger`);
  }

  function flash(msg: string) { setToast(msg); window.setTimeout(() => setToast(null), 2600); }

  const finished = result && shown >= result.stages.length;
  const months = [cursor, cursor.m === 12 ? { y: cursor.y + 1, m: 1 } : { y: cursor.y, m: cursor.m + 1 }];
  const shift = (n: number) => setCursor(({ y, m }) => { const t = y * 12 + (m - 1) + n; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; });
  const canPrev = cursor.y * 12 + cursor.m > 2026 * 12 + 1;
  const canNext = cursor.y * 12 + cursor.m < 2027 * 12 + 11;

  return (
    <div>
      <div className="row" style={{ marginBottom: '1rem' }}>
        <div>
          <h1 className="h2">Request desk</h1>
          <p className="muted" style={{ margin: 0 }}>Pick a person, select dates on their calendar, and run the request through the spine.</p>
        </div>
      </div>
      <div className="desk">
        <PeoplePicker value={e.id} onChange={(id) => dispatch({ type: 'select', employeeId: id })} />

        <div className="stack">
          <div className="panel">
            <div className="row">
              <Ent id={e.packId} />
              <strong>{e.name}</strong>
              <span className="muted small">{e.title}, {e.workLocation}, since {fmtDate(e.hireDate)}{e.terminationDate ? `, leaving ${fmtDate(e.terminationDate)}` : ''}</span>
            </div>
            {e.persona && <p className="persona" style={{ marginBottom: 0 }}>{e.persona}</p>}
            {jurisdictionError && <p className="callout bad small" style={{ marginBottom: 0 }}>{jurisdictionError}</p>}
          </div>

          <div className="panel">
            <div className="row" style={{ marginBottom: '0.75rem' }}>
              <button className="btn btn-quiet" onClick={() => shift(-1)} disabled={!canPrev} aria-label="Previous month">Earlier</button>
              <button className="btn btn-quiet" onClick={() => shift(1)} disabled={!canNext} aria-label="Next month">Later</button>
              <span className="spacer" />
              {kinds.length > 1 && (
                <div className="seg" role="group" aria-label="Leave type">
                  {kinds.map((k) => <button key={k} aria-pressed={kind === k} onClick={() => { setKind(k); clearRun(); }}>{KIND_LABEL[k]}</button>)}
                </div>
              )}
            </div>
            <div className="cal-wrap">
              {months.map((mm) => <Month key={`${mm.y}-${mm.m}`} e={e} y={mm.y} m={mm.m} from={from} to={to} booked={booked} onPick={pick} />)}
            </div>
            <div className="legend">
              <span><i style={{ background: 'var(--spine)' }} />Selected</span>
              <span><i style={{ background: 'var(--over-soft)' }} />Public holiday</span>
              <span><i style={{ background: 'var(--surface-2)' }} />Not a working day</span>
              <span><i style={{ background: 'var(--spine-soft)' }} />Booked</span>
              <span><i style={{ backgroundImage: 'var(--hatch)' }} />Pending</span>
            </div>
            <div className="row" style={{ marginTop: '1rem' }}>
              <span className="small">{from ? <>Selected <strong>{fmtDate(from)}</strong>{to && to !== from && <> to <strong>{fmtDate(to)}</strong></>}</> : 'Click a start date, then an end date.'}</span>
              <span className="spacer" />
              {from && <button className="btn btn-quiet" onClick={() => { setFrom(undefined); setTo(undefined); clearRun(); }}>Clear</button>}
              <button className="btn btn-primary" disabled={!from} onClick={() => run()}>Check request</button>
            </div>
          </div>

          {myRequests.length > 0 && (
            <div className="panel">
              <h2 className="h3">{e.name.split(' ')[0]}'s requests</h2>
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead><tr><th>Dates</th><th>Type</th><th>Status</th><th /></tr></thead>
                  <tbody>
                    {myRequests.map((r) => (
                      <tr key={r.id}>
                        <td>{fmtDate(r.from)}{r.to !== r.from && <> to {fmtDate(r.to)}</>}</td>
                        <td>{KIND_LABEL[r.kind]}</td>
                        <td><span className={`chip ${r.status === 'approved' ? 'v-ok' : r.status === 'pending' ? 'v-review' : 'v-breach'}`}>{r.status}</span></td>
                        <td style={{ textAlign: 'right' }}>
                          {r.status === 'pending' && <button className="btn btn-quiet small" onClick={() => { setFrom(r.from); setTo(r.to); setKind(r.kind); setCursor({ y: yearOf(r.from), m: Number(r.from.slice(5, 7)) }); run(r.from, r.to, r.kind, r.id); }}>Process</button>}
                          {r.status === 'approved' && r.submittedOn === TODAY && <button className="btn btn-quiet small" onClick={() => { dispatch({ type: 'removeRequest', id: r.id }); clearRun(); flash('Request withdrawn; ledger replayed'); }}>Withdraw</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <aside className="stack">
          <div className="panel">
            <h2 className="h3">The spine</h2>
            <StageRail result={result} shown={shown} />
          </div>
          {finished && result && <Outcome key={result.request.id} result={result} e={e} approvedId={approvedId} onApprove={approve} onFlash={flash} />}
          {!result && ledger && (
            <div className="receipt">
              <div className="receipt-head"><strong>Balance today</strong><div className="muted small">{fmtDate(TODAY)}, replayed from the ledger</div></div>
              <div className="receipt-body">
                {Object.entries(ledger.balances).map(([b, bal]) => (
                  <div className="receipt-line" key={b}><span>{bal.label}</span><span className="num">{bal.unlimited ? <strong>Unlimited</strong> : <><strong>{fmt(bal.available)}</strong> {bal.unit}</>}</span></div>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
      {toast && <Toast>{toast}</Toast>}
    </div>
  );
}

function Outcome({ result, e, approvedId, onApprove, onFlash }: { result: PipelineResult; e: Employee; approvedId: string | null; onApprove: () => void; onFlash: (m: string) => void }) {
  const { state, dispatch } = useApp();
  const [sickFrom, setSickFrom] = useState(result.request.from);
  const [sickTo, setSickTo] = useState(result.request.from);
  const [certified, setCertified] = useState(true);
  const [asked, setAsked] = useState(true);
  const unit = result.parts[0]?.unit ?? 'days';
  const live = useMemo(() => (approvedId ? buildLedger(e, state.inputs, result.request.to, { today: TODAY }) : null), [approvedId, state.rev]);
  const sickEvents = live?.events.filter((x) => x.requestId === approvedId && (x.type === 'RESTORE' || (x.type === 'ADJUST' && x.amount === 0) || (x.type === 'DEBIT' && /sick/i.test(x.explanation)))) ?? [];

  if (!result.ok) {
    return (
      <div className="receipt reveal">
        <div className="receipt-head"><strong>Request refused</strong><div className="muted small">{result.error?.code.replace(/_/g, ' ').toLowerCase()}</div></div>
        <div className="receipt-body"><p className="small" style={{ margin: 0 }}>{result.error?.message}</p></div>
      </div>
    );
  }
  return (
    <div className="receipt reveal">
      <div className="receipt-head">
        <div className="row"><strong>{approvedId ? 'Approved' : 'Ready for approval'}</strong><span className="spacer" /><span className="muted small">to {result.approverId}</span></div>
        <div className="muted small">{fmtDate(result.request.from)} to {fmtDate(result.request.to)}</div>
      </div>
      <div className="receipt-body">
        {result.parts.map((p) => (
          <div className="receipt-line" key={p.leaveYear}><span>Charged to leave year {p.leaveYear}</span><Amount n={-p.amount} unit={p.unit} /></div>
        ))}
        {Object.keys(result.balanceAfter).filter((b) => result.balanceBefore[b] !== result.balanceAfter[b]).map((b) => (
          <div className="receipt-line" key={b}>
            <span>{result.bucketLabels[b] ?? b}, balance at end of leave</span>
            <span className="num">{result.balanceAfter[b] < 0 && result.balanceBefore[b] <= 0 ? <>unlimited, <strong>{fmt(-result.balanceAfter[b])}</strong> {unit} used</> : <>{fmt(result.balanceBefore[b])} to <strong>{fmt(result.balanceAfter[b])}</strong> {unit}</>}</span>
          </div>
        ))}
        <details style={{ marginTop: '0.6rem' }}>
          <summary className="small">Payroll export ({result.payroll.length} line{result.payroll.length > 1 ? 's' : ''})</summary>
          <div className="payroll" style={{ marginTop: '0.4rem' }}>{result.payroll.map((l) => JSON.stringify(l)).join('\n')}</div>
        </details>
        {!approvedId ? (
          <div className="row" style={{ marginTop: '0.8rem' }}>
            <button className="btn btn-primary" onClick={onApprove}>Approve as manager</button>
          </div>
        ) : (
          <div className="stack" style={{ marginTop: '0.9rem' }}>
            <div className="callout small">Now test the edge case: report sickness during this leave and watch what local law does.</div>
            <div className="row">
              <label className="field">From<input type="date" value={sickFrom} min={result.request.from} max={result.request.to} onChange={(x) => setSickFrom(x.target.value)} /></label>
              <label className="field">To<input type="date" value={sickTo} min={sickFrom} max={result.request.to} onChange={(x) => setSickTo(x.target.value)} /></label>
            </div>
            <div className="row">
              <label className="check"><input type="checkbox" checked={certified} onChange={(x) => setCertified(x.target.checked)} />Medical certificate</label>
              <label className="check"><input type="checkbox" checked={asked} onChange={(x) => setAsked(x.target.checked)} />Employee asks to reschedule</label>
            </div>
            <button className="btn" disabled={!sickFrom || !sickTo || sickTo < sickFrom} onClick={() => {
              dispatch({ type: 'addSickness', record: { id: `s-${Date.now()}`, employeeId: e.id, from: sickFrom, to: sickTo, certified, employeeAskedToReschedule: asked } });
              onFlash('Sickness recorded; ledger replayed');
            }}>Report sickness</button>
            {sickEvents.map((ev) => (
              <div key={ev.id} className="receipt-line reveal" style={{ gridTemplateColumns: '1fr auto' }}>
                <span className="small">{ev.explanation}<Citation rule={ev.rule} compact /></span>
                <Amount n={ev.amount} unit={ev.unit} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
