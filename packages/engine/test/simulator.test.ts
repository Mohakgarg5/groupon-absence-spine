// The force-unify test as a policy designer: every global choice is a parameter.
import { runStressTest, NAIVE_GLOBAL, describePolicy, type GlobalPolicy } from '../src/stressTest';
import { employees, scenario } from '../src/dataset';

const run = (p: Partial<GlobalPolicy>) => runStressTest(employees, scenario.inputs, { ...NAIVE_GLOBAL, ...p }).summary;
const dim = (p: Partial<GlobalPolicy>, d: string) => run(p).byDimension[d as 'entitlement'];

test('the naive policy is unchanged: 54 breaches, 29 people, 35 days part-timer overspend', () => {
  const s = run({});
  expect([s.breaches, s.employeesAffected, s.overspendDays]).toEqual([54, 29, 35]);
});

test('pro-rating for part-timers removes the overspend', () => expect(run({ proRataPartTime: true }).overspendDays).toBe(0));

test('26 days removes the Polish seniority breach', () => expect(dim({ daysPerYear: 26 }, 'seniority').breaches).toBe(0));

test('carry-over: none breaches DE/PL/US; a cap of 5 days to 30 Sept with a warning rule satisfies all three', () => {
  expect(dim({}, 'carry-over').breaches).toBe(18);
  expect(dim({ carryOver: 'capped', carryDays: 5, carryUntil: '09-30', lapseNeedsWarning: true }, 'carry-over').breaches).toBe(0);
  expect(dim({ carryOver: 'capped', carryDays: 5, carryUntil: '03-31', lapseNeedsWarning: true }, 'carry-over').breaches).toBe(6); // PL needs 30 Sept
  expect(dim({ carryOver: 'capped', carryDays: 5, carryUntil: '09-30', lapseNeedsWarning: false }, 'carry-over').breaches).toBe(8); // DE needs the warning
});

test('restoring certified sick days and compensating holidays on days off clears those columns', () => {
  expect(dim({ sickDuringLeave: 'restored-with-certificate' }, 'sick-during-leave').breaches).toBe(0);
  expect(dim({ holidayOnDayOff: 'extra-day' }, 'holidays').breaches).toBe(0);
});

test('zero breaches is reachable only with the most generous answer to every rule — and it costs days', () => {
  const generous: Partial<GlobalPolicy> = { daysPerYear: 27, proRataPartTime: true, carryOver: 'capped', carryDays: 5, carryUntil: '09-30', lapseNeedsWarning: true, sickDuringLeave: 'restored-with-certificate', holidayOnDayOff: 'extra-day' };
  const s = run(generous);
  expect(s.breaches).toBe(0);
  expect(s.aboveMinimumDays).toBeGreaterThan(run({}).aboveMinimumDays);
  expect(s.reviews).toBeGreaterThan(0); // Illinois location still needs a pack
});

test('units trap: 26 pro-rated days still leave a UK 3-day worker 0.2 days short of 5.6 weeks', () => {
  const r = runStressTest(employees, scenario.inputs, { ...NAIVE_GLOBAL, daysPerYear: 26, proRataPartTime: true });
  const priya = r.rows.find((x) => x.employeeId === 'uk-priya' && x.dimension === 'entitlement')!;
  expect(priya.verdict).toBe('breach');
  expect(priya.delta).toBeCloseTo(-0.2);
});

test('describePolicy reads like plain English', () => {
  expect(describePolicy(NAIVE_GLOBAL)).toEqual([
    '25 working days for everyone, front-loaded on 1 January',
    '+1 day for every 5 years at Groupon',
    'Use it or lose it on 31 December',
    'Falling sick on holiday does not give days back',
    'Local public holidays off; no other holiday rules',
  ]);
});
