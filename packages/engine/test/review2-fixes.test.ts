// Pins the findings of the final code review of the simulator / queue / UX changes.
import { buildLedger } from '../src/ledger';
import { submitRequest } from '../src/pipeline';
import { hrQueue } from '../src/queue';
import { annualUpdateImpact } from '../src/diff';
import { runStressTest } from '../src/stressTest';
import type { Inputs } from '../src/model';
import { emp, emptyInputs } from './fixtures';
import { employees, scenario } from '../src/dataset';

test('UK lapse-warning tasks give the UK date and rule, not Germany\'s', () => {
  const q = hrQueue(employees, scenario.inputs, scenario.today).filter((x) => x.kind === 'lapse-warning' && x.packId === 'UK');
  expect(q.length).toBeGreaterThan(0);
  for (const i of q) { expect(i.detail).toMatch(/1 January/); expect(i.detail).not.toMatch(/31 March/); expect(i.rule?.citation).toMatch(/reg\.13/); }
});

test('a warning sent after the block makes leave lapse at the end of that leave year (UK reg.13(18); DE BAG)', () => {
  const sophie = emp({ id: 's', packId: 'DE-BE', openingBalances: { annual: 6 } });
  const late: Inputs = { ...emptyInputs(), notices: [{ employeeId: 's', leaveYear: 2025, sentOn: '2026-05-04' }] };
  const l = buildLedger(sophie, late, '2027-04-30');
  expect(l.events.some((x) => x.type === 'EXPIRY_BLOCKED' && x.date === '2026-03-31')).toBe(true);
  expect(l.events.find((x) => x.type === 'EXPIRE' && x.leaveYear === 2025)).toMatchObject({ date: '2027-03-31' });
});

test('withdrawn requests are not "affected" by the annual update', () => {
  const inputs: Inputs = { ...scenario.inputs, requests: [...scenario.inputs.requests, { id: 'w', employeeId: 'de-lena', from: '2026-12-21', to: '2027-01-08', kind: 'annual', status: 'withdrawn', submittedOn: '2026-10-02' }] };
  expect(annualUpdateImpact('DE-BE', 2026, 2027, employees, inputs).affectedRequests.map((r) => r.requestId)).not.toContain('w');
});

test('shortage message reports only what this request adds', () => {
  const p = emp({ id: 'x', packId: 'DE-BE' });
  const already: Inputs = { ...emptyInputs(), requests: [{ id: 'a', employeeId: 'x', from: '2026-06-01', to: '2026-07-10', kind: 'annual', status: 'approved', submittedOn: '2026-01-01' }] }; // 30 days, 10 short already
  const r = submitRequest(p, { employeeId: 'x', from: '2026-11-02', to: '2026-11-06', kind: 'annual', submittedOn: '2026-10-02' }, already, '2026-10-02');
  expect(r.error?.code).toBe('INSUFFICIENT_BALANCE');
  expect(r.error?.message).toMatch(/5 days short/);
});

test('final-pay queue text only contains the payout lines', () => {
  const q = hrQueue(employees, scenario.inputs, scenario.today).filter((x) => x.kind === 'final-pay');
  for (const i of q) expect(i.detail).not.toMatch(/not restored|Rounding/i);
});

test('stress test counts a Polish seniority step reached during the year', () => {
  const e = emp({ id: 'c', packId: 'PL', hireDate: '2022-06-15', pl: { priorServiceYears: 1, education: 'secondary-vocational', firstJob: false } }); // reaches 10y on 15 Jun 2026
  const r = runStressTest([e], emptyInputs());
  expect(r.rows.find((x) => x.dimension === 'seniority')!.verdict).toBe('breach');
});
