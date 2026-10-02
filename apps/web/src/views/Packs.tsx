import { useMemo, useState } from 'react';
import {
  buildLedger, getBasePack, getPack, setPackOverride, validatePack, walkRules, resolvePackId,
  type Pack, type RuleRef, type Bucket,
} from '@spine/engine';
import { useApp, people, personById, ENTITY_ORDER, TODAY } from '../state';
import { Citation, Ent, fmt, fmtDate } from '../components/bits';

function VerifBar({ rules }: { rules: RuleRef[] }) {
  const n = (v: string) => rules.filter((r) => r.verification === v).length;
  const parts = [['public-verified', 'var(--ok)'], ['public-unverified', 'var(--over)'], ['assumption', 'var(--review)']] as const;
  return (
    <div>
      <div className="vbar" aria-hidden>{parts.map(([v, c]) => <span key={v} style={{ width: `${(n(v) / rules.length) * 100}%`, background: c }} />)}</div>
      <div className="small muted" style={{ marginTop: '0.3rem' }}>{rules.length} rules: {n('public-verified')} checked against a source, {n('public-unverified')} public but not yet checked, {n('assumption')} our assumptions. None verified against Groupon policy yet.</div>
    </div>
  );
}

function RuleRow({ label, rule, children }: { label: string; rule: RuleRef; children?: React.ReactNode }) {
  return (
    <div style={{ padding: '0.55rem 0', borderBottom: '1px dotted var(--line)' }}>
      <div className="row"><strong className="small">{label}</strong>{children}</div>
      <Citation rule={rule} />
    </div>
  );
}

type Edit = { path: (string | number)[]; label: string; kind: 'number' | 'bool' | 'select' | 'nullableNumber' | 'text'; options?: string[] };

function editsFor(p: Pack): Edit[] {
  const out: Edit[] = [];
  p.buckets.forEach((b: Bucket, i) => {
    const pre = p.buckets.length > 1 ? `${b.id}: ` : '';
    for (const [k, v] of Object.entries(b.entitlement.params)) if (typeof v === 'number') out.push({ path: ['buckets', i, 'entitlement', 'params', k], label: `${pre}entitlement ${k}`, kind: 'number' });
    out.push({ path: ['buckets', i, 'usableFromDays'], label: `${pre}usable from day`, kind: 'number' });
    out.push({ path: ['buckets', i, 'carryOver', 'max'], label: `${pre}carry-over limit (blank = no limit)`, kind: 'nullableNumber' });
    out.push({ path: ['buckets', i, 'carryOver', 'expiresMonthDay'], label: `${pre}carried leave expires (MM-DD)`, kind: 'text' });
    out.push({ path: ['buckets', i, 'carryOver', 'conditionalOnNotice'], label: `${pre}lapse needs a written warning`, kind: 'bool' });
    out.push({ path: ['buckets', i, 'sickDuringLeave', 'mode'], label: `${pre}sick during leave`, kind: 'select', options: ['restore-if-certified', 'restore-on-request', 'restore', 'convert-to-sick-bank'] });
    out.push({ path: ['buckets', i, 'payoutOnTermination', 'mode'], label: `${pre}payout on leaving`, kind: 'select', options: ['remaining', 'none'] });
  });
  out.push({ path: ['holidayPolicy', 'deductFromEntitlement'], label: 'public holidays count toward leave', kind: 'bool' });
  out.push({ path: ['holidayPolicy', 'onNonWorkingDay'], label: 'holiday on a day off', kind: 'select', options: ['nothing', 'extra-leave', 'designate-day-off-task'] });
  return out;
}
const getAt = (o: any, path: (string | number)[]) => path.reduce((x, k) => x?.[k], o);
function setAt(o: any, path: (string | number)[], v: unknown) { const last = path[path.length - 1]; const parent = getAt(o, path.slice(0, -1)); parent[last] = v; }

export function Packs() {
  const { state, dispatch } = useApp();
  const initial = personById(state.employeeId).packId;
  const [id, setId] = useState(ENTITY_ORDER.includes(initial) ? initial : 'DE-BE');
  const [year, setYear] = useState(2026);
  const [raw, setRaw] = useState(false);
  const pack = useMemo(() => getPack(id, year), [id, year, state.rev]);
  const base = useMemo(() => getBasePack(id, year), [id, year]);
  const corrected = state.overrides.some((o) => o.id === id && o.year === year);
  const rules = walkRules(pack);
  const edits = editsFor(pack);

  const [invalid, setInvalid] = useState<string | null>(null);
  function change(path: (string | number)[], v: unknown) {
    const next = structuredClone(pack);
    setAt(next, path, v);
    next.owner = { ...next.owner, signOff: { status: 'pending', by: null, on: null } };
    const errs = validatePack(next);
    if (errs.length) { setInvalid(errs.join('; ')); return; }
    setInvalid(null);
    dispatch({ type: 'override', id, year, pack: JSON.stringify(stripStamp(next)) === JSON.stringify(stripStamp(base)) ? null : next });
  }

  // Impact of the correction: replay every person in this entity with the shipped pack and with the corrected one.
  const impact = useMemo(() => {
    if (!corrected) return [];
    const staff = people.filter((p) => p.packId === id && (() => { try { resolvePackId(p); return true; } catch { return false; } })());
    const asOfs = year === 2026 ? ['2026-12-31', '2027-04-30'] : ['2027-06-30', '2027-12-31'];
    const run = () => staff.map((p) => asOfs.map((a) => Object.values(buildLedger(p, state.inputs, a, { today: TODAY }).balances).reduce((s, b) => s + b.available, 0)));
    const after = run();
    setPackOverride(base);
    const before = run();
    setPackOverride(pack);
    return staff.map((p, i) => ({ p, before: before[i], after: after[i], asOfs })).filter((r) => r.before.some((b, k) => Math.abs(b - r.after[k]) > 0.001));
  }, [corrected, id, year, state.rev]);

  return (
    <div>
      <h1 className="h2">Rule packs</h1>
      <p className="muted" style={{ marginTop: 0, maxWidth: '70ch' }}>Everything local lives here, as data with a citation, a verification status and a named legal owner. The engine code is the same for every entity.</p>
      <div className="row" style={{ marginBottom: '1rem' }}>
        <div className="seg" role="group" aria-label="Entity">{ENTITY_ORDER.map((e) => <button key={e} aria-pressed={id === e} onClick={() => setId(e)}>{e}</button>)}</div>
        <div className="seg" role="group" aria-label="Year">{[2026, 2027].map((y) => <button key={y} aria-pressed={year === y} onClick={() => setYear(y)}>{y}</button>)}</div>
        <span className="spacer" />
        <button className="btn btn-quiet small" onClick={() => setRaw(!raw)}>{raw ? 'Readable view' : 'Show pack file'}</button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', alignItems: 'start' }}>
        <div className="stack">
          <div className="panel">
            <div className="row"><Ent id={pack.id} /><h2 className="h3" style={{ margin: 0 }}>{pack.entity}</h2></div>
            <p className="small muted" style={{ margin: '0.3rem 0' }}>{pack.region}, version {pack.version}{corrected && ', with your draft correction'}. Owner: {pack.owner.role}. Sign-off: {pack.owner.signOff.status}.</p>
            <p style={{ margin: '0.5rem 0 0.8rem' }}>{pack.summary}</p>
            <VerifBar rules={rules} />
          </div>

          {raw ? (
            <div className="panel"><div className="json">{JSON.stringify(stripStamp(pack), null, 2)}</div></div>
          ) : (
            <>
              <div className="panel">
                <h3 className="h3">Who and how leave is counted</h3>
                <RuleRow label="Where this pack applies" rule={pack.locationAssumption} />
                <RuleRow label="Counting" rule={pack.counting.rule}><span className="chip">{pack.counting.mode}</span></RuleRow>
                <RuleRow label="Public holiday policy" rule={pack.holidayPolicy.rule} />
              </div>
              {pack.buckets.map((b) => (
                <div className="panel" key={b.id}>
                  <h3 className="h3">{b.label} <span className="chip">{b.unit}</span></h3>
                  <RuleRow label="Entitlement" rule={b.entitlement.rule}><span className="chip">{b.entitlement.strategy}</span></RuleRow>
                  <RuleRow label="Accrual" rule={b.accrual.rule}><span className="chip">{b.accrual.strategy}</span>{b.usableFromDays > 0 && <span className="chip">usable from day {b.usableFromDays}</span>}</RuleRow>
                  <RuleRow label="Carry-over" rule={b.carryOver.rule}><span className="chip">{b.carryOver.max === null ? 'no limit' : `max ${b.carryOver.max}`}{b.carryOver.expiresMonthDay ? `, until ${b.carryOver.expiresMonthDay}` : ''}</span></RuleRow>
                  <RuleRow label="Sick during leave" rule={b.sickDuringLeave.rule}><span className="chip">{b.sickDuringLeave.mode}</span></RuleRow>
                  <RuleRow label="On leaving" rule={b.payoutOnTermination.rule}><span className="chip">{b.payoutOnTermination.mode === 'remaining' ? 'pay out' : 'no payout'}</span></RuleRow>
                </div>
              ))}
              <div className="panel">
                <h3 className="h3">Public holidays {year}</h3>
                <Citation rule={pack.holidays.source} />
                {pack.holidays.loaded ? (
                  <div className="tbl-wrap" style={{ marginTop: '0.5rem' }}>
                    <table className="tbl"><tbody>{pack.holidays.dates.map((h) => <tr key={h.date}><td className="num">{fmtDate(h.date)}</td><td>{new Date(h.date + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}</td><td>{h.name}</td></tr>)}</tbody></table>
                  </div>
                ) : <p className="callout warn small">Not loaded. Requests in {year} are refused until the calendar is published, loaded and signed off.</p>}
              </div>
              {pack.extras.length > 0 && (
                <div className="panel">
                  <h3 className="h3">Other rules and open points</h3>
                  {pack.extras.map((x) => <RuleRow key={x.ruleId} label={x.label} rule={x} />)}
                </div>
              )}
            </>
          )}
        </div>

        <div className="stack" style={{ position: 'sticky', top: '5rem' }}>
          <div className="panel">
            <h2 className="h3">Try a correction</h2>
            <p className="small muted" style={{ marginTop: 0 }}>
              If legal review finds a rule is wrong, the fix is a change to this pack, not to the engine. Edit a value: every balance replays
              and the people affected are listed below. Corrections stay in this browser until you reset the demo.
            </p>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: '0.6rem' }}>
              {edits.map((ed) => {
                const v = getAt(pack, ed.path), b0 = getAt(base, ed.path);
                const changed = JSON.stringify(v) !== JSON.stringify(b0);
                const key = ed.path.join('.');
                return (
                  <label key={key} className="field" style={changed ? { color: 'var(--spine-ink)', fontWeight: 600 } : undefined}>
                    {ed.label}
                    {ed.kind === 'bool' ? (
                      <select value={String(v)} onChange={(x) => change(ed.path, x.target.value === 'true')}><option value="true">yes</option><option value="false">no</option></select>
                    ) : ed.kind === 'select' ? (
                      <select value={String(v)} onChange={(x) => change(ed.path, x.target.value)}>{ed.options!.map((o) => <option key={o}>{o}</option>)}</select>
                    ) : ed.kind === 'text' ? (
                      <DraftText key={`${id}-${year}-${key}-${String(v)}`} value={(v as string | null) ?? ''} onCommit={(t) => change(ed.path, t || null)} />
                    ) : (
                      <input type="number" step="any" min={0} value={v ?? ''} placeholder={ed.kind === 'nullableNumber' ? 'no limit' : ''}
                        onChange={(x) => { const t = x.target.value; if (t === '' && ed.kind === 'nullableNumber') change(ed.path, null); else if (t !== '' && Number(t) >= 0) change(ed.path, Number(t)); }} />
                    )}
                  </label>
                );
              })}
            </div>
            {invalid && <p className="callout bad small" role="alert" style={{ marginBottom: 0 }}>Not applied: {invalid}</p>}
            {corrected && (
              <div className="row" style={{ marginTop: '0.8rem' }}>
                <span className="chip v-review">Draft correction, sign-off reset to pending</span>
                <span className="spacer" />
                <button className="btn btn-quiet small" onClick={() => dispatch({ type: 'override', id, year, pack: null })}>Discard correction</button>
              </div>
            )}
          </div>
          {corrected && (
            <div className="panel reveal">
              <h3 className="h3">Who this changes</h3>
              {impact.length === 0 ? <p className="muted small">No balances change for the sample people. The rule may only bite in situations the dataset doesn't contain.</p> : (
                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead><tr><th>Person</th>{impact[0].asOfs.map((a) => <th key={a} className="n">{fmtDate(a)}</th>)}</tr></thead>
                    <tbody>
                      {impact.map((r) => (
                        <tr key={r.p.id}>
                          <td><button className="btn btn-quiet small" onClick={() => dispatch({ type: 'go', view: 'ledger', employeeId: r.p.id })}>{r.p.name}</button></td>
                          {r.before.map((b, k) => <td key={k} className="n">{fmt(b)} to <strong>{fmt(r.after[k])}</strong></td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="small muted" style={{ marginBottom: 0 }}>To ship it: change the JSON in <code>packages/engine/src/packs/{id}.{year}.json</code>, add a test that pins the corrected behaviour, run <code>npm test</code>, and get the owner's sign-off.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Text field that keeps a local draft while typing and commits on blur or Enter. */
function DraftText({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const commit = () => { const t = draft.trim(); if (t !== value) onCommit(t); };
  return <input value={draft} placeholder="none (MM-DD)" onChange={(x) => setDraft(x.target.value)} onBlur={commit} onKeyDown={(x) => { if (x.key === 'Enter') commit(); }} />;
}

function stripStamp(p: Pack) {
  return JSON.parse(JSON.stringify(p, (k, v) => (k === 'packId' || k === 'packVersion' ? undefined : v)));
}
