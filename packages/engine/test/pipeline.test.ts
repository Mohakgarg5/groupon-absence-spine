import { submitRequest, approveRequest } from '../src/pipeline';
import { resolvePackId } from '../src/jurisdiction';
import type { Inputs, LeaveRequest } from '../src/model';
import { emp, emptyInputs, withUnloadedCalendar } from './fixtures';

const lena = emp({ id: 'lena', packId: 'DE-BE', hireDate: '2019-04-01', managerId: 'mgr-de', openingBalances: { annual: 3 } });
const TODAY = '2026-10-02';
const ask = (from: string, to: string, kind: LeaveRequest['kind'] = 'annual') => ({ employeeId: 'x', from, to, kind, submittedOn: TODAY });

test('DE pilot 21 Dec 2026 → 8 Jan 2027 is split per leave year and produces two payroll lines', () => {
  const r = submitRequest(lena, { ...ask('2026-12-21', '2027-01-08'), employeeId: 'lena' }, emptyInputs(), TODAY);
  expect(r.ok).toBe(true);
  expect(r.stages.map((s) => s.id)).toEqual(['jurisdiction', 'validate', 'expand', 'split', 'policy', 'balance', 'route', 'post', 'export']);
  expect(r.parts).toEqual([
    { leaveYear: 2026, amount: 8, unit: 'days', from: '2026-12-21', to: '2026-12-31' },
    { leaveYear: 2027, amount: 5, unit: 'days', from: '2027-01-01', to: '2027-01-08' },
  ]);
  expect(r.payroll).toHaveLength(2);
  expect(r.payroll[0]).toMatchObject({ entity: 'Groupon GmbH', amount: 8, packVersion: '2026.1', absenceCode: 'ANNUAL' });
  expect(r.approverId).toBe('mgr-de');
  expect(r.request.status).toBe('pending');
  expect(r.stages.find((s) => s.id === 'policy')!.status).toBe('warn'); // 24 & 31 Dec assumption surfaced
  expect(approveRequest(r).status).toBe('approved');
});

test('preview shows the debits that approval would post', () => {
  const r = submitRequest(lena, { ...ask('2026-12-21', '2027-01-08'), employeeId: 'lena' }, emptyInputs(), TODAY);
  expect(r.preview.filter((e) => e.type === 'DEBIT').map((e) => e.amount)).toEqual([-8, -5]);
});

test('start after end → INVALID_RANGE at validate', () => {
  const r = submitRequest(lena, { ...ask('2026-11-10', '2026-11-09'), employeeId: 'lena' }, emptyInputs(), TODAY);
  expect(r.ok).toBe(false);
  expect(r.error?.code).toBe('INVALID_RANGE');
  expect(r.stages.at(-1)).toMatchObject({ id: 'validate', status: 'fail' });
});

test('weekend-only request → ZERO_DAYS', () =>
  expect(submitRequest(lena, { ...ask('2026-11-07', '2026-11-08'), employeeId: 'lena' }, emptyInputs(), TODAY).error?.code).toBe('ZERO_DAYS'));

test('overlap with an existing request → OVERLAP', () => {
  const inputs: Inputs = { ...emptyInputs(), requests: [{ id: 'r1', employeeId: 'lena', from: '2026-11-09', to: '2026-11-13', kind: 'annual', status: 'approved', submittedOn: TODAY }] };
  expect(submitRequest(lena, { ...ask('2026-11-12', '2026-11-16'), employeeId: 'lena' }, inputs, TODAY).error?.code).toBe('OVERLAP');
});

test('insufficient balance reports the shortfall', () => {
  const r = submitRequest(lena, { ...ask('2026-10-05', '2026-11-13'), employeeId: 'lena' }, emptyInputs(), TODAY);
  expect(r.error?.code).toBe('INSUFFICIENT_BALANCE');
  expect(r.error?.message).toMatch(/short/);
});

test('Chicago new hire: Paid Leave not usable before day 90, sick bank usable from day 30', () => {
  const chi = emp({ id: 'chi', packId: 'US-CHI', workLocation: 'Chicago, IL', hireDate: '2026-07-20' }); // day 77 on 5 Oct; ~11.9 sick hours accrued
  expect(submitRequest(chi, { ...ask('2026-10-05', '2026-10-05'), employeeId: 'chi' }, emptyInputs(), TODAY).error?.code).toBe('NOT_YET_USABLE');
  const sick = submitRequest(chi, { ...ask('2026-10-05', '2026-10-05', 'sick-bank'), employeeId: 'chi' }, emptyInputs(), TODAY);
  expect(sick.ok).toBe(true);
  expect(sick.parts[0]).toMatchObject({ amount: 8, unit: 'hours' });
});

test('Poland: a fifth on-demand day is refused (art. 167²)', () => {
  const p = emp({ id: 'pl', packId: 'PL', pl: { priorServiceYears: 2, education: 'higher', firstJob: false } });
  const inputs: Inputs = { ...emptyInputs(), requests: [{ id: 'od', employeeId: 'pl', from: '2026-03-02', to: '2026-03-05', kind: 'on-demand', status: 'approved', submittedOn: '2026-03-02' }] };
  expect(submitRequest(p, { ...ask('2026-10-05', '2026-10-05', 'on-demand'), employeeId: 'pl' }, inputs, TODAY).error?.code).toBe('ON_DEMAND_LIMIT');
});

test('kind not offered by the pack → KIND_NOT_ALLOWED', () =>
  expect(submitRequest(lena, { ...ask('2026-11-09', '2026-11-09', 'on-demand'), employeeId: 'lena' }, emptyInputs(), TODAY).error?.code).toBe('KIND_NOT_ALLOWED'));

test('a year with no loaded calendar → CALENDAR_NOT_LOADED at the expand stage', () => withUnloadedCalendar('ES-MD', 2027, () => {
  const es = emp({ id: 'es', packId: 'ES-MD' });
  const r = submitRequest(es, { ...ask('2027-01-11', '2027-01-15'), employeeId: 'es' }, emptyInputs(), TODAY);
  expect(r.error?.code).toBe('CALENDAR_NOT_LOADED');
  expect(r.stages.at(-1)!.id).toBe('expand');
}));

test('Madrid January 2027 now processes: calendar days, Epifanía inside the block is still counted', () => {
  const es = emp({ id: 'es', packId: 'ES-MD' });
  const r = submitRequest(es, { ...ask('2027-01-04', '2027-01-08'), employeeId: 'es' }, emptyInputs(), TODAY);
  expect(r.ok).toBe(true);
  expect(r.parts[0].amount).toBe(5);
});

test('outside employment → NOT_EMPLOYED; beyond 2027 → PACK_NOT_FOUND', () => {
  expect(submitRequest(lena, { ...ask('2019-01-02', '2019-01-03'), employeeId: 'lena' }, emptyInputs(), TODAY).error?.code).toBe('NOT_EMPLOYED');
  expect(submitRequest(lena, { ...ask('2028-03-01', '2028-03-02'), employeeId: 'lena' }, emptyInputs(), TODAY).error?.code).toBe('PACK_NOT_FOUND');
});

test('malformed date → INVALID_RANGE', () =>
  expect(submitRequest(lena, { ...ask('2026-02-30', '2026-03-02'), employeeId: 'lena' }, emptyInputs(), TODAY).error?.code).toBe('INVALID_RANGE'));

test('Illinois employee outside Chicago has no pack → NO_PACK_FOR_LOCATION', () => {
  const spr = emp({ id: 'spr', packId: 'US-CHI', workLocation: 'Springfield, IL' });
  expect(() => resolvePackId(spr)).toThrow(/NO_PACK_FOR_LOCATION/);
  const r = submitRequest(spr, { ...ask('2026-11-09', '2026-11-09'), employeeId: 'spr' }, emptyInputs(), TODAY);
  expect(r.error?.code).toBe('NO_PACK_FOR_LOCATION');
  expect(r.stages[0]).toMatchObject({ id: 'jurisdiction', status: 'fail' });
});

test('a failed validation still shows the jurisdiction stage first', () => {
  const r = submitRequest(lena, { ...ask('2019-01-02', '2019-01-03'), employeeId: 'lena' }, emptyInputs(), TODAY);
  expect(r.stages.map((s) => [s.id, s.status])).toEqual([['jurisdiction', 'ok'], ['validate', 'fail']]);
});
