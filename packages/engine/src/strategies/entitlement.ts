// Full-year entitlement per bucket, before proration for joiners/leavers. Strategy names come from the pack.
import { EngineError, type Employee, type RuleRef } from '../model';
import type { Bucket, Pack } from '../packs/types';
import { plSeniorityYears } from './seniority';

export interface Entitlement {
  amount: number;
  explanation: string;
  rule: RuleRef;
  extras?: { amount: number; explanation: string; rule: RuleRef }[];
}

export const daysPerWeek = (e: Employee) => e.pattern.days.length;
export const weeklyHours = (e: Employee) => e.pattern.days.length * e.pattern.hoursPerDay;
const round2 = (n: number) => Math.round(n * 100) / 100;

export function getBucket(pack: Pack, bucketId: string): Bucket {
  const b = pack.buckets.find((x) => x.id === bucketId);
  if (!b) throw new EngineError('BUCKET_NOT_FOUND', `${pack.id} has no bucket "${bucketId}"`);
  return b;
}

export const totalEntitlement = (r: Entitlement) => r.amount + (r.extras ?? []).reduce((s, x) => s + x.amount, 0);

export function annualEntitlement(e: Employee, pack: Pack, bucketId: string, year: number): Entitlement {
  const b = getBucket(pack, bucketId);
  const { strategy, params, rule } = b.entitlement;
  const d = daysPerWeek(e);

  switch (strategy) {
    case 'werktage': {
      const amount = round2((params.werktage * d) / 6);
      const extras: Entitlement['extras'] = [];
      if (e.de?.severeDisability) {
        const r = pack.extras.find((x) => x.ruleId === 'de-sgb9-208');
        if (r) extras.push({ amount: d, explanation: `Severe disability supplement: ${d} days (one working week)`, rule: r });
      }
      return { amount, rule, extras, explanation: `${params.werktage} Werktage × ${d} working days ÷ 6 = ${amount} days` };
    }
    case 'weeks': {
      let amount = round2(params.weeks * d);
      let explanation = `${params.weeks} weeks × ${d} days/week = ${amount} days`;
      if (params.totalCapDays && params.capSharedWith) {
        const shared = getBucket(pack, params.capSharedWith);
        const sharedAmount = round2(shared.entitlement.params.weeks * d);
        const room = Math.max(0, params.totalCapDays - sharedAmount);
        if (amount > room) {
          explanation += `, capped to ${room} so the total stays ≤ ${params.totalCapDays} days`;
          amount = room;
        }
      }
      return { amount, rule, explanation };
    }
    case 'calendar-days':
      return { amount: params.days, rule, explanation: `${params.days} calendar days (pattern-independent; weekends inside a block count)` };
    case 'pl-seniority': {
      const s = plSeniorityYears(e, `${year}-01-01` > e.hireDate ? `${year}-01-01` : e.hireDate, params.educationYears);
      const base = s.years >= params.thresholdYears ? params.over : params.under;
      const fte = weeklyHours(e) / 40;
      const amount = fte >= 1 ? base : Math.ceil(base * fte);
      return {
        amount, rule,
        explanation: `Seniority ${s.breakdown} → ${base} days${fte < 1 ? ` × ${round2(fte)} FTE, rounded up = ${amount}` : ''}`,
      };
    }
    case 'weeks-hours': {
      const h = weeklyHours(e);
      const amount = round2(params.weeks * h);
      return { amount, rule, explanation: `${params.weeks} weeks × ${round2(h)} hours a week = ${amount} hours` };
    }
    case 'fixed-days':
      return { amount: params.days, rule, explanation: `${params.days} days a year` };
    case 'per-days-worked': {
      const est = Math.min(params.capPerYear ?? Infinity, round2((d * 52) / params.per));
      return { amount: est, rule, explanation: `1 day per ${params.per} days worked${params.capPerYear ? `, up to ${params.capPerYear} a year` : ''} (about ${est} days for a full year on a ${d}-day week)` };
    }
    case 'per-hours-worked':
      return { amount: params.capPerYear, rule, explanation: `1 hour per ${params.per} hours worked, capped at ${params.capPerYear} hours per year` };
  }
}
