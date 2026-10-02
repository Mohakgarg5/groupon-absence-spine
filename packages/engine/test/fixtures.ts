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
