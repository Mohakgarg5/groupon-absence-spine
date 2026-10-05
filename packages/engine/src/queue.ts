// The HR work queue: once requests, accruals and year-end run themselves, this is what is left for people —
// judgment calls and conversations (Change & Culture Plan §6). Generated from the same ledgers.
import { EngineError, type Employee, type ISODate, type Inputs, type RuleRef } from './model';
import { addDays, daysBetween, yearOf } from './dates';
import { getPack } from './packs/registry';
import { buildLedger } from './ledger';
import { resolvePackId } from './jurisdiction';

export type QueueKind = 'no-pack' | 'lapse-warning' | 'overdue-leave' | 'final-pay' | 'pending' | 'wellbeing' | 'replacement-day' | 'calendar' | 'migration';
export interface QueueItem {
  kind: QueueKind;
  priority: 1 | 2 | 3; // 1 = legal deadline or blocked person, 2 = money or a decision, 3 = care
  packId: string;
  employeeId?: string;
  title: string;
  detail: string;
  due?: ISODate;
  rule?: RuleRef;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function hrQueue(employees: Employee[], inputs: Inputs, today: ISODate): QueueItem[] {
  const out: QueueItem[] = [];
  const y = yearOf(today);
  const seenEntityTasks = new Set<string>();

  for (const e of employees) {
    try { resolvePackId(e); } catch (err) {
      if (!(err instanceof EngineError)) throw err;
      out.push({ kind: 'no-pack', priority: 1, packId: e.packId, employeeId: e.id, title: `${e.name}: no rule pack for ${e.workLocation}`,
        detail: 'Requests are refused until counsel authors the pack for this work location. Decide interim handling with the employee today.', rule: getPack(e.packId, y).locationAssumption });
      continue;
    }
    if (e.terminationDate && e.terminationDate < today) continue;
    const pack = getPack(e.packId, y);
    const yearEnd = buildLedger(e, inputs, `${y}-12-31`, { today });
    const now = buildLedger(e, inputs, today, { today });

    // Germany (and any pack with conditional lapse): leave left at year end only lapses after a written warning.
    for (const b of pack.buckets.filter((x) => x.carryOver.conditionalOnNotice)) {
      const left = yearEnd.balances[b.id]?.byYear[y] ?? 0;
      const warned = inputs.notices.some((n) => n.employeeId === e.id && n.leaveYear === y);
      if (left > 0 && !warned)
        out.push({ kind: 'lapse-warning', priority: 1, packId: e.packId, employeeId: e.id, due: `${y}-12-31`,
          title: `${e.name}: send the written lapse warning`, detail: `${r1(left)} days of ${y} leave will be left at year end. Without an individual written warning they cannot lapse on 31 March.`, rule: b.carryOver.rule });
    }

    // Leavers in the next 90 days: the final-pay leave figure needs a human check.
    if (e.terminationDate && e.terminationDate >= today && daysBetween(today, e.terminationDate) <= 90) {
      const fin = buildLedger(e, inputs, e.terminationDate, { today });
      const pays = fin.events.filter((x) => x.type === 'PAYOUT' || (x.type === 'ADJUST' && x.date === e.terminationDate));
      out.push({ kind: 'final-pay', priority: 2, packId: e.packId, employeeId: e.id, due: addDays(e.terminationDate, -14),
        title: `${e.name}: check the leave figure for final pay`, detail: pays.map((x) => x.explanation).join(' ') || 'No leave balance to settle.', rule: pays[0]?.rule ?? pack.buckets[0].payoutOnTermination.rule });
    }

    // Care, not compliance: little leave taken by the autumn usually means workload, not preference.
    const annual = pack.buckets.filter((b) => b.requestKinds.includes('annual') && b.accrual.strategy !== 'unlimited-with-floor');
    // Bookable leave: grants minus days the pack takes automatically (UK bank holidays count toward 5.6 weeks).
    const granted = now.events.filter((x) => annual.some((b) => b.id === x.bucket) && x.leaveYear === y && ['GRANT', 'ACCRUE', 'ADJUST'].includes(x.type) && x.amount > 0).reduce((s, x) => s + x.amount, 0)
      + yearEnd.events.filter((x) => annual.some((b) => b.id === x.bucket) && x.leaveYear === y && x.type === 'DEBIT' && !x.requestId).reduce((s, x) => s + x.amount, 0);
    const taken = -yearEnd.events.filter((x) => annual.some((b) => b.id === x.bucket) && x.leaveYear === y && x.type === 'DEBIT' && x.requestId).reduce((s, x) => s + x.amount, 0);
    const leavingSoon = !!e.terminationDate && daysBetween(today, e.terminationDate) <= 90;
    if (!leavingSoon && today >= `${y}-09-01` && granted > 0 && taken / granted < 0.4 && daysBetween(e.hireDate, today) > 180)
      out.push({ kind: 'wellbeing', priority: 3, packId: e.packId, employeeId: e.id,
        title: `${e.name}: check in about workload`, detail: `Only ${r1(taken)} of ${r1(granted)} ${annual[0]?.unit ?? 'days'} booked for ${y} so far. A manager conversation about cover and workload, not a reminder email.` });

    for (const i of yearEnd.issues.filter((x) => x.code === 'LEGACY_CONFLICT' || x.code === 'NEGATIVE_BALANCE'))
      out.push({ kind: 'migration', priority: 2, packId: e.packId, employeeId: e.id, title: `${e.name}: reconcile the balance`, detail: i.message, due: i.date });

    for (const t of yearEnd.tasks) {
      if (t.rule.ruleId === 'pl-carry') {
        out.push({ kind: 'overdue-leave', priority: 1, packId: e.packId, employeeId: e.id, due: t.date, title: `${e.name}: schedule overdue leave`, detail: t.title, rule: t.rule });
        continue;
      }
      const kind: QueueKind = t.rule.ruleId === 'pl-saturday' ? 'replacement-day' : 'calendar';
      const key = `${e.packId}|${kind}|${t.date}`;
      if (seenEntityTasks.has(key) || t.date < today) continue;
      seenEntityTasks.add(key);
      out.push({ kind, priority: kind === 'calendar' ? 1 : 2, packId: e.packId, title: t.title, detail: kind === 'replacement-day' ? 'One decision for the whole entity, announced in advance.' : 'Requests in that year are refused until the official calendar is loaded and signed off.', due: t.date, rule: t.rule });
    }
  }

  // Next year's official holiday calendar must be loaded before anyone can book into it.
  for (const id of [...new Set(employees.map((e) => e.packId))]) {
    try {
      const next = getPack(id, y + 1);
      if (!next.holidays.loaded)
        out.push({ kind: 'calendar', priority: 1, packId: id, due: `${y}-11-30`, title: `${id}: load the ${y + 1} holiday calendar`,
          detail: `Requests for ${y + 1} are refused until the official calendar is loaded and signed off. ${next.holidays.source.citation}.`, rule: next.holidays.source });
    } catch { /* no pack for next year yet: authored in the annual update */ }
  }

  for (const r of inputs.requests.filter((x) => x.status === 'pending')) {
    const e = employees.find((p) => p.id === r.employeeId);
    if (!e) continue;
    out.push({ kind: 'pending', priority: 2, packId: e.packId, employeeId: e.id, due: r.from,
      title: `${e.name}: request ${r.from} to ${r.to} waiting`, detail: 'Waiting for a decision before the leave starts.' });
  }

  return out.sort((a, b) => a.priority - b.priority || (a.due ?? '9999').localeCompare(b.due ?? '9999') || a.title.localeCompare(b.title));
}
