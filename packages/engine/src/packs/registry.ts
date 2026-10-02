// Loads the versioned, cited rule packs. A pack is the only place local law lives.
import { EngineError, type RuleRef } from '../model';
import type { Pack } from './types';
import { isValidISODate, yearOf } from '../dates';

import de26 from './DE-BE.2026.json';
import de27 from './DE-BE.2027.json';
import pl26 from './PL.2026.json';
import pl27 from './PL.2027.json';
import ie26 from './IE.2026.json';
import ie27 from './IE.2027.json';
import uk26 from './UK.2026.json';
import uk27 from './UK.2027.json';
import es26 from './ES-MD.2026.json';
import es27 from './ES-MD.2027.json';
import us26 from './US-CHI.2026.json';
import us27 from './US-CHI.2027.json';

const RAW: unknown[] = [de26, de27, pl26, pl27, ie26, ie27, uk26, uk27, es26, es27, us26, us27];

/** Stamp packId + version onto every rule so each ledger event can cite exactly which pack produced it. */
export function inflate(raw: any): Pack {
  const p = structuredClone(raw);
  const stamp = (r: any) => { if (r && typeof r === 'object' && 'ruleId' in r) { r.packId = p.id; r.packVersion = p.version; } };
  const visit = (o: any) => {
    if (!o || typeof o !== 'object') return;
    stamp(o);
    for (const v of Object.values(o)) visit(v);
  };
  visit(p);
  return p as Pack;
}

let cache: Pack[] | null = null;
let overrides: Pack[] = [];

export function allPacks(): Pack[] {
  if (!cache) cache = RAW.map(inflate);
  return [...cache.filter((p) => !overrides.some((o) => o.id === p.id && o.year === p.year)), ...overrides];
}

/** For "what-if" editing in the UI and tests: replace a pack in memory. */
export function setPackOverride(p: Pack | null, id?: string, year?: number) {
  if (p) overrides = [...overrides.filter((o) => !(o.id === p.id && o.year === p.year)), p];
  else overrides = overrides.filter((o) => !(o.id === id && o.year === year));
}

export function getPack(packId: string, year: number): Pack {
  const p = allPacks().find((x) => x.id === packId && x.year === year);
  if (!p) throw new EngineError('PACK_NOT_FOUND', `No rule pack ${packId} for ${year}. A pack must be authored and signed off before this year can be processed.`);
  return p;
}

export function packIds(): string[] {
  return [...new Set(allPacks().map((p) => p.id))];
}

export function walkRules(p: Pack): RuleRef[] {
  const out: RuleRef[] = [];
  const visit = (o: any) => {
    if (!o || typeof o !== 'object') return;
    if ('ruleId' in o && 'citation' in o) out.push(o);
    for (const v of Object.values(o)) visit(v);
  };
  visit(p);
  return out;
}

const STRATS = {
  entitlement: ['werktage', 'weeks', 'calendar-days', 'pl-seniority', 'per-hours-worked'],
  accrual: ['de-waiting-period', 'front-load-prorata', 'monthly', 'pl-proportional', 'uk-first-year-monthly', 'hours-worked'],
  sick: ['restore-if-certified', 'restore-on-request', 'restore', 'convert-to-sick-bank'],
  counting: ['working-days', 'calendar-days', 'working-hours'],
};

/** Returns human-readable problems; an empty array means the pack is loadable. */
export function validatePack(p: Pack): string[] {
  const e: string[] = [];
  if (!p.id || !p.version || !Number.isInteger(p.year)) e.push('id/version/year required');
  if (p.leaveYear?.startMonth !== 1 || p.leaveYear?.startDay !== 1) e.push('leaveYear: only calendar leave years are supported by this engine version');
  if (!STRATS.counting.includes(p.counting?.mode)) e.push(`counting.mode unknown: ${p.counting?.mode}`);
  if (!p.owner?.role) e.push('owner.role required — every pack needs a named legal owner');
  if (!p.holidays) e.push('holidays block required');
  else {
    if (p.holidays.loaded && p.holidays.dates.length === 0) e.push('holidays.loaded=true but no dates');
    for (const h of p.holidays.dates) {
      if (!isValidISODate(h.date)) e.push(`holiday date invalid: ${h.date}`);
      else if (yearOf(h.date) !== p.year) e.push(`holiday ${h.date} outside pack year ${p.year}`);
    }
    const sorted = [...p.holidays.dates].map((h) => h.date);
    if (sorted.join() !== [...sorted].sort().join()) e.push('holidays must be sorted');
  }
  if (!p.buckets?.length) e.push('at least one bucket required');
  const ids = new Set<string>();
  for (const b of p.buckets ?? []) {
    if (ids.has(b.id)) e.push(`duplicate bucket ${b.id}`);
    ids.add(b.id);
    if (!['days', 'hours'].includes(b.unit)) e.push(`${b.id}: unit must be days|hours`);
    if (!STRATS.entitlement.includes(b.entitlement?.strategy)) e.push(`${b.id}: entitlement.strategy unknown`);
    if (!STRATS.accrual.includes(b.accrual?.strategy)) e.push(`${b.id}: accrual.strategy unknown`);
    if (!STRATS.sick.includes(b.sickDuringLeave?.mode)) e.push(`${b.id}: sickDuringLeave.mode unknown`);
    if (b.carryOver?.expiresMonthDay && !/^\d{2}-\d{2}$/.test(b.carryOver.expiresMonthDay)) e.push(`${b.id}: carryOver.expiresMonthDay must be MM-DD`);
    if (!b.requestKinds?.length) e.push(`${b.id}: requestKinds required`);
  }
  for (const r of walkRules(p)) {
    if (!r.citation) e.push(`rule ${r.ruleId}: citation required`);
    if (!['public-verified', 'public-unverified', 'assumption'].includes(r.verification)) e.push(`rule ${r.ruleId}: verification invalid`);
  }
  return e;
}
