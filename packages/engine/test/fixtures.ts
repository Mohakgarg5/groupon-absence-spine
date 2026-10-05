import type { Employee, Inputs } from '../src/model';

export const MON_FRI = { days: [1, 2, 3, 4, 5], hoursPerDay: 8 };
export const emptyInputs = (): Inputs => ({ requests: [], sickness: [], notices: [] });

export function emp(over: Partial<Employee> & Pick<Employee, 'packId'>): Employee {
  return {
    id: over.id ?? `t-${over.packId}`,
    name: 'Test Person',
    title: 'Tester',
    workLocation: 'Test',
    hireDate: '2020-01-01',
    pattern: MON_FRI,
    ...over,
  };
}

import { getPack, setPackOverride } from '../src/packs/registry';
/** Run `fn` with a pack's holiday calendar unloaded, to test the "refuse to guess" mechanism. */
export function withUnloadedCalendar<T>(packId: string, year: number, fn: () => T): T {
  const p = structuredClone(getPack(packId, year));
  p.holidays = { ...p.holidays, loaded: false, dates: [] };
  setPackOverride(p);
  try { return fn(); } finally { setPackOverride(null, packId, year); }
}
