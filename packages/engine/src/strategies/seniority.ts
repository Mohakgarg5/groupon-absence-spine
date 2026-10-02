// Hook: Polish statutory seniority. Cannot be expressed as a flat pack value because it depends on the
// employee's whole working life and education (Kodeks pracy art. 155 §1) — not tenure at Groupon.
import type { Employee, ISODate } from '../model';
import { iso, yearOf, daysBetween } from '../dates';

export const PL_EDUCATION_YEARS: Record<string, number> = {
  none: 0, 'basic-vocational': 3, 'secondary-vocational': 5, 'general-secondary': 4, 'post-secondary': 6, higher: 8,
};

const tenureYears = (hire: ISODate, on: ISODate) => Math.max(0, daysBetween(hire, on) / 365.25);

export function plSeniorityYears(e: Employee, onDate: ISODate) {
  const prior = e.pl?.priorServiceYears ?? 0;
  const edu = PL_EDUCATION_YEARS[e.pl?.education ?? 'none'] ?? 0;
  const tenure = tenureYears(e.hireDate, onDate);
  const years = Math.floor((prior + edu + tenure) * 100) / 100;
  const eduLabel = (e.pl?.education ?? 'none').replace('-', ' ');
  return {
    years,
    breakdown: `${eduLabel === 'none' ? 'no qualifying education 0' : `${eduLabel} education ${edu}`} + prior employment ${prior} + Groupon tenure ${tenure.toFixed(1)} = ${years.toFixed(1)} years`,
  };
}

/** Date in `year` on which statutory seniority first reaches `threshold`, or null if it doesn't cross during that year. */
export function plThresholdCrossingDate(e: Employee, year: number, threshold: number): ISODate | null {
  const prior = e.pl?.priorServiceYears ?? 0;
  const edu = PL_EDUCATION_YEARS[e.pl?.education ?? 'none'] ?? 0;
  const needTenure = threshold - prior - edu;
  if (needTenure <= 0) return null; // already over threshold at hire
  const [y, m, d] = e.hireDate.split('-').map(Number);
  const whole = Math.floor(needTenure);
  let crossing = iso(y + whole, m, d);
  if (needTenure !== whole) crossing = iso(y + whole, m, d + Math.round((needTenure - whole) * 365.25));
  return yearOf(crossing) === year && crossing > `${year}-01-01` ? crossing : null;
}
