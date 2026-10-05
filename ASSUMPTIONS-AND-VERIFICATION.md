# Assumptions and what must be verified before this ships

Groupon confirmed (5 Oct 2026) that this exercise should rest on independent research, not internal documents, so everything below comes from public sources.

Every rule in the engine carries one of three tags. None is yet "verified against Groupon policy", because I haven't seen Groupon's policies.

| Tag | Meaning |
|---|---|
| ● Checked against a source | I read the primary or official text (or, where noted, a reputable secondary summary) this week |
| ◐ Public, not yet checked | Well-established public law, cited to the canonical source, but I didn't re-read the section; a lawyer must confirm the section and wording |
| ○ Our assumption | A company-policy choice I made to make the build run; Groupon's real policy may differ |

The 2026 rule packs contain **71 distinct rules: 21 checked against a source, 35 public but not yet checked, and 15 assumptions**. The **Rule packs** page shows the split per entity.

**The German pilot pack: 8 of its 12 rules are now checked against the primary text.** That covers BUrlG §§3, 4, 5, 7(3), 7(4) and 9 on gesetze-im-internet.de, SGB IX §208, CJEU C-684/16 via the EU Fundamental Rights Agency's case summary, and Berlin's 8 March holiday. The remaining 4 are three company-policy assumptions (work location, 24/31 December, contractual surplus days) and the rule that a weekend holiday gives no substitute day. Automatic carry-over to 31 March is also still an assumption, recorded on the otherwise-verified carry-over rule. "Checked" means I read the text. It does not replace counsel's sign-off, which is still the first gate below.

The Chicago pack looks better (9 of 16 checked), but most of those checks rely on law-firm summaries, because chicago.gov blocked automated access.

## The assumptions that matter most

Ranked by what it would cost to be wrong.

| # | Assumption | If wrong | Who verifies | How |
|---|---|---|---|---|
| 1 | Statutory minimums are the binding floor. Contracts and works agreements may grant more, and I haven't modelled them | Balances are systematically understated; contractual surplus days may follow different carry-over rules (DE) | HR BP per entity, with employment counsel | Collect contract templates and works agreements; add a "contractual surplus" bucket per pack |
| 2 | The process map Groupon holds matches the shape I designed (one approval step, HRIS or spreadsheet as the record, a monthly hand-off to payroll) | Pipeline stages 7–9 are wrong for some entities | HR Ops lead | Map the as-is process per entity in Phase 0. I requested Groupon's internal map; Groupon asked for independent research instead (`00-source-material-request.md`) |
| 3 | Groupon GmbH staff work in Berlin | Wrong public holidays (Bavaria and NRW differ) | HR BP DE | Pull the work location per employee from the HRIS |
| 4 | DE carry-over happens automatically to 31 March (the statute only allows it for urgent reasons) | More leave lapses than modelled, or less | Employment counsel DE | Check contract and works-agreement wording |
| 5 | Groupon issues no written lapse warnings today | Probably true. If so, every German carry-over balance survives indefinitely, a real liability on the balance sheet | HR Ops DE, with Finance | Search for the annual reminder email; quantify untaken leave |
| 6 | The Chicago employer has more than 100 covered employees, so unused Paid Leave is paid out | The payout rule flips | People Ops US | Headcount in Chicago (about 377 reported in 2026 coverage, unconfirmed) |
| 7 | Chicago Paid Leave accrues per hours worked. **Evidence against:** a third-party profile (Built In, updated Sept 2026) describes Groupon's US PTO as "unlimited or flexible" | If PTO is unlimited, balances are "unlimited", nothing carries over, and on separation Groupon owes 40 h minus the Paid Leave used that year (Chicago rules). The engine supports this: switch Paid Leave to `unlimited-with-floor` on the Rule packs page | People Ops US | Read the US PTO policy. If it's a fixed allowance above the ordinance, the surplus is "vacation" under IWPCA and payable on separation |
| 8 | The UK counts bank holidays toward 5.6 weeks | Every full-time UK balance is 8 days too low (part-timers fewer) | HR BP UK | Read the contract. If it's wrong, it's a one-field fix (try it on the Rule packs page) |
| 9 | Ireland's public-holiday remedy is "an extra day of annual leave" | A different remedy (paid day off or extra pay) changes payroll, not balances | HR BP IE | Ask payroll what is done today |
| 10 | Spain counts 30 calendar days | Many convenios use 22 working days instead | Employment counsel ES | Identify Groupon Spain's applicable convenio |
| 11 | Polish study and work periods are not de-duplicated | Seniority is overstated for people who worked while studying | Payroll PL | Check against the świadectwa pracy held for each employee |
| 12 | The calendar year is the leave year everywhere | UK and FR entities may run other leave years | HR BP UK and FR | Contract review. The engine rejects non-calendar years rather than mis-computing them |
| 13 | The 13 active countries in the 10-K map to the entities I chose. FR, NL, BE, CH and AU have entities but no pack yet | The rollout scope is incomplete | HR Ops, with Legal | Get the entity list with headcount from HRIS in Phase 0 (not available for this exercise) |

## What has to be true before go-live, per entity

Each is a gate. A pack can't be activated with any of these open.

1. **Legal sign-off on the rule pack** by the named owner: employment counsel plus the HR BP. Every ◐ rule is checked line by line, and every ○ rule is confirmed or replaced.
2. **Works-council or employee-representative process completed** where one applies (see the Change & Culture Plan for the legal basis per country).
3. **DPIA completed.** Sickness records are health data under GDPR Art. 9. Only "unfit for work, from/to" is stored, never the diagnosis.
4. **Opening balances reconciled.** The legacy balance for every person is imported, replayed and compared with payroll. Every difference over 0.5 days is explained and signed off. The DE lapse-warning gap is quantified.
5. **Parallel run for one full cycle, including a year-end.** The old process stays the system of record. The engine shadows it, and differences are logged and triaged. Exit criterion: no unexplained differences for two consecutive months.
6. **Next year's holiday calendar loaded from the official source** (the Spanish 2027 pack shows this gate blocking).

## Facts I checked and the corrections I made

- **No Czech entity.** Groupon's leadership sits partly in Prague, but Exhibit 21.1 of the FY2025 10-K lists no Czech legal entity, so CZ is out of scope despite the early research suggesting it.
- **Chicago is not Illinois.** Illinois PLAWA (820 ILCS 192) exempts employers covered by the Chicago ordinance, so a Chicago HQ employee has two hour-banks under Ord. 6-130. The engine routes by physical work location and refuses an Illinois employee outside Chicago (Sam Patel) rather than applying Chicago rules.
- **Madrid holidays 2026.** A third-party calendar site listed 24 June. The official Decreto 75/2025 (BOCM, 25 Sep 2025) does not. I used the decree.
- **Polish part-time leave is counted in hours.** One leave day equals 8 hours (art. 154²). My first version charged a half-time employee on 4-hour days one leave day per day off, which would have halved her leave. A test now pins it.
- **The Polish first-job accrual date.** 1/12 accrues on *completing* each month (the last day), not on the first day of the next month. Corrected, with a test.
