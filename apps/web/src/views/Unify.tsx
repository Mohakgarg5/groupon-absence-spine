import { useMemo, useState } from 'react';
import { runStressTest, getPack, NAIVE_GLOBAL, type Dimension, type StressRow, type GlobalPolicy } from '@spine/engine';
import { useApp, people, personById, ENTITY_ORDER } from '../state';
import { Citation, Ent } from '../components/bits';

const DIMS: { id: Dimension; label: string; probe: string }[] = [
  { id: 'entitlement', label: 'How much leave', probe: 'Full-year entitlement in days off on the person\'s own working pattern.' },
  { id: 'seniority', label: 'Seniority', probe: 'Does seniority come from Groupon tenure, or from statute?' },
  { id: 'carry-over', label: 'Unused leave at year end', probe: 'Probe: 5 days unused on 31 December, no written warning sent.' },
  { id: 'sick-during-leave', label: 'Sick on holiday', probe: 'Probe: 2 certified sick days inside a week of leave.' },
  { id: 'holidays', label: 'Public holidays', probe: 'Holiday rules for 2026 counted from each person\'s real ledger.' },
  { id: 'jurisdiction', label: 'Which law applies', probe: 'Is there a rule pack for where the person actually works?' },
];
const VERDICT_LABEL = { breach: 'Breaks local law', overspend: 'Overpays', review: 'Needs legal review', ok: 'Compatible' } as const;
const worst = (rows: StressRow[]) => (rows.some((r) => r.verdict === 'breach') ? 'breach' : rows.some((r) => r.verdict === 'overspend') ? 'overspend' : rows.some((r) => r.verdict === 'review') ? 'review' : 'ok');

const PRESETS: { id: string; label: string; policy: GlobalPolicy }[] = [
  { id: 'naive', label: 'Simple global policy', policy: NAIVE_GLOBAL },
  { id: 'generous', label: 'Generous global policy', policy: { ...NAIVE_GLOBAL, name: 'Generous global policy', daysPerYear: 26, proRataPartTime: true, carryOver: 'capped', carryDays: 5, carryUntil: '09-30', lapseNeedsWarning: true, sickDuringLeave: 'restored-with-certificate', holidayOnDayOff: 'extra-day' } },
  { id: 'zero', label: 'Zero-breach policy', policy: { ...NAIVE_GLOBAL, name: 'Zero-breach global policy', daysPerYear: 27, proRataPartTime: true, carryOver: 'capped', carryDays: 5, carryUntil: '09-30', lapseNeedsWarning: true, sickDuringLeave: 'restored-with-certificate', holidayOnDayOff: 'extra-day' } },
];
const GROUPON_HEADCOUNT = 1734; // FY2025 10-K
const WORKING_DAYS_PER_FTE = 220; // assumption for scaling only

function PolicyDesigner({ policy, onChange }: { policy: GlobalPolicy; onChange: (p: GlobalPolicy) => void }) {
  const set = <K extends keyof GlobalPolicy>(k: K, v: GlobalPolicy[K]) => onChange({ ...policy, [k]: v, name: 'Your global policy' });
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 250px), 1fr))', gap: '0.7rem' }}>
      <label className="field">Days a year
        <input type="number" min={15} max={40} value={policy.daysPerYear} onChange={(x) => { const n = Number(x.target.value); if (n >= 15 && n <= 40) set('daysPerYear', n); }} />
      </label>
      <label className="field">Part-timers
        <select value={String(policy.proRataPartTime)} onChange={(x) => set('proRataPartTime', x.target.value === 'true')}>
          <option value="false">Same days as full-timers</option>
          <option value="true">Pro-rated to their working week</option>
        </select>
      </label>
      <label className="field">Tenure bonus
        <select value={policy.tenureBonusPerYears} onChange={(x) => set('tenureBonusPerYears', Number(x.target.value))}>
          <option value={0}>None</option><option value={3}>+1 day every 3 years</option><option value={5}>+1 day every 5 years</option>
        </select>
      </label>
      <label className="field">Unused days at year end
        <select value={policy.carryOver} onChange={(x) => onChange({ ...policy, name: 'Your global policy', carryOver: x.target.value as GlobalPolicy['carryOver'], carryDays: x.target.value === 'capped' ? Math.max(policy.carryDays, 5) : policy.carryDays })}>
          <option value="none">Lost on 31 December</option><option value="capped">Carry over, with a cap</option><option value="unlimited">Carry over without limit</option>
        </select>
      </label>
      {policy.carryOver === 'capped' && (
        <>
          <label className="field">Carry-over cap (days)
            <input type="number" min={1} max={30} value={policy.carryDays} onChange={(x) => { const n = Number(x.target.value); if (n >= 1 && n <= 30) set('carryDays', n); }} />
          </label>
          <label className="field">Carried days must be used by
            <select value={policy.carryUntil} onChange={(x) => set('carryUntil', x.target.value)}>
              <option value="03-31">31 March</option><option value="06-30">30 June</option><option value="09-30">30 September</option><option value="12-31">31 December</option>
            </select>
          </label>
          <label className="field">Before carried days lapse
            <select value={String(policy.lapseNeedsWarning)} onChange={(x) => set('lapseNeedsWarning', x.target.value === 'true')}>
              <option value="false">They just lapse</option><option value="true">Employee gets a written warning first</option>
            </select>
          </label>
        </>
      )}
      <label className="field">Sick during holiday
        <select value={policy.sickDuringLeave} onChange={(x) => set('sickDuringLeave', x.target.value as GlobalPolicy['sickDuringLeave'])}>
          <option value="consumed">Days stay used</option><option value="restored-with-certificate">Certified days are given back</option>
        </select>
      </label>
      <label className="field">Public holiday on a day off
        <select value={policy.holidayOnDayOff} onChange={(x) => set('holidayOnDayOff', x.target.value as GlobalPolicy['holidayOnDayOff'])}>
          <option value="ignore">Nothing extra</option><option value="extra-day">A day in lieu</option>
        </select>
      </label>
    </div>
  );
}

export function Unify() {
  const { state, dispatch } = useApp();
  const [policy, setPolicy] = useState<GlobalPolicy>(NAIVE_GLOBAL);
  const res = useMemo(() => runStressTest(people, state.inputs, policy), [state.rev, policy]);
  const perPerson = res.summary.aboveMinimumDays / people.length;
  const scaledDays = Math.round(perPerson * GROUPON_HEADCOUNT);
  const preset = PRESETS.find((p) => JSON.stringify({ ...p.policy, name: '' }) === JSON.stringify({ ...policy, name: '', description: undefined }))?.id;
  const [cell, setCell] = useState<{ ent: string; dim: Dimension }>({ ent: 'PL', dim: 'seniority' });
  const ORDER = { breach: 0, overspend: 1, review: 2, ok: 3 } as const;
  const rows = res.rows.filter((r) => r.packId === cell.ent && r.dimension === cell.dim).sort((a, b) => ORDER[a.verdict] - ORDER[b.verdict]);
  const dimInfo = DIMS.find((d) => d.id === cell.dim)!;

  return (
    <div>
      <h1 className="h2">Force-unify test</h1>
      <p className="muted" style={{ marginTop: 0, maxWidth: '70ch' }}>
        What happens if Groupon simply adopts one leave policy everywhere? Design one below. Each of the 30 people is run through your policy
        and through the same engine and rule packs that process real requests, and every gap is shown with the law behind it.
      </p>

      <div className="panel">
        <div className="row" style={{ marginBottom: '0.8rem' }}>
          <h2 className="h3" style={{ margin: 0 }}>Try to write one policy that works everywhere</h2>
          <span className="spacer" />
          <div className="seg" role="group" aria-label="Policy presets">
            {PRESETS.map((p) => <button key={p.id} aria-pressed={preset === p.id} onClick={() => setPolicy(p.policy)}>{p.label}</button>)}
          </div>
        </div>
        <PolicyDesigner policy={policy} onChange={setPolicy} />
        <p className="small muted" style={{ marginBottom: 0 }}>In plain words: {res.policy.description!.join('; ')}.</p>
      </div>

      <div className="panel section" style={{ display: 'grid', gap: '0.6rem' }} aria-live="polite">
        {res.summary.breaches > 0 ? (
          <p className="statement" style={{ fontSize: 'var(--step-1)' }}>
            This policy breaks local law <em>{res.summary.breaches} {res.summary.breaches === 1 ? 'time' : 'times'}</em>, touching {res.summary.employeesAffected} of {people.length} people.
          </p>
        ) : (
          <p className="statement" style={{ fontSize: 'var(--step-1)' }}>
            Zero breaches, but only because every rule now takes the most generous local answer.
          </p>
        )}
        <p className="small" style={{ margin: 0 }}>
          {res.summary.overspendDays > 0 && <>It overpays part-timers by <strong>{res.summary.overspendDays} days</strong> a year, because the days ignore working patterns. </>}
          It grants <strong>{res.summary.aboveMinimumDays} days a year above the legal minimum</strong> across these {people.length} people. Scaled to Groupon's {GROUPON_HEADCOUNT.toLocaleString('en-GB')} employees, that is roughly <strong>{scaledDays.toLocaleString('en-GB')} days a year</strong>, or the working time of about {Math.round(scaledDays / WORKING_DAYS_PER_FTE)} full-time people. Contracts may already grant some of this; this is the gap to statute, not new cost.
          {res.summary.reviews > 0 && <> {res.summary.reviews} {res.summary.reviews === 1 ? 'result needs' : 'results need'} legal review, including people whose work location has no pack.</>}
        </p>
        {res.summary.breaches === 0 && (
          <p className="callout small" style={{ margin: 0 }}>
            This is the real argument for rule packs. A global policy can only be lawful everywhere by copying the strictest local rule on every point.
            That costs days you don't owe, and it still needs local law for anything new: Illinois outside Chicago, the next country, next year's holidays. The rule packs give the same compliance without the bill.
          </p>
        )}
        <div className="vbar" aria-hidden>
          {(['breach', 'overspend', 'review', 'ok'] as const).map((v) => {
            const n = res.rows.filter((r) => r.verdict === v).length;
            return <span key={v} style={{ width: `${(n / res.rows.length) * 100}%`, background: `var(--${v === 'breach' ? 'breach' : v === 'overspend' ? 'over' : v === 'review' ? 'review' : 'ok'})` }} />;
          })}
        </div>
      </div>

      <div className="panel section">
        <h2 className="h3">Where it breaks</h2>
        <p className="small muted" style={{ marginTop: 0 }}>Each cell is one entity against one rule. Choose a cell to see the people and the statute.</p>
        <div className="matrix-wrap">
          <table className="matrix">
            <thead>
              <tr><th scope="col">Entity</th>{DIMS.map((d) => <th key={d.id} scope="col">{d.label}</th>)}</tr>
            </thead>
            <tbody>
              {ENTITY_ORDER.map((ent) => (
                <tr key={ent}>
                  <th scope="row"><Ent id={ent} /> <span className="small">{res.summary.byEntity[ent]?.employees} people</span></th>
                  {DIMS.map((d) => {
                    const rs = res.rows.filter((r) => r.packId === ent && r.dimension === d.id);
                    if (!rs.length) return <td key={d.id}><div className="cell" style={{ opacity: 0.4, cursor: 'default' }}><span className="small muted">n/a</span></div></td>;
                    const w = worst(rs);
                    const n = rs.filter((r) => r.verdict === w).length;
                    return (
                      <td key={d.id}>
                        <button className={`cell v-${w}`} aria-pressed={cell.ent === ent && cell.dim === d.id} onClick={() => setCell({ ent, dim: d.id })}
                          aria-label={`${ent}, ${d.label}: ${VERDICT_LABEL[w]} for ${n} of ${rs.length}`}>
                          <strong>{w === 'ok' ? '✓' : n}</strong>
                          <span>{w === 'ok' ? 'Compatible' : `${VERDICT_LABEL[w].toLowerCase()}`}</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel section">
        <div className="row"><Ent id={cell.ent} /><h2 className="h3" style={{ margin: 0 }}>{dimInfo.label}</h2><span className="muted small">{getPack(cell.ent, 2026).entity.split('(')[0]}</span></div>
        <p className="small muted">{dimInfo.probe}</p>
        <div className="stack">
          {rows.length === 0 && <p className="muted">No one in this entity is affected by this rule.</p>}
          {rows.map((r) => {
            const p = personById(r.employeeId);
            return (
              <div key={r.employeeId} className="panel-flat">
                <div className="row">
                  <strong>{p.name}</strong><span className="muted small">{p.title}</span>
                  <span className="spacer" />
                  <span className={`chip v-${r.verdict}`}>{VERDICT_LABEL[r.verdict]}{r.verdict === 'overspend' && r.delta ? `, +${r.delta} days` : ''}</span>
                  <button className="btn btn-quiet small" onClick={() => dispatch({ type: 'go', view: 'ledger', employeeId: p.id })}>Open ledger</button>
                </div>
                <div className="cmp" style={{ marginTop: '0.6rem' }}>
                  <div className="cmp-col"><h5>Global policy</h5>{r.global}</div>
                  <div className="cmp-col"><h5>Local law and pack</h5>{r.local}</div>
                </div>
                {r.rule && <div style={{ marginTop: '0.5rem' }}><Citation rule={r.rule} /></div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
