// ISO 'YYYY-MM-DD' date helpers. All maths is done in UTC so results never depend on the host timezone.
import type { ISODate } from './model';

const DAY = 86_400_000;

export function toMs(d: ISODate): number {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day);
}
export function fromMs(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}
export const iso = (y: number, m: number, d: number): ISODate => fromMs(Date.UTC(y, m - 1, d));
export const addDays = (d: ISODate, n: number): ISODate => fromMs(toMs(d) + n * DAY);
export const daysBetween = (a: ISODate, b: ISODate): number => Math.round((toMs(b) - toMs(a)) / DAY);
export const dow = (d: ISODate): number => new Date(toMs(d)).getUTCDay();
export const yearOf = (d: ISODate): number => Number(d.slice(0, 4));
export const monthOf = (d: ISODate): number => Number(d.slice(5, 7));
export const isBefore = (a: ISODate, b: ISODate): boolean => a < b;
export const minDate = (a: ISODate, b: ISODate): ISODate => (a < b ? a : b);
export const maxDate = (a: ISODate, b: ISODate): ISODate => (a > b ? a : b);
export const isValidISODate = (d: unknown): d is ISODate =>
  typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && fromMs(toMs(d)) === d;

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '2026-10-18' → '18 Oct 2026' (UTC, locale-independent). */
export const formatDate = (d: ISODate): string => `${Number(d.slice(8))} ${MON[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;

export function endOfMonth(d: ISODate): ISODate {
  const y = yearOf(d), m = monthOf(d);
  return fromMs(Date.UTC(y, m, 0));
}

export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let t = toMs(from), end = toMs(to); t <= end; t += DAY) out.push(fromMs(t));
  return out;
}

/** Completed months from `from` (inclusive) to `to` (inclusive), e.g. 1 Sep → 31 Dec = 4. */
export function fullMonthsBetween(from: ISODate, to: ISODate): number {
  let count = 0;
  let cursor = from;
  for (;;) {
    const [y, m, d] = cursor.split('-').map(Number);
    const nextStart = fromMs(Date.UTC(y, m, d)); // same day next month
    const monthEnd = addDays(nextStart, -1);
    if (monthEnd > to) return count;
    count++;
    cursor = nextStart;
  }
}

/** Anonymous Gregorian computus — used to cross-check Easter-derived holidays in rule packs. */
export function easterSunday(y: number): ISODate {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(y, month, day);
}
