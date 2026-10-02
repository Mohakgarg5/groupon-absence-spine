// Chicago allows unlimited PTO; on separation the employer still owes 40h minus Paid Leave used in the year.
import { buildLedger } from '../src/ledger';
import { submitRequest } from '../src/pipeline';
import { getPack, setPackOverride, validatePack } from '../src/packs/registry';
import type { Inputs, LeaveRequest } from '../src/model';
import { emp, emptyInputs } from './fixtures';

const TODAY = '2026-10-02';
const req = (id: string, employeeId: string, from: string, to: string): LeaveRequest => ({ id, employeeId, from, to, kind: 'annual', status: 'approved', submittedOn: TODAY });

function withUnlimited(fn: () => void) {
  for (const y of [2026, 2027]) {
    const p = structuredClone(getPack('US-CHI', y));
    p.buckets[0].accrual.strategy = 'unlimited-with-floor';
    expect(validatePack(p)).toEqual([]);
    setPackOverride(p);
  }
  try { fn(); } finally { for (const y of [2026, 2027]) setPackOverride(null, 'US-CHI', y); }
}

test('unlimited PTO: three weeks off is approved and never goes negative', () => withUnlimited(() => {
  const ana = emp({ id: 'ana', packId: 'US-CHI', workLocation: 'Chicago, IL' });
  const r = submitRequest(ana, { employeeId: 'ana', from: '2026-10-05', to: '2026-10-23', kind: 'annual', submittedOn: TODAY }, emptyInputs(), TODAY);
  expect(r.ok).toBe(true);
  const l = buildLedger(ana, { ...emptyInputs(), requests: [{ ...r.request, status: 'approved' }] }, '2026-12-31');
  expect(l.issues).toEqual([]);
  expect(l.balances['paid-leave'].unlimited).toBe(true);
}));

test('unlimited PTO: leaver is paid 40h minus Paid Leave used that year', () => withUnlimited(() => {
  const lv = emp({ id: 'lv', packId: 'US-CHI', workLocation: 'Chicago, IL', terminationDate: '2026-11-30' });
  const inputs: Inputs = { ...emptyInputs(), requests: [req('a', 'lv', '2026-06-01', '2026-06-03')] }; // 24h used
  const pay = buildLedger(lv, inputs, '2026-12-31').events.find((x) => x.type === 'PAYOUT' && x.bucket === 'paid-leave')!;
  expect(pay.explanation).toMatch(/16 hours/);
  expect(pay.rule.ruleId).toBe('chi-unlimited-payout');
  const heavy = buildLedger(lv, { ...emptyInputs(), requests: [req('b', 'lv', '2026-06-01', '2026-06-12')] }, '2026-12-31');
  expect(heavy.events.find((x) => x.type === 'PAYOUT' && x.bucket === 'paid-leave')!.explanation).toMatch(/0 hours/);
}));

test('unlimited PTO: the sick bank stays a separate, capped, non-payable bank', () => withUnlimited(() => {
  const ana = emp({ id: 'ana2', packId: 'US-CHI', workLocation: 'Chicago, IL' });
  expect(buildLedger(ana, emptyInputs(), '2026-12-31').balances['paid-sick'].available).toBe(40);
}));

test('validator refuses unlimited PTO on the sick bank (sick hours are never payable)', () => {
  const p = structuredClone(getPack('US-CHI', 2026));
  p.buckets[1].accrual.strategy = 'unlimited-with-floor';
  expect(validatePack(p).some((x) => /only to an hours-based annual/.test(x))).toBe(true);
});
