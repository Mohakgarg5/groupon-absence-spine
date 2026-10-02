import { allPacks, getPack, validatePack, walkRules } from '../src/packs/registry';
import { easterSunday, addDays, dow } from '../src/dates';

test('all packs validate', () => {
  for (const p of allPacks()) expect({ pack: `${p.id}@${p.version}`, errors: validatePack(p) }).toEqual({ pack: `${p.id}@${p.version}`, errors: [] });
});

test('there are 6 entities × 2 years', () => {
  const ids = new Set(allPacks().map((p) => p.id));
  expect([...ids].sort()).toEqual(['DE-BE', 'ES-MD', 'IE', 'PL', 'UK', 'US-CHI']);
  expect(allPacks()).toHaveLength(12);
});

test('every rule carries a citation and a verification status', () => {
  for (const p of allPacks())
    for (const r of walkRules(p)) {
      expect(r.citation, `${p.id} ${r.ruleId}`).toBeTruthy();
      expect(['public-verified', 'public-unverified', 'assumption']).toContain(r.verification);
      expect(r.packId).toBe(p.id);
    }
});

test('validatePack rejects a non-calendar leave year and a bucket without citation', () => {
  const p = structuredClone(getPack('DE-BE', 2026));
  p.leaveYear = { startMonth: 4, startDay: 1 };
  (p.buckets[0].entitlement.rule as any).citation = '';
  const errs = validatePack(p);
  expect(errs.some((e) => /leaveYear/.test(e))).toBe(true);
  expect(errs.some((e) => /citation/.test(e))).toBe(true);
});

test('getPack unknown year throws PACK_NOT_FOUND', () => expect(() => getPack('DE-BE', 2031)).toThrow(/PACK_NOT_FOUND/));

const has = (packId: string, year: number, date: string) => getPack(packId, year).holidays.dates.some((h) => h.date === date);

test.each([2026, 2027])('Easter-derived holidays match computus in %i', (y) => {
  const e = easterSunday(y);
  for (const off of [-2, 1, 39, 50]) expect(has('DE-BE', y, addDays(e, off)), `DE-BE ${addDays(e, off)}`).toBe(true);
  for (const off of [0, 1, 49, 60]) expect(has('PL', y, addDays(e, off)), `PL ${addDays(e, off)}`).toBe(true);
  expect(has('IE', y, addDays(e, 1))).toBe(true);
  expect(has('UK', y, addDays(e, -2))).toBe(true);
  expect(has('UK', y, addDays(e, 1))).toBe(true);
});

test('ES-MD 2026 is the official Decreto 75/2025 + Madrid city locals; 24 June is NOT a holiday', () => {
  const p = getPack('ES-MD', 2026);
  expect(p.holidays.dates.map((h) => h.date)).toEqual([
    '2026-01-01', '2026-01-06', '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-02', '2026-05-15',
    '2026-08-15', '2026-10-12', '2026-11-02', '2026-11-09', '2026-12-07', '2026-12-08', '2026-12-25',
  ]);
  expect(p.holidays.source.verification).toBe('public-verified');
});

test('ES-MD 2027 calendar is explicitly not loaded', () => expect(getPack('ES-MD', 2027).holidays.loaded).toBe(false));

test('PL has 14 statutory holidays incl. Wigilia since 2025', () => {
  for (const y of [2026, 2027]) {
    expect(getPack('PL', y).holidays.dates).toHaveLength(14);
    expect(has('PL', y, `${y}-12-24`)).toBe(true);
  }
});

test('US-CHI company holidays fall on weekdays (observed dates)', () => {
  for (const y of [2026, 2027]) for (const h of getPack('US-CHI', y).holidays.dates) expect([1, 2, 3, 4, 5], h.date).toContain(dow(h.date));
});

test('UK substitute bank holidays are weekdays', () => {
  for (const y of [2026, 2027]) for (const h of getPack('UK', y).holidays.dates) expect([1, 2, 3, 4, 5], h.date).toContain(dow(h.date));
});

test('overrides replace a pack in memory; getBasePack ignores them', async () => {
  const { setPackOverride, getBasePack } = await import('../src/packs/registry');
  const p = structuredClone(getPack('IE', 2026));
  p.buckets[0].carryOver.max = 1;
  setPackOverride(p);
  expect(getPack('IE', 2026).buckets[0].carryOver.max).toBe(1);
  expect(getBasePack('IE', 2026).buckets[0].carryOver.max).toBe(5);
  setPackOverride(null, 'IE', 2026);
  expect(getPack('IE', 2026).buckets[0].carryOver.max).toBe(5);
});
