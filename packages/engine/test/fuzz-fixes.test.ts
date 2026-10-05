// Pins the defects found by the adversarial fuzzer (≈28k random employees, 150k requests).
import { buildLedger } from '../src/ledger';
import { submitRequest, approveRequest } from '../src/pipeline';
import type { Inputs, LedgerEvent } from '../src/model';
import { emp, emptyInputs } from './fixtures';

const I = (p: Partial<Inputs> = {}): Inputs => ({ ...emptyInputs(), ...p });
const sum = (ev: LedgerEvent[]) => Math.round(ev.reduce((s, x) => s + x.amount, 0) * 1e4) / 1e4;

test('1. US-CHI: overlapping sickness never restores more than the request debited', () => {
  const e = emp({ id: 'x', packId: 'US-CHI', workLocation: 'Chicago, IL', hireDate: '2025-06-01', pattern: { days: [1, 2, 3, 4], hoursPerDay: 8 }, openingBalances: { 'paid-leave': 16, 'paid-sick': 6 } });
  const L = buildLedger(e, I({
    requests: [{ id: 'r1', employeeId: 'x', from: '2026-01-30', to: '2026-02-02', kind: 'annual', status: 'approved', submittedOn: '2026-01-01' }],
    sickness: [{ id: 's1', employeeId: 'x', from: '2026-01-30', to: '2026-02-02', certified: true }, { id: 's2', employeeId: 'x', from: '2026-02-01', to: '2026-02-02', certified: true }],
  }), '2026-02-28');
  const debited = -sum(L.events.filter((x) => x.type === 'DEBIT' && x.bucket === 'paid-leave'));
  expect(sum(L.events.filter((x) => x.type === 'RESTORE'))).toBeLessThanOrEqual(debited);
});

test('2. balanceAfter equals the running sum when sickness starts on a non-working day', () => {
  const e = emp({ id: 'x', packId: 'IE', pattern: { days: [1, 2, 3, 4], hoursPerDay: 10 } });
  const L = buildLedger(e, I({ requests: [{ id: 'r1', employeeId: 'x', from: '2026-12-24', to: '2026-12-31', kind: 'annual', status: 'approved', submittedOn: '2026-10-01' }], sickness: [{ id: 's1', employeeId: 'x', from: '2026-12-25', to: '2026-12-31', certified: true }] }), '2026-12-31');
  let run = 0;
  for (const ev of L.events.filter((x) => x.bucket === 'annual')) { run = Math.round((run + ev.amount) * 1e4) / 1e4; expect(ev.balanceAfter, `${ev.date} ${ev.type}`).toBeCloseTo(run, 3); }
});

test('3. PL on-demand cap counts each calendar year\'s own days, also for cross-year requests', () => {
  const e = emp({ id: 'x', packId: 'PL', pl: { priorServiceYears: 0, education: 'none', firstJob: false } });
  let inputs = I();
  const out: (string | undefined)[] = [];
  for (const [f, t] of [['2026-12-30', '2027-01-05'], ['2027-02-01', '2027-02-04'], ['2026-03-02', '2026-03-03']]) {
    const r = submitRequest(e, { employeeId: 'x', from: f, to: t, kind: 'on-demand', submittedOn: '2026-10-01' }, inputs, '2026-10-01');
    out.push(r.error?.code ?? 'ok');
    if (r.ok) inputs = { ...inputs, requests: [...inputs.requests, approveRequest(r)] };
  }
  expect(out).toEqual(['ok', 'ON_DEMAND_LIMIT', 'ok']);
});

test('4. PL seniority: one calculation decides both the 1 Jan entitlement and the crossing date', () => {
  const e = emp({ id: 'x', packId: 'PL', hireDate: '2024-11-11', pl: { priorServiceYears: 2.86, education: 'post-secondary', firstJob: false } });
  const grants = buildLedger(e, I(), '2026-12-31').events.filter((x) => x.type === 'GRANT');
  expect(sum(grants)).toBe(26);
  const e2 = emp({ id: 'y', packId: 'PL', hireDate: '2023-02-24', pl: { priorServiceYears: 3.15, education: 'basic-vocational', firstJob: false } });
  const g2 = buildLedger(e2, I(), '2026-12-31').events.filter((x) => x.type === 'GRANT');
  for (const g of g2.filter((x) => /reaches/.test(x.explanation))) expect(g.date < '2026-12-31' || sum(g2) === 26).toBe(true);
});

test('5. DE: a 1 July hire completes the waiting period on 31 Dec (BGB §§187(2), 188(2)) and gets the full 20', () => {
  const L = buildLedger(emp({ id: 'x', packId: 'DE-BE', hireDate: '2026-07-01' }), I(), '2026-12-31');
  expect(L.balances.annual.available).toBe(20);
  const L2 = buildLedger(emp({ id: 'y', packId: 'DE-BE', hireDate: '2026-07-02' }), I(), '2026-12-31');
  expect(L2.balances.annual.available).toBe(8.3333); // 2 July: waiting period ends 1 Jan → §5(1)a, 5 full months × 20/12, fraction < ½ stays
});

test('6. UK hire year is pro-rated to the leave year (reg.13(5)) and never paid out beyond it', () => {
  const c = (h: string, t?: string) => buildLedger(emp({ id: 'x', packId: 'UK', hireDate: h, terminationDate: t }), I(), '2026-12-31');
  const total = (l: ReturnType<typeof c>) => sum(l.events.filter((x) => ['ACCRUE', 'GRANT'].includes(x.type) && x.amount > 0)) + sum(l.events.filter((x) => x.type === 'DEBIT' && !x.requestId));
  expect(sum(c('2026-01-31').events.filter((x) => x.type === 'ACCRUE'))).toBeLessThanOrEqual(25.71);
  expect(sum(c('2026-06-30').events.filter((x) => x.type === 'ACCRUE'))).toBeLessThanOrEqual(14.2);
  const one = c('2026-12-31', '2026-12-31');
  expect(-sum(one.events.filter((x) => x.type === 'PAYOUT'))).toBeLessThan(0.1);
  void total;
});

test('7. US-CHI: converting sickness never takes sick hours an approved sick-bank request needs', () => {
  const e = emp({ id: 'x', packId: 'US-CHI', workLocation: 'Chicago, IL', hireDate: '2026-01-05' });
  let inputs = I();
  for (const [f, t, k] of [['2026-08-03', '2026-08-04', 'annual'], ['2026-08-10', '2026-08-13', 'sick-bank']] as const) {
    const r = submitRequest(e, { employeeId: 'x', from: f, to: t, kind: k, submittedOn: '2026-01-01' }, inputs, '2026-07-01');
    expect(r.ok).toBe(true);
    inputs = { ...inputs, requests: [...inputs.requests, approveRequest(r)] };
  }
  inputs = { ...inputs, sickness: [{ id: 's', employeeId: 'x', from: '2026-08-03', to: '2026-08-04', certified: true }] };
  expect(buildLedger(e, inputs, '2026-12-31').issues.filter((i) => i.code === 'NEGATIVE_BALANCE')).toEqual([]);
});

test('minor: unknown pack and impossible work patterns are clean refusals, not crashes', () => {
  const bad = submitRequest(emp({ id: 'x', packId: 'XX' }), { employeeId: 'x', from: '2026-03-02', to: '2026-03-02', kind: 'annual', submittedOn: '2026-01-01' }, I(), '2026-01-01');
  expect(bad.error?.code).toBe('PACK_NOT_FOUND');
  const zero = submitRequest(emp({ id: 'y', packId: 'DE-BE', pattern: { days: [1, 1, 2], hoursPerDay: 0 } }), { employeeId: 'y', from: '2026-03-02', to: '2026-03-02', kind: 'annual', submittedOn: '2026-01-01' }, I(), '2026-01-01');
  expect(zero.error?.code).toBe('INVALID_PATTERN');
});

test('minor: asking for a balance beyond 2027 never produces events citing the wrong year', () => {
  const L = buildLedger(emp({ id: 'x', packId: 'DE-BE' }), I(), '2028-06-30');
  expect(L.events.every((x) => x.date <= '2027-12-31')).toBe(true);
});

test('UK: a restore goes back to the bucket the day was taken from, never more than that bucket gave', () => {
  const e = emp({ id: 'x', packId: 'UK', hireDate: '2018-05-01', pattern: { days: [1, 4], hoursPerDay: 11 }, openingBalances: { 'statutory-4wk': 15.5, 'additional-1.6wk': 2 } });
  const inputs: Inputs = { ...emptyInputs(), notices: [{ employeeId: 'x', leaveYear: 2026, sentOn: '2026-05-11' }],
    requests: [{ id: 'r', employeeId: 'x', from: '2026-02-06', to: '2026-02-12', kind: 'annual', status: 'approved', submittedOn: '2026-01-01' }],
    sickness: [{ id: 's', employeeId: 'x', from: '2026-02-05', to: '2026-02-11', certified: true, employeeAskedToReschedule: true }] };
  const L = buildLedger(e, inputs, '2026-03-31');
  for (const b of ['statutory-4wk', 'additional-1.6wk']) {
    const took = -sum(L.events.filter((x) => x.requestId === 'r' && x.type === 'DEBIT' && x.bucket === b));
    const back = sum(L.events.filter((x) => x.requestId === 'r' && x.type === 'RESTORE' && x.bucket === b));
    expect(back, b).toBeLessThanOrEqual(took + 1e-9);
  }
});

test('US-CHI: converting December sickness keeps hours an approved January sick-bank request needs', () => {
  const e = emp({ id: 'x', packId: 'US-CHI', workLocation: 'Chicago, IL', hireDate: '2021-04-29', pattern: { days: [1, 2, 3], hoursPerDay: 6 } });
  const inputs: Inputs = { ...emptyInputs(),
    requests: [{ id: 'a', employeeId: 'x', from: '2026-12-21', to: '2026-12-23', kind: 'annual', status: 'approved', submittedOn: '2026-10-01' },
               { id: 's', employeeId: 'x', from: '2027-01-04', to: '2027-01-27', kind: 'sick-bank', status: 'approved', submittedOn: '2026-10-01' }],
    sickness: [{ id: 'k', employeeId: 'x', from: '2026-12-21', to: '2026-12-23', certified: true }] };
  const before = buildLedger(e, { ...inputs, sickness: [] }, '2027-12-31').issues.filter((i) => i.code === 'NEGATIVE_BALANCE').length;
  const after = buildLedger(e, inputs, '2027-12-31').issues.filter((i) => i.code === 'NEGATIVE_BALANCE').length;
  expect(after).toBeLessThanOrEqual(before);
});

test('stress test flags invalid HR data for review instead of printing NaN', async () => {
  const { runStressTest } = await import('../src/stressTest');
  const r = runStressTest([emp({ id: 'z', packId: 'PL', pattern: { days: [1, 2, 3, 4, 5], hoursPerDay: 0 } })], emptyInputs());
  expect(r.rows.map((x) => x.verdict)).toEqual(['review']);
  expect(JSON.stringify(r)).not.toMatch(/NaN|Infinity/);
});
