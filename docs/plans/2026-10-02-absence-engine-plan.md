# Absence Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A runnable TypeScript repo that processes leave requests and accruals end to end through a unified spine (ledger, pipeline, trace, payroll export) driven by cited, versioned, per-entity rule packs. It includes a React UI and a CLI demo, and the docs make the case.

**Architecture:** `packages/engine` is a pure, deterministic TS library: calendar, packs, strategies, ledger, pipeline, stress test and diff. `apps/web` (Vite + React) and `cli/demo.ts` both import it directly; there is no backend. Rule packs are JSON. Every ledger event carries its rule citation.

**Tech Stack:** Node ≥ 20, TypeScript 5, Vitest, Vite 5, React 18, tsx (CLI). No other runtime dependencies.

**Spec:** `docs/specs/2026-10-02-absence-management-design.md`

## Global Constraints

- One-command start: `npm install && npm run dev`. Also `npm test`, `npm run demo`, `npm run build`.
- No network, database or API keys at runtime.
- Dates are ISO `YYYY-MM-DD` strings, computed in UTC. Never use local-timezone `Date` math.
- Every ledger event must carry `rule: RuleRef` with a non-empty `citation` and a `verification` of `public-verified | public-unverified | assumption`. No `internal-verified` exists until Groupon confirms.
- Leave year = calendar year for all packs. The validator rejects anything else.
- A request touching a year with no loaded holiday calendar must fail loudly with `CALENDAR_NOT_LOADED`.
- All employee data is fictional.
- Copy tone: plain, honest, no hype. Uncertain items show a badge, never silent defaults.

## Review Focus

1. **Requests with start > end, zero working days, or overlaps with an existing request** → clear rejection reason, no ledger change. Test in Task 5.
2. **Part-time patterns** (e.g. Mon/Wed/Thu): entitlement scales and bank holidays on non-working days are ignored or credited per pack. Tests in Tasks 3–4.
3. **Requests spanning 31 Dec** → split per leave year, each part checked against that year's balance and holiday calendar. Test in Task 5.
4. **A year with no holiday calendar** (ES-MD 2027) → `CALENDAR_NOT_LOADED`, not a silent zero-holiday result. Test in Task 2.
5. **Leavers** → pro-rata entitlement and payout per pack; no payout for buckets where it is forbidden (Chicago sick). Test in Task 4.

---

## File map

```
package.json                     workspaces root; scripts: dev, build, test, demo, typecheck
tsconfig.base.json
packages/engine/
  package.json, tsconfig.json, vitest.config.ts
  src/index.ts                   public exports
  src/dates.ts                   ISO date utils (UTC): addDays, daysBetween, eachDay, dow, monthsBetweenFull, yearOf
  src/model.ts                   all types (below)
  src/packs/registry.ts          loadPacks(), getPack(packId, year), validatePack()
  src/packs/*.json               DE-BE.2026, DE-BE.2027, PL.2026, PL.2027, IE.2026, IE.2027, UK.2026, UK.2027, ES-MD.2026, ES-MD.2027 (calendar missing), US-CHI.2026, US-CHI.2027
  src/calendar.ts                expandDays(employee, pack, from, to) → DayLine[]
  src/strategies/entitlement.ts  annualEntitlement(employee, pack, bucket, year) → {amount, explanation, rule}
  src/strategies/seniority.ts    plSeniorityYears(employee, onDate) (hook)
  src/ledger.ts                  buildLedger(employee, inputs, asOf) → Ledger {events, lots, balances}
  src/pipeline.ts                submitRequest(), approveRequest()
  src/jurisdiction.ts            resolvePackId(employee) (hook: US work location)
  src/stressTest.ts              runStressTest(employees, globalPolicy) → StressResult
  src/diff.ts                    diffPacks(a, b, employees, inputs) → PackDiff (+ HR tasks)
  test/*.test.ts
apps/web/                        Vite React app (Tasks 7–9)
cli/demo.ts                      terminal walkthrough (Task 6)
data/employees.json              30 fictional employees
data/scenario.json               seeded requests, sickness records, expiry notices
README.md, DECISION.md, CHANGE-AND-CULTURE-PLAN.md, ASSUMPTIONS-AND-VERIFICATION.md
```

## Core types (`src/model.ts`) — referenced by every task

```ts
export type ISODate = string;
export type Verification = 'public-verified' | 'public-unverified' | 'assumption';
export type Unit = 'days' | 'hours';
export interface RuleRef { packId: string; packVersion: string; ruleId: string; citation: string; url?: string; verification: Verification; note?: string; }
export interface WorkPattern { days: number[]; hoursPerDay: number } // 0=Sun..6=Sat
export type Education = 'none'|'basic-vocational'|'secondary-vocational'|'general-secondary'|'post-secondary'|'higher';
export interface Employee {
  id: string; name: string; title: string; packId: string; workLocation: string;
  hireDate: ISODate; terminationDate?: ISODate; pattern: WorkPattern; managerId?: string;
  openingBalances?: Record<string, number>;   // bucketId → migrated carry-over from legacy, as of 2026-01-01
  pl?: { priorServiceYears: number; education: Education; firstJob: boolean };
  de?: { severeDisability?: boolean };
  persona?: string;                           // one-line "why this person is in the dataset"
}
export type RequestKind = 'annual' | 'on-demand' | 'sick-bank';
export interface LeaveRequest { id: string; employeeId: string; from: ISODate; to: ISODate; kind: RequestKind; status: 'pending'|'approved'|'rejected'; submittedOn: ISODate; note?: string }
export interface SicknessRecord { id: string; employeeId: string; from: ISODate; to: ISODate; certified: boolean; employeeAskedToReschedule?: boolean }
export interface ExpiryNotice { employeeId: string; leaveYear: number; sentOn: ISODate } // DE duty to inform
export interface Inputs { requests: LeaveRequest[]; sickness: SicknessRecord[]; notices: ExpiryNotice[] }
export type EventType = 'OPENING'|'GRANT'|'ACCRUE'|'DEBIT'|'RESTORE'|'CARRY_OVER'|'EXPIRE'|'EXPIRY_BLOCKED'|'PAYOUT'|'ADJUST';
export interface LedgerEvent { id: string; date: ISODate; employeeId: string; bucket: string; type: EventType; amount: number; unit: Unit; leaveYear: number; rule: RuleRef; explanation: string; requestId?: string; projected?: boolean }
export interface DayLine { date: ISODate; kind: 'counted'|'weekend'|'non-working'|'holiday'; holidayName?: string; amount: number; unit: Unit; rule?: RuleRef }
```

Pack JSON shape (validated by `validatePack`):

```jsonc
{
  "id": "DE-BE", "version": "2027.1", "year": 2027, "entity": "Groupon GmbH", "country": "DE", "region": "Berlin",
  "owner": { "role": "Employment counsel DE + HR Business Partner DE", "signOff": { "status": "pending", "by": null, "on": null } },
  "leaveYear": { "startMonth": 1, "startDay": 1 },
  "counting": { "mode": "working-days" | "calendar-days" | "working-hours", "rule": RuleRefLite },
  "holidays": { "loaded": true, "source": RuleRefLite, "dates": [{ "date": "2027-01-01", "name": "Neujahr" }] },
  "holidayPolicy": { "onNonWorkingDay": "nothing" | "extra-leave" | "designate-day-off-task", "deductFromEntitlement": false, "rule": RuleRefLite },
  "buckets": [{
    "id": "annual", "label": "...", "unit": "days",
    "entitlement": { "strategy": "werktage"|"weeks"|"calendar-days"|"pl-seniority"|"per-hours-worked", "params": {}, "rule": RuleRefLite },
    "accrual": { "strategy": "de-waiting-period"|"front-load-prorata"|"monthly"|"pl-proportional"|"uk-first-year-monthly"|"hours-worked", "params": {}, "rule": RuleRefLite },
    "usableFromDays": 0, "requestKinds": ["annual"],
    "carryOver": { "max": null, "expiresMonthDay": "03-31", "conditionalOnNotice": true, "rule": RuleRefLite },
    "sickDuringLeave": { "mode": "restore-if-certified"|"restore-on-request"|"restore"|"convert-to-sick-bank", "rule": RuleRefLite },
    "payoutOnTermination": { "mode": "remaining"|"none", "rule": RuleRefLite }
  }],
  "extras": [{ "id": "...", "label": "...", "rule": RuleRefLite }]   // rules surfaced in UI only (e.g. PL on-demand 4 days)
}
```

`RuleRefLite = { ruleId, citation, url?, verification, note? }`. The registry inflates it to `RuleRef` by adding the packId and version.

---

### Task 1: Scaffold + dates + model

**Files:** root `package.json`, `tsconfig.base.json`, `packages/engine/{package.json,tsconfig.json,vitest.config.ts}`, `src/dates.ts`, `src/model.ts`, `test/dates.test.ts`

- [ ] Root `package.json`: `"workspaces": ["packages/*","apps/*"]`; scripts `dev: npm -w apps/web run dev`, `build: npm -w packages/engine run typecheck && npm -w apps/web run build`, `test: npm -w packages/engine test`, `demo: tsx cli/demo.ts`; devDeps `typescript`, `tsx`.
- [ ] Write the failing tests:

```ts
import { addDays, eachDay, dow, daysBetween, fullMonthsBetween, easterSunday } from '../src/dates';
test('addDays crosses year', () => expect(addDays('2026-12-31', 1)).toBe('2027-01-01'));
test('eachDay inclusive', () => expect(eachDay('2026-12-30','2027-01-02')).toEqual(['2026-12-30','2026-12-31','2027-01-01','2027-01-02']));
test('dow', () => { expect(dow('2026-12-26')).toBe(6); expect(dow('2027-02-01')).toBe(1); });
test('daysBetween', () => expect(daysBetween('2026-01-01','2026-12-31')).toBe(364));
test('full months', () => { expect(fullMonthsBetween('2026-09-01','2026-12-31')).toBe(4); expect(fullMonthsBetween('2026-09-15','2026-12-31')).toBe(3); });
test('easter', () => { expect(easterSunday(2026)).toBe('2026-04-05'); expect(easterSunday(2027)).toBe('2027-03-28'); });
```

- [ ] Run `npm test` and confirm FAIL. Implement `dates.ts` with UTC-only math (`Date.UTC`). `fullMonthsBetween(from, to)` counts completed calendar-aligned months from `from` up to and including `to`. `easterSunday` uses the anonymous Gregorian computus and is used only by tests to cross-check pack dates.
- [ ] PASS, then commit `feat(engine): scaffold, date utils, model types`.

### Task 2: Rule packs + registry + calendar expansion

**Files:** `src/packs/*.json` (12 files), `src/packs/registry.ts`, `src/calendar.ts`, `test/packs.test.ts`, `test/calendar.test.ts`

**Interfaces produced:** `getPack(packId: string, year: number): Pack` (throws `PACK_NOT_FOUND`); `allPacks(): Pack[]`; `validatePack(p): string[]`; `expandDays(e: Employee, from, to): DayLine[]` (throws `CALENDAR_NOT_LOADED` with packId and year).

Pack content (verbatim facts; citations from `docs/research/`):

- **DE-BE.** Unit days, counting working-days.
  - Entitlement `werktage {werktage:24}` → 24 × patternDays/6 (BUrlG §3, public-unverified).
  - Accrual `de-waiting-period {waitingMonths:6}` (BUrlG §§4–5).
  - Severe disability +5 × patternDays/5 (SGB IX §208).
  - Carry `{max:null, expiresMonthDay:'03-31', conditionalOnNotice:true}` (BUrlG §7(3); CJEU C-684/16).
  - Sick `restore-if-certified` (BUrlG §9). Payout `remaining` (BUrlG §7(4)).
  - Holidays 2026: 01-01 Neujahr, 03-08 Frauentag, 04-03 Karfreitag, 04-06 Ostermontag, 05-01, 05-14 Christi Himmelfahrt, 05-25 Pfingstmontag, 10-03, 12-25, 12-26. 2027: 01-01, 03-08, 03-26, 03-29, 05-01, 05-06, 05-17, 10-03, 12-25, 12-26 (Berliner Feiertagsgesetz).
  - Extras: rule `de-24-31-dec`, assumption "24 & 31 Dec treated as ordinary working days; verify Groupon GmbH policy".
- **PL.** Days.
  - Entitlement `pl-seniority {under:20, over:26, thresholdYears:10}` (KP art. 154–155).
  - Accrual `pl-proportional` (KP art. 153, 155¹, 155²).
  - Carry `{max:null, expiresMonthDay:'09-30', conditionalOnNotice:false}` (art. 168).
  - Sick `restore` (art. 165 postponement). Payout `remaining` (art. 171).
  - Request kinds `annual`, `on-demand` (max 4/yr, art. 167²).
  - Holidays 2026: 01-01, 01-06, 04-05, 04-06, 05-01, 05-03, 05-24, 06-04, 08-15, 11-01, 11-11, 12-24, 12-25, 12-26. 2027: 01-01, 01-06, 03-28, 03-29, 05-01, 05-03, 05-16, 05-27, 08-15, 11-01, 11-11, 12-24, 12-25, 12-26.
  - holidayPolicy `designate-day-off-task` for Saturday holidays (art. 130 §2).
- **IE.** Days.
  - Entitlement `weeks {weeks:4}` (OWTA s.19). Accrual `monthly` (s.19, 1/3 working week per month).
  - Carry `{max:5, expiresMonthDay:'06-30'}` (s.20; max 5 is an assumption).
  - Sick `restore-on-request` (WLB Act 2023, public-unverified). Payout `remaining` (s.23).
  - holidayPolicy `extra-leave` for holidays on non-working days. Remedy choice is an assumption; eligibility requires 40 h in the prior 5 weeks (OWTA s.21).
  - Holidays 2026: 01-01, 02-02, 03-17, 04-06, 05-04, 06-01, 08-03, 10-26, 12-25, 12-26. 2027: 01-01, 02-01, 03-17, 03-29, 05-03, 06-07, 08-02, 10-25, 12-25, 12-26.
- **UK** (England).
  - Two buckets: `statutory-4wk` (weeks 4, reg.13, carry max 0) and `additional-1.6wk` (weeks 1.6, reg.13A, capped so the total is ≤ 28, carry max 5 expiring 12-31, an assumption).
  - holidayPolicy `deductFromEntitlement:true` (assumption: bank holidays count toward 5.6 weeks; they are auto-debited from `additional-1.6wk` first).
  - Accrual `uk-first-year-monthly` (reg.15A; front-load after year 1, an assumption). Sick `restore-on-request`. Payout `remaining` (reg.14).
  - Bank holidays 2026: 01-01, 04-03, 04-06, 05-04, 05-25, 08-31, 12-25, 12-28. 2027: 01-01, 03-26, 03-29, 05-03, 05-31, 08-30, 12-27, 12-28.
- **ES-MD.** Unit days, counting calendar-days (ET art. 38.1).
  - Entitlement `calendar-days {days:30}`. Accrual `front-load-prorata`. Carry `{max:0}` (art. 38.3).
  - Sick `restore` (art. 38.3, public-unverified). Payout `remaining`.
  - 2026 holidays (public-verified, Decreto 75/2025 BOCM 25-09-2025 + Madrid city locals): 01-01, 01-06, 04-02, 04-03, 05-01, 05-02, 05-15, 08-15, 10-12, 11-02, 11-09, 12-07, 12-08, 12-25.
  - **2027: `loaded:false`, note "BOCM decree not yet published as of 2026-10-02".**
  - Extra: assumption "Groupon Spain may account in 22 working days via convenio — verify".
- **US-CHI.** Unit hours, counting working-hours.
  - Bucket `paid-leave`: `per-hours-worked {per:35, capPerYear:40}`, usableFromDays 90, carry `{max:16, expiresMonthDay:null}`, payout `remaining` (employer >100 covered employees).
  - Bucket `paid-sick`: same accrual, usableFromDays 30, carry max 80, payout `none`, requestKinds `['sick-bank']`. Sick during leave `convert-to-sick-bank` on `paid-leave`.
  - Holidays: Groupon US company holiday calendar (assumption), with observed dates computed for 2026/2027: New Year, MLK, Memorial, Juneteenth, Independence (observed), Labor, Thanksgiving + Friday, Christmas (observed).
  - Rule `us-jurisdiction`: Chicago Ord. 6-130 applies by physical work location; IL PLAWA 820 ILCS 192 exempts Chicago-covered employers.

- [ ] Tests (failing first):

```ts
test('all packs validate', () => allPacks().forEach(p => expect(validatePack(p)).toEqual([])));
test('every rule has citation+verification', () => allPacks().forEach(p => walkRules(p).forEach(r => { expect(r.citation).toBeTruthy(); expect(['public-verified','public-unverified','assumption']).toContain(r.verification); })));
test('Easter-derived holidays match computus', () => { /* DE-BE 2026 Karfreitag = easter-2, Ostermontag = easter+1, Himmelfahrt = +39, Pfingstmontag = +50; same 2027; PL Corpus Christi = +60 */ });
test('DE expansion skips weekend and Berlin holidays', () => {
  const lines = expandDays(de5day, '2026-12-21', '2027-01-08');
  expect(lines.filter(l => l.kind==='counted').length).toBe(13); // 21-24 + 28-31 Dec (8) + 4-8 Jan (5)
});
```

  Expected count: Dec 21–24 = 4, Dec 28–31 = 4, Jan 4–8 = 5. That is 13 counted, with 25 Dec and 1 Jan as holiday lines. Assert **13**, and assert that 25-12 and 01-01 are `holiday`.

```ts
test('part-time pattern marks non-working days', () => { /* Mon/Wed/Thu employee: Tue → 'non-working' */ });
test('ES 2027 throws CALENDAR_NOT_LOADED', () => expect(() => expandDays(esEmp,'2027-01-04','2027-01-05')).toThrow(/CALENDAR_NOT_LOADED/));
test('ES counts calendar days incl. weekend', () => expect(sumCounted(expandDays(esEmp,'2026-07-06','2026-07-12'))).toBe(7));
test('US-CHI counts hours, skips company holiday', () => { /* 2026-07-03 observed Independence Day → holiday; Mon–Thu 8h = 32h for 2026-06-29..07-03 */ });
test('getPack unknown year throws PACK_NOT_FOUND', ...);
```

- [ ] Implement, PASS, commit `feat(engine): cited rule packs, registry, calendar expansion`.

### Task 3: Entitlement & seniority strategies

**Files:** `src/strategies/entitlement.ts`, `src/strategies/seniority.ts`, `test/entitlement.test.ts`

**Produces:** `annualEntitlement(e, pack, bucketId, year): { amount: number; explanation: string; rule: RuleRef; extras?: {amount, explanation, rule}[] }` (full-year amount before proration); `plSeniorityYears(e, onDate): { years: number; breakdown: string }`; `plThresholdCrossingDate(e, year): ISODate | null`.

- [ ] Tests:

```ts
test('DE 5-day = 20, 3-day = 12, 6-day = 24', ...);
test('DE severe disability adds 5 (5-day)', () => expect(total(annualEntitlement(deDisabled,...))).toBe(25));
test('UK 5-day: 20 + 8 = 28; 6-day capped: 24 + 4 = 28; 3-day: 12 + 4.8', ...);
test('IE 5-day 20, 4-day 16', ...);
test('ES 30 calendar days', ...);
test('PL graduate with 3y prior work = 8+3 = 11y → 26', ...);
test('PL general-secondary (4y) + 2y = 6y → 20', ...);
test('PL crossing threshold mid-2027 returns date', ...);
test('PL part-time 0.5 FTE of 26 = 13 days', ...);
```

  PL rule: education years = {basic-vocational 3, secondary-vocational 5, general-secondary 4, post-secondary 6, higher 8, none 0}. Seniority = priorServiceYears + educationYears + tenure at Groupon. Simplification: overlapping study and work periods aren't de-duplicated; noted in the pack. Part-time = `ceil(entitlement × FTE)` where FTE = weekly hours / 40 (art. 154 §2).

- [ ] Implement, PASS, commit.

### Task 4: Ledger (accrual, lots, carry/expiry, sickness, payout)

**Files:** `src/ledger.ts`, `test/ledger.test.ts`

**Produces:** `buildLedger(e: Employee, inputs: Inputs, asOf: ISODate): Ledger` where

```ts
interface Lot { id: string; bucket: string; leaveYear: number; remaining: number; expiresOn: ISODate | null; sourceEventId: string }
interface Ledger { employee: Employee; events: LedgerEvent[]; balances: Record<string, { available: number; unit: Unit; byYear: Record<number, number> }>; tasks: HrTask[] }
interface HrTask { date: ISODate; title: string; rule: RuleRef }
```

Algorithm. Replay from 2026-01-01 to `asOf` in date order. Within a day, the order is OPENING/GRANT/ACCRUE → DEBIT → RESTORE → year-end → expiry.

1. `OPENING` from `openingBalances`, as a lot of leaveYear 2025 with expiry per the 2026 pack carry rule. Explanation: "Migrated from legacy system — reconcile before go-live".
2. Grants and accruals per strategy:
   - `de-waiting-period`: if 6 months are complete by Jan 1, or in the hire year by its 6-month date → full GRANT at max(Jan 1, waiting date). If the waiting period doesn't complete within the year → ACCRUE 1/12 at each full-month end, and at year end ADJUST rounding where the fraction is ≥ .5 (§5(2)). Leaver in the first half → GRANT at 1/12 × full months (§5(1)c).
   - `front-load-prorata`: GRANT at max(Jan 1, hire) = full × days employed in year / days in year, rounded to 0.5.
   - `monthly`: ACCRUE full/12 at each month end while employed.
   - `pl-proportional`: firstJob in the hire year → ACCRUE 1/12 at each month end. Otherwise GRANT at max(Jan 1, hire) = ceil(full × monthsEmployedInYear / 12), counting started months. Crossing the threshold in the year → GRANT +6 × FTE (rounded up) on the crossing date, citing art. 154.
   - `uk-first-year-monthly`: first leave year → ACCRUE 1/12 per month (reg.15A). Otherwise GRANT full at Jan 1. Leaver → ADJUST to the reg.14 formula at termination.
   - `hours-worked`: at each month end, ACCRUE (counted working hours in month) / 35, capped at 40 per year per bucket, `projected: true` for dates after the scenario "today". Explanation includes hours.
3. UK `deductFromEntitlement`: at the GRANT date, DEBIT each bank holiday that falls on a pattern day (from `additional-1.6wk` first, then `statutory-4wk`), with explanation "Bank holiday counted toward 5.6 weeks".
4. IE `extra-leave`: for each public holiday on a non-pattern day where hoursPerWeek × 5 ≥ 40 → GRANT daysPerWeek/5 days on that date (OWTA s.21).
5. PL `designate-day-off-task`: a Saturday holiday → HrTask "Designate replacement day off".
6. Approved requests → DEBIT per leave-year part, at the part's first date, consuming lots in earliest-expiry-first order.
7. Sickness overlapping approved leave → RESTORE of the overlapping counted amount when the mode allows:
   - `restore-if-certified` requires `certified`. Otherwise RESTORE is skipped and an `ADJUST` of 0 is posted with explanation "Not restored: no medical certificate (BUrlG §9)", so the decision is visible.
   - `restore-on-request` requires `employeeAskedToReschedule`.
   - `convert-to-sick-bank` → RESTORE paid-leave and DEBIT paid-sick (skipped if usableFrom isn't met or the balance is short).
8. Year end (Dec 31): for each lot of leaveYear Y with remaining > 0 → carry up to `max` (CARRY_OVER, amount 0, explanatory), EXPIRE the excess. Carried lots get `expiresOn = (Y+1)-MM-DD`, or null.
9. On the expiry date: if `conditionalOnNotice` and there's no `ExpiryNotice` for (employee, Y) dated before the expiry → `EXPIRY_BLOCKED` (amount 0) and the lot keeps no expiry. Otherwise EXPIRE the remaining.
10. Termination: PAYOUT the remaining of each bucket with payout `remaining`. For `none` → ADJUST to zero with explanation "Forfeited: not payable (Ord. 6-130)".

- [ ] Tests (each asserts the events *and* the balance):

```ts
test('DE full-timer: GRANT 20 on 2026-01-01 citing BUrlG §3', ...);
test('DE joiner 2026-09-01: 4 × 20/12 = 6.67 → rounding ADJUST to 7 (§5(2))', ...);
test('DE leaver 2026-05-31 (first half): 5/12 × 20 = 8.33 → 8.33 (no round-up <.5)', ...);
test('DE carry-over expires 31 Mar only with notice; EXPIRY_BLOCKED without', ...);
test('DE sick certified during leave → RESTORE 2; uncertified → no restore + explanation', ...);
test('UK bank holidays auto-debited; part-timer not working Mondays debited fewer', ...);
test('IE St Stephen\'s Day 2026 (Sat) → extra 1 day for Mon–Fri employee', ...);
test('PL Saturday holiday 2026-08-15 → HrTask', ...);
test('PL threshold crossing grants +6', ...);
test('US-CHI accrues hours monthly capped 40; sick usable day 30, leave day 90', ...);
test('US-CHI termination: paid-leave PAYOUT, paid-sick forfeited', ...);
test('invariant: balance == sum(events) per bucket; every event has citation', ...);
```

- [ ] Implement, PASS, commit.

### Task 5: Request pipeline with trace

**Files:** `src/pipeline.ts`, `src/jurisdiction.ts`, `test/pipeline.test.ts`

**Produces:**

```ts
type StageId = 'jurisdiction'|'validate'|'expand'|'split'|'policy'|'balance'|'route'|'post'|'export';
interface Stage { id: StageId; label: string; status: 'ok'|'warn'|'fail'; detail: string; rules: RuleRef[] }
interface PayrollLine { employeeId: string; entity: string; absenceCode: string; from: ISODate; to: ISODate; amount: number; unit: Unit; leaveYear: number; packVersion: string }
interface PipelineResult { ok: boolean; request: LeaveRequest; stages: Stage[]; days: DayLine[]; parts: { leaveYear: number; amount: number; unit: Unit; bucket: string }[]; balanceBefore: Record<string, number>; balanceAfter: Record<string, number>; approverId?: string; payroll: PayrollLine[]; error?: { code: string; message: string } }
submitRequest(e: Employee, req: Omit<LeaveRequest,'status'|'id'> & {id?: string}, inputs: Inputs, today: ISODate): PipelineResult // status 'pending' when ok
approveRequest(result: PipelineResult): LeaveRequest // status 'approved'
resolvePackId(e: Employee): string // 'US-IL' location without Chicago → throws NO_PACK_FOR_LOCATION ("Illinois PLAWA pack not built")
```

Error codes: `INVALID_RANGE`, `ZERO_DAYS`, `OVERLAP`, `NOT_EMPLOYED`, `NOT_YET_USABLE`, `INSUFFICIENT_BALANCE`, `KIND_NOT_ALLOWED`, `ON_DEMAND_LIMIT`, `CALENDAR_NOT_LOADED`, `NO_PACK_FOR_LOCATION`. Every failure still returns the stages up to the failing one, so the UI can show where and why.

The balance check runs `buildLedger` with the candidate request as approved, on asOf = the request end. It fails if any DEBIT can't be covered.

- [ ] Tests:

```ts
test('DE pilot 2026-12-21..2027-01-08 → parts 2026:8, 2027:5; payroll 2 lines', ...);
test('start > end → INVALID_RANGE', ...); test('weekend only → ZERO_DAYS', ...); test('overlap → OVERLAP', ...);
test('US-CHI day 45 annual → NOT_YET_USABLE; sick-bank → ok', ...);
test('PL 5th on-demand day → ON_DEMAND_LIMIT', ...);
test('ES 2027 → CALENDAR_NOT_LOADED at expand stage', ...);
test('insufficient balance → INSUFFICIENT_BALANCE with shortfall', ...);
test('Springfield, IL employee → NO_PACK_FOR_LOCATION', ...);
```

- [ ] Implement, PASS, commit.

### Task 6: Stress test, pack diff, dataset, CLI demo

**Files:** `src/stressTest.ts`, `src/diff.ts`, `data/employees.json`, `data/scenario.json`, `cli/demo.ts`, `test/stress.test.ts`, `test/diff.test.ts`

**Global policy** (`NAIVE_GLOBAL`): 25 working days front-loaded on Jan 1 regardless of pattern; +1 day per 5 years of Groupon tenure; unused leave lost 31 Dec; sick days during leave stay consumed; single bucket; unused leave paid out on termination; 24/31 Dec ignored.

`runStressTest(employees, inputs) → { rows: StressRow[]; summary: { breaches: number; overspendDays: number; employeesAffected: number; byEntity: Record<string, {breaches:number; overspend:number}> } }`. Here `StressRow = { employeeId, dimension: 'entitlement'|'carry-over'|'sick-during-leave'|'seniority'|'structure', global: string, local: string, verdict: 'breach'|'overspend'|'ok', rule?: RuleRef }`. Each dimension uses real engine functions on a probe scenario:

- Entitlement: flat global 25 days (not pro-rated) vs local entitlement converted to days. Hours divide by hoursPerDay; ES calendar days × 5/7.
- Carry-over probe: 5 days unused on 31 Dec with no notice sent.
- Sickness probe: 2 certified days inside a 5-day leave.
- Seniority: local vs global years basis.
- Structure: US-CHI needs two banks with different usable-from and payout rules.

`diffPacks(packA, packB) → { holidaysAdded, holidaysRemoved, ruleChanges: {ruleId, field, from, to}[], blocked: boolean, reason?: string }` and `annualUpdateImpact(packId, fromYear, toYear, employees, inputs) → { diff, seniorityCrossings: {employeeId, date, from, to}[], tasks: HrTask[], affectedRequests: {requestId, before, after}[] }`.

Dataset: 30 employees with personas covering every scenario:

- DE: Lena (pilot), the 3-day part-timer, the Sep joiner, the May leaver, a severe-disability case, and one each notified / not notified for carry-over.
- PL: the graduate, the threshold-crosser in 2027, a first-job hire, a part-timer.
- IE: a full-timer and a Tue–Sat retail-ops worker affected by the Saturday holiday.
- UK: a full-timer and a Tue–Thu part-timer.
- ES: one each.
- US-CHI: a new hire at day 45 and a leaver.
- One Springfield, IL remote employee.

Scenario "today" = 2026-10-02.

- [ ] Tests: stress summary has breaches > 0 in DE, PL, US-CHI, and overspend > 0 for the DE part-timer. diffPacks DE 2026→2027 lists dates. ES 2026→2027 is `blocked:true`.
- [ ] `cli/demo.ts` prints, with ANSI colour, no deps:
  1. the DE pilot pipeline stages;
  2. the receipt (ledger lines with citations);
  3. the sickness restore;
  4. the carry-over notice vs no notice;
  5. the PL graduate;
  6. US-CHI;
  7. the stress summary table;
  8. the annual update.
- [ ] `npm run demo` runs cleanly. Commit.

### Task 7: Web app shell + design system

**Files:** `apps/web/{package.json,vite.config.ts,index.html,tsconfig.json}`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/state.ts` (React context: employees, inputs, today, persistence to localStorage with try/catch, reset), `src/components/{Receipt,CitationCard,Badge,StageRail,EntityChip}.tsx`

- Aesthetic: "statute ledger". Warm paper background, ink-black type, receipt-paper cards with perforated edges, a monospace numeric column, and one signal colour per verdict (ink-green ok, vermilion breach, amber assumption). Typography: a serif display (Fraunces) + Inter + JetBrains Mono via Google Fonts with system fallbacks. Light and dark themes. Responsive at 400px, keyboard focus visible, reduced-motion respected.
- Nav: Request Desk · Ledger · Force-Unify · Rule Packs · Annual Update · The Case.
- [ ] `npm run dev` renders the shell with no console errors. Commit.

### Task 8: Request Desk + Ledger views

- Request Desk:
  - Left: employee picker grouped by entity with persona.
  - Centre: month calendar painted with the entity's holidays, weekends and non-working days; drag or click to select a range; kind selector where the pack allows.
  - Submit animates the StageRail through the 9 stages, each expandable with its rules.
  - Right: the live Receipt (balance before → parts → after) and payroll line.
  - Approve-as-manager posts the request to state. Reject paths display the failing stage in red with the reason.
  - A "Report sick during this leave" action adds a SicknessRecord (certified toggle).
- Ledger: per-employee event timeline grouped by leave year, with verification badges and a CitationCard drawer (rule id, citation, URL, verification, owner, note). Balance tiles per bucket in the native unit. Includes the HR task list and an "expiry notice sent" toggle for DE.
- [ ] Playwright smoke: pick Lena → select 21 Dec–8 Jan → stages all ok → approve → ledger shows DEBIT 8 and 5. Commit.

### Task 9: Force-Unify, Rule Packs, Annual Update, The Case

- Force-Unify:
  - A hero counter: breaches, employees affected, overspend days.
  - A matrix of entities × dimensions as cells coloured by worst verdict; clicking a cell lists employee rows with global vs local and the statute.
  - A toggle "apply naive global policy" re-renders a sample employee's receipt under both, side by side.
- Rule Packs: an entity card per pack with owner, sign-off status, and counts of verified / unverified / assumption fields, plus a readable rule list with badges and a raw JSON view.
- Annual Update: choose a pack and 2026→2027 to see holiday diff, rule changes, seniority crossings, HR tasks and affected requests. ES shows a blocked state with the reason and what's needed.
- The Case: the decision in one screen (unify vs local table), what we're not doing, assumptions, links to the docs.
- [ ] Smoke test each view; `npm run build` passes. Commit.

### Task 10: Docs

- `README.md`: quick start, a 3-minute reviewer tour, a map from brief requirements to files, and the iteration-2 "how to apply a correction" recipe (edit pack JSON → add test → `npm test`).
- `DECISION.md`, `CHANGE-AND-CULTURE-PLAN.md`, `ASSUMPTIONS-AND-VERIFICATION.md`, per spec §9. The headcount model is a formula with inputs and a worked example labelled as illustrative.
- AI-use log:
  - The research agent suggested a Czech hub, but there's no Czech entity in the 10-K.
  - PLAWA vs the Chicago ordinance.
  - A blog listed 24 June as a Madrid holiday; the official decree doesn't.
  - Proskauer payout bands are flagged unverified.
- [ ] Final verification: `npm install` from clean, `npm test`, `npm run demo`, `npm run build`, UI smoke. Commit.
