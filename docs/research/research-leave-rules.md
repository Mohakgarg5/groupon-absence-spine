# Statutory annual leave / absence rules for a per-entity rules engine

Date of research: 2026-10-02. Not legal advice. Law changes; re-verify before production use.

## Confidence legend and method

- [V] = checked this session against a fetched or searched source (links in "Sources checked").
- [K] = from my background knowledge of the statute, NOT re-fetched this session. The URLs given are the canonical official locations, but I did not open them. Verify the section number before encoding.
- [?] = uncertain or contested. Needs counsel or primary-text check.
- Several official sites blocked fetching (chicago.gov returned 403, labor.illinois.gov returned 404). Chicago and Illinois detail rests on law-firm summaries (Proskauer, Kilpatrick Townsend), which are secondary.

## Cross-country summary table

| Country | Min. entitlement | Native unit | Statutory seniority uplift | Carry-over (statutory) | Payout in lieu | Sick during leave |
|---|---|---|---|---|---|---|
| US federal | None | n/a | n/a | n/a | n/a | n/a |
| US Illinois (state) | 40 h paid leave (any reason), if covered | Hours | No | Carry forward (cap up to 80 h by rule), use cap 40 h/yr | Not required by PLAWA; IWPCA if it is vacation/PTO | Not addressed |
| US Chicago | 40 h paid leave + 40 h paid sick/safe | Hours | No | 16 h leave / 80 h sick | Leave: size-dependent. Sick: never | Separate bank |
| Czech Rep. | 4 weeks (5 public sector, 8 teachers) | Hours (weeks x weekly hours) | No | Employer schedules; to end of next year | Termination only | Not counted as leave |
| UK | 5.6 weeks (cap 28 days) | Weeks | No | 4 wks: only in limited cases; 1.6 wks: by agreement | Termination only | Can reschedule / carry over |
| Ireland | 4 working weeks | Working weeks / hours | No | 6 months by consent; 15 months if ill | Termination only | Leave can be rescheduled (2023 Act) |
| Germany | 24 Werktage (6-day wk) = 20 days (5-day wk) | Days (weekday-based) | No (except +5 days severe disability) | 31 Mar (and duty-to-inform) | Termination only | Certified sick days not counted (s.9) |
| Poland | 20 days (<10 y) / 26 days (>=10 y) | Working days (1 day = 8 h) | Yes, statutory, incl. schooling | To 30 Sept following year | Termination only | Leave is postponed |
| Italy | 4 weeks | Weeks | Via CCNL only | 2 wks in year, 2 wks within 18 months | Termination only | Suspends leave (Const. Court) [?] |
| Spain | 30 calendar days | Calendar days | Via convenio only | Within year; 18 months if incapacity | Termination only | Leave moved, up to 18 months |
| France | 2.5 jours ouvrables/month (30 = 5 weeks) | Jours ouvrables (Mon-Sat) | No (children/age extras) | By agreement / 15 months after sickness | Termination only | In flux [?] |
| Netherlands | 4 x weekly hours | Hours | No | Statutory expires 6 months after year end (conditions) | Termination only | Not counted if ill |

## United States

### Federal
- No federal vacation or holiday mandate for private employers. FLSA does not require paid or unpaid leave. Source: US DOL, https://www.dol.gov/agencies/whd/flsa [K]. The 11 federal holidays (5 U.S.C. 6103) apply only to federal employees [K].
- FMLA: 29 U.S.C. 2601 et seq.; 29 CFR Part 825. https://www.dol.gov/agencies/whd/fmla [K]
  - Up to 12 workweeks unpaid, job-protected leave in a 12-month period for birth/adoption, serious health condition (own or family), qualifying exigency. 26 workweeks for military caregiver (29 U.S.C. 2612).
  - Eligibility: 12 months of employment, 1,250 hours in prior 12 months, employer with 50+ employees within 75 miles (29 U.S.C. 2611).
  - Unit: weeks, but intermittent leave is tracked in hours. The 12-month period is employer-selected (calendar, fixed, rolling, etc.), which a rules engine must parameterize per entity.
  - Employer may require substitution of accrued paid leave (29 U.S.C. 2612(d)). FMLA is an absence type distinct from vacation.

### Illinois: Paid Leave for All Workers Act (PLAWA), 820 ILCS 192
- Official text: https://ilga.gov/legislation/ilcs/ilcs3.asp?ActID=4351 [V, found in search]. Effective 1 Jan 2024.
- Entitlement: accrue at least 1 hour per 40 hours worked, up to 40 hours per 12-month period [V]. Use for any reason. Exempt-from-overtime employees are deemed to work 40 h/week for accrual unless their regular week is shorter [V].
- Usable from the 90th day of employment [V]. Notice: up to 7 days for foreseeable leave, "as soon as practicable" otherwise [V, KTS].
- Carry-over: under accrual method, unused hours carry forward; proposed rules allow the employer to cap carry-over at 80 hours; employer may cap use at 40 hours/year [V, KTS summary of proposed rules; final rule is 56 Ill. Adm. Code 200, https://labor.illinois.gov/content/dam/soi/en/web/idol/laws-rules/plaw/56-200CD-A.pdf, not read]. [?] confirm final rule text.
- Front-loading: employer may grant 40 h upfront with advance written notice; then no carry-over is required [V, KTS].
- Payout: PLAWA itself does not require payout unless the hours sit in a vacation/PTO bank; then the Illinois Wage Payment and Collection Act (820 ILCS 115/5) requires payout of earned vacation at separation [V (KTS) / K for IWPCA]. Use-it-or-lose-it for true vacation is restricted by IWPCA rules (56 Ill. Adm. Code 300.520) [K].
- Coverage/exemptions: all employees working in Illinois except independent contractors, federal/state government employees, RUIA/RLA employees, temporary student workers, construction-industry CBA employees, and certain package-delivery CBA employees [V]. Employers covered by Chicago or Cook County ordinances as of 1 Jan 2024 are exempt from PLAWA [V, KTS]. Gotcha: Chicago entities use the Chicago rules, not PLAWA. Other Illinois sites use PLAWA.
- Public holidays: no private-sector mandate in Illinois [K].
- Related: Employee Sick Leave Act, 820 ILCS 191 (lets employees use existing sick leave for family) [K].

### Chicago: Paid Leave and Paid Sick and Safe Leave Ordinance (Municipal Code of Chicago, Ch. 6-130; "Article II of Title 6" in the rules)
- Rules: https://chicago.gov/city/en/depts/dol/rules-and-regulations-portal/chicago-paid-leave-and-paid-sick-and-safe-leave-rules-supporting.html [V in search results, not opened]. Effective 1 July 2024.
- Coverage: employees who work at least 80 hours within any 120-day period while physically in Chicago [V]. Applies to employers with at least one employee [V].
- Two separate banks, each accruing 1 hour per 35 hours worked, up to 40 hours per 12 months [V].
- Paid Leave (any reason) usable from day 90 (employer may set 4 h minimum increment). Paid Sick Leave usable from day 30 (2 h minimum increment) [V].
- Carry-over: up to 16 h Paid Leave and up to 80 h Paid Sick Leave per 12-month period; front-loaded Paid Leave needs no carry-over [V, Proskauer].
- Front-loading: 40 h Paid Leave and/or 40 h Paid Sick at start of year or employment [V].
- Payout of Paid Leave at separation (final rate of pay), per Proskauer [V secondary, [?] re-verify against rules]:
  - Up to 50 covered employees: no payout duty.
  - 51-100: max 16 h until 1 July 2025, then full unused accrued Paid Leave.
  - Over 100: full unused accrued Paid Leave.
  - Paid Sick Leave: never paid out.
  - The summary's size bands (<=50, 51-100, >100) are as given; my own recollection was different, so check the rule text.
- Penalties $1,000-$3,000 per violation; private right of action since 1 July 2024 (sick) and 1 July 2025 (leave) [V].
- Engine implication: Chicago employee = two ledgers; Illinois non-Chicago = one ledger; both hours-based. Work location (physical presence in Chicago) drives the rule, not employer HQ.

## Czech Republic
- Act No. 262/2006 Coll., Labour Code (Zakonik prprice). Official: https://www.zakonyprolidi.cz/cs/2006-262 [K]. 2021 reform: Act 285/2020 Coll. [V].
- Entitlement (s.212): 4 weeks; 5 weeks for specified public bodies/state; 8 weeks for teachers and academic staff [V on 4/5/8 weeks; K on which employers].
- Unit since 1 Jan 2021: hours. Entitlement = weekly working hours x weeks (s.212-213). Full entitlement after 52 weeks of work at the set weekly time [V]. Leave is recorded and taken in hours, so a 40 h week = 160 h; a 20 h week = 80 h.
- Accrual: shorter periods give 1/52 of the annual entitlement per week of work [K, s.213(2)] [?]. A first-year/60-day rule exists in the code (leave right arises after the employment condition) [?] confirm section.
- Seniority: none statutory.
- Scheduling and carry-over (s.217-218): employer schedules leave after consulting the employee, notifying at least 14 days ahead; one block of at least 2 weeks if the employee requests. If obstacles prevent taking leave, the employer must schedule it by the end of the following calendar year [K].
- Public holidays: 13 under Act 245/2000 Coll. (incl. Good Friday and Easter Monday) [K]. Not regional.
- Holidays and sickness within leave: public holidays and temporary incapacity are not counted as leave taken (s.216) [K] [?] confirm paragraph numbers. Employees get wage compensation for holidays falling on working days (s.348) [K].
- Payout: only on termination (s.222) [K]. Wage compensation during employment is prohibited.
- Gotcha: hours-based ledger; a holiday inside leave consumes no hours; part-time conversion is mid-year sensitive when weekly hours change (hours already earned are recomputed) [K, [?]].

## United Kingdom
- Working Time Regulations 1998 (SI 1998/1833). https://www.legislation.gov.uk/uksi/1998/1833 [K]. Guidance: https://www.gov.uk/holiday-entitlement-rights [K].
- Entitlement: reg.13 gives 4 weeks (EU-derived). Reg.13A gives an additional 1.6 weeks (domestic). Total 5.6 weeks, capped at 28 days (reg.13A(3)) [K].
- Unit: weeks of the worker's own working pattern. Part-time is a pro-rata of 5.6 x days per week (e.g. 3 days/week = 16.8 days). Employer can express in hours.
- Accrual: in the first year, 1/12 of the annual amount per month (reg.15A). Irregular-hours and part-year workers: leave accrues at 12.07% of hours worked for leave years starting on or after 1 April 2024 (SI 2023/1426) [K, [?] check]. Rolled-up holiday pay was permitted for them from the same date.
- Seniority: none.
- Carry-over: 4 weeks cannot be carried over except where the worker could not take it due to sickness or family leave (reg.13(10)-(11), carry-over up to 18 months) [K]. 1.6 weeks can be carried over by relevant agreement (reg.13A(7)) [K].
- Public holidays: no statutory right to time off on bank holidays. Bank holidays can count towards the 5.6 weeks. 8 in England/Wales, 9 in Scotland, 10 in Northern Ireland (varies; regional) [K]. Check the contract.
- Sickness during leave: worker can ask to treat a sick day as sick leave and take the leave later (case law: Pereda, Kreuziger line; reg.13(9)-(10)) [K] [?].
- Payout: only on termination (reg.14) [K]; no payment in lieu during employment.
- Watch: the Employment Rights Act 2025 is phasing in; I did not verify any annual-leave effect [?].
- Gotcha: two buckets with different rules (4 vs 1.6); 28-day cap hits full-time 6/7-day workers; employer-defined leave year (not calendar) is common.

## Ireland
- Organisation of Working Time Act 1997 (OWTA). Revised Act: https://revisedacts.lawreform.ie/eli/1997/act/20/revised/en/html [V, found in search].
- Entitlement (s.19): the least onerous (for the employee, the most favourable) of: 4 working weeks in a leave year in which the worker worked at least 1,365 hours; 1/3 of a working week per calendar month worked with at least 117 hours; or 8% of hours worked in a leave year (max 4 working weeks) [K].
- Part-time: via the 8% / 117-hour calculation, so unit is hours, not fixed days.
- Seniority: none.
- Timing and carry-over (s.20): employer decides after consulting, taking into account the employee; leave in the year, or up to 6 months after with employee consent [K].
- Accrual during sickness: Workplace Relations Act 2015 s.86 inserted s.19(1A): certified sick days count as worked days. Carry-over extends to 15 months for leave missed due to illness [V].
- Sickness during annual leave: Work Life Balance and Miscellaneous Provisions Act 2023 amended OWTA so an employee ill during leave (with a medical certificate) can take the sick days as sick leave and reschedule leave [K] [?] confirm the exact section and the commencement.
- Public holidays (s.21): 10 per year (New Year's Day, St Brigid's Day, St Patrick's Day, Easter Monday, first Mondays in May, June and August, last Monday in October, Christmas Day, St Stephen's Day) [K]. National, not regional.
- Substitution: the employer chooses one of: a paid day off on the day; a paid day off within a month; an extra day of annual leave; an extra day's pay [V]. Eligibility needs 40 hours worked in the 5 weeks before the holiday [K]. Part-timers get pro-rata under the Act's formula [K].
- Payout: only on termination (s.23) [K].
- Not annual leave but relevant: Sick Leave Act 2022 statutory sick pay is phased 3 days (2023), 5 (2024), 7 (2025), 10 (2026) [K].
- Gotcha: the employer chooses the holiday substitute, and the engine must store that per entity.

## Germany
- Bundesurlaubsgesetz (BUrlG). https://www.gesetze-im-internet.de/burlg/ [K].
- Entitlement (s.3): 24 Werktage per year (Werktage = Mon-Sat), i.e. 4 weeks; equals 20 days on a 5-day week. Convert as 24 x (days worked per week / 6) [K].
- Waiting period (s.4): full entitlement arises after 6 months of employment [K].
- Pro-rata (s.5): 1/12 per full month if the waiting period is not met or if the employee leaves in the first half of the year; fractions of at least half a day round up [K].
- Seniority: none statutory. Severely disabled employees get +5 working days (SGB IX s.208) [K]. Young workers 25-30 Werktage (JArbSchG s.19) [K].
- Carry-over (s.7(3)): leave must be granted and taken in the calendar year. Carry-over to 31 March of the next year only for urgent operational or personal reasons [K].
- Expiry only if the employer informed the employee and invited them to take it: ECJ C-684/16 Max-Planck and C-619/16 Kreuziger (6 Nov 2018); BAG 19 Feb 2019 (9 AZR 423/16) [K]. ECJ C-120/21 (22 Sept 2022): the 3-year limitation period only runs if the employer informed [K]. Long-term illness: leave expires 15 months after the year end (ECJ KHS C-214/10; BAG) [K].
- Sickness during leave (s.9): days of incapacity certified by a doctor are not counted as leave [K].
- Public holidays: no federal statute listing them (federal level only 3 Oct). Each Land has a Feiertagsgesetz. Nine are effectively nationwide: 1 Jan, Good Friday, Easter Monday, 1 May, Ascension, Whit Monday, 3 Oct, 25 and 26 Dec. Others vary: Epiphany (BW, BY, ST), Corpus Christi (BW, BY, HE, NW, RP, SL), Reformation Day (several eastern and northern Lander), International Women's Day (Berlin, Mecklenburg-Vorpommern), Buss- und Bettag (Saxony) [K]. Vary even within Bavaria (Assumption Day, Augsburg Peace Festival).
- Holiday in leave: Werktage definition excludes statutory holidays (s.3(2)), so a holiday in leave is not deducted [K].
- Payout: only if leave cannot be taken due to termination (s.7(4)) [K].
- Gotcha: work-location Land determines holidays; unit depends on the weekly pattern; duty-to-inform changes whether the carry-over actually expires.

## Poland
- Kodeks pracy (Labour Code). https://isap.sejm.gov.pl (Dz.U. 1974 nr 24 poz. 141, consolidated) [K].
- Entitlement (art.154 s.1): 20 days if employed under 10 years; 26 days if 10 years or more [K].
- Seniority (art.154 s.2, art.155): "employment period" includes certain periods of education: basic vocational 3 years; secondary vocational 5; general secondary 4; post-secondary 6; higher 8. Only the longest counts, no cumulation [K]. Statutory, so the engine needs total seniority and education.
- Unit: working days, 1 day = 8 hours (art.154(2)). Part-time: leave is expressed in hours, rounded up to a full hour [K]. [?] confirm art.154(2) numbering.
- Accrual: first-time employment gets 1/12 per month (art.155(1)); in later years the employer grants the full entitlement from 1 Jan of the year [K].
- Pro-rata on leaving: 1/12 per month in the year of termination for the employee (art.155(1)) [K].
- Carry-over (art.168): untaken leave must be granted by 30 Sept of the following year [K].
- Leave on demand (art.167(2)): 4 days per year, included in the 20/26 [K]. Gotcha: sub-balance.
- Sickness: leave is postponed if the employee is temporarily incapable (art.165) [K].
- Public holidays: Act of 18 Jan 1951 on days off work. 14 from 2025 (24 Dec added) including Sundays (Easter, Pentecost) [K, [?] confirm]. National.
- Holiday on a Saturday: art.130 s.2 reduces working time by 8 hours, so the employee gets another day off; holidays on Sunday give no day off [K]. Holidays in leave are not counted since leave counts working days.
- Payout: ekwiwalent only on termination (art.171) [K].

## Italy
- D.Lgs. 66/2003, art.10. https://www.normattiva.it/ [K]. Constitution art.36 (leave irrenunciable). Civil Code art.2109.
- Entitlement: not less than 4 weeks per year [K]. Typically 26 working days via CCNL (collective agreement) depending on the sector.
- Timing: at least 2 weeks (consecutive if requested) in the year of accrual; remaining 2 weeks within 18 months after the end of the year, unless the CCNL allows more [K].
- Seniority: statutory none; CCNL often adds days.
- Public holidays: Law 260/1949 as amended: 1 Jan, 6 Jan, Easter Monday, 25 Apr, 1 May, 2 June, 15 Aug, 1 Nov, 8 Dec, 25 Dec, 26 Dec (11 civil/religious) plus Easter Sunday and the local patron saint day by municipality (e.g. Rome 29 June, Milan 7 Dec) [K]. Regional/municipal; patron saint days apply via CCNL.
- Holidays on Sunday: extra pay or day off per CCNL [K, [?]].
- Sickness during leave: Constitutional Court decision no. 616/1987 held that illness can suspend leave if it prevents recovery [K, [?] conditions].
- Payout: art.10(2): no payment in lieu except on termination [K].
- Gotcha: statute minimal; CCNL carries the real rules, and leave is counted in working days of a 5- or 6-day pattern, with different holiday treatment.

## Spain
- Estatuto de los Trabajadores (RDL 2/2015). https://www.boe.es/buscar/act.php?id=BOE-A-2015-11430 [K].
- Entitlement (art.38.1): minimum 30 calendar days per year (or the equivalent in a convenio, often 22 working days) [K].
- Accrual: proportional to time worked (about 2.5 days/month) [K].
- Timing (art.38.2): dates agreed; calendar published at least 2 months ahead [K].
- Carry-over (art.38.3): leave must be taken within the year; if it overlaps incapacity, pregnancy or parental leave, it can be taken after, within 18 months from the end of the year [K].
- Seniority: statutory none; convenios.
- Public holidays (art.37.2): max 14 per year, of which 2 are local. The State sets non-replaceable holidays (1 Jan, Good Friday, 1 May, 15 Aug, 12 Oct, 1 Nov, 6 Dec, 8 Dec, 25 Dec) and autonomous communities choose the rest (Holy Thursday, Easter Monday, 6 Jan, 19 Mar, 25 Jul, etc.) [K]. Regional plus local.
- Counting: calendar days, so holidays inside the leave block are not credited back [K, [?]].
- Payout: not allowed except on termination [K].
- Gotcha: calendar day unit; the same statute is converted into "working days" by many convenios.

## France
- Code du travail. https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006072050/ [K].
- Entitlement (L3141-3): 2.5 jours ouvrables per month of effective work, max 30 jours ouvrables (5 weeks) per reference year [K]. Jours ouvrables = every day except Sunday (usually Mon-Sat) and chome public holidays. Many employers account in jours ouvres (25 days).
- Reference period: 1 June to 31 May by default; the agreement may differ (L3141-10) [K].
- Accrual: includes periods treated as work (L3141-4/5). Since Loi 2024-364 (22 Apr 2024), leave accrues during illness: 2 days/month for non-occupational sickness (max 24 days/year) and carry-over of 15 months after sickness [K, [?]].
- Statutory seniority: none, but extras: employees under 21 and parents get +2 days per child (L3141-8/9) [K, [?]]. Fractionnement (L3141-23): +1 or +2 days if some leave is taken outside 1 May-31 Oct [K].
- Public holidays: 11 listed (L3133-1). Only 1 May is a mandatory paid holiday (L3133-4); others by agreement/usage [K]. Alsace-Moselle adds Good Friday and 26 Dec (local law) [K]. Journee de solidarite is separate.
- Holidays during leave: a chome holiday on a jour ouvrable is not deducted [K, [?]].
- Sickness during leave: historically leave not restored; Cour de cassation 2024-2025 decisions and EU case law are changing this [?]. Treat as unresolved.
- Payout: indemnite compensatrice de conges payes on termination only (L3141-28) [K].
- Gotcha: Mon-Sat counting; different accounting of 5 vs 6 days; employer duty to inform affects carry-over [?].

## Netherlands
- Burgerlijk Wetboek Book 7, art.7:634 (statutory leave), 7:635 (extra-statutory), 7:638 (timing), 7:640 (illness does not reduce leave), 7:641 (payout on termination), 7:642 (expiry). https://wetten.overheid.nl/BWBR0005290 [K].
- Entitlement: 4 x the contractual weekly working time, in hours (e.g. 160 h at 40 h/week) [K]. Pro-rata for part-time and partial years.
- Accrual continues during sickness (7:635) [K].
- Expiry (7:640a): statutory days expire 6 months after the end of the year of accrual, only if the employer has told the employee in time and in writing; extra-statutory days expire after 5 years [K, [?] confirm article numbers]. Long-term sick: 6 months after year end plus the period of incapacity [?]. Two buckets.
- Seniority: none.
- Public holidays: no statutory right to a day off; the Algemene termijnenwet recognises Nieuwjaarsdag, Eerste and Tweede Paasdag, Koningsdag, Hemelvaartsdag, Eerste and Tweede Pinksterdag, Eerste and Tweede Kerstdag. Bevrijdingsdag (5 May) is generally only a holiday in jubilee years or per CAO [K, [?]]. Entitlement depends on contract/CAO.
- Sickness during leave: the leave day is not lost if the employee reports sick before and is truly unfit; case law allows restoring [?].
- Payout: statutory days cannot be waived or paid out in employment; unused ones are paid at termination (7:641) [K].

## Gotchas that break a single global rule model
1. Units: hours (US, CZ, NL), weeks (UK, IT), working days (PL), Werktage (DE), jours ouvrables (FR), calendar days (ES). Store entitlement as a rule object with unit plus working-pattern, not a number.
2. Multiple buckets per jurisdiction: UK 4+1.6; NL statutory/non-statutory; FR paid leave plus fractionnement; Chicago leave vs sick; PL on-demand days.
3. Expiry depends on employer behavior (DE, NL, FR duty-to-inform), so an expiry date is conditional on an `employer_informed` flag.
4. Holidays: some countries credit holidays in leave back (DE, CZ, PL, FR), ES counts calendar days, UK/NL have no entitlement, IE employer picks one of four remedies. Regional holiday calendars: DE per Land, ES per community plus locality, IT per municipality, UK per nation, FR for Alsace-Moselle.
5. Seniority uplift is statutory in PL (education counts), partly in DE/FR/ES by status, and elsewhere by collective agreements. A rules engine needs CBA override layers.
6. Sickness and long-term illness change carry-over (DE 15 months, IE 15 months, UK 18 months, FR 15 months, ES 18 months).
7. Payout is termination-only in all EU states; the US varies (IL: depends on vacation policy; Chicago: size-dependent).
8. Work location vs. employer entity: Chicago ordinance applies by physical presence; Illinois PLAWA excludes Chicago/Cook employers.
9. Leave year is not always the calendar year (UK, FR 1 Jun-31 May, FMLA employer-chosen).

## Sources checked
- https://revisedacts.lawreform.ie/eli/1997/act/20/revised/en/html (Irish OWTA, search result)
- https://www.irishstatutebook.ie/2015/en/act/pub/0016/sec0086.html (WRA 2015 s.86, search result)
- https://ilga.gov/legislation/ilcs/ilcs3.asp?ActID=4351 (PLAWA, search result)
- https://ktslaw.com/insights/alert/2024/1/understanding-the-illinois-paid-leave-for-all-workers-act-a-comprehensive-overview (fetched)
- https://proskauer.com/blog/effective-july-1-2024-chicago-paid-leave-and-paid-sick-and-safe-leave-ordinance (fetched)
- https://chicago.gov/city/en/depts/dol/rules-and-regulations-portal/chicago-paid-leave-and-paid-sick-and-safe-leave-rules-supporting.html (search result, not opened)
- https://www.praceamzda.cz/clanky/12098/nova-pravni-uprava-dovolene and https://advokatnidenik.cz/2020/09/05/nova-pravni-uprava-dovolene-strasak-ci-zadouci-zmena/ (Czech 2021 reform, search results)
- Everything marked [K] relies on background knowledge. Official URLs given are canonical but not opened this session: legislation.gov.uk, gesetze-im-internet.de, legifrance.gouv.fr, boe.es, normattiva.it, isap.sejm.gov.pl, wetten.overheid.nl, zakonyprolidi.cz, dol.gov.
