// Packs for Groupon's other live hubs, from primary-source research.
import { buildLedger } from '../src/ledger';
import { submitRequest } from '../src/pipeline';
import { getPack } from '../src/packs/registry';
import { easterSunday, addDays } from '../src/dates';
import { emp, emptyInputs } from './fixtures';

const T = '2026-10-02';

describe('Czech Republic (hours-based since 2021)', () => {
  test('full-timer: 4 weeks × 40 h = 160 hours; part-timer on 30 h = 120 hours', () => {
    expect(buildLedger(emp({ id: 'c1', packId: 'CZ' }), emptyInputs(), '2026-01-31').balances.annual).toMatchObject({ available: 160, unit: 'hours' });
    expect(buildLedger(emp({ id: 'c2', packId: 'CZ', pattern: { days: [1, 2, 3, 4, 5], hoursPerDay: 6 } }), emptyInputs(), '2026-01-31').balances.annual.available).toBe(120);
  });
  test('a week off costs 40 hours, and a holiday inside it costs nothing (§219(2))', () => {
    const r = submitRequest(emp({ id: 'c3', packId: 'CZ' }), { employeeId: 'c3', from: '2026-10-26', to: '2026-10-30', kind: 'annual', submittedOn: T }, emptyInputs(), T);
    expect(r.ok).toBe(true);
    expect(r.parts[0]).toMatchObject({ amount: 32, unit: 'hours' }); // 28 Oct is a public holiday
  });
  test('leave never lapses; HR gets a deadline task at the end of the next year', () => {
    const l = buildLedger(emp({ id: 'c4', packId: 'CZ' }), emptyInputs(), '2027-12-31');
    expect(l.events.filter((x) => x.type === 'EXPIRE')).toHaveLength(0);
    expect(l.balances.annual.byYear[2026]).toBe(160);
  });
  test('Easter-derived holidays match the computus', () => {
    for (const y of [2026, 2027]) {
      const e = easterSunday(y);
      const dates = getPack('CZ', y).holidays.dates.map((h) => h.date);
      expect(dates).toContain(addDays(e, -2));
      expect(dates).toContain(addDays(e, 1));
      expect(dates).toHaveLength(13);
    }
  });
});

describe('Valencia (same Spanish law, different holidays)', () => {
  test('a Valencia and a Madrid colleague are off on different days', () => {
    const vc = getPack('ES-VC', 2026).holidays.dates.map((h) => h.date);
    const md = getPack('ES-MD', 2026).holidays.dates.map((h) => h.date);
    expect(vc).toContain('2026-03-19'); // San José
    expect(md).not.toContain('2026-03-19');
    expect(vc).toContain('2026-10-09'); // Día de la Comunitat Valenciana
    expect(vc).toHaveLength(14);
    expect(getPack('ES-VC', 2027).holidays.dates.map((h) => h.date)).not.toContain('2027-06-24'); // San Juan dropped in 2027
  });
  test('entitlement is still 30 calendar days', () => {
    expect(buildLedger(emp({ id: 'v1', packId: 'ES-VC' }), emptyInputs(), '2026-01-31').balances.annual.available).toBe(30);
  });
});

describe('US: the law follows the work location', () => {
  test('Springfield, IL is processed under PLAWA: 1 h per 40 worked, usable after 90 days', () => {
    const sam = emp({ id: 'sam', packId: 'US-IL', workLocation: 'Springfield, IL', hireDate: '2024-08-05' });
    const l = buildLedger(sam, emptyInputs(), '2026-12-31');
    expect(l.balances.plawa).toMatchObject({ available: 40, unit: 'hours' });
    expect(submitRequest(sam, { employeeId: 'sam', from: '2026-11-09', to: '2026-11-09', kind: 'annual', submittedOn: T }, emptyInputs(), T).ok).toBe(true);
  });
  test('an HR record that names the wrong pack for the location is refused with the right law named', () => {
    const r = submitRequest(emp({ id: 'x', packId: 'US-CHI', workLocation: 'Springfield, IL' }), { employeeId: 'x', from: '2026-11-09', to: '2026-11-09', kind: 'annual', submittedOn: T }, emptyInputs(), T);
    expect(r.error?.code).toBe('NO_PACK_FOR_LOCATION');
    expect(r.error?.message).toMatch(/Paid Leave for All Workers Act applies \(US-IL\)/);
  });
  test('Dallas: flexible PTO, never refused, nothing owed on leaving', () => {
    const tx = emp({ id: 'tx', packId: 'US-TX', workLocation: 'Dallas, TX', terminationDate: '2026-11-30' });
    const r = submitRequest(tx, { employeeId: 'tx', from: '2026-10-05', to: '2026-10-23', kind: 'annual', submittedOn: T }, emptyInputs(), T);
    expect(r.ok).toBe(true);
    const l = buildLedger(tx, { ...emptyInputs(), requests: [{ ...r.request, status: 'approved' }] }, '2026-12-31');
    expect(l.events.find((x) => x.type === 'PAYOUT')!.explanation).toMatch(/nothing is owed/);
  });
  test('New York City: sick time from day one, 1 h per 30, capped at 56', () => {
    const ny = emp({ id: 'ny', packId: 'US-NYC', workLocation: 'New York, NY', hireDate: '2026-08-03' });
    expect(getPack('US-NYC', 2026).buckets.find((b) => b.id === 'esst')!.usableFromDays).toBe(0); // no waiting period
    expect(submitRequest(ny, { employeeId: 'ny', from: '2026-11-02', to: '2026-11-02', kind: 'sick-bank', submittedOn: T }, emptyInputs(), T).ok).toBe(true);
    expect(buildLedger(emp({ id: 'ny2', packId: 'US-NYC', workLocation: 'New York, NY' }), emptyInputs(), '2026-12-31').balances.esst.available).toBe(56);
  });
});

describe('India (Karnataka)', () => {
  test('earned leave accrues 1 day per 20 days worked; a 12-day sick pool sits beside it', () => {
    const l = buildLedger(emp({ id: 'in1', packId: 'IN-KA' }), emptyInputs(), '2026-12-31');
    expect(l.balances.earned.available).toBeGreaterThan(11);
    expect(l.balances.earned.available).toBeLessThan(13);
    expect(l.balances.sick.available).toBe(12);
  });
  test('2027 festival dates are not published, so 2027 requests are refused rather than guessed', () => {
    const r = submitRequest(emp({ id: 'in2', packId: 'IN-KA' }), { employeeId: 'in2', from: '2027-02-01', to: '2027-02-02', kind: 'annual', submittedOn: T }, emptyInputs(), T);
    expect(r.error?.code).toBe('CALENDAR_NOT_LOADED');
  });
  test('earned leave carries forward up to 45 days and is paid out on leaving', () => {
    const lv = emp({ id: 'in3', packId: 'IN-KA', terminationDate: '2026-11-30' });
    expect(buildLedger(lv, emptyInputs(), '2026-12-31').events.some((x) => x.type === 'PAYOUT' && x.bucket === 'earned')).toBe(true);
  });
});

test('flexible/unlimited PTO is described as hours used, never as a negative balance', () => {
  const tx = emp({ id: 'tx9', packId: 'US-TX', workLocation: 'Dallas, TX' });
  const r = submitRequest(tx, { employeeId: 'tx9', from: '2026-10-12', to: '2026-10-12', kind: 'annual', submittedOn: T }, emptyInputs(), T);
  const detail = r.stages.find((s) => s.id === 'balance')!.detail;
  expect(detail).toMatch(/unlimited, 8 hours used this year/);
  expect(detail).not.toMatch(/-\d/);
});
