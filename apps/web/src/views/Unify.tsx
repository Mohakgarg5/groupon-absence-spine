import { useMemo, useState } from 'react';
import { runStressTest, getPack, type Dimension, type StressRow } from '@spine/engine';
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

export function Unify() {
  const { state, dispatch } = useApp();
  const res = useMemo(() => runStressTest(people, state.inputs), [state.rev]);
  const [cell, setCell] = useState<{ ent: string; dim: Dimension }>({ ent: 'PL', dim: 'seniority' });
  const rows = res.rows.filter((r) => r.packId === cell.ent && r.dimension === cell.dim);
  const dimInfo = DIMS.find((d) => d.id === cell.dim)!;

  return (
    <div>
      <h1 className="h2">Force-unify test</h1>
      <p className="muted" style={{ marginTop: 0, maxWidth: '70ch' }}>
        What happens if Groupon simply adopts one leave policy everywhere? Each person below is run through the policy and through the same
        engine and rule packs that process real requests. The gap is the argument for keeping the law local.
      </p>

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="panel">
          <h2 className="h3">The policy being tested: {res.policy.name}</h2>
          <ul className="small" style={{ margin: 0, paddingLeft: '1.1rem' }}>{res.policy.description.map((d) => <li key={d}>{d}</li>)}</ul>
          <p className="small muted" style={{ marginBottom: 0 }}>It looks fair and simple. That is exactly why it is the default proposal in most HR transformations.</p>
        </div>
        <div className="panel" style={{ display: 'grid', gap: '0.6rem' }}>
          <p className="statement" style={{ fontSize: 'var(--step-1)' }}>
            <em>{res.summary.breaches} breaches</em> of local law, touching {res.summary.employeesAffected} of {people.length} people.
          </p>
          <p className="small" style={{ margin: 0 }}>
            It also overpays part-timers by <strong>{res.summary.overspendDays} days</strong> a year, because a flat 25 days ignores working patterns.
            {res.summary.reviews > 0 && <> {res.summary.reviews} results rest on our own assumptions and need a lawyer before anyone can call them breaches.</>}
          </p>
          <div className="vbar" aria-hidden>
            {(['breach', 'overspend', 'review', 'ok'] as const).map((v) => {
              const n = res.rows.filter((r) => r.verdict === v).length;
              return <span key={v} style={{ width: `${(n / res.rows.length) * 100}%`, background: `var(--${v === 'breach' ? 'breach' : v === 'overspend' ? 'over' : v === 'review' ? 'review' : 'ok'})` }} />;
            })}
          </div>
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
