// The unified request pipeline. Same nine stages for every entity; only the rule pack differs.
import {
  EngineError, isValidPattern, type DayLine, type Employee, type ISODate, type Inputs, type LeaveRequest, type LedgerEvent, type RuleRef, type Unit,
} from './model';
import { isValidISODate, maxDate, minDate, yearOf, addDays, formatDate } from './dates';
import { employeeById } from './dataset';
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
  const request: LeaveRequest = { ...draft, id: draft.id ?? `req-${e.id}-${draft.from}-${draft.to}-${draft.kind}-${inputs.requests.length + 1}`, status: 'pending' };
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
    const jp = safe('jurisdiction', () => getPack(packId, y0));
    if ('stages' in jp) return jp;
    stage('jurisdiction', 'ok', `${e.workLocation} → ${jp.entity} · rule pack ${packId}`, [jp.locationAssumption]);
  }
  if (!isValidPattern(e.pattern))
    return fail('validate', 'INVALID_PATTERN', 'The employee\'s working pattern is invalid: working days must be distinct weekdays and hours per day between 0 and 24.');

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
  // Only a pending request being re-processed may share an id with this one; an approved booking always clashes.
  const clash = inputs.requests.find((r) => r.employeeId === e.id && !(r.id === request.id && r.status === 'pending') && r.status !== 'rejected' && r.status !== 'withdrawn' && r.from <= request.to && r.to >= request.from);
  if (clash) return fail('validate', 'OVERLAP', `Overlaps the ${clash.status} request ${formatDate(clash.from)} to ${formatDate(clash.to)}.`);
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
        return fail('policy', 'NOT_YET_USABLE', `${b.label} can be used from ${b.usableFromDays} days after starting (${formatDate(usable)}).`, [b.entitlement.rule]);
    }
    const ob = packs[part.leaveYear].buckets.find((b) => b.onDemandMax);
    if (request.kind === 'on-demand' && ob) {
      // Count only the days that fall in this leave year, so a Dec→Jan request is split correctly.
      const used = inputs.requests.filter((r) => r.employeeId === e.id && r.kind === 'on-demand' && r.status === 'approved' && r.id !== request.id && r.from <= `${part.leaveYear}-12-31` && r.to >= `${part.leaveYear}-01-01`)
        .reduce((s, r) => s + expandDays(e, maxDate(r.from, `${part.leaveYear}-01-01`), minDate(r.to, `${part.leaveYear}-12-31`)).filter((d) => d.amount > 0).length, 0);
      const days = res.days.filter((d) => d.amount > 0 && d.date >= part.from && d.date <= part.to).length;
      const rule = packs[part.leaveYear].extras.find((x) => x.ruleId === 'pl-on-demand')!;
      if (used + days > ob.onDemandMax!) return fail('policy', 'ON_DEMAND_LIMIT', `You asked for ${days} on-demand ${days === 1 ? 'day' : 'days'}, but only ${Math.max(0, ob.onDemandMax! - used)} of ${ob.onDemandMax} remain in ${part.leaveYear}. Book the rest as ordinary leave.`, [rule]);
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
  const others = inputs.requests.filter((r) => !(r.id === request.id && r.status === 'pending'));
  const lastTo = [request.to, ...others.filter((r) => r.employeeId === e.id).map((r) => r.to)].sort().at(-1)!;
  // Replay to the end of the latest affected leave year so later scheduled debits (e.g. UK bank holidays) are seen.
  const asOf = minDate(`${yearOf(lastTo)}-12-31`, minDate(horizon, e.terminationDate ?? horizon));
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
  if (newShort.length) {
    // Report the real total: what is still missing once every grant up to the end of the last affected year has arrived.
    const baseFuture = buildLedger(e, { ...inputs, requests: others }, asOf, { today });
    const added = Object.entries(future.balances).filter(([, b]) => !b.unlimited)
      .map(([id, b]) => ({ b, gap: Math.min(0, b.available) - Math.min(0, baseFuture.balances[id]?.available ?? 0) })).filter((x) => x.gap < 0);
    const msg = added.length
      ? added.map(({ b, gap }) => `${fmt(-gap)} ${b.unit} short in ${b.label}`).join('; ') + ` (this request needs ${fmt(total)} ${unit})`
      : `${newShort[0].message}; later accruals arrive too late to cover it`;
    return fail('balance', 'INSUFFICIENT_BALANCE', `Not enough leave: ${msg}.`, kindBuckets(years[0]).map((b) => b.entitlement.rule));
  }
  stage('balance', 'ok', Object.keys(res.balanceAfter).filter((b) => res.balanceBefore[b] !== res.balanceAfter[b])
    .map((b) => cand.balances[b].unlimited
      ? `${cand.balances[b].label}: unlimited, ${fmt(cand.balances[b].usedByYear?.[yearOf(request.to)] ?? 0)} ${cand.balances[b].unit} used this year`
      : `${cand.balances[b].label}: ${fmt(res.balanceBefore[b])} → ${fmt(res.balanceAfter[b])} ${cand.balances[b].unit}`).join(' · ') + ' (at the end of the leave, including scheduled accruals).', bRules);

  // 7. Route
  res.approverId = e.managerId ?? 'hr-ops';
  const approverName = e.managerId ? employeeById(e.managerId)?.name ?? e.managerId : null;
  stage('route', 'ok', `Sent to ${approverName ? `${approverName}, line manager` : 'HR operations (no manager on file)'}. The same approval flow in every entity.`);

  // 8. Post
  const nDebit = res.preview.filter((x) => x.type === 'DEBIT').length;
  stage('post', 'ok', `On approval, ${nDebit} ledger ${nDebit === 1 ? 'event is' : 'events are'} posted, each stamped with its pack version and citation.`);

  // 9. Export
  res.payroll = res.parts.map((part) => ({
    employeeId: e.id, entity: packs[part.leaveYear].entity, absenceCode: ABSENCE_CODE[request.kind], from: part.from, to: part.to,
    amount: part.amount, unit: part.unit, leaveYear: part.leaveYear, packVersion: packs[part.leaveYear].version,
  }));
  stage('export', 'ok', `${res.payroll.length} payroll ${res.payroll.length === 1 ? 'line' : 'lines'} in the common export format.`);
  res.ok = true;
  return res;
}

export function approveRequest(result: PipelineResult): LeaveRequest {
  if (!result.ok) throw new EngineError('NOT_APPROVABLE', 'Only a request that passed every stage can be approved.');
  return { ...result.request, status: 'approved' };
}
