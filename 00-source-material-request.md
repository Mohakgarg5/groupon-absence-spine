# Source material request — sent before design work started

**To:** Case study contact, HR Transformation
**Subject:** Absence management case study — request for the internal process map

Hi,

Before I commit to a target design, I'd like to work from what already exists rather than reconstruct it. The brief mentions that an internal process map for absence management has been done. Could you share it, or the relevant parts?

The things that would most change my design, in priority order:

1. **The process map itself.** Per legal entity: who approves leave, where balances are held (HRIS, payroll provider, spreadsheet), and where hand-offs to payroll happen.
2. **Entity list with headcount per entity.** This tells me which entity to pilot on and how much a design is worth.
3. **Systems of record** per entity (e.g. Workday / SuccessFactors / local payroll bureau / Excel) and who owns each.
4. **Any collective agreements or works-council agreements** that override statutory leave. In DE, IT, ES, FR and NL, these often define entitlement and seniority steps, not the statute.
5. **Known pain points or incidents.** Examples: balance disputes, year-end carry-over clean-ups, payroll corrections, audit findings.
6. **Rough time spent today:** HR/payroll hours per month on leave admin per entity, even as an estimate.

If some of this can't be shared, a "no" is useful too. I'll mark those parts of the design as assumptions, cite public statutory sources instead, and list them under "must verify before ship".

In the meantime I'm proceeding on public statutory sources, with every rule cited and flagged as *unverified against internal policy*.

Thanks,
Mohak Garg

---

## Follow-up: short questions that came out of the research

**Subject:** Absence case study, six quick factual questions

Hi again,

Building the prototype turned up six questions. Each one changes a specific part of the design, so even a one-line answer helps:

1. **Which HRIS holds leave balances today, per entity?** (I've assumed nothing; one search result suggested Workday, but I couldn't verify it.)
2. **What are the German works-council structures?** Is there a Konzern- or Gesamtbetriebsrat, and an existing IT works agreement? (This decides who we consult under BetrVG §87(1) Nr. 6, and how long the pilot takes.)
3. **Do German contracts or works agreements give more than 20 days?** And do they say anything about carry-over to 31 March, or about the annual warning that leave will lapse? (The CJEU's *Max-Planck* ruling makes the warning decisive.)
4. **Do UK contracts treat bank holidays as part of, or on top of, the annual-leave entitlement?** (For a full-timer, that's 8 days a year either way.)
5. **Is US PTO unlimited, as some public profiles say, or a fixed allowance? And what is Chicago HQ headcount?** (Under Chicago's rules, unlimited PTO still owes 40 hours minus the hours used when someone leaves. A fixed allowance is payable in full under Illinois wage law.)
6. **Is Groupon, Inc. self-certified under the EU-US Data Privacy Framework for HR data?** (It decides the transfer basis for EU absence data.)

Thanks,
Mohak

---

**Status log**

| Date | Item | Status |
|---|---|---|
| 2026-10-02 | Request drafted before any design work | Sent |
| 2026-10-02 | Follow-up questions drafted after research | Sent |
| 2026-10-05 | Reply from Groupon: *"Honestly, we want you to make a research and try to create it in your own way :)"* | Closed. No internal material is available for this exercise, so the design rests on public sources, and every internal fact stays a labelled assumption |

**What the reply changes.** I asked before assuming, and the answer is that independent research is the expected path. Nothing in the build relied on receiving internal documents: every rule is cited to a public source and tagged verified, unverified or assumed. The open questions above are no longer requests to Groupon. They are now the first tasks of Phase 0 for a real programme team with internal access (see the Change & Culture Plan), and they stay in the assumptions register until someone inside can answer them.
