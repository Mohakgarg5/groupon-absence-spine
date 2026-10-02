import { annualEntitlement, totalEntitlement } from '../src/strategies/entitlement';
import { plSeniorityYears, plThresholdCrossingDate } from '../src/strategies/seniority';
import { getPack } from '../src/packs/registry';
import { emp } from './fixtures';

const ent = (packId: string, bucket: string, over: any = {}, year = 2026) =>
  annualEntitlement(emp({ packId, ...over }), getPack(packId, year), bucket, year);
const days = (n: number[]) => ({ pattern: { days: n, hoursPerDay: 8 } });

test('DE converts 24 Werktage to the employee pattern', () => {
  expect(ent('DE-BE', 'annual').amount).toBe(20);
  expect(ent('DE-BE', 'annual', days([1, 3, 4])).amount).toBe(12);
  expect(ent('DE-BE', 'annual', days([1, 2, 3, 4, 5, 6])).amount).toBe(24);
  expect(ent('DE-BE', 'annual').rule.ruleId).toBe('de-entitlement');
});

test('DE severe disability adds SGB IX §208 supplement', () => {
  const r = ent('DE-BE', 'annual', { de: { severeDisability: true } });
  expect(totalEntitlement(r)).toBe(25);
  expect(r.extras?.[0].rule.ruleId).toBe('de-sgb9-208');
});

test('UK 5.6 weeks split into 4 + 1.6 and capped at 28 days', () => {
  expect(ent('UK', 'statutory-4wk').amount).toBe(20);
  expect(ent('UK', 'additional-1.6wk').amount).toBe(8);
  expect(ent('UK', 'statutory-4wk', days([1, 2, 3, 4, 5, 6])).amount).toBe(24);
  expect(ent('UK', 'additional-1.6wk', days([1, 2, 3, 4, 5, 6])).amount).toBe(4);
  expect(ent('UK', 'additional-1.6wk', days([2, 3, 4])).amount).toBeCloseTo(4.8);
});

test('IE 4 working weeks', () => {
  expect(ent('IE', 'annual').amount).toBe(20);
  expect(ent('IE', 'annual', days([1, 2, 3, 4])).amount).toBe(16);
});

test('ES 30 calendar days regardless of pattern', () => {
  expect(ent('ES-MD', 'annual').amount).toBe(30);
  expect(ent('ES-MD', 'annual', days([1, 2, 3])).amount).toBe(30);
});

test('US-CHI banks are capped at 40 hours each', () => {
  expect(ent('US-CHI', 'paid-leave').amount).toBe(40);
  expect(ent('US-CHI', 'paid-sick').amount).toBe(40);
});

const grad = { hireDate: '2026-03-01', pl: { priorServiceYears: 3, education: 'higher', firstJob: false } };

test('PL graduate: 8 education years + 3 prior = 11 → 26 days', () => {
  const s = plSeniorityYears(emp({ packId: 'PL', ...grad }), '2026-03-01');
  expect(s.years).toBe(11);
  expect(s.breakdown).toMatch(/higher education 8/);
  expect(ent('PL', 'annual', grad).amount).toBe(26);
});

test('PL general secondary (4) + 2 prior = 6 → 20 days', () =>
  expect(ent('PL', 'annual', { hireDate: '2025-01-01', pl: { priorServiceYears: 2, education: 'general-secondary', firstJob: false } }).amount).toBe(20));

test('PL threshold crossing date inside the year', () => {
  const e = emp({ packId: 'PL', hireDate: '2021-06-15', pl: { priorServiceYears: 1, education: 'secondary-vocational', firstJob: false } });
  // 1 + 5 = 6 at hire → 10 years on 2025-06-15
  expect(plThresholdCrossingDate(e, 2025, 10)).toBe('2025-06-15');
  expect(plThresholdCrossingDate(e, 2026, 10)).toBeNull();
});

test('PL part-time 0.5 FTE of 26 rounds up to 13; 0.6 FTE of 20 = 12', () => {
  expect(ent('PL', 'annual', { ...grad, pattern: { days: [1, 2, 3, 4, 5], hoursPerDay: 4 } }).amount).toBe(13);
  expect(ent('PL', 'annual', { hireDate: '2025-01-01', pl: { priorServiceYears: 0, education: 'none', firstJob: false }, pattern: { days: [1, 2, 3], hoursPerDay: 8 } }).amount).toBe(12);
});

test('unknown bucket throws', () => expect(() => ent('DE-BE', 'nope')).toThrow(/BUCKET_NOT_FOUND/));
