import { buildLedger } from '../src/ledger';
import type { Inputs, LeaveRequest, LedgerEvent } from '../src/model';
import { emp, emptyInputs } from './fixtures';

const req = (employeeId: string, from: string, to: string, kind: LeaveRequest['kind'] = 'annual'): LeaveRequest => ({
  id: `r-${employeeId}-${from}`, employeeId, from, to, kind, status: 'approved', submittedOn: '2026-10-01',
});
const of = (events: LedgerEvent[], type: string, bucket?: string) => events.filter((x) => x.type === type && (!bucket || x.bucket === bucket));
const sum = (events: LedgerEvent[]) => Math.round(events.reduce((s, x) => s + x.amount, 0) * 100) / 100;

describe('Germany (DE-BE)', () => {
  const lena = emp({ id: 'lena', packId: 'DE-BE', hireDate: '2019-04-01', openingBalances: { annual: 3 } });

  test('full-timer gets 20 days on 1 Jan citing BUrlG §3', () => {
    const l = buildLedger(lena, emptyInputs(), '2026-01-31');
    const g = of(l.events, 'GRANT')[0];
    expect(g).toMatchObject({ date: '2026-01-01', amount: 20, leaveYear: 2026 });
    expect(g.rule.citation).toMatch(/BUrlG §3/);
    expect(l.balances.annual.available).toBe(23);
  });

  test('opening balance is flagged as migrated from legacy', () => {
    const l = buildLedger(lena, emptyInputs(), '2026-01-31');
    expect(of(l.events, 'OPENING')[0]).toMatchObject({ amount: 3, leaveYear: 2025 });
    expect(of(l.events, 'OPENING')[0].explanation).toMatch(/legacy/i);
  });

  test('joiner on 1 Sep: 4 × 20/12 accrued monthly, rounded up to 7 (§5(2))', () => {
    const j = emp({ id: 'j', packId: 'DE-BE', hireDate: '2026-09-01' });
    const l = buildLedger(j, emptyInputs(), '2026-12-31');
    expect(of(l.events, 'ACCRUE')).toHaveLength(4);
    expect(of(l.events, 'ADJUST')[0].explanation).toMatch(/§5/);
    expect(l.balances.annual.available).toBe(7);
  });

  test('joiner on 1 Mar completes waiting period in-year → full 20 on 1 Sep', () => {
    const j = emp({ id: 'j2', packId: 'DE-BE', hireDate: '2026-03-01' });
    const l = buildLedger(j, emptyInputs(), '2026-12-31');
    expect(of(l.events, 'GRANT')[0]).toMatchObject({ date: '2026-09-01', amount: 20 });
  });

  test('leaver on 31 May (first half): 5/12 × 20 = 8.33, no round-up below ½, paid out', () => {
    const lv = emp({ id: 'lv', packId: 'DE-BE', hireDate: '2018-01-01', terminationDate: '2026-05-31' });
    const l = buildLedger(lv, emptyInputs(), '2026-12-31');
    expect(of(l.events, 'GRANT')[0].amount).toBe(8.33);
    expect(of(l.events, 'PAYOUT')[0]).toMatchObject({ date: '2026-05-31', amount: -8.33 });
    expect(l.balances.annual.available).toBe(0);
  });

  test('carry-over lapses on 31 March only when the employer sent notice', () => {
    const informed = emp({ id: 'inf', packId: 'DE-BE', hireDate: '2015-01-01' });
    const silent = emp({ id: 'sil', packId: 'DE-BE', hireDate: '2015-01-01' });
    const inputs: Inputs = { ...emptyInputs(), requests: [req('inf', '2026-06-01', '2026-06-12'), req('sil', '2026-06-01', '2026-06-12')], notices: [{ employeeId: 'inf', leaveYear: 2026, sentOn: '2026-10-15' }] };
    const a = buildLedger(informed, inputs, '2027-04-30');
    const b = buildLedger(silent, inputs, '2027-04-30');
    // 20 - 10 used = 10 carried into 2027
    expect(of(a.events, 'CARRY_OVER')[0].explanation).toMatch(/10/);
    expect(of(a.events, 'EXPIRE')[0]).toMatchObject({ date: '2027-03-31', amount: -10 });
    expect(of(b.events, 'EXPIRE')).toHaveLength(0);
    expect(of(b.events, 'EXPIRY_BLOCKED')[0].rule.citation).toMatch(/C-684\/16/);
    expect(a.balances.annual.available).toBe(20);
    expect(b.balances.annual.available).toBe(30);
  });

  test('certified sickness during leave restores days (§9); uncertified does not but says why', () => {
    const inputs: Inputs = { requests: [req('lena', '2026-12-21', '2026-12-31')], notices: [], sickness: [{ id: 's1', employeeId: 'lena', from: '2026-12-29', to: '2026-12-30', certified: true }] };
    const l = buildLedger(lena, inputs, '2026-12-31');
    expect(sum(of(l.events, 'DEBIT'))).toBe(-8);
    expect(of(l.events, 'RESTORE')[0]).toMatchObject({ amount: 2, date: '2026-12-29' });
    expect(of(l.events, 'RESTORE')[0].rule.citation).toMatch(/§9/);

    const uncert = buildLedger(lena, { ...inputs, sickness: [{ ...inputs.sickness[0], certified: false }] }, '2026-12-31');
    expect(of(uncert.events, 'RESTORE')).toHaveLength(0);
    expect(uncert.events.some((x) => /no medical certificate/i.test(x.explanation))).toBe(true);
  });

  test('3-day part-timer gets 12 days', () => {
    const pt = emp({ id: 'pt', packId: 'DE-BE', pattern: { days: [1, 3, 4], hoursPerDay: 8 } });
    expect(buildLedger(pt, emptyInputs(), '2026-02-01').balances.annual.available).toBe(12);
  });

  test('severe disability adds a separate SGB IX grant', () => {
    const d = emp({ id: 'd', packId: 'DE-BE', de: { severeDisability: true } });
    const l = buildLedger(d, emptyInputs(), '2026-02-01');
    expect(of(l.events, 'GRANT').map((g) => g.rule.ruleId)).toEqual(['de-entitlement', 'de-sgb9-208']);
    expect(l.balances.annual.available).toBe(25);
  });
});

describe('United Kingdom', () => {
  test('bank holidays on working days are debited from the 1.6-week bucket first', () => {
    const ft = emp({ id: 'uk', packId: 'UK' });
    const l = buildLedger(ft, emptyInputs(), '2026-12-31');
    const bh = of(l.events, 'DEBIT').filter((x) => /bank holiday/i.test(x.explanation));
    expect(bh).toHaveLength(8);
    expect(l.balances['additional-1.6wk'].available).toBe(0);
    expect(l.balances['statutory-4wk'].available).toBe(20);
  });

  test('Tue–Thu part-timer is debited only for bank holidays on their days (1 Jan 2026 is a Thursday)', () => {
    const pt = emp({ id: 'ukpt', packId: 'UK', pattern: { days: [2, 3, 4], hoursPerDay: 8 } });
    const l = buildLedger(pt, emptyInputs(), '2026-12-31');
    expect(of(l.events, 'DEBIT').map((x) => x.date)).toEqual(['2026-01-01']);
    expect(l.balances['statutory-4wk'].available + l.balances['additional-1.6wk'].available).toBeCloseTo(15.8);
  });

  test('4-week leave lapses at year end only if the worker was warned (reg.13(16)-(17), from 2024); 1.6-week carries up to 5', () => {
    const ft = emp({ id: 'uk2', packId: 'UK', pattern: { days: [2, 3, 4, 5, 6], hoursPerDay: 8 } }); // Tue–Sat: fewer bank holidays hit
    const warned = buildLedger(ft, { ...emptyInputs(), notices: [{ employeeId: 'uk2', leaveYear: 2026, sentOn: '2026-11-01' }] }, '2027-01-02');
    expect(of(warned.events, 'EXPIRE', 'statutory-4wk')[0]).toMatchObject({ date: '2027-01-01', amount: -20 });
    const silent = buildLedger(ft, emptyInputs(), '2027-01-02');
    expect(of(silent.events, 'EXPIRY_BLOCKED', 'statutory-4wk')).toHaveLength(1);
    expect(silent.balances['statutory-4wk'].byYear[2026]).toBe(20);
    expect(silent.balances['additional-1.6wk'].byYear[2026]).toBeLessThanOrEqual(5);
  });
});

describe('Ireland', () => {
  test("St Stephen's Day 2026 falls on Saturday → Mon–Fri employee gets an extra day (s.21)", () => {
    const ie = emp({ id: 'ie', packId: 'IE' });
    const l = buildLedger(ie, emptyInputs(), '2026-12-31');
    const extra = of(l.events, 'GRANT').filter((x) => x.rule.ruleId === 'ie-holiday-remedy');
    expect(extra).toHaveLength(1);
    expect(extra[0]).toMatchObject({ date: '2026-12-26', amount: 1 });
  });

  test('accrues ⅓ working week per month = 20 over a full year', () => {
    const ie = emp({ id: 'ie2', packId: 'IE' });
    const l = buildLedger(ie, emptyInputs(), '2026-12-31');
    expect(of(l.events, 'ACCRUE')).toHaveLength(12);
    expect(sum(of(l.events, 'ACCRUE'))).toBeCloseTo(20);
  });

  test('part-timer under 40h in prior 5 weeks gets no holiday remedy', () => {
    const ie = emp({ id: 'ie3', packId: 'IE', pattern: { days: [1], hoursPerDay: 6 } });
    const l = buildLedger(ie, emptyInputs(), '2026-12-31');
    expect(of(l.events, 'GRANT').filter((x) => x.rule.ruleId === 'ie-holiday-remedy')).toHaveLength(0);
  });
});

describe('Poland', () => {
  test('Saturday holiday 15 Aug 2026 creates an HR task (art. 130 §2)', () => {
    const p = emp({ id: 'pl', packId: 'PL', pl: { priorServiceYears: 5, education: 'higher', firstJob: false } });
    const l = buildLedger(p, emptyInputs(), '2026-12-31');
    expect(l.tasks.some((t) => t.date === '2026-08-15' && /replacement day off/i.test(t.title))).toBe(true);
  });

  test('crossing 10 years mid-year grants a +6 top-up on that date', () => {
    const p = emp({ id: 'pl2', packId: 'PL', hireDate: '2022-06-15', pl: { priorServiceYears: 1, education: 'secondary-vocational', firstJob: false } });
    // 1 + 5 + 4 = 10 on 2026-06-15
    const l = buildLedger(p, emptyInputs(), '2026-12-31');
    expect(of(l.events, 'GRANT')[0].amount).toBe(20);
    expect(of(l.events, 'GRANT')[1]).toMatchObject({ date: '2026-06-15', amount: 6 });
  });

  test('joiner (not first job) on 15 Mar gets ceil(26 × 10/12) = 22', () => {
    const g = emp({ id: 'pl3', packId: 'PL', hireDate: '2026-03-15', pl: { priorServiceYears: 3, education: 'higher', firstJob: false } });
    expect(of(buildLedger(g, emptyInputs(), '2026-12-31').events, 'GRANT')[0].amount).toBe(22);
  });

  test('first-job hire accrues 1/12 on completing each month of work', () => {
    const f = emp({ id: 'pl4', packId: 'PL', hireDate: '2026-07-01', pl: { priorServiceYears: 0, education: 'general-secondary', firstJob: true } });
    const l = buildLedger(f, emptyInputs(), '2026-12-31');
    expect(of(l.events, 'ACCRUE').map((x) => x.date)).toEqual(['2026-07-31', '2026-08-31', '2026-09-30', '2026-10-31', '2026-11-30', '2026-12-31']);
  });

  test('untaken leave is not lost on 30 September: the employer must grant it (art. 168) and the claim survives (art. 291)', () => {
    const p = emp({ id: 'pl5', packId: 'PL', pl: { priorServiceYears: 0, education: 'none', firstJob: false } });
    const l = buildLedger(p, emptyInputs(), '2027-10-15');
    expect(of(l.events, 'EXPIRE')).toHaveLength(0);
    expect(l.balances.annual.byYear[2026]).toBe(20);
    expect(l.tasks.some((t) => t.date === '2027-09-30' && /must still be granted/.test(t.title))).toBe(true);
  });
});

describe('Chicago (US-CHI)', () => {
  const newHire = emp({ id: 'chi', packId: 'US-CHI', hireDate: '2026-08-18' });

  test('accrues hours per 35 worked into two banks, capped at 40', () => {
    const l = buildLedger(newHire, emptyInputs(), '2026-12-31');
    expect(l.balances['paid-leave'].unit).toBe('hours');
    expect(l.balances['paid-leave'].available).toBeGreaterThan(0);
    expect(l.balances['paid-leave'].available).toBeLessThanOrEqual(40);
    expect(l.balances['paid-sick'].available).toBe(l.balances['paid-leave'].available);
    const full = buildLedger(emp({ id: 'chi2', packId: 'US-CHI' }), emptyInputs(), '2026-12-31');
    expect(full.balances['paid-leave'].available).toBe(40);
    expect(sum(of(full.events, 'ACCRUE', 'paid-leave'))).toBe(40);
  });

  test('termination pays out Paid Leave but forfeits Paid Sick Leave', () => {
    const lv = emp({ id: 'chi3', packId: 'US-CHI', hireDate: '2024-01-01', terminationDate: '2026-11-30' });
    const l = buildLedger(lv, emptyInputs(), '2026-12-31');
    expect(of(l.events, 'PAYOUT', 'paid-leave')[0].amount).toBeLessThan(0);
    expect(of(l.events, 'PAYOUT', 'paid-sick')).toHaveLength(0);
    expect(of(l.events, 'ADJUST', 'paid-sick')[0].explanation).toMatch(/not payable/i);
  });

  test('carry-over caps: 16h leave, 80h sick', () => {
    const l = buildLedger(emp({ id: 'chi4', packId: 'US-CHI' }), emptyInputs(), '2027-01-02');
    expect(l.balances['paid-leave'].byYear[2026]).toBe(16);
    expect(l.balances['paid-sick'].byYear[2026]).toBe(40);
  });
});

describe('Spain', () => {
  test('mid-year joiner gets pro-rated calendar days; no carry-over', () => {
    const j = emp({ id: 'es', packId: 'ES-MD', hireDate: '2026-07-01' });
    const l = buildLedger(j, emptyInputs(), '2026-12-31');
    expect(of(l.events, 'GRANT')[0].amount).toBeCloseTo(15.12, 1);
  });
});

describe('invariants', () => {
  const people = [
    emp({ id: 'a', packId: 'DE-BE', openingBalances: { annual: 4 } }),
    emp({ id: 'b', packId: 'UK' }),
    emp({ id: 'c', packId: 'US-CHI', terminationDate: '2027-02-10' }),
    emp({ id: 'd', packId: 'PL', pl: { priorServiceYears: 2, education: 'higher', firstJob: false } }),
    emp({ id: 'e', packId: 'IE' }),
    emp({ id: 'f', packId: 'ES-MD' }),
  ];
  test.each(people.map((p) => [p.packId, p]))('%s: balance equals the sum of events, every event cites a rule', (_id, p) => {
    const l = buildLedger(p as any, emptyInputs(), '2027-12-31');
    for (const [bucket, bal] of Object.entries(l.balances)) expect(bal.available).toBeCloseTo(sum(l.events.filter((x) => x.bucket === bucket)), 2);
    for (const ev of l.events) { expect(ev.rule.citation).toBeTruthy(); expect(ev.rule.packVersion).toMatch(/^202[67]\.1$/); }
  });

  test('events are in date order', () => {
    const l = buildLedger(people[0], emptyInputs(), '2027-12-31');
    const dates = l.events.map((x) => x.date);
    expect(dates).toEqual([...dates].sort());
  });
});

test('monthly accruals sum to the exact entitlement (no 1/12 rounding drift)', () => {
  const ie = emp({ id: 'drift', packId: 'IE', pattern: { days: [1, 2, 3, 4, 5, 6], hoursPerDay: 8 } }); // Sat holiday → no remedy; 24 days
  const l = buildLedger(ie, emptyInputs(), '2026-12-31');
  expect(sum(of(l.events, 'ACCRUE'))).toBe(24);
  const pl = emp({ id: 'drift2', packId: 'PL', hireDate: '2026-01-01', pl: { priorServiceYears: 0, education: 'none', firstJob: true } });
  expect(sum(of(buildLedger(pl, emptyInputs(), '2027-01-01').events.filter((x) => x.leaveYear === 2026), 'ACCRUE'))).toBe(20);
});

test('DE partial year below ½-day fraction keeps the exact twelfths (no drift)', () => {
  const j = emp({ id: 'nov', packId: 'DE-BE', hireDate: '2026-11-01' }); // 2 × 20/12 = 3.3333 → fraction < ½ stays
  expect(buildLedger(j, emptyInputs(), '2026-12-31').balances.annual.available).toBe(3.3333);
});

test('overlapping or duplicate sickness records never restore the same day twice', () => {
  const p = emp({ id: 'dup', packId: 'DE-BE' });
  const inputs: Inputs = {
    requests: [req('dup', '2026-12-21', '2026-12-31')], notices: [],
    sickness: [
      { id: 'a', employeeId: 'dup', from: '2026-12-29', to: '2026-12-30', certified: true },
      { id: 'b', employeeId: 'dup', from: '2026-12-29', to: '2026-12-30', certified: true },
      { id: 'c', employeeId: 'dup', from: '2026-12-30', to: '2026-12-31', certified: true },
    ],
  };
  const l = buildLedger(p, inputs, '2026-12-31');
  expect(sum(of(l.events, 'RESTORE'))).toBe(3); // 29, 30, 31 once each
});
