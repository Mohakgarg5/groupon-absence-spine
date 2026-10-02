// The unified request pipeline. Same nine stages for every entity; only the rule pack differs.
import {
  EngineError, type DayLine, type Employee, type ISODate, type Inputs, type LeaveRequest, type LedgerEvent, type RuleRef, type Unit,
} from './model';
import { isValidISODate, maxDate, minDate, yearOf, addDays } from './dates';
import { getPack } from './packs/registry';
import { expandDays, sumCounted } from './calendar';
import { buildLedger, SUPPORTED_YEARS } from './ledger';
import { resolvePackId } from './jurisdiction';

export type StageId = 'jurisdiction' | 'validate' | 'expand' | 'split' | 'policy' | 'balance' | 'route' | 'post' | 'export';
export const STAGES: { id: StageId; label: string }[] = [
  { id: 'jurisdiction', label: 'Which law applies' },
  { id: 'validate', label: 'Validate request' },
  { id: 'expand', label: 'Expand onto calendar' },
  { id: 'split', label: 'Split by leave year' },
  { id: 'policy', label: 'Apply local policy' },
  { id: 'balance', label: 'Check balance' },
  { id: 'route', label: 'Route for approval' },
  { id: 'post', label: 'Post to ledger' },
  { id: 'export', label: 'Payroll export' },
];
export interface Stage { id: StageId; label: string; status: 'ok' | 'warn' | 'fail'; detail: string; rules: RuleRef[] }
export interface PayrollLine {
  employeeId: string; entity: string; absenceCode: string; from: ISODate; to: ISODate;
  amount: number; unit: Unit; leaveYear: number; packVersion: string;
}
export interface RequestPart { leaveYear: number; amount: number; unit: Unit; from: ISODate; to: ISODate }
export interface PipelineResult {
  ok: boolean;
  request: LeaveRequest;
  stages: Stage[];
  days: DayLine[];
  parts: RequestPart[];
  balanceBefore: Record<string, number>;
  balanceAfter: Record<string, number>;
  bucketLabels: Record<string, string>;
  preview: LedgerEvent[];
  approverId?: string;
  payroll: PayrollLine[];
  error?: { code: string; message: string };
}

const ABSENCE_CODE = { annual: 'ANNUAL', 'on-demand': 'ON_DEMAND', 'sick-bank': 'SICK' } as const;
const label = (id: StageId) => STAGES.find((s) => s.id === id)!.label;
const fmt = (n: number) => String(Math.round(n * 100) / 100);

export type RequestDraft = Omit<LeaveRequest, 'status' | 'id'> & { id?: string };

export function submitRequest(e: Employee, draft: RequestDraft, inputs: Inputs, today: ISODate): PipelineResult {
  const request: LeaveRequest = { ...draft, id: draft.id ?? `req-${e.id}-${draft.from}-${draft.kind}`, status: 'pending' };
  const res: PipelineResult = { ok: false, request, stages: [], days: [], parts: [], balanceBefore: {}, balanceAfter: {}, bucketLabels: {}, preview: [], payroll: [] };
  const stage = (id: StageId, status: Stage['status'], detail: string, rules: RuleRef[] = []) => res.stages.push({ id, label: label(id), status, detail, rules });
  const fail = (id: StageId, code: string, message: string, rules: RuleRef[] = []) => {
    stage(id, 'fail', message, rules);
    res.error = { code, message };
    return res;
  };
  const safe = <T>(id: StageId, fn: () => T): T | PipelineResult => {
    try { return fn(); } catch (err) {
      if (err instanceof EngineError) return fail(id, err.code, err.message.replace(/^[A-Z_]+: /, ''));
      throw err;
    }
  };

  // 1. Jurisdiction
  const packId = safe('jurisdiction', () => resolvePackId(e));
  if (typeof packId !== 'string') return packId;
  {
    const y0 = isValidISODate(request.from) && SUPPORTED_YEARS.includes(yearOf(request.from)) ? yearOf(request.from) : SUPPORTED_YEARS[0];
    const jp = getPack(packId, y0);
    stage('jurisdiction', 'ok', `${e.workLocation} → ${jp.entity} · rule pack ${packId}`, [jp.locationAssumption]);
  }

  // 2. Validate
  if (!isValidISODate(request.from) || !isValidISODate(request.to)) return fail('validate', 'INVALID_RANGE', `Dates must be real calendar dates (got ${request.from} → ${request.to}).`);
  if (request.from > request.to) return fail('validate', 'INVALID_RANGE', `Start ${request.from} is after end ${request.to}.`);
  if (request.from < e.hireDate || (e.terminationDate && request.to > e.terminationDate))
    return fail('validate', 'NOT_EMPLOYED', `Request falls outside employment (${e.hireDate} → ${e.terminationDate ?? 'ongoing'}).`);
  const years: number[] = [];
  for (let y = yearOf(request.from); y <= yearOf(request.to); y++) years.push(y);
  const unsupported = years.find((y) => !SUPPORTED_YEARS.includes(y));
  if (unsupported) return fail('validate', 'PACK_NOT_FOUND', `No signed-off rule pack for ${packId} ${unsupported}. Leave in a year needs that year's pack first.`);
  const packs = Object.fromEntries(years.map((y) => [y, getPack(packId, y)]));
  const p0 = packs[years[0]];
  const clash = inputs.requests.find((r) => r.employeeId === e.id && r.id !== request.id && r.status !== 'rejected' && r.from <= request.to && r.to >= request.from);
  if (clash) return fail('validate', 'OVERLAP', `Overlaps ${clash.status} request ${clash.from} → ${clash.to}.`);
  const kindBuckets = (y: number) => packs[y].buckets.filter((b) => b.requestKinds.includes(request.kind));
  if (!kindBuckets(years[0]).length) return fail('validate', 'KIND_NOT_ALLOWED', `${p0.entity} has no "${request.kind}" leave type.`, [p0.counting.rule]);
  stage('validate', 'ok', `${request.from} → ${request.to}, ${request.kind} leave, no overlaps.`);

  // 3. Expand
  const days = safe('expand', () => expandDays(e, request.from, request.to));
  if (!Array.isArray(days)) return days;
  res.days = days;
  const unit = days[0].unit;
  const total = sumCounted(days);
  const hol = days.filter((d) => d.kind === 'holiday');
  if (total <= 0) return fail('expand', 'ZERO_DAYS', 'The range contains no working time on this employee\'s pattern.', [p0.counting.rule]);
  stage('expand', 'ok',
    `${fmt(total)} ${unit} counted (${p0.counting.mode})${hol.length ? `; holidays not charged: ${hol.map((h) => `${h.holidayName} ${h.date}`).join(', ')}` : ''}.`,
    [p0.counting.rule, ...new Map(years.map((y) => [packs[y].holidays.source.citation, packs[y].holidays.source])).values()]);

  // 4. Split
  for (const y of years) {
    const from = maxDate(request.from, `${y}-01-01`), to = minDate(request.to, `${y}-12-31`);
    const amount = sumCounted(days.filter((d) => d.date >= from && d.date <= to));
    if (amount > 0) res.parts.push({ leaveYear: y, amount, unit, from, to });
  }
  stage('split', 'ok', res.parts.map((x) => `${x.leaveYear}: ${fmt(x.amount)} ${unit}`).join(' · ') + (res.parts.length > 1 ? ' — each part is charged to its own leave year' : ''));

  // 5. Policy
  const warnings: string[] = [];
  const pRules: RuleRef[] = [];
  for (const part of res.parts) {
    for (const b of kindBuckets(part.leaveYear)) {
      const usable = addDays(e.hireDate, b.usableFromDays);
      if (b.usableFromDays > 0 && part.from < usable)
        return fail('policy', 'NOT_YET_USABLE', `${b.label} can be used from day ${b.usableFromDays} of employment (${usable}).`, [b.entitlement.rule]);
    }
    const ob = packs[part.leaveYear].buckets.find((b) => b.onDemandMax);
    if (request.kind === 'on-demand' && ob) {
      const used = inputs.requests.filter((r) => r.employeeId === e.id && r.kind === 'on-demand' && r.status === 'approved' && yearOf(r.from) === part.leaveYear && r.id !== request.id)
        .reduce((s, r) => s + sumCounted(expandDays(e, r.from, r.to)), 0);
      const rule = packs[part.leaveYear].extras.find((x) => x.ruleId === 'pl-on-demand')!;
      if (used + part.amount > ob.onDemandMax!) return fail('policy', 'ON_DEMAND_LIMIT', `Already ${used} of ${ob.onDemandMax} on-demand days used in ${part.leaveYear}.`, [rule]);
      pRules.push(rule);
    }
  }
  if (request.from < today) warnings.push('Retroactive request — dates are in the past');
  const decExtra = p0.extras.find((x) => x.ruleId === 'de-24-31-dec');
  if (decExtra && days.some((d) => d.kind === 'counted' && /-12-(24|31)$/.test(d.date))) {
    warnings.push('24/31 Dec charged as full working days — company-policy assumption, not law');
    pRules.push(decExtra);
  }
  stage('policy', warnings.length ? 'warn' : 'ok', warnings.length ? warnings.join('; ') + '.' : 'No local policy restrictions triggered.', pRules);

  // 6. Balance — replay the ledger with and without the request.
  const horizon = `${SUPPORTED_YEARS[SUPPORTED_YEARS.length - 1]}-12-31`;
  const others = inputs.requests.filter((r) => r.id !== request.id);
  const lastTo = [request.to, ...others.filter((r) => r.employeeId === e.id).map((r) => r.to)].sort().at(-1)!;
  const asOf = minDate(lastTo, minDate(horizon, e.terminationDate ?? horizon));
  const base = buildLedger(e, { ...inputs, requests: others }, request.to, { today });
  const withReq = { ...inputs, requests: [...others, { ...request, status: 'approved' as const }] };
  const cand = buildLedger(e, withReq, request.to, { today });
  const future = buildLedger(e, withReq, asOf, { today });
  const baseIssues = new Set(buildLedger(e, { ...inputs, requests: others }, asOf, { today }).issues.map((i) => i.message));
  const newShort = future.issues.filter((i) => i.code === 'NEGATIVE_BALANCE' && !baseIssues.has(i.message));
  for (const [b, bal] of Object.entries(base.balances)) res.balanceBefore[b] = bal.available;
  for (const [b, bal] of Object.entries(cand.balances)) { res.balanceAfter[b] = bal.available; res.bucketLabels[b] = bal.label; }
  res.preview = cand.events.filter((x) => x.requestId === request.id);
  const bRules = [...new Map(res.preview.map((x) => [x.rule.ruleId, x.rule])).values()];
  if (newShort.length) return fail('balance', 'INSUFFICIENT_BALANCE', `Not enough balance: ${newShort.map((i) => i.message).join('; ')}.`, kindBuckets(years[0]).map((b) => b.entitlement.rule));
  stage('balance', 'ok', Object.keys(res.balanceAfter).filter((b) => res.balanceBefore[b] !== res.balanceAfter[b])
    .map((b) => `${cand.balances[b].label}: ${fmt(res.balanceBefore[b])} → ${fmt(res.balanceAfter[b])} ${cand.balances[b].unit}`).join(' · ') + ' (at the end of the leave, including scheduled accruals).', bRules);

  // 7. Route
  res.approverId = e.managerId ?? 'hr-ops';
  stage('route', 'ok', `Sent to ${e.managerId ? `line manager (${e.managerId})` : 'HR operations (no manager on file)'} — same approval flow in every entity.`);

  // 8. Post
  stage('post', 'ok', `On approval, ${res.preview.filter((x) => x.type === 'DEBIT').length} ledger event(s) are posted, each stamped with pack version and citation.`);

  // 9. Export
  res.payroll = res.parts.map((part) => ({
    employeeId: e.id, entity: packs[part.leaveYear].entity, absenceCode: ABSENCE_CODE[request.kind], from: part.from, to: part.to,
    amount: part.amount, unit: part.unit, leaveYear: part.leaveYear, packVersion: packs[part.leaveYear].version,
  }));
  stage('export', 'ok', `${res.payroll.length} payroll line(s) in the common export format.`);
  res.ok = true;
  return res;
}

export function approveRequest(result: PipelineResult): LeaveRequest {
  if (!result.ok) throw new EngineError('NOT_APPROVABLE', 'Only a request that passed every stage can be approved.');
  return { ...result.request, status: 'approved' };
}
