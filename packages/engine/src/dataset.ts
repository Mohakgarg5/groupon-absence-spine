// Fictional demo population and scenario ("today" = 2026-10-02). No real Groupon employee data.
import type { Employee, Inputs, ISODate } from './model';
import employeesJson from './data/employees.json';
import scenarioJson from './data/scenario.json';

export const employees = employeesJson as Employee[];
export const scenario = {
  today: scenarioJson.today as ISODate,
  inputs: { requests: scenarioJson.requests, sickness: scenarioJson.sickness, notices: scenarioJson.notices } as Inputs,
};
export const employeeById = (id: string) => employees.find((e) => e.id === id);
