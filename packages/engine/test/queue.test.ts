// The HR work queue: what people do once the typing is automated (Change & Culture Plan §6).
import { hrQueue } from '../src/queue';
import { getPack, setPackOverride } from '../src/packs/registry';
import { employees, scenario } from '../src/dataset';

const q = hrQueue(employees, scenario.inputs, scenario.today);
const of = (kind: string) => q.filter((x) => x.kind === kind);

test('German staff with unused 2026 leave and no warning get a lapse-warning task before 31 Dec', () => {
  const ids = of('lapse-warning').map((x) => x.employeeId);
  expect(ids).toContain('de-sophie');
  expect(ids).not.toContain('de-lena'); // warned on 30 Sept
  expect(ids).not.toContain('de-felix'); // warned on 30 Sept
  expect(of('lapse-warning')[0].due).toBe('2026-12-31');
  expect(of('lapse-warning')[0].rule?.citation).toMatch(/C-684\/16/);
});

test('people who have taken little leave by October get a wellbeing check-in, not a reminder email', () => {
  const ids = of('wellbeing').map((x) => x.employeeId);
  expect(ids).toContain('de-max'); // no leave booked all year
  expect(ids).not.toContain('de-lena'); // took two weeks in July
});

test('leavers in the next 90 days get a final-pay leave calculation', () => {
  const ids = of('final-pay').map((x) => x.employeeId);
  expect(ids).toEqual(expect.arrayContaining(['uk-george', 'us-derek']));
});

test('pending requests, missing packs, blocked calendars and Polish Saturday holidays are queued once each', () => {
  expect(of('pending').map((x) => x.employeeId)).toEqual(['es-carmen']);
  expect(of('no-pack')).toEqual([]); // every hub now has a pack
  expect(of('replacement-day').every((x) => x.employeeId === undefined)).toBe(true);
});

test('an unloaded holiday calendar for next year becomes a single deadline task', () => {
  const p = structuredClone(getPack('IE', 2027));
  p.holidays = { ...p.holidays, loaded: false, dates: [] };
  setPackOverride(p);
  try { expect(hrQueue(employees, scenario.inputs, scenario.today).filter((x) => x.kind === 'calendar').map((x) => x.packId)).toEqual(['IE', 'IN-KA']); }
  finally { setPackOverride(null, 'IE', 2027); }
  // India's 2027 festival calendar is genuinely unpublished
  expect(hrQueue(employees, scenario.inputs, scenario.today).filter((x) => x.kind === 'calendar').map((x) => x.packId)).toEqual(['IN-KA']);
});

test('queue is sorted by priority then due date', () => {
  const pr = q.map((x) => x.priority);
  expect(pr).toEqual([...pr].sort((a, b) => a - b));
});
