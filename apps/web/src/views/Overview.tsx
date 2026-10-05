import { useMemo } from 'react';
import { allPacks, runStressTest, STAGES, walkRules } from '@spine/engine';
import { useApp, people, ENTITY_ORDER } from '../state';
import { goToStep } from '../components/Tour';

const LOCAL_STAGES = new Set(['jurisdiction', 'expand', 'policy', 'balance']);

export function Overview() {
  const { state, dispatch } = useApp();
  const stress = useMemo(() => runStressTest(people, state.inputs), [state.rev]);
  const packs = useMemo(() => ENTITY_ORDER.map((id) => allPacks().find((p) => p.id === id && p.year === 2026)!), [state.rev]);

  return (
    <div>
      <section>
        <h1 className="display">Unify the process and the record. Keep the law local.</h1>
        <p className="lede">
          One request flow, one ledger, one audit trail and one payroll export for every Groupon entity. The law each country
          imposes lives in a versioned, cited rule pack with a named legal owner, so a change in Polish law edits one file, not the system.
        </p>
        <div className="row" style={{ marginTop: '1.25rem' }}>
          <button className="btn btn-primary" onClick={() => goToStep(dispatch, 0)}>Take the 3-minute guided tour</button>
          <button className="btn" onClick={() => dispatch({ type: 'go', view: 'desk', employeeId: 'de-lena', deskPreset: { from: '2026-12-21', to: '2027-01-08', autorun: true } })}>
            Run the Berlin pilot request
          </button>
          <button className="btn" onClick={() => dispatch({ type: 'go', view: 'unify' })}>Try to write one global policy</button>
          <button className="btn btn-quiet" onClick={() => dispatch({ type: 'go', view: 'docs' })}>Read the decision</button>
        </div>
      </section>

      <dl className="glossary" aria-label="Four terms used throughout">
        <div><dt>Spine</dt><dd>The nine steps every request takes, identical in every entity.</dd></div>
        <div><dt>Rule pack</dt><dd>One entity's leave law as data, each rule cited, tagged by how far it is verified, and owned by counsel.</dd></div>
        <div><dt>Ledger</dt><dd>The event history every balance is replayed from. Nothing is typed in.</dd></div>
        <div><dt>Lapse</dt><dd>Unused leave expiring. In Germany and the UK it only lapses after a written warning; in Poland it never lapses.</dd></div>
      </dl>

      <section className="section panel" aria-labelledby="spine-h">
        <h2 className="h3" id="spine-h">Every request takes the same nine steps</h2>
        <p className="muted small" style={{ margin: 0 }}>Filled stations read the entity's rule pack. Hollow stations are identical everywhere.</p>
        <div className="spine-h" role="list">
          {STAGES.map((s) => (
            <div key={s.id} role="listitem" className={`station ${LOCAL_STAGES.has(s.id) ? 'local' : ''}`}>
              {s.label}
            </div>
          ))}
        </div>
        <div className="packs-row">
          {packs.map((p) => {
            const rules = walkRules(p);
            const verified = rules.filter((r) => r.verification === 'public-verified').length;
            const assumed = rules.filter((r) => r.verification === 'assumption').length;
            const unchecked = rules.length - verified - assumed;
            return (
              <button key={p.id} className="pack-cart" onClick={() => dispatch({ type: 'go', view: 'packs', employeeId: people.find((e) => e.packId === p.id)!.id })}>
                <span className="chip ent">{p.id}</span>
                <strong>{p.entity.split('(')[0].trim()}</strong>
                <span className="muted">{p.region}</span><br />
                <span className="muted">v{p.version}, sign-off {p.owner.signOff.status}</span><br />
                <span className="muted">{rules.length} rules: {verified} checked{unchecked ? `, ${unchecked} not yet checked` : ''}, {assumed} assumed</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="section grid cols-2">
        <div className="panel">
          <h2 className="h3">Unified for every entity</h2>
          <ul>
            <li>Request lifecycle and approval routing</li>
            <li>An append-only ledger: balances are replayed from events, never typed in</li>
            <li>An explanation and a citation on every number</li>
            <li>Rule-pack versioning, legal sign-off and audit trail</li>
            <li>One payroll export format and one set of reports</li>
          </ul>
        </div>
        <div className="panel">
          <h2 className="h3">Local, in each entity's rule pack</h2>
          <ul>
            <li>Entitlement and its unit: hours, days, Werktage, weeks or calendar days</li>
            <li>Accrual, waiting periods and statutory seniority</li>
            <li>Carry-over and when leave may lapse</li>
            <li>Public holidays per region, and what happens when one falls on a day off</li>
            <li>Sickness during leave, payout on leaving, and which law applies where</li>
          </ul>
        </div>
      </section>

      <section className="section panel" style={{ display: 'grid', gap: '1rem' }}>
        <p className="statement">
          Applying one sensible-looking global policy to our 30 sample people breaks local law <em>{stress.summary.breaches} times</em>, affecting {stress.summary.employeesAffected} of them, and overpays part-timers by {stress.summary.overspendDays} days a year.
        </p>
        <div className="row">
          <button className="btn" onClick={() => dispatch({ type: 'go', view: 'unify' })}>Try to write one global policy</button>
          <button className="btn btn-quiet" onClick={() => dispatch({ type: 'go', view: 'queue' })}>See what's left for HR</button>
          <span className="muted small">Policy tested: {stress.policy.description!.join('; ')}.</span>
        </div>
      </section>

      <section className="section grid cols-3">
        <div className="panel-flat">
          <h3 className="h3">Not doing</h3>
          <p className="small" style={{ margin: 0 }}>A single global leave policy, a big-bang migration, buying an HRIS module before the rules are known, or encoding collective agreements nobody has read yet.</p>
        </div>
        <div className="panel-flat">
          <h3 className="h3">Pilot first</h3>
          <p className="small" style={{ margin: 0 }}>Warsaw, where Groupon's multi-country payroll team sits, runs the operational pilot in parallel with today's process. Germany, the hardest law, shadows it through the 31 March lapse. Nothing is switched off before a clean year-end.</p>
        </div>
        <div className="panel-flat">
          <h3 className="h3">Still to verify</h3>
          <p className="small" style={{ margin: 0 }}>I asked for Groupon's internal process map first. Groupon asked for independent research, so 59 of the 78 rules are now checked against primary law, and every rule carries a badge saying whether it is checked, public but unchecked, or my assumption.</p>
        </div>
      </section>
    </div>
  );
}
