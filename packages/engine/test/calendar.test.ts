import { expandDays, sumCounted } from '../src/calendar';
import { emp, withUnloadedCalendar } from './fixtures';

const de = emp({ packId: 'DE-BE' });

test('DE pilot range skips weekends and Berlin holidays', () => {
  const lines = expandDays(de, '2026-12-21', '2027-01-08');
  expect(lines.filter((l) => l.kind === 'counted')).toHaveLength(13);
  expect(lines.find((l) => l.date === '2026-12-25')?.kind).toBe('holiday');
  expect(lines.find((l) => l.date === '2027-01-01')?.kind).toBe('holiday');
  expect(lines.find((l) => l.date === '2026-12-26')?.kind).toBe('weekend');
  expect(lines.find((l) => l.date === '2026-12-24')?.kind).toBe('counted');
  expect(sumCounted(lines)).toBe(13);
});

test('part-time Mon/Wed/Thu marks Tue and Fri as non-working', () => {
  const pt = emp({ packId: 'DE-BE', pattern: { days: [1, 3, 4], hoursPerDay: 8 } });
  const lines = expandDays(pt, '2026-06-01', '2026-06-05');
  expect(lines.map((l) => l.kind)).toEqual(['counted', 'non-working', 'counted', 'counted', 'non-working']);
});

test('a year whose calendar is not loaded throws CALENDAR_NOT_LOADED', () =>
  withUnloadedCalendar('ES-MD', 2027, () => expect(() => expandDays(emp({ packId: 'ES-MD' }), '2027-01-04', '2027-01-05')).toThrow(/CALENDAR_NOT_LOADED/)));

test('ES counts calendar days including weekends', () =>
  expect(sumCounted(expandDays(emp({ packId: 'ES-MD' }), '2026-07-06', '2026-07-12'))).toBe(7));

test('US-CHI counts hours and skips the observed Independence Day', () => {
  const lines = expandDays(emp({ packId: 'US-CHI' }), '2026-06-29', '2026-07-03');
  expect(lines.find((l) => l.date === '2026-07-03')?.kind).toBe('holiday');
  expect(sumCounted(lines)).toBe(32);
  expect(lines[0].unit).toBe('hours');
});

test('expansion across a year uses each year\'s pack', () => {
  const lines = expandDays(de, '2026-12-31', '2027-01-01');
  expect(lines.map((l) => l.kind)).toEqual(['counted', 'holiday']);
});

test('PL part-timer on 4h days is charged ½ leave-day per day off (1 day = 8h, art. 154²)', () => {
  const marta = emp({ packId: 'PL', pattern: { days: [1, 2, 3, 4, 5], hoursPerDay: 4 } });
  const lines = expandDays(marta, '2026-06-08', '2026-06-12');
  expect(sumCounted(lines)).toBe(2.5);
  expect(sumCounted(expandDays(emp({ packId: 'PL' }), '2026-06-08', '2026-06-12'))).toBe(5);
});
