# Decision: unify the process and the record, keep the law local

## The decision

Groupon should run absence management as **one global process on one ledger, with each entity's law held in a versioned, cited rule pack owned by that entity's employment counsel.**

**What's unified.** Every leave request in every entity goes through the same nine steps:

1. jurisdiction
2. validation
3. calendar expansion
4. leave-year split
5. local policy
6. balance check
7. approval routing
8. ledger posting
9. payroll export

Every balance is replayed from an append-only ledger in which each line names the rule that produced it.

**What stays local.** Anything that comes from a country's law or collective agreement:

- entitlement and its unit
- accrual and seniority
- carry-over and lapse
- holidays and what happens when they fall on a day off
- sickness during leave
- payout
- which law applies to whom

All of this stays local, as data, and nothing goes live without that owner's sign-off.

**How it rolls out.** Groupon GmbH (Germany) pilots first, in a parallel run that spans a full year-end. Entities follow one at a time, behind gates.

## Where I drew the boundary, and why

The test I applied to every rule:

> *Would two Groupon entities ever legitimately need different answers to this question?*
> If yes, it is local and lives in a rule pack. If no, it is the spine.

"How many days does Lena get?" has different lawful answers in Berlin, Warsaw and Chicago. "How is Lena's request approved, recorded, explained and sent to payroll?" never needs a different answer. So the boundary sits between **what the law says** and **how Groupon operates**.

What sits on each side:

| Spine: one design for all | Rule pack: per entity, per year |
|---|---|
| Request lifecycle and approval routing | Entitlement and its unit: hours (Chicago), working days (PL, IE, UK), Werktage (DE), calendar days (ES) |
| Append-only ledger; balances are derived, never typed | Accrual: waiting periods (DE §4), monthly (IE), first-job twelfths (PL art. 153), per hours worked (Chicago) |
| An explanation and a citation on every number | Statutory seniority (PL counts education years) |
| Pack versioning, sign-off, audit trail | Carry-over, caps and conditional lapse (DE needs a written warning; NL similar) |
| One payroll export format | Regional holiday calendars and holiday-on-a-day-off remedies (IE, PL) |
| Reporting and analytics | Sickness during leave; payout on leaving; which law applies where |

Some rules can't be expressed as data. Each of these is a named **hook** in code, and the list of hooks is itself evidence of what can't be unified:

- `plSeniorityYears`: Polish seniority depends on a person's whole working life and education.
- `resolvePackId`: in the US, the law follows physical work location, not the employing entity.

Those are the only two hooks, but I don't want to overstate how much is pure data:

- **Accrual strategies.** Three are country-specific functions: `de-waiting-period`, `pl-proportional` and `uk-first-year-monthly`. The pack selects them by name.
- **Rule ids referenced in code.** A few rules are looked up by id: Polish leave on demand, the Irish holiday remedy, Polish Saturday holidays, and the German 24/31 December note.

Each is small, named and tested, and the pack switches it on. But each one is code, and a new country may need one more. Keeping that list visible is the point: it is exactly the list of what can't be unified.

## What the build shows

`npm run demo` or the web app. The pilot is Groupon GmbH, Berlin.

1. **The request.** Lena books 21 Dec 2026 to 8 Jan 2027.
   - The engine expands the range onto Berlin's calendar. 25 Dec and 1 Jan are holidays and aren't charged; 26 Dec is a Saturday.
   - 24 and 31 Dec are charged as working days. That's an assumption, flagged as such, because they aren't statutory holidays.
   - It splits the request into 8 days from leave year 2026 and 5 days from 2027.
   - It replays her ledger to check both years' balances, routes the request to her manager, and emits two payroll lines, each stamped with its pack version.
2. **The edge case.** She is certified sick on 29–30 December.
   - BUrlG §9: certified incapacity during leave isn't leave, so the ledger restores 2 days and cites §9.
   - Without a certificate, nothing is restored, and the ledger says why.
   - A single global policy ("sick days on holiday stay used") breaches German, Polish, Spanish and Irish law in this case (each restores certified sick days).
   - In the UK the right exists when the employee asks to reschedule. The force-unify test counts the UK rows as breaches on that basis, so 4 of its 54 breaches are conditional on the employee asking.
3. **The edge case that matters most for migration.** The CJEU's *Max-Planck* ruling (C-684/16) means German leave only lapses on 31 March if the employer warned the employee in writing.
   - Felix was warned, so his leftover leave lapses.
   - Sophie's warning isn't in the legacy system, so hers can't lapse.
   - A "use it or lose it" global rule would wipe out leave that German law says still exists. Equally, any migration that imports balances without the warning letters carries a liability nobody has counted.
4. **The force-unify test.** One sensible-looking global policy is applied to all 30 sample people: 25 days, a tenure bonus, use it or lose it, sick days stay used. It produces **54 breaches of local law, affecting 29 of the 30.** It *also* overpays part-timers by 35 days a year, because a flat 25 days ignores working patterns. Unifying everything is both illegal and expensive.

## What I decided not to do

**No single global leave policy.** The force-unify test is the argument. A policy generous enough to satisfy every country still fails, because it measures leave in the wrong unit for a given country, or lets leave lapse when the law forbids it, or ignores rules on public holidays. An "at least as good as local law" floor would also need local rules to prove it, so it doesn't remove the rule packs; it only hides them.

**No big-bang migration.** The riskiest moment in this whole programme is importing legacy balances. The build shows why: German carry-over balances whose warning letters aren't recorded can't lapse, and every balance needs reconciling against payroll. That is done one entity at a time, in a parallel run, with the old process still the system of record.

**No buying or configuring an HRIS absence module first.** Groupon may well end up running this in Workday Absence or similar; I couldn't confirm which HRIS Groupon uses. My point is about the order of work:

1. the rules, written and signed off;
2. then the tests that pin them;
3. then the system that has to pass those tests.

**This build's rule packs and its 116 tests are written to become the acceptance test for whatever system Groupon buys.** If a vendor configuration can't replay Lena, Sophie and Katarzyna correctly, it isn't ready.

**No encoding of collective agreements or contractual surplus days yet.** In Germany, Spain and Italy, collective agreements and contracts usually grant more than statute and can carry different carry-over rules. I haven't seen them, so I modelled the statutory floor and listed this as assumption #1.

**No packs yet for FR, NL, BE, CH, AU, IN or UAE.** Exhibit 21.1 lists entities there, but I don't know which ones employ people. I chose six entities that between them cover every way the rules differ. The architecture adds an entity as a new JSON file plus its tests, not as new code.

**No central store of medical data.** The ledger records "unfit for work, from–to, certified yes/no", never a diagnosis. Health data is GDPR Art. 9 special-category data, and a German employer doesn't receive the diagnosis anyway.

**No AI in the decision path.** The engine is deterministic and every number is explainable. AI was a research tool here (see below). It has no place deciding whether someone gets leave.

## Key assumptions

The full register, with owners and verification methods, is in [ASSUMPTIONS-AND-VERIFICATION.md](ASSUMPTIONS-AND-VERIFICATION.md). The five that would hurt most if wrong:

1. **The statutory floor is the right baseline.** Contracts probably grant more, so modelled balances are a floor, not the truth.
2. **The as-is process has the shape I assumed:** one approval step, and a hand-off to payroll each month. I asked for Groupon's internal process map before designing. Groupon replied that the exercise should rest on independent research, so this stays an assumption, and mapping the as-is process is the first task of Phase 0.
3. **Berlin is the German work location.**
4. **German carry-over is automatic to 31 March,** and no written lapse warnings are sent today.
5. **UK bank holidays count toward 5.6 weeks.** If contracts give them on top, it's a one-field correction worth 8 days a year for each full-time UK employee, and fewer for part-timers whose working days miss some bank holidays.

## Before this could ship

All per entity, all as hard gates:

1. counsel signs off the rule pack;
2. the works-council or employee-representative process is complete;
3. a DPIA is complete;
4. opening balances are reconciled against payroll;
5. the parallel run is clean across a year-end;
6. next year's holiday calendar is loaded from the official source.

The Madrid 2027 calendar shows gate 6 in action. It isn't published yet, so the engine refuses January 2027 requests for Spain rather than guessing.

## Source material

Before designing anything, I asked Groupon for the internal process map and six factual questions (`00-source-material-request.md`). Groupon replied that it wanted independent research.

Everything here therefore rests on public sources: the FY2025 10-K and May 2026 8-K, legislation, court rulings and official holiday decrees. Every internal fact I couldn't know is written down as a labelled assumption with an owner, not quietly guessed.

## How AI was used, and where I overruled it

I used AI agents as the primary research tool, as the brief asks. I ran three research passes in parallel:

1. Groupon's entities and footprint, from the FY2025 10-K, Exhibit 21.1 and 8-Ks;
2. statutory leave law across ten countries;
3. works-council, data-protection and workload benchmarks for the change plan.

The agents were told to tag every claim as verified, from memory, or uncertain. Those tags became the verification badges in the rule packs.

Where my judgment overruled or corrected the AI-assisted research:

| What AI-assisted research suggested | What I found | What I did |
|---|---|---|
| A Czech hub (leadership in Prague) as a candidate entity | No Czech legal entity in Exhibit 21.1 | Dropped CZ |
| Illinois PLAWA for Chicago HQ staff | PLAWA exempts employers covered by the Chicago ordinance | US pack is Chicago Ord. 6-130, routed by work location; non-Chicago Illinois staff are refused until a PLAWA pack exists |
| A Madrid holiday list including 24 June (third-party site) | The official decree (BOCM 25 Sep 2025) doesn't list it | Used the decree; marked the pack "checked" |
| A statutory summary saying Polish part-time leave is "proportional" | True, but the leave is then taken in hours (1 day = 8 h). My first build charged a 4-hour-day worker a full day per day off | Fixed and pinned with a test |
| Chicago payout bands from a law-firm summary | Couldn't reach the city's rule text | Kept the rule but tagged it "not yet checked" |

AI also wrote most of the code under my direction, test-first. The boundary decision, the choice of edge cases, and the change plan's call on headcount are mine.

## Where I expect to be wrong

The brief says iteration 1 will draw at least one substantive correction. These are the places I'm least sure of, so I've made them the cheapest to change:

- **Whether Groupon should build anything at all,** versus configuring its existing HRIS. Even if the answer is "configure", the rule packs and tests remain the specification. That part doesn't change.
- **The unification boundary for approvals.** I put approval routing in the spine. Some entities may legally need works-council involvement in leave scheduling (DE BetrVG §87(1) Nr. 5), which would make part of routing local.
- **Any individual rule.** Every rule is one JSON field plus a test. The **Try a correction** panel shows the blast radius of a change before it's made.
