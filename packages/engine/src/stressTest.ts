// "Force-unify": apply one naive global policy to every employee and compare with what local law requires.
// Local outcomes come from the same engine and rule packs that process real requests.
import { EngineError, type Employee, type Inputs, type RuleRef } from './model';
import { daysBetween } from './dates';
import { getPack } from './packs/registry';
import type { Pack } from './packs/types';
import { annualEntitlement, totalEntitlement, daysPerWeek } from './strategies/entitlement';
import { plSeniorityYears } from './strategies/seniority';
import { buildLedger } from './ledger';
import { resolvePackId } from './jurisdiction';

export interface GlobalPolicy {
  name: string;
  daysPerYear: number;
  tenureBonusPerYears: number; // +1 day per N years of Groupon tenure
  carryOver: 'none';
  sickDuringLeave: 'consumed';
  publicHolidays: 'local-calendar-only';
  description: string[];
}

export const NAIVE_GLOBAL: GlobalPolicy = {
  name: 'One Groupon leave policy',
  daysPerYear: 25,
  tenureBonusPerYears: 5,
  carryOver: 'none',
  sickDuringLeave: 'consumed',
  publicHolidays: 'local-calendar-only',
  description: [
    '25 working days for everyone, front-loaded on 1 January',
    '+1 day for every 5 years at Groupon',
    'Use it or lose it on 31 December',
    'Falling sick on holiday does not give days back',
    'Local public holidays off; no other holiday rules',
  ],
};

export type Dimension = 'entitlement' | 'seniority' | 'carry-over' | 'sick-during-leave' | 'holidays' | 'jurisdiction';
export type Verdict = 'breach' | 'overspend' | 'review' | 'ok';
export interface StressRow {
  employeeId: string;
  packId: string;
  dimension: Dimension;
  global: string;
  local: string;
  verdict: Verdict;
  delta?: number; // days, + = global gives more than law requires
  rule?: RuleRef;
}
export interface StressResult {
  policy: GlobalPolicy;
  rows: StressRow[];
  summary: {
    breaches: number;
    overspendDays: number;
    employeesAffected: number;
    reviews: number;
    byEntity: Record<string, { breaches: number; overspend: number; employees: number; affected: number }>;
    byDimension: Record<Dimension, { breaches: number; overspend: number; review: number }>;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const YEAR = 2026;

/** Local entitlement expressed in days off on the employee's own pattern, comparable with "25 days". */
function localDaysOff(e: Employee, pack: Pack): number {
  let total = 0;
  for (const b of pack.buckets.filter((x) => x.requestKinds.includes('annual'))) {
    const t = totalEntitlement(annualEntitlement(e, pack, b.id, YEAR));
    if (b.unit === 'hours') total += t / e.pattern.hoursPerDay;
    else if (pack.counting.mode === 'calendar-days') total += (t * daysPerWeek(e)) / 7;
    else if (pack.counting.dayEquivalentHours) total += (t * pack.counting.dayEquivalentHours) / e.pattern.hoursPerDay;
    else total += t;
  }
  if (pack.holidayPolicy.deductFromEntitlement) {
    total -= pack.holidays.dates.filter((h) => e.pattern.days.includes(new Date(h.date + 'T00:00:00Z').getUTCDay())).length;
  }
  return r1(total);
}

export function runStressTest(employees: Employee[], inputs: Inputs, policy: GlobalPolicy = NAIVE_GLOBAL): StressResult {
  const rows: StressRow[] = [];
  for (const e of employees) {
    const push = (row: Omit<StressRow, 'employeeId' | 'packId'>) => rows.push({ employeeId: e.id, packId: e.packId, ...row });
    try { resolvePackId(e); } catch (err) {
      if (err instanceof EngineError) {
        push({ dimension: 'jurisdiction', global: 'Applies the global policy as if Chicago', local: 'Illinois PLAWA (820 ILCS 192) — no pack authored', verdict: 'review', rule: getPack(e.packId, YEAR).locationAssumption });
        continue;
      }
      throw err;
    }
    const pack = getPack(e.packId, YEAR);
    const annual = pack.buckets.filter((b) => b.requestKinds.includes('annual'));
    const tenure = Math.max(0, daysBetween(e.hireDate, `${YEAR}-01-01`) / 365.25);
    const globalDays = policy.daysPerYear + Math.floor(tenure / policy.tenureBonusPerYears);
    const local = localDaysOff(e, pack);
    const d = daysPerWeek(e);

    // Entitlement & seniority
    const entRule = annual[0].entitlement.rule;
    const plSen = pack.buckets[0].entitlement.strategy === 'pl-seniority' ? plSeniorityYears(e, `${YEAR}-01-01` > e.hireDate ? `${YEAR}-01-01` : e.hireDate, pack.buckets[0].entitlement.params.educationYears) : null;
    const plOver = plSen && plSen.years >= pack.buckets[0].entitlement.params.thresholdYears;
    if (globalDays < local - 0.05) {
      if (plOver) {
        push({ dimension: 'entitlement', global: `${globalDays} days`, local: `${local} days`, verdict: 'ok', delta: 0 });
        push({ dimension: 'seniority', global: `${globalDays} days (Groupon tenure ${r1(tenure)} y)`, local: `${local} days — statutory seniority ${r1(plSen!.years)} y incl. education`, verdict: 'breach', delta: r1(globalDays - local), rule: entRule });
      } else {
        push({ dimension: 'entitlement', global: `${globalDays} days`, local: `${local} days off on this pattern`, verdict: 'breach', delta: r1(globalDays - local), rule: entRule });
        push({ dimension: 'seniority', global: 'Tenure bonus', local: 'No statutory seniority', verdict: 'ok' });
      }
    } else {
      const fairGlobal = (globalDays * d) / 5;
      const over = d < 5 ? r1(globalDays - fairGlobal) : 0;
      push({
        dimension: 'entitlement', global: `${globalDays} days`, local: `${local} days off on a ${d}-day week`,
        verdict: over > 0 ? 'overspend' : 'ok', delta: over > 0 ? over : r1(globalDays - local),
        ...(over > 0 ? { rule: entRule } : {}),
      });
      push({
        dimension: 'seniority', global: `${globalDays} days (Groupon tenure ${r1(tenure)} y)`,
        local: !plSen ? 'No statutory seniority' : plOver
          ? `Statutory seniority ${r1(plSen.years)} y → ${local} days; the tenure bonus happens to cover it`
          : `Statutory seniority ${r1(plSen.years)} y, under the ${pack.buckets[0].entitlement.params.thresholdYears}-year step`,
        verdict: 'ok',
      });
    }

    // Carry-over probe: 5 days unused on 31 Dec, no written warning sent.
    const carry = annual.find((b) => b.carryOver.max !== 0) ?? annual[0];
    const c = carry.carryOver;
    const keepsSome = c.max === null || c.max > 0;
    const mandatory = c.conditionalOnNotice || pack.id === 'US-CHI' || pack.id === 'PL';
    push({
      dimension: 'carry-over', global: 'Unused leave lost on 31 Dec',
      local: !keepsSome ? 'Lapses at year end (same as global)'
        : c.conditionalOnNotice ? `Kept: cannot lapse unless the employee was warned; otherwise until ${c.expiresMonthDay ?? 'n/a'}`
        : `Carried${c.max !== null ? ` up to ${c.max} ${carry.unit}` : ''}${c.expiresMonthDay ? ` to ${c.expiresMonthDay}` : ''}`,
      verdict: !keepsSome ? 'ok' : mandatory ? 'breach' : c.rule.verification === 'assumption' || /consent|agreement/i.test(c.rule.citation) ? 'ok' : 'review',
      rule: c.rule,
    });

    // Sickness during leave probe: 2 certified days inside a week of leave.
    const s = annual[0].sickDuringLeave;
    push({
      dimension: 'sick-during-leave', global: '2 sick days stay counted as leave',
      local: s.mode === 'restore-if-certified' ? '2 days restored (with certificate)'
        : s.mode === 'restore' ? '2 days restored / leave postponed'
        : s.mode === 'restore-on-request' ? '2 days restored if the employee asks'
        : 'Hours moved to the Paid Sick Leave bank',
      verdict: s.rule.verification === 'assumption' ? 'review' : 'breach',
      rule: s.rule,
    });

    // Holiday rules the global policy ignores — counted from the real ledger.
    const led = buildLedger(e, inputs, `${YEAR}-12-31`);
    const remedies = led.events.filter((x) => x.rule.ruleId === 'ie-holiday-remedy').length;
    const satTasks = led.tasks.filter((t) => t.rule.ruleId === 'pl-saturday').length;
    if (remedies) push({ dimension: 'holidays', global: 'Holidays on non-working days ignored', local: `${remedies} public holidays fell on non-working days → ${remedies} remedies owed`, verdict: 'breach', rule: pack.holidayPolicy.rule });
    else if (satTasks) push({ dimension: 'holidays', global: 'Saturday holidays ignored', local: `${satTasks} Saturday holiday(s) → replacement day off owed`, verdict: 'breach', rule: pack.holidayPolicy.rule });
    else push({ dimension: 'holidays', global: 'Local calendar', local: pack.holidayPolicy.deductFromEntitlement ? 'Bank holidays count toward 5.6 weeks — global is more generous' : 'No extra holiday rule triggered', verdict: 'ok' });
  }

  const dims: Dimension[] = ['entitlement', 'seniority', 'carry-over', 'sick-during-leave', 'holidays', 'jurisdiction'];
  const byDimension = Object.fromEntries(dims.map((d) => [d, { breaches: 0, overspend: 0, review: 0 }])) as StressResult['summary']['byDimension'];
  const byEntity: StressResult['summary']['byEntity'] = {};
  const affected = new Set<string>();
  for (const e of employees) byEntity[e.packId] ??= { breaches: 0, overspend: 0, employees: 0, affected: 0 };
  for (const e of employees) byEntity[e.packId].employees++;
  for (const r of rows) {
    const be = byEntity[r.packId];
    if (r.verdict === 'breach') { be.breaches++; byDimension[r.dimension].breaches++; affected.add(r.employeeId); }
    if (r.verdict === 'overspend') { be.overspend = r1(be.overspend + (r.delta ?? 0)); byDimension[r.dimension].overspend = r1(byDimension[r.dimension].overspend + (r.delta ?? 0)); }
    if (r.verdict === 'review') byDimension[r.dimension].review++;
  }
  for (const id of affected) byEntity[employees.find((e) => e.id === id)!.packId].affected++;
  return {
    policy, rows,
    summary: {
      breaches: rows.filter((r) => r.verdict === 'breach').length,
      overspendDays: r1(rows.filter((r) => r.verdict === 'overspend').reduce((s, r) => s + (r.delta ?? 0), 0)),
      employeesAffected: affected.size,
      reviews: rows.filter((r) => r.verdict === 'review').length,
      byEntity, byDimension,
    },
  };
}
