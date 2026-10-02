// Hook: Polish statutory seniority. Cannot be expressed as a flat pack value because it depends on the
// employee's whole working life and education (Kodeks pracy art. 155 §1) — not tenure at Groupon.
import type { Employee, ISODate } from '../model';
import { iso, yearOf, daysBetween } from '../dates';

export const PL_EDUCATION_YEARS: Record<string, number> = {
  none: 0, 'basic-vocational': 3, 'secondary-vocational': 5, 'general-secondary': 4, 'post-secondary': 6, higher: 8,
};

/** Whole years by anniversary, plus the fraction of the current year — so exactly one year after hiring is 1.0. */
function tenureYears(hire: ISODate, on: ISODate): number {
  if (on <= hire) return 0;
  const [hy, hm, hd] = hire.split('-').map(Number);
  let years = yearOf(on) - hy;
  if (iso(hy + years, hm, hd) > on) years--;
  const anniv = iso(hy + years, hm, hd);
  const next = iso(hy + years + 1, hm, hd);
  return years + daysBetween(anniv, on) / daysBetween(anniv, next);
}

export function plSeniorityYears(e: Employee, onDate: ISODate, educationYears: Record<string, number> = PL_EDUCATION_YEARS) {
  const prior = e.pl?.priorServiceYears ?? 0;
  const edu = educationYears[e.pl?.education ?? 'none'] ?? 0;
  const tenure = tenureYears(e.hireDate, onDate);
  const years = Math.floor((prior + edu + tenure) * 100) / 100;
  const eduLabel = (e.pl?.education ?? 'none').replace('-', ' ');
  return {
    years,
    breakdown: `${eduLabel === 'none' ? 'no qualifying education 0' : `${eduLabel} education ${edu}`} + prior employment ${prior} + Groupon tenure ${tenure.toFixed(1)} = ${years.toFixed(1)} years`,
  };
}

/** Date in `year` on which statutory seniority first reaches `threshold`, or null if it doesn't cross during that year. */
export function plThresholdCrossingDate(e: Employee, year: number, threshold: number, educationYears: Record<string, number> = PL_EDUCATION_YEARS): ISODate | null {
  const prior = e.pl?.priorServiceYears ?? 0;
  const edu = educationYears[e.pl?.education ?? 'none'] ?? 0;
  const needTenure = threshold - prior - edu;
  if (needTenure <= 0) return null; // already over threshold at hire
  const [y, m, d] = e.hireDate.split('-').map(Number);
  const whole = Math.floor(needTenure);
  let crossing = iso(y + whole, m, d);
  if (needTenure !== whole) crossing = iso(y + whole, m, d + Math.round((needTenure - whole) * 365.25));
  return yearOf(crossing) === year && crossing > `${year}-01-01` ? crossing : null;
}
