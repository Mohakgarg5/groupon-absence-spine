// Expands a date range into day lines on the employee's own pattern and their entity's holiday calendar.
import { EngineError, type DayLine, type Employee, type ISODate } from './model';
import { dow, eachDay, yearOf } from './dates';
import { getPack } from './packs/registry';
import type { Pack } from './packs/types';

export function holidayOn(pack: Pack, date: ISODate) {
  return pack.holidays.dates.find((h) => h.date === date);
}

export function packFor(e: Employee, year: number): Pack {
  const p = getPack(e.packId, year);
  if (!p.holidays.loaded)
    throw new EngineError('CALENDAR_NOT_LOADED', `${p.id} ${year} holiday calendar is not loaded (${p.holidays.source.citation}). The engine will not guess holidays.`);
  return p;
}

export function expandDays(e: Employee, from: ISODate, to: ISODate): DayLine[] {
  return eachDay(from, to).map((date) => {
    const pack = packFor(e, yearOf(date));
    const mode = pack.counting.mode;
    const unit = mode === 'working-hours' ? 'hours' : 'days';
    const hol = holidayOn(pack, date);
    const working = e.pattern.days.includes(dow(date));
    if (mode === 'calendar-days') return { date, kind: 'counted', amount: 1, unit, ...(hol ? { holidayName: hol.name } : {}) };
    if (hol && working) return { date, kind: 'holiday', holidayName: hol.name, amount: 0, unit };
    if (!working) return { date, kind: [0, 6].includes(dow(date)) ? 'weekend' : 'non-working', amount: 0, unit, ...(hol ? { holidayName: hol.name } : {}) };
    return { date, kind: 'counted', amount: mode === 'working-hours' ? e.pattern.hoursPerDay : 1, unit };
  });
}

export const sumCounted = (lines: DayLine[]) => lines.reduce((s, l) => s + l.amount, 0);
