import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  approveRequest, buildLedger, expandDays, getPack, STAGES, submitRequest, resolvePackId,
  addDays, dow, endOfMonth, iso, yearOf,
  type DayLine, type Employee, type PipelineResult, type RequestKind, type LeaveRequest,
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

function Month({ e, y, m, from, to, booked, sick, onPick }: {
  e: Employee; y: number; m: number; from?: string; to?: string;
  booked: Map<string, 'approved' | 'pending'>; sick: Set<string>; onPick: (d: string) => void;
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
            b ? `booked ${b}` : '', sick.has(date) ? 'sick' : '', sel ? 'sel' : '', out ? 'out' : ''].join(' ');
          const tag = line?.holidayName ?? (sick.has(date) ? 'sick' : b === 'approved' && line?.kind === 'counted' ? 'booked' : b === 'pending' ? 'pending' : line?.kind === 'non-working' ? 'off' : '');
          return (
            <button key={date} className={cls} disabled={out} onClick={() => onPick(date)}
              title={line?.holidayName}
              aria-label={`${fmtDate(date)}${line?.holidayName ? `, ${line.holidayName}` : ''}${line?.kind === 'non-working' ? ', not a working day' : ''}${b ? `, ${b} leave` : ''}${sick.has(date) ? ', reported sick' : ''}`}
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
    for (const r of state.inputs.requests.filter((x) => x.employeeId === e.id && (x.status === 'approved' || x.status === 'pending')))
      for (let d = r.from; d <= r.to; d = addDays(d, 1)) m.set(d, r.status === 'approved' ? 'approved' : 'pending');
    return m;
  }, [state.inputs.requests, e.id]);

  const sickDays = useMemo(() => {
    const set = new Set<string>();
    for (const r of state.inputs.sickness.filter((x) => x.employeeId === e.id)) for (let d = r.from; d <= r.to; d = addDays(d, 1)) set.add(d);
    return set;
  }, [state.inputs.sickness, e.id]);
  const [sickFor, setSickFor] = useState<string | null>(null);
  const [confirmWithdraw, setConfirmWithdraw] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const left = !!e.terminationDate && e.terminationDate < TODAY;
  const ledger = useMemo(() => (jurisdictionError ? null : buildLedger(e, state.inputs, TODAY, { today: TODAY })), [e.id, state.rev, jurisdictionError]);
  const myRequests = state.inputs.requests.filter((r) => r.employeeId === e.id).sort((a, b) => a.from.localeCompare(b.from));

  function clearRun() {
    if (timer.current) window.clearInterval(timer.current);
    setResult(null); setShown(0); setApprovedId(null);
  }

  // Reset when the person changes.
  useEffect(() => {
    clearRun(); setFrom(undefined); setTo(undefined); setKind('annual'); setSickFor(null); setConfirmWithdraw(null);
    setCursor({ y: 2026, m: 10 });
  }, [e.id]);

  // Overview "Run the Berlin example" preset. If those dates are already booked in this demo, show the booking instead of a refusal.
  useEffect(() => {
    const p = state.deskPreset;
    if (!p) return;
    dispatch({ type: 'consumePreset' });
    setCursor({ y: yearOf(p.from), m: Number(p.from.slice(5, 7)) });
    const booked = state.inputs.requests.find((r) => r.employeeId === e.id && r.status === 'approved' && r.from <= p.to && r.to >= p.from);
    if (booked) {
      setSickFor(booked.id);
      flash('Already booked in this demo: report sickness below, withdraw it, or use Reset demo to replay from the start');
      return;
    }
    setFrom(p.from); setTo(p.to); setKind('annual');
    if (p.autorun) setTimeout(() => run(p.from, p.to, 'annual'), 250);
  }, [state.deskPreset]);

  // Tour "do it for me": open the sickness panel on that request.
  useEffect(() => {
    if (state.focus?.startsWith('sick:')) { clearRun(); setSickFor(state.focus.slice(5)); }
  }, [state.focus]);

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
    setResult(r); setApprovedId(null); setSickFor(null);
    // Bring the spine into view when it is off-screen (narrow layouts put it below the calendar).
    window.setTimeout(() => {
      const el = railRef.current;
      if (el && (el.getBoundingClientRect().top > window.innerHeight || el.getBoundingClientRect().bottom < 0))
        el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
    }, 50);
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
              {months.map((mm) => <Month key={`${mm.y}-${mm.m}`} e={e} y={mm.y} m={mm.m} from={from} to={to} booked={booked} sick={sickDays} onPick={pick} />)}
            </div>
            <div className="legend">
              <span><i style={{ background: 'var(--spine)' }} />Selected</span>
              <span><i style={{ background: 'var(--over-soft)' }} />Public holiday</span>
              <span><i style={{ background: 'var(--surface-2)' }} />Not a working day</span>
              <span><i style={{ background: 'var(--spine-soft)' }} />Booked</span>
              <span><i style={{ backgroundImage: 'var(--hatch)' }} />Pending</span>
              <span><i style={{ background: 'var(--breach-soft)' }} />Reported sick</span>
            </div>
            <div className="row" style={{ marginTop: '1rem' }}>
              <span className="small">{left ? <>{e.name.split(' ')[0]} left on {fmtDate(e.terminationDate!)}. New requests can't be booked; the payout is in the Ledger.</> : from ? <>Selected <strong>{fmtDate(from)}</strong>{to && to !== from && <> to <strong>{fmtDate(to)}</strong></>}</> : 'Click a start date, then an end date.'}</span>
              <span className="spacer" />
              {from && <button className="btn btn-quiet" onClick={() => { setFrom(undefined); setTo(undefined); clearRun(); }}>Clear</button>}
              <button className="btn btn-primary" disabled={!from || left} onClick={() => run()}>Check request</button>
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
                      <Fragment key={r.id}>
                        <tr style={r.status === 'withdrawn' ? { opacity: 0.55 } : undefined}>
                          <td>{fmtDate(r.from)}{r.to !== r.from && <> to {fmtDate(r.to)}</>}</td>
                          <td>{KIND_LABEL[r.kind]}</td>
                          <td><span className={`chip ${r.status === 'approved' ? 'v-ok' : r.status === 'pending' ? 'v-review' : r.status === 'withdrawn' ? '' : 'v-breach'}`}>{r.status}</span></td>
                          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                            {r.status === 'pending' && <button className="btn btn-quiet small" onClick={() => { setFrom(r.from); setTo(r.to); setKind(r.kind); setCursor({ y: yearOf(r.from), m: Number(r.from.slice(5, 7)) }); run(r.from, r.to, r.kind, r.id); }}>Process</button>}
                            {r.status === 'approved' && r.kind !== 'sick-bank' && <button className="btn btn-quiet small" onClick={() => setSickFor(sickFor === r.id ? null : r.id)}>{sickFor === r.id ? 'Close' : 'Report sickness'}</button>}
                            {r.status === 'approved' && (confirmWithdraw === r.id
                              ? <><button className="btn btn-quiet small" onClick={() => { dispatch({ type: 'withdrawRequest', id: r.id }); setConfirmWithdraw(null); if (result?.request.id === r.id) clearRun(); flash('Request withdrawn; kept in the audit trail'); }}>Confirm withdraw</button><button className="btn btn-quiet small" onClick={() => setConfirmWithdraw(null)}>Keep</button></>
                              : <button className="btn btn-quiet small" onClick={() => setConfirmWithdraw(r.id)}>Withdraw</button>)}
                          </td>
                        </tr>
                        {state.inputs.sickness.filter((x) => x.employeeId === e.id && r.status === 'approved' && x.from <= r.to && x.to >= r.from).map((x) => (
                          <tr key={x.id}><td colSpan={4} className="small muted" style={{ paddingLeft: '1.5rem' }}>Sick {fmtDate(x.from)}{x.to !== x.from && <> to {fmtDate(x.to)}</>}{sickNote(e, x)}</td></tr>
                        ))}
                        {sickFor === r.id && <tr><td colSpan={4}><SicknessPanel request={r} e={e} onFlash={flash} /></td></tr>}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <aside className="stack">
          <div className="panel" ref={railRef} style={{ scrollMarginTop: '5rem' }}>
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

const REFUSAL_TITLE: Record<string, string> = {
  INVALID_RANGE: 'Check the dates', ZERO_DAYS: 'No working time in this range', OVERLAP: 'Already booked', NOT_EMPLOYED: 'Outside employment',
  NOT_YET_USABLE: 'Not usable yet', INSUFFICIENT_BALANCE: 'Not enough leave', KIND_NOT_ALLOWED: 'Leave type not offered here',
  ON_DEMAND_LIMIT: 'On-demand days used up', CALENDAR_NOT_LOADED: 'Holiday calendar not published yet', PACK_NOT_FOUND: 'No rule pack for that year',
  NO_PACK_FOR_LOCATION: 'No rule pack for this work location', INVALID_PATTERN: 'Working pattern missing or invalid',
};

const SICK_HELP: Record<string, string> = {
  'restore-if-certified': 'Days come back only with a medical certificate.',
  'restore-on-request': 'Days come back when the employee asks to reschedule them.',
  restore: 'Leave is postponed; the days come back automatically.',
  'convert-to-sick-bank': 'Hours move from Paid Leave to the Paid Sick Leave bank, while it has hours.',
};

function sickNote(e: Employee, x: { certified: boolean; employeeAskedToReschedule?: boolean; from: string }) {
  const mode = getPack(e.packId, Math.min(2027, yearOf(x.from))).buckets[0].sickDuringLeave.mode;
  if (mode === 'restore-if-certified' || mode === 'convert-to-sick-bank') return x.certified ? ', with a medical certificate' : ', no medical certificate';
  if (mode === 'restore-on-request') return x.employeeAskedToReschedule ? ', employee asked to reschedule' : ', employee did not ask to reschedule';
  return ', reported';
}

function defaultSickDates(r: LeaveRequest): [string, string] {
  if (r.from <= '2026-12-29' && r.to >= '2026-12-30') return ['2026-12-29', '2026-12-30'];
  return [r.from, r.from];
}

/** Report sickness during an approved leave, and show what local law does with it, live. */
export function SicknessPanel({ request, e, onFlash }: { request: LeaveRequest; e: Employee; onFlash: (m: string) => void }) {
  const { state, dispatch } = useApp();
  const [d0, d1] = defaultSickDates(request);
  const [sickFrom, setSickFrom] = useState(d0);
  const [sickTo, setSickTo] = useState(d1);
  const [certified, setCertified] = useState(true);
  const [asked, setAsked] = useState(true);
  const mode = getPack(e.packId, Math.min(2027, yearOf(request.from))).buckets[0].sickDuringLeave.mode;
  const ledger = useMemo(() => buildLedger(e, state.inputs, request.to, { today: TODAY }), [state.rev, request.id]);
  const without = useMemo(() => buildLedger(e, { ...state.inputs, sickness: state.inputs.sickness.filter((x) => !(x.employeeId === e.id && x.from <= request.to && x.to >= request.from)) }, request.to, { today: TODAY }), [state.rev, request.id]);
  const records = state.inputs.sickness.filter((x) => x.employeeId === e.id && x.from <= request.to && x.to >= request.from);
  const events = ledger.events.filter((x) => x.requestId === request.id && (x.type === 'RESTORE' || (x.type === 'ADJUST' && x.amount === 0) || (x.type === 'DEBIT' && /sick/i.test(x.explanation))));
  const main = Object.keys(ledger.balances)[0];
  const changed = Object.keys(ledger.balances).filter((b) => Math.abs(ledger.balances[b].available - (without.balances[b]?.available ?? 0)) > 0.001);
  return (
    <div className="stack">
      <div className="callout small">Now the edge case: report sickness during this leave and see what {getPack(e.packId, 2026).country === 'DE' ? 'German' : 'local'} law does. {SICK_HELP[mode]}</div>
      <div className="row">
        <label className="field">Sick from<input type="date" value={sickFrom} min={request.from} max={request.to} onChange={(x) => { setSickFrom(x.target.value); if (x.target.value > sickTo) setSickTo(x.target.value); }} /></label>
        <label className="field">Sick until<input type="date" value={sickTo} min={sickFrom} max={request.to} onChange={(x) => setSickTo(x.target.value)} /></label>
      </div>
      <div className="row">
        {(mode === 'restore-if-certified' || mode === 'convert-to-sick-bank') && <label className="check"><input type="checkbox" checked={certified} onChange={(x) => setCertified(x.target.checked)} />Medical certificate provided</label>}
        {mode === 'restore-on-request' && <label className="check"><input type="checkbox" checked={asked} onChange={(x) => setAsked(x.target.checked)} />Employee asks to reschedule the days</label>}
      </div>
      <div className="row">
        <button className="btn" disabled={!sickFrom || !sickTo || sickTo < sickFrom} onClick={() => {
          dispatch({ type: 'addSickness', record: { id: `s-${e.id}-${sickFrom}`, employeeId: e.id, from: sickFrom, to: sickTo, certified, employeeAskedToReschedule: asked } });
          onFlash(records.length ? 'Sickness report updated; ledger replayed' : 'Sickness recorded; ledger replayed');
        }}>{records.length ? 'Update sickness report' : 'Report sickness'}</button>
        {records.length > 0 && <button className="btn btn-quiet" onClick={() => { records.forEach((r) => dispatch({ type: 'removeSickness', id: r.id })); onFlash('Sickness report removed'); }}>Remove report</button>}
      </div>
      {events.map((ev) => (
        <div key={ev.id} className="receipt-line reveal">
          <span className="small">{ev.explanation}<Citation rule={ev.rule} compact /></span>
          <Amount n={ev.amount} unit={ev.unit} />
        </div>
      ))}
      {records.length > 0 && (
        <div className="receipt-line reveal">
          <span className="small">Balance on {fmtDate(request.to)}{changed.length ? '' : ' (unchanged)'}</span>
          <span className="num">{changed.length ? <>{fmt(without.balances[changed[0]].available)} to <strong>{fmt(ledger.balances[changed[0]].available)}</strong></> : <strong>{fmt(ledger.balances[main].available)}</strong>} {ledger.balances[changed[0] ?? main].unit}</span>
        </div>
      )}
    </div>
  );
}

function Outcome({ result, e, approvedId, onApprove, onFlash }: { result: PipelineResult; e: Employee; approvedId: string | null; onApprove: () => void; onFlash: (m: string) => void }) {
  const { state } = useApp();
  const unit = result.parts[0]?.unit ?? 'days';
  const approver = e.managerId ? personById(e.managerId)?.name : null;
  const approved = approvedId ? state.inputs.requests.find((r) => r.id === approvedId) : undefined;

  if (!result.ok) {
    return (
      <div className="receipt reveal">
        <div className="receipt-head"><strong>Refused: {REFUSAL_TITLE[result.error!.code] ?? 'request refused'}</strong></div>
        <div className="receipt-body"><p className="small" style={{ margin: 0 }}>{result.error?.message}</p></div>
      </div>
    );
  }
  return (
    <div className="receipt reveal">
      <div className="receipt-head">
        <div className="row"><strong>{approvedId ? 'Approved and posted' : 'Ready for approval'}</strong><span className="spacer" /><span className="muted small">{approver ? `${approver}, line manager` : 'HR operations'}</span></div>
        <div className="muted small">{fmtDate(result.request.from)} to {fmtDate(result.request.to)}</div>
      </div>
      <div className="receipt-body">
        {result.parts.map((p) => (
          <div className="receipt-line" key={p.leaveYear}><span>Charged to {p.leaveYear} leave</span><Amount n={-p.amount} unit={p.unit} /></div>
        ))}
        {Object.keys(result.balanceAfter).filter((b) => result.balanceBefore[b] !== result.balanceAfter[b]).map((b) => (
          <div className="receipt-line" key={b}>
            <span>{result.bucketLabels[b] ?? b}<span className="muted small" style={{ display: 'block' }}>Balance on {fmtDate(result.request.to)}, including any grant due by then, without and with this leave</span></span>
            <span className="num">{result.balanceAfter[b] < 0 && result.balanceBefore[b] <= 0 ? <>unlimited, <strong>{fmt(-result.balanceAfter[b])}</strong> {unit} used</> : <>{fmt(result.balanceBefore[b])} to <strong>{fmt(result.balanceAfter[b])}</strong> {unit}</>}</span>
          </div>
        ))}
        <details style={{ marginTop: '0.6rem' }}>
          <summary className="small">Payroll export ({result.payroll.length} {result.payroll.length === 1 ? 'line' : 'lines'}, same format in every entity)</summary>
          <div className="tbl-wrap" style={{ marginTop: '0.4rem' }}>
            <table className="tbl">
              <thead><tr><th>Entity</th><th>Code</th><th>From</th><th>To</th><th className="n">Amount</th><th>Leave year</th><th>Pack</th></tr></thead>
              <tbody>{result.payroll.map((l, i) => <tr key={i}><td>{l.entity.split('(')[0]}</td><td>{l.absenceCode}</td><td>{fmtDate(l.from)}</td><td>{fmtDate(l.to)}</td><td className="n">{fmt(l.amount)} {l.unit === 'hours' ? 'h' : 'd'}</td><td>{l.leaveYear}</td><td>v{l.packVersion}</td></tr>)}</tbody>
            </table>
          </div>
        </details>
        {!approvedId ? (
          <div className="row" style={{ marginTop: '0.8rem' }}>
            <button className="btn btn-primary" onClick={onApprove}>{approver ? 'Approve as line manager' : 'Approve as HR operations'}</button>
          </div>
        ) : approved && <div style={{ marginTop: '0.9rem' }}><SicknessPanel request={approved} e={e} onFlash={onFlash} /></div>}
      </div>
    </div>
  );
}
