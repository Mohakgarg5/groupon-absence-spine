# Change and culture plan

This plan is written for the moment Groupon is in, not a generic one.

The May 2026 8-K approved a restructuring of up to 400 roles, about a quarter of a 1,734-person company. Most of the cuts land by the end of Q3 2026, under a strategy to rebuild Groupon "as an AI-native company". The same filing says Groupon is evaluating *further* "cost-reduction and automation actions related to Project Foundry" through 2027. Press coverage reported HR among the affected teams; the filing itself names no functions.

So whatever we call this programme, HR staff will hear "we're automating absence admin" as "Foundry is coming for my job." Everything below starts from that fact rather than working around it.

## 1. What changes, for whom

| Who | Today (assumed until the process map arrives) | After |
|---|---|---|
| HR and payroll admins in each entity | Re-key requests, check balances in spreadsheets or HRIS, fix year-end carry-over by hand, re-key holidays and seniority each autumn, answer "how many days do I have?" | Handle exceptions, own reconciliation, act as their entity's rule-pack steward, and give employees the human answer when the receipt isn't enough |
| Employment counsel per entity | Advises ad hoc when something goes wrong | Named owner of a rule pack; signs off each annual version |
| Managers | Approve in whatever tool their entity uses | Approve in one flow, seeing the balance and the reason behind it |
| Employees | Ask HR, or trust a number nobody can explain | See a receipt: every day granted, taken, restored or lapsed, with the rule behind it |
| Works councils and employee reps | Not involved | Formally consulted, and in DE and NL their consent is needed before go-live |
| Finance | Untaken-leave liability estimated, if at all | A replayable, auditable liability figure per entity |

## 2. Communication: who hears what, when, and from whom

The principle: **the people whose work changes hear it first, in person, from their own HR lead, with the honest answer about their jobs, before anything is written down.** Given Foundry, a slide or an all-hands message reaching HR admins second-hand would destroy the programme's credibility on day one.

| # | Audience | What they hear | When | From whom | How |
|---|---|---|---|---|---|
| 1 | HR and payroll admins doing leave admin today (per entity) | What is changing and why. What is *not* decided: no role reduction will be attributed to this programme before the capacity saving has been measured, not modelled (month 6 after go-live), and any role change after that goes through normal consultation. Their role in the pilot: co-authoring their entity's rule pack and owning the reconciliation | Week 0, before any other audience | Their own HR lead, with the programme lead present | Small-group meeting per entity, then 1:1s within a week. Q&A notes published to the group the same day |
| 2 | Employment counsel per entity | The pack they will own, what sign-off means, and the 43 rules marked "public, not yet checked" that need their review | Week 1 | HR Transformation lead | Working session per entity with the draft pack and the assumption register |
| 3 | Works councils: DE (Konzern- or Gesamtbetriebsrat, depending on structure), NL OR if present, FR CSE if present, ES comité | The system, the data it holds (no diagnoses), what it monitors and what it can't, the timeline. A request to agree a works agreement before the pilot processes real data | Week 2, before any real data enters the system | Entity managing director with HR lead; employment counsel attends | Formal written information under BetrVG §§80, 90 (DE); consent request under WOR art. 27 (NL); consultation under C. trav. L2312-8 (FR) |
| 4 | Legal-entity directors and Finance | Migration risk, especially German carry-over balances that can't lapse without warning letters (a liability to quantify), plus the gates and the pilot plan | Week 2 | HR Transformation lead and CFO's delegate | Steering-group paper |
| 5 | DPO and IT security | DPIA scope, data minimisation, EU-US transfer basis | Week 1 | Programme lead | DPIA kick-off |
| 6 | Managers in the pilot entity | What changes in approving leave, and the training slot | 4 weeks before the parallel run | HR BP for their area | 30-minute session with a walkthrough of the desk |
| 7 | Employees in the pilot entity | Nothing changes for them during the parallel run. At cutover: how to read their receipt, and who to ask | Parallel run start (brief note); cutover (full) | HR lead for the entity, in the local language | Email plus intranet page; the receipt itself explains every line |
| 8 | Wider company | Only at the first cutover: one short note that Germany now runs on the new process, what's next, and a link to how balances are calculated | After the DE gate passes | CHRO or COO | Company update. No headline about automation or AI |

Messages I would not send:

- "This frees HR for strategic work". It is vague, and after Foundry it reads as a euphemism.
- Any savings number before it has been measured.
- "AI-powered". The engine is deterministic, and saying so is a selling point.

## 3. Rollout: a pilot first, then one entity at a time

**Why not big-bang:**

- The riskiest single event is importing legacy balances.
- Every entity has a different legal clock: the German carry-over lapse on 31 March, the Polish deadline on 30 September, the Spanish holiday decree each autumn.
- Two jurisdictions need representative consent before go-live.

A big-bang go-live would have to clear every one of those at once.

**Why Germany first, despite it being the hardest:**

- It has the most rules that break unify-everything: the waiting period, §9 sickness, conditional lapse, regional holidays.
- It has the strongest employee representation.
- If the design survives Germany, it survives anywhere. If it doesn't, we learn that on one entity.

| Phase | Dates | What happens | Gate to proceed |
|---|---|---|---|
| 0. Discovery | Oct–Nov 2026 | Get the process map. Take a time baseline (see §5). Collect contracts and works agreements. Start the DPIA. Formally inform DE works councils. Check whether Groupon is self-certified under the EU-US Data Privacy Framework (otherwise SCCs) | Process map reviewed; baseline captured; DE works-council talks open |
| 1. DE readiness | Nov 2026–Feb 2027 | Counsel signs off the DE-BE pack. Negotiate a works agreement, or at least a pilot agreement covering the shadow run (I'm assuming 3–9 months for the full agreement). Do a migration dry run: import, replay, reconcile | Pack signed; a pilot agreement in place; every dry-run difference over 0.5 days explained |
| 2. DE parallel run | Jan–Apr 2027 | The old process stays the system of record. The engine shadows every request. Differences are logged daily and triaged weekly by the German admins. **Spans year-end 2026 and the 31 March 2027 lapse** | Two consecutive months with no unexplained differences; lapse-warning letters sent and recorded |
| 3. DE cutover | May 2027 | Germany switches. Old process read-only for 12 months | Month-3 review: measured time saving, error count, employee queries |
| 4. PL, IE | H2 2027 | Warsaw shared services goes first. Its admins become the champions network, and the Polish 30 Sept deadline is the stress point | Same gates per entity |
| 5. UK, US-CHI, ES | Late 2027, ready for the 2028 leave year | The UK needs a contract review (does the bank-holiday assumption hold?). Chicago gets an Illinois PLAWA pack for staff outside Chicago. Spain needs its convenio reviewed and the 2028 Madrid decree loaded | Same |
| 6. Remaining entities | 2028 | FR, NL (consent needed), BE, CH, AU and any others that employ people | Same |

**What happens to the people doing this work today, during the transition.**

The parallel run is *more* work for them, not less: they run the old process and also triage every difference. I estimate about a 50% increase in absence-admin time for German admins over four months. That is a planning assumption, to be measured in Phase 0. The plan:

- **Backfill** that load with temporary capacity, ideally from Warsaw shared services, so it builds cross-entity knowledge.
- **Make them the experts of record.** They co-author and test their entity's pack and are credited as its stewards. The local knowledge in their heads is the most valuable asset in this programme, and the rule packs are where it gets written down.
- **Give them first claim on the new work in §6,** with training before cutover, not after.

## 4. Critical downsides: where this goes wrong for people

I've organised this by who gets hurt. Each risk has an early-warning signal, so we know it's happening before it becomes a crisis.

### Morale

| Risk | How it hurts people | Mitigation | Early warning |
|---|---|---|---|
| HR admins read this as the next Foundry wave | Disengagement, quiet sabotage of the pilot, departures of exactly the people whose knowledge the packs need | Hear it first and in person (§2). Make no headcount claim before measurement. They co-author the packs. Redeployment first | Pulse survey of HR ops; unplanned attrition or sick leave in HR ops; slow difference triage in the parallel run |
| Employees see balances change at migration | "The new system took my holiday." Trust in HR drops company-wide | No balance is ever reduced at cutover without a human review and an individual explanation. The receipt shows exactly why | Spike in balance queries in the first two weeks after cutover; works-council complaints |
| Managers lose informal discretion (the extra day "off the books") | They resist, and a shadow process appears | Make discretionary leave an explicit, visible type rather than banning it | Approvals done outside the tool; payroll adjustments not matched by ledger events |

### Legal exposure

| Risk | How it hurts people | Mitigation | Early warning |
|---|---|---|---|
| One wrong rule in a pack underpays a whole entity | Today's errors are individual; a central rule error is systematic, repeated for every employee, every year. That is a class-action shape in some jurisdictions | Counsel signs off every pack. Every rule is pinned by tests. A parallel run before cutover. Changes are visible before activation via the annual-update and correction views | Differences in the parallel run clustered on one rule |
| Introducing the system without German co-determination | BetrVG §87(1) Nr. 6 covers technical systems objectively able to monitor behaviour or performance (BAG 1 ABR 20/21); per-person absence data very likely qualifies. The works council can seek an order to stop its use, the programme stalls, and HR loses credibility with employee representatives for years | Inform under §§80 and 90 before any real data is processed. Negotiate a works agreement. If the agreement is group-wide, the Konzernbetriebsrat may be the right counterpart (BAG 1 ABR 45/11) | Council asks for an expert under §80(3); agreement talks slip past Phase 1 |
| Health data handled badly | Sickness records are GDPR Art. 9 data. A central cross-entity system meets several DPIA triggers (sensitive, large-scale, employees). Transfers to a US parent rely on the Data Privacy Framework, whose appeal (C-703/25 P) is pending | Store only "unfit, from/to, certified yes/no", never a diagnosis or free text. Germany's eAU and Poland's e-ZLA already give employers no diagnosis. DPIA before build. Role-based access. SCCs as a fallback | A DPIA finding not closed before the parallel run |
| Migration surfaces an unbooked liability | German leave that can't lapse because nobody sent the warning. Finance hears about it late, and the programme is blamed for "creating" a cost that was always there | Quantify it in Phase 0 and present it to Finance as a discovered risk, with the fix (warning letters from 2026 onwards) | Large blocked-lapse totals in the dry run |

### HR's credibility with the rest of the company

| Risk | How it hurts people | Mitigation | Early warning |
|---|---|---|---|
| A wrong payslip after cutover | "HR can't even count holidays." This lasts far longer than the error | Parallel run across a year-end; cutover gate requires two clean months; old process read-only for 12 months for audit | Any payroll correction traced to the engine in the first 3 months |
| Savings claimed but not delivered, or delivered by cutting people right after | The programme reads as cost-cutting dressed as transformation, and the next HR initiative is dead on arrival | Publish the measured saving with its method (§5). Say plainly where the capacity went (§6) | Leadership asks for the FTE number before month 6 |
| Employees can't reach a human | Self-service becomes a wall | Every receipt names a person to ask; queries are tracked | Repeat queries from the same person; complaints about the tone of answers |

### The design itself

| Risk | How it hurts people | Mitigation | Early warning |
|---|---|---|---|
| Rule-pack knowledge concentrated in one person per entity, who then leaves | The pack rots, annual updates are missed, and the engine blocks requests (see Madrid 2027) | Two named owners per pack (counsel and HR). Calendar deadlines in the annual-update view. A September reminder | An annual update not started by 1 October |
| The model is wrong about something important | Expected, and the brief says so | Every rule is one JSON field plus a test. The correction view shows who is affected before anything changes | Iteration-2 feedback |

## 5. The headcount and quality argument, made honestly

### The honest headline

On a bottom-up model, this design removes roughly **0.4 to 2.7 FTE of manual absence admin across Groupon, central estimate about 1.4 FTE.** That is real but small, and I won't dress it up.

The larger value is:

- **Risk reduction:** systematic statutory breaches avoided, plus an untaken-leave liability that becomes visible and controlled;
- **Explainability:** fewer disputes and more trust;
- **Freed time** spent on work that actually affects culture.

**My recommendation is to take the capacity as redeployment, not as a headcount reduction.** After Foundry the remaining HR team is already stretched. If leadership still wants it as headcount, take it through attrition *after* the month-6 measurement, never announced in advance.

### The model (every input is an assumption until Phase 0 measures it)

No independent benchmark exists for HR minutes per routine leave request. The figures I found are vendor-sponsored and about long statutory leave cases, so I didn't use them. Each entity's own baseline replaces these inputs.

Annual absence-admin hours **today**:

```
H_today =  N·R·t_req              (handling each request)
        +  N·Q·t_q                (answering balance questions)
        +  E·h_entity             (year-end clean-up + annual holiday/seniority re-keying, per entity)
        +  N·R·e·t_fix            (fixing errors)
        +  N·L·t_leaver           (leaver payout calculations)
```

Annual hours **after**:

```
H_after =  N·R·x·t_req  +  N·Q·(1−d)·t_q  +  E·h_entity'  +  N·R·(e/2)·t_fix  +  N·L·t_leaver'
        +  S  (new work: rule-pack stewardship and platform ownership)
```

| Input | Low | Central | High | Source |
|---|---|---|---|---|
| N employees | 1,734 | 1,734 | 1,734 | FY2025 10-K (before Foundry; post-Foundry N is lower, which shrinks the saving) |
| R leave requests per person per year | 6 | 8 | 10 | Assumption |
| t_req manual minutes per request (HR plus payroll touches) | 5 | 10 | 15 | Planning assumption, measure in Phase 0 |
| Q balance questions per person per year, t_q = 8 min | 1 | 2 | 3 | Assumption |
| E entities with staff, h_entity hours per entity per year | 10 × 24 | 10 × 40 | 10 × 60 | Assumption |
| e error rate, t_fix | 2%, 45 min | 2%, 45 min | 2%, 45 min | Assumption |
| L leaver rate, t_leaver | 20%, 30 min | 20%, 30 min | 20%, 30 min | 2026 is atypical (Foundry) |
| x share of requests still needing an HR touch after | 15% | 15% | 15% | Design target |
| d share of balance questions answered by the receipt | 80% | 80% | 80% | Design target |
| h_entity' after (reconcile and sign off) | 12 h | 12 h | 12 h | Design target |
| t_leaver' after (review only) | 10 min | 10 min | 10 min | Design target |
| S new work: 10 packs × 2 h/month + 0.25 FTE platform owner | 640 h | 640 h | 640 h | Counted honestly as a cost |

| | Low | Central | High |
|---|---|---|---|
| H_today | ≈ 1,670 h | ≈ 3,560 h | ≈ 6,060 h |
| H_after | ≈ 1,070 h | ≈ 1,360 h | ≈ 1,740 h |
| **Saving** | **≈ 600 h (0.4 FTE)** | **≈ 2,200 h (1.4 FTE)** | **≈ 4,320 h (2.7 FTE)** |

FTE is taken as 1,600 productive hours a year. The new stewardship work (S) is subtracted, not hidden. For scale: CIPD's median HR-to-employee ratio of 1:60 would imply about 29 HR staff for 1,734 people. That is illustrative only, not Groupon data. On that basis the central saving is roughly 5% of HR capacity.

**What the model leaves out, and how it cuts each way:**

- **Not counted as savings:** avoided statutory breaches (the force-unify test found 54 on 30 sample people), avoided disputes, and audit time. These are real but I can't price them honestly yet.
- **Not counted as costs:**
  - counsel time to sign off six packs, about 5 days each;
  - the temporary parallel-run load (§3);
  - the works-council process;
  - build or configuration effort.
- **Payback.** In year one this is not a cost saving. It becomes one from year two, if the measurement confirms the central case.

### How the estimate gets verified

Measurement, not modelling, decides what happens with capacity.

1. **Baseline (Phase 0, 4 weeks, DE and PL).** Admins log time in 15-minute blocks against five categories: requests, queries, year-end and annual update, corrections, leavers. Alongside that:
   - request counts from the HRIS;
   - query counts from the HR ticket tool, tagged;
   - corrections from payroll.

   Admins see their own data, and it is never used for individual performance assessment. That is also a works-council condition in Germany.
2. **Re-measure** in month 3 after cutover, with the same method and categories.
3. **Report a range**, not a point, with the inputs shown, to the steering group and to the HR team at the same time.
4. **The capacity decision comes at month 6.** If the measured saving is below 0.5 FTE, say so and stop claiming one.

## 6. What the freed capacity is for

"More strategic HR" is not a plan. These are specific pieces of work. Each is something the new ledger makes possible, and each has a measure.

1. **Leave-not-taken outreach.** The ledger already knows who hasn't had a real break.
   - Each quarter it flags people under 40% of entitlement used by 1 September, and people with no block of 5 or more consecutive days in 12 months.
   - The HR BP raises it with the manager, not the employee.
   - The first target is the teams that absorbed Foundry's workload. Survivors of a restructuring are the classic burnout group.
   - Measures: share of employees taking a two-week break; pulse-survey workload items.
2. **Return-to-work and BEM in Germany.** SGB IX §167 obliges an employer to offer *betriebliches Eingliederungsmanagement* (a structured return-to-work offer) to anyone off sick more than six weeks in 12 months.
   - Today that depends on someone noticing.
   - With sickness dates in one record, the offer can be triggered reliably, subject to the works agreement and the DPIA.
   - Measure: share of eligible employees offered BEM within two weeks (target 100%).
3. **Fairness checks across entities.** The force-unify test found the same Groupon policy would give a 3-day-a-week employee 8.3 weeks off and a full-timer 5. Equivalent inconsistencies probably exist today, by accident.
   - Each quarter, HR reviews parity between part-time and full-time staff, the spread of leave approvals and refusals across teams, and parental and carer leave usage by gender.
   - Measure: issues found and fixed.
4. **Manager coaching on fair approval and cover planning,** using approval-time and refusal data per team. This is coaching, not surveillance, and the works agreement defines the line.
5. **Explaining instead of answering.** Admins move from "your balance is 13" to the cases the receipt can't settle: disputes, hardship, special leave.
   - Measures: repeat-query rate, and a satisfaction score from employees who did contact HR.
6. **Rule-pack stewardship as a recognised skill.** Each entity's steward becomes the person who knows its leave law in detail, with a career path to match. This is the opposite of making the role disappear.
