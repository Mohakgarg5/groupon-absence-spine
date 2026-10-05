// Annual update: what changes when a pack rolls from one year to the next, and who it affects — before activation.
import { EngineError, type Employee, type HrTask, type Inputs } from './model';
import { dow, yearOf } from './dates';
import { getPack } from './packs/registry';
import type { Pack } from './packs/types';
import { expandDays, sumCounted } from './calendar';
import { annualEntitlement, totalEntitlement } from './strategies/entitlement';
import { plThresholdCrossingDate } from './strategies/seniority';

export interface PackDiff {
  from: string;
  to: string;
  blocked: boolean;
  reason?: string;
  moved: { name: string; from: string; to: string }[];
  /** Holidays on the same day and month in both years. */
  unchanged: number;
  added: { name: string; date: string }[];
  removed: { name: string; date: string }[];
  ruleChanges: { path: string; from: unknown; to: unknown }[];
}

const IGNORE = new Set(['version', 'year', 'holidays', 'packVersion']);

function flatten(o: any, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  const key = (x: any) => (x && typeof x === 'object' ? x.id ?? x.ruleId : undefined);
  if (Array.isArray(o) && o.length && o.every((x) => key(x) !== undefined)) {
    for (const x of o) flatten(x, `${prefix}${key(x)}.`, out);
    return out;
  }
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    for (const [k, v] of Object.entries(o)) if (!IGNORE.has(k)) flatten(v, `${prefix}${k}.`, out);
    return out;
  }
  out[prefix.slice(0, -1)] = Array.isArray(o) ? JSON.stringify(o) : o;
  return out;
}

export function diffPacks(a: Pack, b: Pack): PackDiff {
  const d: PackDiff = { from: `${a.id}@${a.version}`, to: `${b.id}@${b.version}`, blocked: false, moved: [], unchanged: 0, added: [], removed: [], ruleChanges: [] };
  if (!b.holidays.loaded) { d.blocked = true; d.reason = b.holidays.source.citation; }
  // Match on the base name so "Christmas Day (substitute day)" is a moved Christmas, not a new holiday.
  const base = (n: string) => n.replace(/\s*\((observed|substitute day)\)\s*$/i, '').replace(/^traslado (de la |del |de )/i, '').replace(/^./, (c) => c.toUpperCase()).trim();
  const an = new Map(a.holidays.dates.map((h) => [base(h.name), h.date]));
  const bn = new Map(b.holidays.dates.map((h) => [base(h.name), h.date]));
  for (const [name, date] of bn) {
    if (!an.has(name)) d.added.push({ name, date });
    else if (an.get(name)!.slice(5) === date.slice(5)) d.unchanged++;
    else d.moved.push({ name, from: an.get(name)!, to: date });
  }
  if (b.holidays.loaded) for (const [name, date] of an) if (!bn.has(name)) d.removed.push({ name, date });
  const fa = flatten(a), fb = flatten(b);
  for (const k of new Set([...Object.keys(fa), ...Object.keys(fb)])) {
    if (k.startsWith('owner.signOff')) continue;
    if (JSON.stringify(fa[k]) !== JSON.stringify(fb[k])) d.ruleChanges.push({ path: k, from: fa[k], to: fb[k] });
  }
  return d;
}

export interface UpdateImpact {
  packId: string;
  fromYear: number;
  toYear: number;
  diff: PackDiff;
  signOff: Pack['owner'];
  seniorityCrossings: { employeeId: string; date: string; from: number; to: number }[];
  entitlementChanges: { employeeId: string; from: number; to: number; unit: string }[];
  tasks: HrTask[];
  affectedRequests: { requestId: string; employeeId: string; from: string; to: string; status: 'ok' | 'blocked'; charged?: number; holidaysInside?: string[]; reason?: string }[];
}

export function annualUpdateImpact(packId: string, fromYear: number, toYear: number, employees: Employee[], inputs: Inputs): UpdateImpact {
  const a = getPack(packId, fromYear), b = getPack(packId, toYear);
  const people = employees.filter((e) => e.packId === packId && (!e.terminationDate || yearOf(e.terminationDate) >= toYear) && e.hireDate <= `${toYear}-12-31`);
  const imp: UpdateImpact = { packId, fromYear, toYear, diff: diffPacks(a, b), signOff: b.owner, seniorityCrossings: [], entitlementChanges: [], tasks: [], affectedRequests: [] };

  for (const e of people) {
    const bucket = b.buckets[0];
    if (bucket.entitlement.strategy === 'pl-seniority') {
      const p = bucket.entitlement.params;
      const date = plThresholdCrossingDate(e, toYear, p.thresholdYears, p.educationYears);
      if (date) imp.seniorityCrossings.push({ employeeId: e.id, date, from: p.under, to: p.over });
    }
    try {
      const before = totalEntitlement(annualEntitlement(e, a, bucket.id, fromYear));
      const after = totalEntitlement(annualEntitlement(e, b, bucket.id, toYear));
      if (before !== after) imp.entitlementChanges.push({ employeeId: e.id, from: before, to: after, unit: bucket.unit });
    } catch { /* bucket missing in one year */ }
  }

  if (b.holidays.loaded) {
    for (const h of b.holidays.dates) {
      if (b.holidayPolicy.onNonWorkingDay === 'designate-day-off-task' && dow(h.date) === 6)
        imp.tasks.push({ date: h.date, title: `${h.name} falls on a Saturday — designate a replacement day off for all staff`, rule: b.holidayPolicy.rule });
    }
    if (b.holidayPolicy.onNonWorkingDay === 'extra-leave') {
      const weekend = b.holidays.dates.filter((h) => [0, 6].includes(dow(h.date)));
      for (const h of weekend) imp.tasks.push({ date: h.date, title: `${h.name} falls on a weekend — Mon–Fri staff are owed the employer-chosen remedy`, rule: b.holidayPolicy.rule });
    }
  } else {
    imp.tasks.push({ date: `${toYear}-01-01`, title: `Load and sign off the ${toYear} holiday calendar before activating ${packId} v${b.version}`, rule: b.holidays.source });
  }
  if (b.owner.signOff.status !== 'signed')
    imp.tasks.push({ date: `${toYear}-01-01`, title: `Legal sign-off pending: ${b.owner.role}`, rule: { packId: b.id, packVersion: b.version, ruleId: 'pack-signoff', citation: 'Rule-pack governance: no pack version activates until its named owner signs it off', verification: 'assumption' } });

  for (const r of inputs.requests.filter((x) => people.some((p) => p.id === x.employeeId) && x.status !== 'rejected' && yearOf(x.to) >= toYear && yearOf(x.from) <= toYear)) {
    const e = people.find((p) => p.id === r.employeeId)!;
    const from = r.from < `${toYear}-01-01` ? `${toYear}-01-01` : r.from;
    const to = r.to > `${toYear}-12-31` ? `${toYear}-12-31` : r.to;
    try {
      const lines = expandDays(e, from, to);
      imp.affectedRequests.push({ requestId: r.id, employeeId: e.id, from, to, status: 'ok', charged: sumCounted(lines), holidaysInside: lines.filter((l) => l.kind === 'holiday').map((l) => `${l.holidayName} ${l.date}`) });
    } catch (err) {
      if (!(err instanceof EngineError)) throw err;
      imp.affectedRequests.push({ requestId: r.id, employeeId: e.id, from, to, status: 'blocked', reason: err.message.replace(/^[A-Z_]+: /, '') });
    }
  }
  return imp;
}
