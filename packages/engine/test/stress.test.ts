import { runStressTest, NAIVE_GLOBAL } from '../src/stressTest';
import { diffPacks, annualUpdateImpact } from '../src/diff';
import { getPack } from '../src/packs/registry';
import { employees, scenario } from '../src/dataset';

test('dataset: 30 fictional employees across all 6 packs', () => {
  expect(employees).toHaveLength(30);
  expect(new Set(employees.map((e) => e.packId)).size).toBe(6);
});

describe('force-unify stress test', () => {
  const res = runStressTest(employees, scenario.inputs, NAIVE_GLOBAL);
  const row = (id: string, dim: string) => res.rows.find((r) => r.employeeId === id && r.dimension === dim)!;

  test('finds statutory breaches in DE, PL and US-CHI', () => {
    for (const ent of ['DE-BE', 'PL', 'US-CHI']) expect(res.summary.byEntity[ent].breaches, ent).toBeGreaterThan(0);
    expect(res.summary.breaches).toBeGreaterThan(10);
  });

  test('PL graduate: global tenure rule gives 25, statute 26 → seniority breach citing art. 155', () => {
    const r = row('pl-kasia', 'seniority');
    expect(r.verdict).toBe('breach');
    expect(r.rule?.citation).toMatch(/155/);
  });

  test('DE part-timer: flat 25 days for a 3-day week is an overspend', () => {
    const r = row('de-jonas', 'entitlement');
    expect(r.verdict).toBe('overspend');
    expect(r.delta).toBeCloseTo(10);
    expect(res.summary.overspendDays).toBeGreaterThan(0);
  });

  test('DE carry-over without notice and sickness during leave are breaches', () => {
    expect(row('de-lena', 'carry-over').verdict).toBe('breach');
    expect(row('de-lena', 'sick-during-leave').verdict).toBe('breach');
  });

  test('IE Tue–Sat worker: global ignores 6 public-holiday remedies', () => {
    const r = row('ie-cian', 'holidays');
    expect(r.verdict).toBe('breach');
    expect(r.local).toMatch(/6/);
  });

  test('Springfield employee is flagged for review, not silently processed', () =>
    expect(row('us-sam', 'jurisdiction').verdict).toBe('review'));

  test('rows carry a citation whenever they claim a breach', () => {
    for (const r of res.rows.filter((x) => x.verdict === 'breach')) expect(r.rule?.citation, `${r.employeeId} ${r.dimension}`).toBeTruthy();
  });
});

describe('annual update', () => {
  test('DE-BE 2026 → 2027 lists moved holidays and no rule changes', () => {
    const d = diffPacks(getPack('DE-BE', 2026), getPack('DE-BE', 2027));
    expect(d.blocked).toBe(false);
    expect(d.moved.find((m) => m.name === 'Karfreitag')).toEqual({ name: 'Karfreitag', from: '2026-04-03', to: '2027-03-26' });
    expect(d.ruleChanges).toEqual([]);
  });

  test('ES-MD 2027 is blocked until the BOCM decree is loaded', () => {
    const d = diffPacks(getPack('ES-MD', 2026), getPack('ES-MD', 2027));
    expect(d.blocked).toBe(true);
    expect(d.reason).toMatch(/BOCM/);
  });

  test('PL 2027 impact: Piotr crosses 10 years; Saturday holidays become HR tasks', () => {
    const imp = annualUpdateImpact('PL', 2026, 2027, employees, scenario.inputs);
    expect(imp.seniorityCrossings).toEqual([expect.objectContaining({ employeeId: 'pl-piotr', date: '2027-05-10', from: 20, to: 26 })]);
    expect(imp.tasks.filter((t) => t.rule.ruleId === 'pl-saturday').map((t) => t.date)).toEqual(['2027-05-01', '2027-12-25']);
    expect(imp.tasks.some((t) => /sign-off pending/.test(t.title))).toBe(true);
  });

  test('ES impact flags the pending January request as blocked', () => {
    const imp = annualUpdateImpact('ES-MD', 2026, 2027, employees, scenario.inputs);
    expect(imp.affectedRequests).toEqual([expect.objectContaining({ requestId: 'r-carmen-jan', status: 'blocked' })]);
  });

  test('a rule change shows up in the diff', () => {
    const a = getPack('IE', 2026), b = structuredClone(getPack('IE', 2027));
    b.buckets[0].carryOver.max = 3;
    expect(diffPacks(a, b).ruleChanges).toEqual([expect.objectContaining({ path: 'buckets.annual.carryOver.max', from: 5, to: 3 })]);
  });
});
