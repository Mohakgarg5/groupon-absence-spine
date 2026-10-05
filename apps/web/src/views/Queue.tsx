import { useMemo } from 'react';
import { hrQueue, type QueueItem } from '@spine/engine';
import { useApp, people, TODAY } from '../state';
import { Citation, Ent, fmtDate } from '../components/bits';

const GROUPS: { p: QueueItem['priority']; title: string; why: string }[] = [
  { p: 1, title: 'Legal deadlines and people who are stuck', why: 'Miss these and the law, not HR, decides the outcome.' },
  { p: 2, title: 'Money and decisions', why: 'Final pay, approvals and one-off entity decisions need a person to check them.' },
  { p: 3, title: 'Care', why: 'The work automation makes room for: conversations that prevent burnout.' },
];

export function Queue() {
  const { state, dispatch } = useApp();
  const items = useMemo(() => hrQueue(people, state.inputs, TODAY), [state.rev]);
  return (
    <div>
      <h1 className="h2">HR work queue</h1>
      <p className="muted" style={{ marginTop: 0, maxWidth: '72ch' }}>
        Once requests, accruals and year-end run themselves, this is what is left for HR on {fmtDate(TODAY)}: judgment calls and conversations,
        generated from the same ledgers. It is the work the Change &amp; Culture Plan redirects freed capacity to.
      </p>
      <div className="grid cols-3" style={{ margin: '1rem 0' }}>
        {GROUPS.map((g) => (
          <div key={g.p} className="tile">
            <div className="small muted">{g.title}</div>
            <div><span className="tile-v">{items.filter((i) => i.priority === g.p).length}</span><span className="tile-u">items</span></div>
          </div>
        ))}
      </div>
      {GROUPS.map((g) => {
        const list = items.filter((i) => i.priority === g.p);
        return (
          <section key={g.p} className="panel section" aria-labelledby={`q${g.p}`}>
            <h2 className="h3" id={`q${g.p}`}>{g.title}</h2>
            <p className="small muted" style={{ marginTop: 0 }}>{g.why}</p>
            {list.length === 0 && <p className="small muted">Nothing here today.</p>}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {list.map((i, k) => (
                <li key={k} style={{ padding: '0.7rem 0', borderTop: '1px solid var(--line)' }}>
                  <div className="row">
                    <Ent id={i.packId} />
                    <strong>{i.title}</strong>
                    {i.due && <span className="chip">{i.due < TODAY ? 'overdue' : `by ${fmtDate(i.due)}`}</span>}
                    <span className="spacer" />
                    {i.employeeId && <button className="btn btn-quiet small" onClick={() => dispatch({ type: 'go', view: i.kind === 'pending' ? 'desk' : 'ledger', employeeId: i.employeeId })}>{i.kind === 'pending' ? 'Open in desk' : 'Open ledger'}</button>}
                  </div>
                  <p className="small" style={{ margin: '0.3rem 0' }}>{i.detail}</p>
                  {i.rule && <Citation rule={i.rule} compact />}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
