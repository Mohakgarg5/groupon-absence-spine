// The unified record. Balances are never stored: they are re-derived by replaying every rule, in date order,
// from the employee's facts and the entity's rule packs. Every event carries the citation that produced it.
import {
  EngineError, type DayLine, type Employee, type EventType, type HrTask, type ISODate, type Inputs, type LedgerEvent, type RuleRef, type Unit,
} from './model';
import { addDays, daysBetween, dow, endOfMonth, formatDate, iso, maxDate, minDate, yearOf } from './dates';
import { getPack } from './packs/registry';
import type { Bucket, Pack } from './packs/types';
import { annualEntitlement, daysPerWeek, totalEntitlement, weeklyHours } from './strategies/entitlement';
import { plThresholdCrossingDate } from './strategies/seniority';
import { expandDays, sumCounted } from './calendar';

export const LEDGER_START: ISODate = '2026-01-01';
export const SUPPORTED_YEARS = [2026, 2027];

export interface Lot {
  id: string;
  bucket: string;
  leaveYear: number;
  remaining: number;
  createdOn: ISODate;
  expiresOn: ISODate | null;
  carried: boolean;
  blocked: boolean;
}
export interface LedgerIssue { code: string; date: ISODate; message: string }
export interface BucketBalance { available: number; unit: Unit; label: string; byYear: Record<number, number>; unlimited?: boolean; usedByYear?: Record<number, number> }
export interface Ledger {
  employee: Employee;
  asOf: ISODate;
  events: LedgerEvent[];
  balances: Record<string, BucketBalance>;
  lots: Lot[];
  tasks: HrTask[];
  issues: LedgerIssue[];
}

const r4 = (n: number) => Math.round(n * 1e4) / 1e4;
const r2 = (n: number) => Math.round(n * 100) / 100;
const fmt = (n: number) => String(r2(n));
const daysInYear = (y: number) => daysBetween(`${y}-01-01`, `${y}-12-31`) + 1;

/** BUrlG §5(2): fractions of at least half a day are rounded up; smaller fractions stay (BAG: no rounding down). */
const deRound = (x: number) => (x - Math.floor(x) >= 0.5 - 1e-9 ? Math.ceil(x) : r2(x));
/** WTR reg.15A(2): fractions below ½ count as ½ day; above ½ as a whole day. */
const ukRound = (x: number) => {
  const f = r4(x - Math.floor(x));
  if (f === 0 || f === 0.5) return r4(x);
  return f < 0.5 ? Math.floor(x) + 0.5 : Math.ceil(x);
};
/** Same day k months later, clamped to month end (31 Jan + 1 month = 28/29 Feb). */
const addMonths = (d: ISODate, k: number) => {
  const [y, m, day] = d.split('-').map(Number);
  const last = Number(endOfMonth(iso(y, m + k, 1)).slice(8));
  return iso(y, m + k, Math.min(day, last));
};
const monthsStarted = (from: ISODate, to: ISODate) =>
  (yearOf(to) * 12 + Number(to.slice(5, 7))) - (yearOf(from) * 12 + Number(from.slice(5, 7))) + 1;

interface Op { date: ISODate; prio: number; seq: number; run: () => void }

export interface LedgerOptions { today?: ISODate }

export function buildLedger(e: Employee, inputs: Inputs, asOf: ISODate, opts: LedgerOptions = {}): Ledger {
  const today = opts.today ?? asOf;
  const events: LedgerEvent[] = [];
  const lots: Lot[] = [];
  const tasks: HrTask[] = [];
  const issues: LedgerIssue[] = [];
  const overdraft: Record<string, number> = {};
  const bucketMeta: Record<string, { unit: Unit; label: string }> = {};
  // Unlimited-PTO buckets hold no lots: usage is counted, never refused, and the balance is minus the usage.
  const unlimited = new Set<string>();
  const unlimitedUsed: Record<string, number> = {};
  let seq = 0;

  const horizon = `${SUPPORTED_YEARS[SUPPORTED_YEARS.length - 1]}-12-31`;
  const endDate = minDate(minDate(asOf, horizon), e.terminationDate ?? asOf);
  const startDate = maxDate(LEDGER_START, e.hireDate);
  const lastYear = Math.min(yearOf(endDate), SUPPORTED_YEARS[SUPPORTED_YEARS.length - 1]);
  if (startDate > endDate) return finish();

  const years: number[] = [];
  for (let y = yearOf(startDate); y <= lastYear; y++) years.push(y);
  const packs: Record<number, Pack> = {};
  for (const y of years) packs[y] = getPack(e.packId, y);
  for (const p of Object.values(packs)) for (const b of p.buckets) {
    bucketMeta[b.id] = { unit: b.unit, label: b.label };
    if (b.accrual.strategy === 'unlimited-with-floor') unlimited.add(b.id);
  }

  const balanceOf = (bucket: string) => r4(lots.filter((l) => l.bucket === bucket).reduce((s, l) => s + l.remaining, 0) - (overdraft[bucket] ?? 0) - (unlimitedUsed[bucket] ?? 0));

  function post(type: EventType, date: ISODate, bucket: string, amount: number, leaveYear: number, rule: RuleRef, explanation: string, extra: Partial<LedgerEvent> = {}) {
    const ev: LedgerEvent = {
      id: `${e.id}-${String(++seq).padStart(4, '0')}`, date, employeeId: e.id, bucket, type, amount: r4(amount),
      unit: bucketMeta[bucket]?.unit ?? 'days', leaveYear, rule, explanation, ...extra,
    };
    if (date > today) ev.projected = true;
    events.push(ev);
    ev.balanceAfter = balanceOf(bucket);
    return ev;
  }

  function credit(type: EventType, date: ISODate, bucket: string, amount: number, leaveYear: number, rule: RuleRef, explanation: string, extra: Partial<LedgerEvent> = {}) {
    amount = r4(amount);
    if (amount <= 0) return;
    if (unlimited.has(bucket)) {
      unlimitedUsed[bucket] = r4((unlimitedUsed[bucket] ?? 0) - amount);
      return post(type, date, bucket, amount, leaveYear, rule, explanation, extra);
    }
    let rest = amount;
    const od = overdraft[bucket] ?? 0;
    if (od > 0) { const repay = Math.min(od, rest); overdraft[bucket] = r4(od - repay); rest = r4(rest - repay); }
    if (rest > 0) lots.push({ id: `lot-${lots.length + 1}`, bucket, leaveYear, remaining: rest, createdOn: date, expiresOn: null, carried: false, blocked: false });
    return post(type, date, bucket, amount, leaveYear, rule, explanation, extra);
  }

  const bucketsOf = (y: number) => packs[y]?.buckets ?? [];
  const bucketDef = (id: string, y: number): Bucket | undefined => (packs[y] ?? packs[years[years.length - 1]])?.buckets.find((b) => b.id === id);

  /** Draw `amount` from the given buckets' lots: earliest-expiring first (or strictly in bucket order). */
  function consume(bucketIds: string[], amount: number, date: ISODate, strict: boolean): Record<string, number> {
    const taken: Record<string, number> = {};
    let need = r4(amount);
    const effExpiry = (l: Lot) => {
      if (l.expiresOn) return l.expiresOn;
      const b = bucketDef(l.bucket, l.leaveYear);
      return b?.carryOver.max === 0 && !l.carried ? `${l.leaveYear}-12-31` : '9999-12-31';
    };
    const cands = lots
      .filter((l) => bucketIds.includes(l.bucket) && l.remaining > 0 && l.createdOn <= date)
      .sort((a, b) => strict
        ? bucketIds.indexOf(a.bucket) - bucketIds.indexOf(b.bucket) || effExpiry(a).localeCompare(effExpiry(b))
        : effExpiry(a).localeCompare(effExpiry(b)) || a.leaveYear - b.leaveYear || bucketIds.indexOf(a.bucket) - bucketIds.indexOf(b.bucket));
    for (const l of cands) {
      if (need <= 0) break;
      const t = Math.min(l.remaining, need);
      l.remaining = r4(l.remaining - t);
      need = r4(need - t);
      taken[l.bucket] = r4((taken[l.bucket] ?? 0) + t);
    }
    const unl = bucketIds.find((b) => unlimited.has(b));
    if (need > 0 && unl) {
      unlimitedUsed[unl] = r4((unlimitedUsed[unl] ?? 0) + need);
      taken[unl] = r4((taken[unl] ?? 0) + need);
      need = 0;
    }
    if (need > 0) {
      const b = bucketIds[0];
      overdraft[b] = r4((overdraft[b] ?? 0) + need);
      taken[b] = r4((taken[b] ?? 0) + need);
      issues.push({ code: 'NEGATIVE_BALANCE', date, message: `${fmt(need)} ${bucketMeta[b]?.unit ?? 'days'} short in ${bucketMeta[b]?.label ?? b} on ${formatDate(date)}` });
    }
    return taken;
  }

  function debit(bucketIds: string[], amount: number, date: ISODate, leaveYear: number, rule: RuleRef, explanation: string, strict = false, extra: Partial<LedgerEvent> = {}) {
    const taken = consume(bucketIds, amount, date, strict);
    for (const [b, amt] of Object.entries(taken)) post('DEBIT', date, b, -amt, leaveYear, rule, explanation, extra);
    return taken;
  }

  // ---------- schedule operations ----------
  const ops: Op[] = [];
  const at = (date: ISODate, prio: number, run: () => void) => { if (date >= startDate && date <= endDate) ops.push({ date, prio, seq: ops.length, run }); };
  const firstYear = years[0];

  // Migrated opening balances (carry-over from leave year 2025, held in the legacy system).
  if (e.openingBalances && e.hireDate < LEDGER_START) {
    for (const [bucket, amount] of Object.entries(e.openingBalances)) {
      const b = bucketDef(bucket, 2026);
      if (!b || amount <= 0) continue;
      at(LEDGER_START, 0, () => {
        credit('OPENING', LEDGER_START, bucket, amount, 2025, b.carryOver.rule,
          `Migrated from legacy system: ${fmt(amount)} ${b.unit} carried from 2025 — reconcile against payroll before go-live`);
        const lot = lots[lots.length - 1];
        lot.carried = true;
        lot.expiresOn = b.carryOver.expiresMonthDay ? `2026-${b.carryOver.expiresMonthDay}` : null;
        if (b.carryOver.max !== null && amount > b.carryOver.max)
          issues.push({ code: 'LEGACY_CONFLICT', date: LEDGER_START, message: `Legacy carry-over of ${fmt(amount)} exceeds the pack's carry-over limit of ${b.carryOver.max} for ${bucket} — reconcile` });
      });
    }
  }

  for (const y of years) {
    const pack = packs[y];
    const empStart = maxDate(`${y}-01-01`, e.hireDate);
    const empEnd = minDate(`${y}-12-31`, e.terminationDate ?? `${y}-12-31`);
    if (empStart > empEnd) continue;
    const leaving = !!e.terminationDate && yearOf(e.terminationDate) === y;

    for (const b of pack.buckets) {
      const ent = annualEntitlement(e, pack, b.id, y);
      const full = totalEntitlement(ent);
      const rule = b.accrual.rule;
      // Rates and caps live once, in entitlement.params; accrual.params only holds accrual-specific switches.
      const p = { ...b.entitlement.params, ...b.accrual.params };

      switch (b.accrual.strategy) {
        case 'de-waiting-period': {
          // BGB §§187(2), 188(2): a period starting on the hire day ends the day before the same date 6 months later.
          const waitNext = addMonths(e.hireDate, p.waitingMonths);
          const waitDone = addDays(waitNext, -1);
          const proRata = (months: number, why: string, date: ISODate) => {
            const amt = deRound((full * months) / 12);
            at(date, 0, () => credit('GRANT', date, b.id, amt, y, rule, `${why}: ${months}/12 × ${fmt(full)} = ${fmt((full * months) / 12)} → ${fmt(amt)} days (§5)`));
          };
          if (leaving && e.terminationDate! <= `${y}-06-30` && waitDone <= e.terminationDate!) {
            proRata(Math.max(0, monthsBetweenFull(empStart, empEnd)), 'Leaving in the first half of the year (§5(1)c)', empStart);
          } else if (leaving && e.terminationDate! < waitDone) {
            proRata(Math.max(0, monthsBetweenFull(empStart, empEnd)), 'Leaving before the waiting period ends (§5(1)b)', empStart);
          } else if (waitDone <= `${y}-12-31`) {
            const date = maxDate(empStart, minDate(waitNext, `${y}-12-31`));
            const why = waitDone > `${y}-01-01` ? `Waiting period completed on ${waitDone} (§4) — full entitlement` : 'Full annual entitlement';
            at(date, 0, () => {
              credit('GRANT', date, b.id, ent.amount, y, ent.rule, `${why}: ${ent.explanation}`);
              for (const x of ent.extras ?? []) credit('GRANT', date, b.id, x.amount, y, x.rule, x.explanation);
            });
          } else {
            // §5(1)a: waiting period cannot be completed this year → 1/12 per full month, rounded at year end.
            let k = 0;
            for (let end = addDays(addMonths(empStart, 1), -1); end <= empEnd; end = addDays(addMonths(empStart, ++k + 1), -1)) {
              const n = k + 1;
              const amt = r4(r4((full * n) / 12) - r4((full * (n - 1)) / 12));
              at(end, 0, () => credit('ACCRUE', end, b.id, amt, y, rule, `Month ${n} of employment completed: 1/12 × ${fmt(full)} (§5(1)a, waiting period not completable this year)`));
            }
            const months = k;
            const close = empEnd;
            at(close, 0.5, () => {
              const exact = (full * months) / 12;
              const target = deRound(exact);
              const diff = r4(target - r4((full * months) / 12));
              if (diff > 0.0001) credit('ADJUST', close, b.id, diff, y, rule, `Rounding: ${fmt(exact)} days rounded up to ${fmt(target)} — fractions of at least ½ day round up (§5(2))`);
            });
          }
          break;
        }
        case 'front-load-prorata': {
          const days = daysBetween(empStart, empEnd) + 1;
          const amt = days === daysInYear(y) ? full : r4((full * days) / daysInYear(y));
          at(empStart, 0, () => credit('GRANT', empStart, b.id, amt, y, rule,
            days === daysInYear(y) ? `Full year: ${ent.explanation}` : `Pro-rata ${days}/${daysInYear(y)} days employed × ${fmt(full)} = ${fmt(amt)}`));
          break;
        }
        case 'monthly': {
          for (let m = 1; m <= 12; m++) {
            const ms = iso(y, m, 1), me = endOfMonth(ms);
            const s = maxDate(ms, empStart), en = minDate(me, empEnd);
            if (s > en) continue;
            const frac = (daysBetween(s, en) + 1) / (daysBetween(ms, me) + 1);
            // Whole months telescope (m/12 − (m−1)/12) so a full year sums to exactly the entitlement.
            const amt = frac === 1 ? r4(r4((full * m) / 12) - r4((full * (m - 1)) / 12)) : r4((full / 12) * frac);
            at(en, 0, () => credit('ACCRUE', en, b.id, amt, y, rule,
              `${frac < 1 ? `Part month (${fmt(frac * 100)}%): ` : ''}⅓ working week = ${fmt(daysPerWeek(e) / 3)} days for ${ms.slice(0, 7)}`));
          }
          break;
        }
        case 'pl-proportional': {
          const params = b.entitlement.params;
          if (e.pl?.firstJob && yearOf(e.hireDate) === y) {
            for (let k = 1; addDays(addMonths(e.hireDate, k), -1) <= empEnd; k++) {
              const d = addDays(addMonths(e.hireDate, k), -1);
              const amt = r4(r4((full * k) / 12) - r4((full * (k - 1)) / 12)); // telescoping: twelfths sum exactly
              at(d, 0, () => credit('ACCRUE', d, b.id, amt, y, rule, `First job: 1/12 × ${fmt(full)} on completing month ${k} of work (art. 153 §1)`));
            }
          } else {
            const ms = monthsStarted(empStart, empEnd);
            const amt = ms >= 12 ? full : Math.ceil((full * ms) / 12);
            at(empStart, 0, () => credit('GRANT', empStart, b.id, amt, y, ms >= 12 ? ent.rule : rule,
              ms >= 12 ? ent.explanation : `Proportional: ${ms}/12 months (incomplete months round up) × ${fmt(full)} = ${fmt((full * ms) / 12)} → ${amt} days (art. 155¹–155²)`));
          }
          const crossing = plThresholdCrossingDate(e, y, params.thresholdYears, params.educationYears);
          if (p.topUpOnThreshold && crossing && crossing <= empEnd && crossing > empStart) {
            const fte = weeklyHours(e) / 40;
            const days = (n: number) => (fte >= 1 ? n : Math.ceil(n * fte));
            const top = days(params.over) - days(params.under);
            at(crossing, 0, () => credit('GRANT', crossing, b.id, top, y, packs[y].extras.find((x) => x.ruleId === 'pl-158') ?? b.entitlement.rule, `Statutory seniority reaches ${params.thresholdYears} years on ${crossing}: entitlement rises ${days(params.under)} → ${days(params.over)} days (+${top})`));
          }
          break;
        }
        case 'uk-first-year-monthly': {
          if (e.hireDate > `${y}-01-01` && yearOf(e.hireDate) === y) {
            // reg.13(5): the hire-year entitlement is the proportion of the leave year employed; reg.15A paces it monthly.
            const cap = r4((full * (daysBetween(empStart, empEnd) + 1)) / daysInYear(y));
            let prev = 0;
            for (let k = 0; addMonths(e.hireDate, k) <= empEnd; k++) {
              const d = addMonths(e.hireDate, k);
              const target = Math.min(cap, ukRound((full * (k + 1)) / 12));
              const amt = r4(target - prev);
              prev = target;
              if (amt <= 0) continue;
              const n = k + 1;
              at(d, 0, () => credit('ACCRUE', d, b.id, amt, y, rule, `First year: month ${n} — 1/12 of ${fmt(full)} accrues at the start of each month, rounded to ½ days (reg.15A)`));
            }
          } else if (leaving) {
            const days = daysBetween(empStart, empEnd) + 1;
            const amt = r4((full * days) / daysInYear(y));
            at(empStart, 0, () => credit('GRANT', empStart, b.id, amt, y, b.payoutOnTermination.rule, `Leaving on ${e.terminationDate}: ${fmt(full)} × ${days}/${daysInYear(y)} = ${fmt(amt)} days (reg.14 (A × B))`));
          } else {
            at(empStart, 0, () => credit('GRANT', empStart, b.id, ent.amount, y, ent.rule, ent.explanation));
          }
          break;
        }
        case 'unlimited-with-floor':
          break; // nothing accrues; usage is tracked and the separation floor is applied at termination
        case 'hours-worked': {
          let cum = 0;
          for (let m = 1; m <= 12; m++) {
            const ms = iso(y, m, 1), me = endOfMonth(ms);
            const s = maxDate(ms, empStart), en = minDate(me, empEnd);
            if (s > en) continue;
            const hours = sumCounted(expandDays(e, s, en));
            const raw = r4(hours / p.per);
            const amt = r4(Math.min(raw, p.capPerYear - cum));
            cum = r4(cum + amt);
            if (amt <= 0) continue;
            at(en, 0, () => credit('ACCRUE', en, b.id, amt, y, rule,
              `${fmt(hours)} hours scheduled in ${ms.slice(0, 7)} ÷ ${p.per} = ${fmt(raw)} h${amt < raw ? ` (capped: ${p.capPerYear} h/year reached)` : ''}`));
          }
          break;
        }
      }
    }

    // ---------- holiday-dependent rules ----------
    const hp = pack.holidayPolicy;
    if (!pack.holidays.loaded) {
      tasks.push({ date: `${y}-01-01`, title: `${pack.id} ${y} holiday calendar not loaded — holiday rules not applied`, rule: pack.holidays.source });
    } else {
      for (const h of pack.holidays.dates) {
        if (h.date < empStart || h.date > empEnd) continue;
        const works = e.pattern.days.includes(dow(h.date));
        if (hp.deductFromEntitlement && works) {
          const order = hp.deductOrder ?? pack.buckets.map((b) => b.id);
          const unitAmt = bucketDef(order[0], y)?.unit === 'hours' ? e.pattern.hoursPerDay : 1;
          at(h.date, 1, () => debit(order, unitAmt, h.date, y, hp.rule, `Bank holiday — ${h.name} — counted toward the 5.6 weeks`, true));
        }
        if (hp.onNonWorkingDay === 'extra-leave' && !works) {
          if (weeklyHours(e) * 5 >= (hp.minHoursInPrior5Weeks ?? 0)) {
            const amt = r4(daysPerWeek(e) / 5);
            at(h.date, 0, () => credit('GRANT', h.date, pack.buckets[0].id, amt, y, hp.rule, `${h.name} falls on a day the employee doesn't work: employer remedy = +${fmt(amt)} day of annual leave (s.21)`));
          }
        }
        if (hp.onNonWorkingDay === 'designate-day-off-task' && dow(h.date) === 6) {
          tasks.push({ date: h.date, title: `${h.name} falls on a Saturday — designate a replacement day off (art. 130 §2)`, rule: hp.rule });
        }
      }
    }
  }

  // Employer deadline to grant carried-over leave (the claim survives): an HR task, not an expiry.
  for (const y of years) for (const b of bucketsOf(y)) {
    const md = b.carryOver.grantByMonthDay;
    if (!md) continue;
    const date = `${y}-${md}`;
    at(date, 9, () => {
      const left = r4(lots.filter((l) => l.bucket === b.id && l.leaveYear < y && l.remaining > 0).reduce((s, l) => s + l.remaining, 0));
      if (left > 0) tasks.push({ date, title: `${fmt(left)} ${b.unit} of earlier leave must still be granted: the deadline was ${date} and the claim does not lapse`, rule: b.carryOver.rule });
    });
  }

  // ---------- requests & sickness ----------
  const debitedBy: Record<string, { buckets: string[]; amount: number; taken: Record<string, number>; given: Record<string, number> }> = {};
  const approved = inputs.requests.filter((r) => r.employeeId === e.id && r.status === 'approved');
  for (const req of approved) {
    for (const y of years) {
      const from = maxDate(req.from, `${y}-01-01`), to = minDate(req.to, `${y}-12-31`);
      if (from > to) continue;
      let amount = 0;
      try { amount = sumCounted(expandDays(e, from, to)); } catch (err) {
        issues.push({ code: err instanceof EngineError ? err.code : 'ERROR', date: from, message: String((err as Error).message) });
        continue;
      }
      if (amount <= 0) continue;
      const bks = bucketsOf(y).filter((b) => b.requestKinds.includes(req.kind)).map((b) => b.id);
      if (!bks.length) { issues.push({ code: 'KIND_NOT_ALLOWED', date: from, message: `${req.kind} not allowed in ${e.packId}` }); continue; }
      const unit = bucketMeta[bks[0]].unit;
      at(from, 1, () => {
        const taken = debit(bks, amount, from, y, packs[y].counting.rule,
          `${req.kind === 'on-demand' ? 'Leave on demand' : req.kind === 'sick-bank' ? 'Sick leave' : 'Leave'} ${from} → ${to}: ${fmt(amount)} ${unit}`, false, { requestId: req.id });
        debitedBy[`${req.id}|${y}`] = { buckets: Object.keys(taken), amount, taken, given: {} };
      });
    }
  }
  for (const s of inputs.sickness.filter((x) => x.employeeId === e.id)) {
    for (const req of approved) {
      if (req.kind === 'sick-bank') continue;
      const ovFrom = maxDate(s.from, req.from), ovTo = minDate(s.to, req.to);
      if (ovFrom > ovTo) continue;
      for (const y of years) {
        const from = maxDate(ovFrom, `${y}-01-01`), to = minDate(ovTo, `${y}-12-31`);
        if (from > to) continue;
        let lines: DayLine[] = [];
        try { lines = expandDays(e, from, to).filter((l) => l.amount > 0); } catch { continue; }
        if (!lines.length) continue;
        // Post on the first counted sick day, so the event sits where it happens in the replay.
        at(lines[0].date, 2, () => applySickness(s, req.id, y, lines));
      }
    }
  }

  const restoredDays = new Set<string>();
  const restoredAmt: Record<string, number> = {};
  function applySickness(s: Inputs['sickness'][number], reqId: string, y: number, allLines: DayLine[]) {
    const d = debitedBy[`${reqId}|${y}`];
    if (!d) return;
    // A day of leave can only be given back once, however many sickness records cover it.
    const lines = allLines.filter((l) => !restoredDays.has(`${reqId}|${l.date}`));
    if (!lines.length) return;
    const from = lines[0].date, to = lines[lines.length - 1].date;
    const amount = sumCounted(lines);
    const mark = () => lines.forEach((l) => restoredDays.add(`${reqId}|${l.date}`));
    const key = `${reqId}|${y}`;
    const room = r4(d.amount - (restoredAmt[key] ?? 0)); // never give back more than the request took
    const bucket = d.buckets[0];
    const b = bucketDef(bucket, y)!;
    const rule = b.sickDuringLeave.rule;
    const amt = Math.min(amount, room);
    if (amt <= 0) return;
    const track = (n: number) => { restoredAmt[key] = r4((restoredAmt[key] ?? 0) + n); };
    // Give days back to the buckets they were taken from, never more than each one gave.
    const restoreTo = (n: number, explain: (a: number) => string) => {
      let left = r4(n);
      for (const bk of d.buckets) {
        if (left <= 0) break;
        const roomB = r4((d.taken[bk] ?? 0) - (d.given[bk] ?? 0));
        const a = Math.min(left, roomB);
        if (a <= 0) continue;
        credit('RESTORE', from, bk, a, y, rule, explain(a), { requestId: reqId });
        d.given[bk] = r4((d.given[bk] ?? 0) + a);
        left = r4(left - a);
      }
    };
    const range = from === to ? from : `${from} → ${to}`;
    const unit = b.unit;
    const noRestore = (why: string) => post('ADJUST', from, bucket, 0, y, rule, `Sick ${range} during leave — not restored: ${why}`, { requestId: reqId });
    switch (b.sickDuringLeave.mode) {
      case 'restore-if-certified':
        if (!s.certified) return noRestore('no medical certificate provided (BUrlG §9 requires one)');
        restoreTo(amt, (a) => `Certified sickness ${range} during leave: ${fmt(a)} ${unit} not counted as leave`);
        mark(); track(amt);
        return;
      case 'restore-on-request':
        if (!s.employeeAskedToReschedule) return noRestore('the employee has not asked to reschedule (right exists on request)');
        restoreTo(amt, (a) => `Sick ${range} during leave and employee asked to reschedule: ${fmt(a)} ${unit} restored`);
        mark(); track(amt);
        return;
      case 'restore':
        restoreTo(amt, (a) => `Incapacity ${range} interrupts leave: ${fmt(a)} ${unit} restored to be taken later`);
        mark(); track(amt);
        return;
      case 'convert-to-sick-bank': {
        const sick = bucketsOf(y).find((x) => x.requestKinds.includes('sick-bank'));
        if (!sick) return noRestore('no sick bank in this pack');
        if (addDays(e.hireDate, sick.usableFromDays) > from) return noRestore(`sick leave usable only from day ${sick.usableFromDays} of employment`);
        // Keep what already-approved sick-bank requests later in the year will need.
        // Includes bookings after year end: carried-over sick hours are what fund them.
        const reserved = approved.filter((r) => r.kind === 'sick-bank' && r.from > from)
          .reduce((s2, r) => { try { return s2 + sumCounted(expandDays(e, r.from, minDate(r.to, endDate))); } catch { return s2; } }, 0);
        const avail = Math.max(0, r4(balanceOf(sick.id) - reserved));
        const use = Math.min(amt, avail);
        if (use <= 0) return noRestore('no Paid Sick Leave balance available');
        restoreTo(use, (a) => `Sick ${range} during leave: ${fmt(a)} h moved from Paid Leave to Paid Sick Leave`);
        debit([sick.id], use, from, y, rule, `Sick ${range} during leave: ${fmt(use)} h charged to Paid Sick Leave`, true, { requestId: reqId });
        track(use);
        if (use >= amt) mark();
        return;
      }
    }
  }

  // A warning sent after leave was blocked starts the clock again: it lapses at the end of the leave year
  // in which the employer cured the failure (UK reg.13(18); DE BAG 9 AZR 423/16, 9 AZR 266/20).
  for (const n of inputs.notices.filter((x) => x.employeeId === e.id)) {
    at(n.sentOn, 3, () => {
      for (const l of lots.filter((x) => x.blocked && x.leaveYear === n.leaveYear && x.remaining > 0)) {
        const b = bucketDef(l.bucket, yearOf(n.sentOn));
        const md = b?.carryOver.expiresMonthDay;
        if (!b?.carryOver.conditionalOnNotice || !md) continue;
        l.blocked = false;
        l.expiresOn = `${yearOf(n.sentOn) + 1}-${md}`;
        post('CARRY_OVER', n.sentOn, l.bucket, 0, l.leaveYear, b.carryOver.rule,
          `Written warning sent on ${formatDate(n.sentOn)} for ${l.leaveYear} leave: ${fmt(l.remaining)} ${b.unit} can now lapse on ${formatDate(l.expiresOn)} if not taken`);
      }
    });
  }

  // ---------- termination ----------
  if (e.terminationDate && e.terminationDate <= endDate && yearOf(e.terminationDate) <= lastYear) {
    const td = e.terminationDate, y = yearOf(td);
    at(td, 5, () => {
      for (const b of bucketsOf(y)) {
        if (unlimited.has(b.id)) {
          // Ord. 6-130-030(g): 40 h minus the hours used in the 12 months before separation (rolling, not the benefit year).
          const since = addDays(td, -365);
          const used = r4(-events.filter((x) => x.bucket === b.id && x.date > since && x.date <= td).reduce((s, x) => s + x.amount, 0));
          const floor = b.entitlement.params.capPerYear ?? 40;
          const pay = r4(Math.max(0, floor - used));
          const rule = packs[y].extras.find((x) => x.ruleId === 'chi-unlimited-payout') ?? b.payoutOnTermination.rule;
          post('PAYOUT', td, b.id, 0, y, rule, `Employment ends ${td}: unlimited PTO, so pay out ${fmt(pay)} hours (${floor} h floor − ${fmt(used)} h Paid Leave used in the 12 months before leaving)`);
          continue;
        }
        const bal = balanceOf(b.id);
        if (bal < 0) { issues.push({ code: 'NEGATIVE_AT_TERMINATION', date: td, message: `${fmt(-bal)} ${b.unit} overdrawn in ${b.id} — check whether local law allows deduction from final pay` }); continue; }
        if (bal === 0) continue;
        consume([b.id], bal, td, true);
        if (b.payoutOnTermination.mode === 'remaining') post('PAYOUT', td, b.id, -bal, y, b.payoutOnTermination.rule, `Employment ends ${formatDate(td)}: ${fmt(bal)} ${b.unit} of ${b.label} paid out in final pay.`);
        else post('ADJUST', td, b.id, -bal, y, b.payoutOnTermination.rule, `Employment ends ${formatDate(td)}: ${fmt(bal)} ${b.unit} of ${b.label} forfeited, because it is not payable under the rule.`);
      }
    });
  }

  // ---------- replay ----------
  let yearEndDone = firstYear - 1;
  const notices = inputs.notices.filter((n) => n.employeeId === e.id);

  function processExpiries(date: ISODate) {
    const due = lots.filter((l) => l.remaining > 0 && l.expiresOn === date);
    const groups = new Map<string, Lot[]>();
    for (const l of due) { const k = `${l.bucket}|${l.leaveYear}`; groups.set(k, [...(groups.get(k) ?? []), l]); }
    for (const group of groups.values()) {
      const { bucket, leaveYear } = group[0];
      const b = bucketDef(bucket, yearOf(date))!;
      const rule = b.carryOver.rule;
      const amt = r4(group.reduce((s, l) => s + l.remaining, 0));
      if (b.carryOver.conditionalOnNotice) {
        const n = notices.find((x) => x.leaveYear === leaveYear && x.sentOn <= date);
        if (!n) {
          group.forEach((l) => { l.expiresOn = null; l.blocked = true; });
          post('EXPIRY_BLOCKED', date, bucket, 0, leaveYear, rule,
            `${fmt(amt)} ${b.unit} from ${leaveYear} would lapse on ${formatDate(date)}, but there is no record that the employee was given the chance and warned in writing, so the leave does not lapse`);
          continue;
        }
        group.forEach((l) => (l.remaining = 0));
        post('EXPIRE', date, bucket, -amt, leaveYear, rule, `${fmt(amt)} ${b.unit} from ${leaveYear} lapse — employee was warned on ${n.sentOn}`);
      } else {
        group.forEach((l) => (l.remaining = 0));
        post('EXPIRE', date, bucket, -amt, leaveYear, rule, `${fmt(amt)} ${b.unit} carried from ${leaveYear} expire on ${date}`);
      }
    }
  }

  function processYearEnd(y: number) {
    const date = `${y}-12-31`;
    for (const b of bucketsOf(y)) {
      const cands = lots.filter((l) => l.bucket === b.id && l.remaining > 0 && !l.blocked && (l.expiresOn === null || l.expiresOn > date))
        .sort((a, c) => a.leaveYear - c.leaveYear);
      const total = r4(cands.reduce((s, l) => s + l.remaining, 0));
      if (total <= 0) continue;
      const rule = b.carryOver.rule;
      const keep = b.carryOver.max === null ? total : Math.min(total, b.carryOver.max);
      let excess = r4(total - keep);
      for (const l of cands) {
        if (excess <= 0) break;
        const t = Math.min(l.remaining, excess);
        l.remaining = r4(l.remaining - t);
        excess = r4(excess - t);
      }
      if (total - keep > 0)
        post('EXPIRE', date, b.id, -(total - keep), y, rule,
          keep === 0 ? `Year end: ${fmt(total)} ${b.unit} unused — this bucket cannot be carried over` : `Year end: ${fmt(total - keep)} ${b.unit} above the ${b.carryOver.max} ${b.unit} carry-over limit lapse`);
      for (const l of cands) if (l.remaining > 0 && !l.carried) {
        l.carried = true;
        l.expiresOn = b.carryOver.expiresMonthDay ? `${y + 1}-${b.carryOver.expiresMonthDay}` : null;
      }
      if (keep > 0) {
        const md = b.carryOver.expiresMonthDay;
        post('CARRY_OVER', date, b.id, 0, y, rule,
          `${fmt(keep)} ${b.unit} carried into ${y + 1}${md ? `; must be used by ${y + 1}-${md}${b.carryOver.conditionalOnNotice ? ' (lapses only if the employee was warned)' : ''}` : ''}`);
      }
    }
  }

  /** Process every boundary (expiry dates, year ends) strictly before `date`. */
  function settle(date: ISODate) {
    for (;;) {
      const nextExpiry = lots.filter((l) => l.remaining > 0 && l.expiresOn && l.expiresOn < date).map((l) => l.expiresOn!).sort()[0];
      const nextYearEnd = yearEndDone + 1 <= lastYear && `${yearEndDone + 1}-12-31` < date ? `${yearEndDone + 1}-12-31` : undefined;
      if (!nextExpiry && !nextYearEnd) return;
      if (nextExpiry && (!nextYearEnd || nextExpiry <= nextYearEnd)) processExpiries(nextExpiry);
      else { yearEndDone++; processYearEnd(yearEndDone); }
    }
  }

  ops.sort((a, b) => a.date.localeCompare(b.date) || a.prio - b.prio || a.seq - b.seq);
  for (const op of ops) { settle(op.date); op.run(); }
  // Boundaries take effect when the replay moves past them: a balance asked for on 31 Dec is still pre-year-end.
  if (!(e.terminationDate && e.terminationDate <= endDate)) settle(endDate);

  return finish();

  function finish(): Ledger {
    events.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const balances: Record<string, BucketBalance> = {};
    for (const [id, meta] of Object.entries(bucketMeta)) {
      const byYear: Record<number, number> = {};
      for (const l of lots.filter((x) => x.bucket === id && x.remaining > 0)) byYear[l.leaveYear] = r4((byYear[l.leaveYear] ?? 0) + l.remaining);
      balances[id] = { available: balanceOf(id), unit: meta.unit, label: meta.label, byYear };
      if (unlimited.has(id)) {
        const usedByYear: Record<number, number> = {};
        for (const ev of events.filter((x) => x.bucket === id)) usedByYear[ev.leaveYear] = r4((usedByYear[ev.leaveYear] ?? 0) - ev.amount);
        balances[id].unlimited = true;
        balances[id].usedByYear = usedByYear;
      }
    }
    return { employee: e, asOf, events, balances, lots, tasks, issues };
  }
}

function monthsBetweenFull(from: ISODate, to: ISODate): number {
  let k = 0;
  while (addDays(addMonths(from, k + 1), -1) <= to) k++;
  return k;
}
