# Absence Management — "Global Spine, Local Rule Packs" — Design Spec

**Date:** 2026-10-02 · **Author:** Mohak Garg · **Status:** approved in conversation, awaiting written-spec review

## 1. Intent

Groupon's absence management is fragmented per legal entity, and no target design exists. We propose one and build a first working version. Success means:

- A reviewer can clone the repo and run `npm install && npm run dev` (UI) or `npm run demo` (terminal).
- They can watch a real leave request and an accrual get processed end to end under real German rules, with a sickness-during-leave edge case.
- They can see, concretely, why a single global rule breaks.
- The written decision and the Change & Culture Plan are honest and specific.
- **Iteration-2 readiness:** a correction to a rule is a small, visible, diffable change to one rule pack, plus a test. It is not a code rewrite.

## 2. The decision (summary)

**Unify the process and the record. Keep the law local.**

| Unified ("spine") | Local ("rule pack" per entity) |
|---|---|
| Request lifecycle and states | Entitlement amount, unit, working-pattern conversion |
| Append-only leave ledger (balances are derived, never stored) | Accrual method (front-load / monthly / per hours worked) |
| Explanation trace attached to every number | Seniority rules (incl. PL education years) |
| Approval routing interface | Carry-over and expiry (incl. conditional expiry) |
| Audit trail, rule-pack versioning, sign-off | Public holiday calendar (per region) and holiday-in-leave treatment |
| Payroll export format | Sickness-during-leave treatment |
| Reporting / analytics | Payout-in-lieu rules, multiple buckets (e.g. Chicago leave vs sick) |

Not doing: a single global policy, a big-bang migration, buying an HRIS module first, or encoding collective agreements we haven't seen.

## 3. Scope: entities

Sources: FY2025 10-K Exhibit 21.1 and `docs/research/`. Groupon has no Czech legal entity, so CZ is excluded.

| Pack id | Entity (Exhibit 21.1) | Location assumption | Why included |
|---|---|---|---|
| `DE-BE` | Groupon GmbH | Berlin | **Pilot.** Full end-to-end. Regional holidays, Werktage unit, §9 sickness, conditional carry-over expiry |
| `PL` | Groupon Shared Services Poland Sp. z o.o. | Warsaw | Statutory seniority incl. education years; 4 on-demand days; carry-over to 30 Sept |
| `IE` | Groupon International Ltd | Dublin | Employer-chosen public-holiday remedy; hours-based part-time |
| `UK` | Groupon UK entity (one of five; to confirm which employs) | London | 5.6 weeks in two buckets (4 + 1.6) with different carry-over; 28-day cap |
| `ES-MD` | Groupon Spain | Madrid | Calendar-day unit; regional + local holidays |
| `US-CHI` | Groupon, Inc. / US employing entity (to confirm) | Chicago | Hours; **two banks** (paid leave + paid sick); work location (not entity) decides the law; Illinois PLAWA does *not* apply in Chicago |

Each rule field carries `verification`: `public-verified` (checked against a fetched source), `public-unverified` (from knowledge, canonical URL given), or `assumption` (company-policy choice we made). Nothing is labelled `internal-verified` until the internal process map or policy confirms it.

## 4. Architecture

```
packages/engine      pure TS, no deps; deterministic; Vitest
  model.ts           Employee, WorkPattern, LeaveRequest, LedgerEvent, Trace
  calendar.ts        working-day expansion per pattern + holiday calendar
  packs/             JSON rule packs per entity per version + loader/validator
  hooks/             named local hooks (code) for non-declarative rules
  accrual.ts         accrual engine driven by pack.accrual
  pipeline.ts        request → validate → expand → policy → balance → approve → post → export
  ledger.ts          append-only events; balance = fold(events)
  stressTest.ts      runs a naive "global policy" vs the local packs; reports breaches
  diff.ts            pack v2026 vs v2027 impact
apps/web             Vite + React UI using the engine directly (no backend)
cli/demo.ts          terminal run of the scenarios
data/employees.json  ~30 fictional employees across 6 entities
```

**Ledger events:** `GRANT`, `ACCRUE`, `REQUEST_DEBIT`, `RESTORE` (sickness/holiday), `CARRY_OVER`, `EXPIRE`, `EXPIRY_BLOCKED` (duty-to-inform not met), `PAYOUT`, `ADJUST`. Every event carries `{packId, packVersion, ruleId, citation, verification, explanation}`.

**Rule pack shape (declarative):** `unit`, `buckets[]` (each with entitlement formula params, accrual method, carry-over, expiry, payout, usage-from day), `seniority` (steps + what counts), `holidays` (by year, region), `holidayInLeave` (`not-deducted` / `deducted-calendar-days` / `employer-remedy`), `sickDuringLeave` (`restore` / `reschedule-on-request` / `postpone`), `leaveYear` (start month/day), `owner` (named legal owner role), `signOff` (status, date).

**Hooks:** only where data can't express the rule, and each is listed in DECISION.md as evidence of what can't be unified. Planned: `pl.seniorityWithEducation`, `de.carryOverDutyToInform`, `us-chi.workLocationJurisdiction`.

## 5. End-to-end scenarios (demo + tests)

1. **DE pilot request.**
   - A Berlin employee on a 5-day week requests 21 Dec 2026 to 8 Jan 2027.
   - Expansion skips weekends and Berlin holidays (25/26 Dec, 1 Jan). 24 and 31 Dec are ordinary working days unless entity policy says otherwise (`assumption`, flagged).
   - The request splits across leave years 2026 and 2027.
   - The balance check includes 2026 carry-over.
   - Then approval, posting, and a payroll export line.
2. **DE edge case: sickness during leave.** A doctor's certificate covers 29–30 Dec. Under BUrlG §9 the engine posts a `RESTORE` of 2 days.
3. **DE carry-over expiry on 31 March:**
   - Employee A was warned in writing (`employerInformed=true`): the remaining days `EXPIRE`.
   - Employee B was not warned: `EXPIRY_BLOCKED`, under CJEU C-684/16.
4. **PL seniority.** A new hire with a master's degree (8 years counted) and 3 years' prior work reaches 11 years of seniority, so 26 days. A tenure-only global rule gives 20, which is a breach.
5. **US-CHI.** A Chicago employee accrues by hours worked into two banks with different usage-from days (90 vs 30). Termination pays out paid leave but not sick leave (employer > 100 employees).
6. **Force-unify stress test.**
   - The global policy is "25 working days, front-loaded, tenure-based seniority, use-it-or-lose-it at 31 Dec, sick days during leave stay consumed".
   - It runs against all 30 employees, per entity.
   - Output per employee: global result, local result, delta, statute breached, and any cost overspend where the global rule is more generous.
7. **Annual update.** The DE-BE pack goes from 2026 to 2027 (new holiday dates). The diff shows affected requests and balances before activation.

## 6. UI concept

The tone is a calm "ledger / receipt" aesthetic. Each balance is a printed receipt, and every line links to the statute behind it. Five views:

1. **Request desk.** Pick an employee, pick dates on a calendar painted with their entity's holidays, and watch the pipeline animate stage by stage. The result is a receipt.
2. **Ledger.** Per-employee event timeline. Click any line to open a citation card showing the rule id, statute, verification status and owner.
3. **Force-unify.** The stress-test matrix: entities × rules, red cells for breaches, with an aggregate counter of breaches and overspend.
4. **Rule packs.** A readable view of each pack, with verification badges and an owner/sign-off panel. Includes the v2026 → v2027 diff and its impact.
5. **Case study.** Brief summaries of the decision and the change plan, linking to the docs.

## 7. Error handling

The engine validates pack schemas at load, and an invalid pack fails loudly. A request is rejected with a reason when:

- it falls before the usage-from date,
- the balance is insufficient (unless the pack allows negative balances, which none currently do),
- it overlaps an existing request, or
- it covers zero working days.

Unknown entity or region raises an error. The UI shows errors inline and never fails silently.

## 8. Testing

Vitest unit tests cover each scenario above, plus:

- calendar expansion: regional holidays, weekends, part-time patterns, and the year split;
- accrual pro-rata;
- the pack validator;
- ledger fold invariants: the balance equals the sum of events, and no event is posted without a citation.

`npm test` must pass. The UI gets a Playwright smoke check during development (not shipped as a dependency).

## 9. Written deliverables

- `README.md` — run instructions, a tour of the build, and where each brief requirement is answered.
- `DECISION.md` — decision, what we're not doing, AI-use log including where AI was corrected (the Czech entity; PLAWA vs Chicago), assumptions, and the pre-ship verification table.
- `CHANGE-AND-CULTURE-PLAN.md` — communications matrix in the context of Project Foundry, phased rollout with gates, an unsoftened downsides analysis, and a headcount model as a formula with explicit inputs and a verification method.
- `00-source-material-request.md` — the process-map request, already drafted.

## 10. Known risks to this design

- Public-unverified rules may be wrong, which is the reason for verification badges and the sign-off gate.
- Collective agreements may override statute in DE/ES; that sits outside the pilot.
- Holiday dates are hard-coded per year in the packs. In production they would come from a maintained source owned by the pack owner.
