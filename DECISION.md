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

**How it rolls out.** I've split the rollout into two roles, based on public evidence about where Groupon's people actually are:

- **Operational pilot: Warsaw.** Groupon Shared Services Poland has live hiring and runs payroll for several countries, so the volume and the payroll owners are there.
- **Legal proving ground: Germany.** Groupon GmbH has the hardest rules to get right. It runs in parallel as a shadow, using the same engine and spanning a full year-end.

Other entities follow one at a time, behind gates.

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
| Pack versioning, sign-off, audit trail | Carry-over, caps and conditional lapse: DE and, since 2024, UK need a warning; Polish leave never lapses |
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

`npm run demo`, the live demo, or the web app's **guided tour**. The worked example is Groupon GmbH in Berlin, the hardest rules.

1. **The request.** Lena books 21 Dec 2026 to 8 Jan 2027.
   - The engine expands the range onto Berlin's calendar. 25 Dec and 1 Jan are holidays and aren't charged; 26 Dec is a Saturday.
   - 24 and 31 Dec are charged as working days. That's an assumption, flagged as such, because they aren't statutory holidays.
   - It splits the request into 8 days from leave year 2026 and 5 days from 2027.
   - It replays her ledger to check both years' balances, routes the request to her manager, and emits two payroll lines, each stamped with its pack version.
2. **The edge case.** She is certified sick on 29–30 December.
   - BUrlG §9: certified incapacity during leave isn't leave, so the ledger restores 2 days and cites §9.
   - Without a certificate, nothing is restored, and the ledger says why.
   - A single global policy ("sick days on holiday stay used") breaches German, Polish, Spanish and Irish law in this case (each restores certified sick days).
   - In the UK, the right to retake leave lost to sickness rests on case law (*Pereda*, *ANGED*, *Larner*) rather than the regulations. The force-unify test counts those 4 UK rows as breaches.
3. **The edge case that matters most for migration.** The CJEU's *Max-Planck* ruling (C-684/16) means German leave only lapses on 31 March if the employer warned the employee in writing.
   - Felix was warned, so his leftover leave lapses.
   - Sophie's warning isn't in the legacy system, so hers can't lapse.
   - A "use it or lose it" global rule would wipe out leave that German law says still exists. Equally, any migration that imports balances without the warning letters carries a liability nobody has counted.
4. **The force-unify test, now a simulator.** One sensible-looking global policy is applied to all 30 sample people: 25 days, a tenure bonus, use it or lose it, sick days stay used.
   - It produces **58 breaches of local law, affecting 29 of the 30.** It *also* overpays part-timers by 35 days a year, because a flat 25 days ignores working patterns.
   - On the Force-unify page you can design your own global policy. A generous one still fails: Polish leave never lapses, and a UK 3-day worker ends up 0.2 days short because UK law counts in weeks.
   - Zero breaches is reachable only by copying the most generous local answer on every rule. That means 27 days pro-rated, carry-over without limit, sick days restored and holiday remedies. Scaled to Groupon's 1,734 people, it grants roughly 13,900 days a year above the legal minimum and still needs local law for anything new. That is the strongest version of the argument: a lawful global policy *is* the rule packs, with a bigger bill.
5. **The HR work queue.** The same ledgers generate what is left for people once the typing is automated:
   - lapse warnings due before 31 December (German and UK staff);
   - final-pay leave checks for leavers;
   - Polish replacement days off for Saturday holidays;
   - a person whose work location has no pack;
   - wellbeing check-ins for the four people, two of them team leads, who have barely taken leave.

   That is the Change & Culture Plan's "freed capacity" made concrete.

## What I decided not to do

**No single global leave policy.** The force-unify test is the argument. A policy generous enough to satisfy every country still fails, because it measures leave in the wrong unit for a given country, or lets leave lapse when the law forbids it, or ignores rules on public holidays. An "at least as good as local law" floor would also need local rules to prove it, so it doesn't remove the rule packs; it only hides them.

**No German-first operational pilot.** My first draft piloted Germany because its rules are hardest. Public evidence changed that.
- Groupon's 2026 job postings show no Berlin roles, and German-speaking sales roles are based in Valencia.
- Warsaw is a live hub, and its payroll analysts run "payroll across multiple countries".

A pilot should go where the people and the payroll owners are, so Warsaw runs it. Germany shadows it as the legal stress test. If Groupon GmbH turns out to employ more people than the evidence suggests, the order can flip; the gates are the same.

**No big-bang migration.** The riskiest moment in this whole programme is importing legacy balances. The build shows why: German carry-over balances whose warning letters aren't recorded can't lapse, and every balance needs reconciling against payroll. That is done one entity at a time, in a parallel run, with the old process still the system of record.

**No new HR system, and no configuring the existing one first.** Groupon's own job postings name **Workday** as its HRIS and an external payroll provider, run from Warsaw. So the realistic target is Workday Absence plus the payroll interface, not a custom platform. The order of work matters:

1. the rules, written as packs and signed off;
2. the tests that pin them;
3. Workday configured until it passes those tests.

**This build's rule packs and engine tests are written to become the acceptance test for the Workday configuration.** If Workday can't replay Lena, Sophie, Katarzyna and Priya correctly, it isn't ready. The few things Workday may not express natively are where a thin rules service earns its place:
- conditional lapse after a warning;
- Polish seniority that counts education;
- a citation on every line.

Since 6 April 2026, UK law requires six years of holiday records, and failing to keep them is an offence (reg. 16B). An explainable ledger is no longer a nice-to-have.

**No encoding of collective agreements or contractual surplus days yet.** In Germany, Spain and Italy, collective agreements and contracts usually grant more than statute and can carry different carry-over rules. I haven't seen them, so I modelled the statutory floor and listed this as assumption #1.

**No packs yet for FR, NL, BE, CH, AU, IN or UAE.** Exhibit 21.1 lists entities there, but I don't know which ones employ people. I chose six entities that between them cover every way the rules differ. The architecture adds an entity as a new JSON file plus its tests, not as new code.

**No central store of medical data.** The ledger records "unfit for work, from–to, certified yes/no", never a diagnosis. Health data is GDPR Art. 9 special-category data, and a German employer doesn't receive the diagnosis anyway.

**No AI in the decision path.** The engine is deterministic and every number is explainable. AI was a research tool here (see below). It has no place deciding whether someone gets leave.

## Key assumptions

The full register, with owners and verification methods, is in [ASSUMPTIONS-AND-VERIFICATION.md](ASSUMPTIONS-AND-VERIFICATION.md). The five that would hurt most if wrong:

1. **The statutory floor is the right baseline.** Contracts probably grant more, so modelled balances are a floor, not the truth.
2. **The as-is process has the shape I assumed:** one approval step, and a hand-off to payroll each month. I asked for Groupon's internal process map before designing. Groupon replied that the exercise should rest on independent research, so this stays an assumption, and mapping the as-is process is the first task of Phase 0.
3. **Headcount sits where the public evidence suggests:** Warsaw large, Berlin small. This drives the pilot choice, and HRIS headcount per entity confirms or flips it.
4. **No individual written lapse warnings are sent today.** In Germany and, since 2024, the UK, that means leftover statutory leave can't lapse. It's a liability to quantify.
5. **UK bank holidays count toward 5.6 weeks.** If contracts give them on top, it's a one-field correction worth 8 days a year for each full-time UK employee, and fewer for part-timers whose working days miss some bank holidays.

## Before this could ship

All per entity, all as hard gates:

1. counsel signs off the rule pack;
2. the works-council or employee-representative process is complete;
3. a DPIA is complete;
4. opening balances are reconciled against payroll;
5. the parallel run is clean across a year-end;
6. next year's holiday calendar is loaded from the official source.

Gate 6 happened for real during this build. I first wrote the Madrid 2027 pack as "decree not yet published", so the engine refused January 2027 bookings rather than guessing. Madrid published Decreto 82/2026 on 1 October 2026. Loading it was a single-file change, and the annual-update view showed its effect, including San José on 19 March, new for Madrid in 2027. The refusal mechanism stays, and it is tested.

## Source material

Before designing anything, I asked Groupon for the internal process map and six factual questions (`00-source-material-request.md`). Groupon replied that it wanted independent research.

Everything here therefore rests on public sources: the FY2025 10-K and May 2026 8-K, legislation, court rulings and official holiday decrees. Every internal fact I couldn't know is written down as a labelled assumption with an owner, not quietly guessed.

## How AI was used, and where I overruled it

I used AI agents as the primary research tool, as the brief asks. There were two waves.

**Wave 1:**
1. Groupon's entities and footprint, from the FY2025 10-K, Exhibit 21.1 and 8-Ks;
2. statutory leave law across ten countries;
3. works-council, data-protection and workload benchmarks.

**Wave 2, after Groupon asked for independent research.** Four agents verified every rule against primary texts:
- the Polish Kodeks pracy (Dz.U. 2026 poz. 1245);
- the Spanish Estatuto de los Trabajadores and the BOCM decrees;
- legislation.gov.uk and the Irish Statute Book;
- the Chicago City Clerk ordinance and the Office of Labor Standards rules;
- the German statutes on gesetze-im-internet.de.

Another agent searched Groupon's own job postings for evidence of real policy and systems. Separate testing agents fuzzed the engine and walked the app as a first-time reviewer.

**Result:** 59 of the 78 rules are now checked against a primary source, 4 are public but unchecked, and 15 are labelled company-policy assumptions.

The agents were told to tag every claim as verified, from memory, or uncertain. Those tags became the verification badges in the rule packs.

Where my judgment overruled or corrected the AI-assisted research:

| What AI-assisted research suggested | What I found | What I did |
|---|---|---|
| A Czech hub (leadership in Prague) as a candidate entity | No Czech legal entity in Exhibit 21.1 | Dropped CZ |
| Illinois PLAWA for Chicago HQ staff | PLAWA exempts employers covered by the Chicago ordinance | US pack is Chicago Ord. 6-130, routed by work location; non-Chicago Illinois staff are refused until a PLAWA pack exists |
| A Madrid holiday list including 24 June (third-party site) | The official decree (BOCM 25 Sep 2025) doesn't list it | Used the decree; marked the pack "checked" |
| A statutory summary saying Polish part-time leave is "proportional" | True, but the leave is then taken in hours (1 day = 8 h). My first build charged a 4-hour-day worker a full day per day off | Fixed and pinned with a test |
| Chicago payout bands from a law-firm summary | Wave 2 reached the City Clerk ordinance and the Office of Labor Standards rules | Confirmed and tagged "checked"; the unlimited-PTO payout is 40 h minus hours used in the *rolling* 12 months (6-130-030(g)), now modelled |
| My own Polish pack: carried leave "expires" on 30 September | Art. 168 sets the employer's deadline to grant it; the claim survives 3 years (art. 291) | Polish leave no longer lapses; HR gets a deadline task instead |
| My own UK pack: the 4-week leave simply lapses at year end | SI 2023/1426 (from 1 Jan 2024): it carries forward if the employer didn't give the chance to take it or warn the worker (reg. 13(16)–(17)) | Modelled like Germany. The simple global policy now breaks UK law too (58 breaches, not 54) |
| My own Madrid 2027 pack: "decree not yet published" | Decreto 82/2026 was published on 1 October 2026 | Loaded the 14 dates; the city locals are flagged as union-reported until the official resolution |
| My own Polish seniority: education + prior work | Art. 302¹ (from 2026) also counts civil-law contracts and self-employment; study and work overlaps count once, whichever is better (art. 155 §2) | Added as a cited rule, with the data note on what `priorServiceYears` must contain |
| Public profiles: Groupon US PTO is "unlimited" | Groupon's own Dallas posting says "flexible PTO" | Kept accrual as the default; added an unlimited-PTO option with the Chicago 40-hour separation floor, switchable live |

AI also wrote most of the code under my direction, test-first. The boundary decision, the choice of edge cases, and the change plan's call on headcount are mine.

## Where I expect to be wrong

The brief says iteration 1 will draw at least one substantive correction. These are the places I'm least sure of, so I've made them the cheapest to change:

- **The pilot location.** I moved the operational pilot to Warsaw on public evidence about where people and payroll sit. Groupon's own headcount data could flip it back to Germany. The gates don't change either way.
- **How much of this Workday can do natively.** I've framed the packs and tests as the acceptance spec for a Workday configuration. If Workday can express everything, the rules service shrinks to nothing, and that's fine.
- **The unification boundary for approvals.** I put approval routing in the spine. Some entities may legally need works-council involvement in leave scheduling (DE BetrVG §87(1) Nr. 5), which would make part of routing local.
- **Any individual rule.** Every rule is one JSON field plus a test. The **Try a correction** panel shows the blast radius of a change before it's made.
