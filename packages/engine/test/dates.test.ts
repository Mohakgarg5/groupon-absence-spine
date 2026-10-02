import { addDays, eachDay, dow, daysBetween, fullMonthsBetween, easterSunday, yearOf, endOfMonth, isBefore } from '../src/dates';

test('addDays crosses year boundary', () => expect(addDays('2026-12-31', 1)).toBe('2027-01-01'));
test('addDays negative', () => expect(addDays('2026-03-01', -1)).toBe('2026-02-28'));
test('eachDay is inclusive', () =>
  expect(eachDay('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']));
test('eachDay empty when from > to', () => expect(eachDay('2026-01-02', '2026-01-01')).toEqual([]));
test('dow uses 0=Sun..6=Sat', () => { expect(dow('2026-12-26')).toBe(6); expect(dow('2027-02-01')).toBe(1); });
test('daysBetween', () => expect(daysBetween('2026-01-01', '2026-12-31')).toBe(364));
test('fullMonthsBetween counts completed months', () => {
  expect(fullMonthsBetween('2026-09-01', '2026-12-31')).toBe(4);
  expect(fullMonthsBetween('2026-09-15', '2026-12-31')).toBe(3);
  expect(fullMonthsBetween('2026-01-01', '2026-05-31')).toBe(5);
  expect(fullMonthsBetween('2026-01-01', '2026-05-30')).toBe(4);
});
test('easterSunday (computus)', () => { expect(easterSunday(2026)).toBe('2026-04-05'); expect(easterSunday(2027)).toBe('2027-03-28'); });
test('helpers', () => { expect(yearOf('2027-03-01')).toBe(2027); expect(endOfMonth('2028-02-03')).toBe('2028-02-29'); expect(isBefore('2026-01-01','2026-01-02')).toBe(true); });
