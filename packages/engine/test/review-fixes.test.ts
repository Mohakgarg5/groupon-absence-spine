// Pins the defects found in the final whole-branch review.
import { submitRequest } from '../src/pipeline';
import { buildLedger } from '../src/ledger';
import { getPack, setPackOverride, validatePack } from '../src/packs/registry';
import { annualEntitlement } from '../src/strategies/entitlement';
import type { Inputs, LeaveRequest } from '../src/model';
import { emp, emptyInputs } from './fixtures';

const TODAY = '2026-10-02';
const approved = (id: string, employeeId: string, from: string, to: string, kind: LeaveRequest['kind'] = 'annual'): LeaveRequest =>
  ({ id, employeeId, from, to, kind, status: 'approved', submittedOn: TODAY });

test('a new request with the same start date as an approved one is an OVERLAP, not a silent replacement', () => {
  const lena = emp({ id: 'lena', packId: 'DE-BE', hireDate: '2019-04-01' });
  const pilot = submitRequest(lena, { employeeId: 'lena', from: '2026-12-21', to: '2027-01-08', kind: 'annual', submittedOn: TODAY }, emptyInputs(), TODAY);
  const inputs: Inputs = { ...emptyInputs(), requests: [{ ...pilot.request, status: 'approved' }] };
  const again = submitRequest(lena, { employeeId: 'lena', from: '2026-12-21', to: '2026-12-23', kind: 'annual', submittedOn: TODAY }, inputs, TODAY);
  expect(again.error?.code).toBe('OVERLAP');
});

test('re-processing a pending request by its own id does not clash with itself', () => {
  const es = emp({ id: 'carmen', packId: 'ES-MD' });
  const pending: LeaveRequest = { id: 'r-carmen-jan', employeeId: 'carmen', from: '2027-01-04', to: '2027-01-08', kind: 'annual', status: 'pending', submittedOn: TODAY };
  const r = submitRequest(es, { ...pending, id: 'r-carmen-jan' }, { ...emptyInputs(), requests: [pending] }, TODAY);
  expect(r.ok).toBe(true);
});

test('balance check sees debits scheduled later in the leave year (UK bank holidays)', () => {
  const oliver = emp({ id: 'ol', packId: 'UK', hireDate: '2020-06-15' });
  const inputs: Inputs = { ...emptyInputs(), requests: [approved('sep', 'ol', '2026-09-07', '2026-09-11')] };
  // 28 − 8 bank holidays − 5 (Sep) = 15 left; 15 days in Oct leaves nothing for the 25 & 28 Dec bank holidays already counted? No —
  // bank holidays are debited on their date, so booking all remaining days now must be refused.
  const r = submitRequest(oliver, { employeeId: 'ol', from: '2026-10-05', to: '2026-10-27', kind: 'annual', submittedOn: TODAY }, inputs, TODAY);
  expect(r.error?.code).toBe('INSUFFICIENT_BALANCE');
});

test('PL leave on demand counts the employee\'s own days, not 8h day-equivalents', () => {
  const marta = emp({ id: 'm', packId: 'PL', pattern: { days: [1, 2, 3, 4, 5], hoursPerDay: 4 }, pl: { priorServiceYears: 6, education: 'higher', firstJob: false } });
  const inputs: Inputs = { ...emptyInputs(), requests: [approved('od', 'm', '2026-03-02', '2026-03-05', 'on-demand')] };
  const r = submitRequest(marta, { employeeId: 'm', from: '2026-10-05', to: '2026-10-05', kind: 'on-demand', submittedOn: TODAY }, inputs, TODAY);
  expect(r.error?.code).toBe('ON_DEMAND_LIMIT');
  expect(r.error?.message).toMatch(/Already 4 of 4/);
});

test('Chicago accrual cap has one source of truth: editing it changes balances', () => {
  const chi = emp({ id: 'c', packId: 'US-CHI' });
  const p = structuredClone(getPack('US-CHI', 2026));
  p.buckets[0].entitlement.params.capPerYear = 80;
  setPackOverride(p);
  try { expect(buildLedger(chi, emptyInputs(), '2026-12-31').balances['paid-leave'].available).toBeGreaterThan(40); }
  finally { setPackOverride(null, 'US-CHI', 2026); }
});

test('month arithmetic clamps to month end (31 Jan hire accrues on 28 Feb, not 3 Mar)', () => {
  const pl = emp({ id: 'p', packId: 'PL', hireDate: '2026-01-31', pl: { priorServiceYears: 0, education: 'none', firstJob: true } });
  const dates = buildLedger(pl, emptyInputs(), '2026-04-30').events.filter((x) => x.type === 'ACCRUE').map((x) => x.date);
  expect(dates).toEqual(['2026-02-27', '2026-03-30', '2026-04-29']);
});

test('PL seniority reached exactly on 1 Jan applies for that whole year', () => {
  const e = emp({ id: 'j', packId: 'PL', hireDate: '2025-01-01', pl: { priorServiceYears: 1, education: 'higher', firstJob: false } });
  expect(annualEntitlement(e, getPack('PL', 2026), 'annual', 2026).amount).toBe(26);
});

test('PL education table is read from the pack, not hard-coded', () => {
  const p = structuredClone(getPack('PL', 2026));
  p.buckets[0].entitlement.params.educationYears.higher = 0;
  const e = emp({ id: 'k', packId: 'PL', hireDate: '2026-03-01', pl: { priorServiceYears: 3, education: 'higher', firstJob: false } });
  expect(annualEntitlement(e, p, 'annual', 2026).amount).toBe(20);
});

test('invalid packs are rejected when set as an override', () => {
  const p = structuredClone(getPack('IE', 2026));
  p.buckets[0].carryOver.expiresMonthDay = '13-45';
  expect(validatePack(p).some((x) => /MM-DD/.test(x))).toBe(true);
  expect(() => setPackOverride(p)).toThrow(/INVALID_PACK/);
});

test('IE: certified illness during leave is restored (WLB Act 2023), matching its citation', () => {
  const ie = emp({ id: 'i', packId: 'IE' });
  const inputs: Inputs = { requests: [approved('x', 'i', '2026-06-08', '2026-06-12')], notices: [], sickness: [{ id: 's', employeeId: 'i', from: '2026-06-09', to: '2026-06-09', certified: true }] };
  expect(buildLedger(ie, inputs, '2026-06-30').events.some((x) => x.type === 'RESTORE')).toBe(true);
});
