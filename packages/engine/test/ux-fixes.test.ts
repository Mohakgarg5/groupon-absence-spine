// Pins the wording and arithmetic issues found by the first-time-reviewer UX test.
import { submitRequest } from '../src/pipeline';
import { buildLedger } from '../src/ledger';
import { diffPacks } from '../src/diff';
import { getPack } from '../src/packs/registry';
import { runStressTest } from '../src/stressTest';
import type { Inputs } from '../src/model';
import { emp, emptyInputs } from './fixtures';
import { employees, scenario } from '../src/dataset';

const T = '2026-10-02';

test('long requests report the real total shortfall, net of next year\'s grant', () => {
  const max = emp({ id: 'm', packId: 'DE-BE', hireDate: '2014-02-01', openingBalances: { annual: 2 } });
  const r = submitRequest(max, { employeeId: 'm', from: '2026-11-02', to: '2027-04-30', kind: 'annual', submittedOn: T }, emptyInputs(), T);
  expect(r.error?.code).toBe('INSUFFICIENT_BALANCE');
  const needed = r.parts.reduce((s, p) => s + p.amount, 0);
  const have = 22 + 20;
  expect(r.error?.message).toMatch(new RegExp(`${needed - have} days short`));
  expect(r.error?.message).not.toMatch(/annual/); // bucket label, not id
});

test('PL on-demand refusal says how many were asked and how many remain', () => {
  const p = emp({ id: 'p', packId: 'PL', pl: { priorServiceYears: 2, education: 'higher', firstJob: false } });
  const inputs: Inputs = { ...emptyInputs(), requests: [{ id: 'o', employeeId: 'p', from: '2026-03-02', to: '2026-03-02', kind: 'on-demand', status: 'approved', submittedOn: T }] };
  const r = submitRequest(p, { employeeId: 'p', from: '2026-10-05', to: '2026-10-09', kind: 'on-demand', submittedOn: T }, inputs, T);
  expect(r.error?.message).toMatch(/asked for 5 on-demand days, but only 3 of 4 remain in 2026/);
});

test('routing names the approver, and usable-from is explained in plain dates', () => {
  const lena = emp({ id: 'de-lena', name: 'Lena', packId: 'DE-BE', managerId: 'de-max' });
  const ok = submitRequest(lena, { employeeId: 'de-lena', from: '2026-11-09', to: '2026-11-09', kind: 'annual', submittedOn: T }, emptyInputs(), T);
  expect(ok.stages.find((s) => s.id === 'route')!.detail).toMatch(/Max Vogel/);
  const maya = emp({ id: 'u', packId: 'US-CHI', workLocation: 'Chicago, IL', hireDate: '2026-07-20' });
  const r = submitRequest(maya, { employeeId: 'u', from: '2026-10-05', to: '2026-10-05', kind: 'annual', submittedOn: T }, emptyInputs(), T);
  expect(r.error?.message).toMatch(/90 days after starting \(18 Oct 2026\)/);
});

test('a withdrawn request keeps its row but no longer counts', () => {
  const lena = emp({ id: 'w', packId: 'DE-BE' });
  const inputs: Inputs = { ...emptyInputs(), requests: [{ id: 'x', employeeId: 'w', from: '2026-11-09', to: '2026-11-13', kind: 'annual', status: 'withdrawn', submittedOn: T }] };
  expect(buildLedger(lena, inputs, '2026-12-31').balances.annual.available).toBe(20);
  expect(submitRequest(lena, { employeeId: 'w', from: '2026-11-10', to: '2026-11-10', kind: 'annual', submittedOn: T }, inputs, T).ok).toBe(true);
});

test('lapse wording names the date, not "today"', () => {
  const s = emp({ id: 's', packId: 'DE-BE', openingBalances: { annual: 6 } });
  const ev = buildLedger(s, emptyInputs(), '2026-04-30').events.find((x) => x.type === 'EXPIRY_BLOCKED')!;
  expect(ev.explanation).toMatch(/would lapse on 31 Mar 2026/);
});

test('annual update counts only holidays whose date actually moved', () => {
  const d = diffPacks(getPack('DE-BE', 2026), getPack('DE-BE', 2027));
  expect(d.moved.map((m) => m.name).sort()).toEqual(['Christi Himmelfahrt', 'Karfreitag', 'Ostermontag', 'Pfingstmontag']);
  expect(d.unchanged).toBe(6);
});

test('force-unify rows explain the arithmetic in words', () => {
  const r = runStressTest(employees, scenario.inputs);
  const jonas = r.rows.find((x) => x.employeeId === 'de-jonas' && x.dimension === 'entitlement')!;
  expect(jonas.global).toMatch(/pro-rated it would be 15/);
  const marta = r.rows.find((x) => x.employeeId === 'pl-marta' && x.dimension === 'entitlement')!;
  expect(marta.local).toMatch(/4-hour days/);
  const sophie = r.rows.find((x) => x.employeeId === 'pl-kasia' && x.dimension === 'carry-over')!;
  expect(sophie.local).not.toMatch(/\d{2}-\d{2}/);
});
