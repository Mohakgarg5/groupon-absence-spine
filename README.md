# Spine: absence management across Groupon's legal entities

My answer to the HR Transformation case study, iteration 1. It has three parts:

- **A decision.** Unify the process and the record, and keep the law local.
- **A working build.** A rules engine, a web desk and a CLI run real leave requests and accruals end to end.
- **A change and culture plan.**

All employees in the build are fictional. Every rule is cited and tagged with how far it has been verified. Groupon legal has not signed off any of it.

**Live demo:** https://groupon-absence-spine.vercel.app (no install; state stays in your browser, and **Reset demo** clears it)
**Repository:** https://github.com/Mohakgarg5/groupon-absence-spine

## Run it

Requires Node 20 or newer (tested on Node 24). No database, keys or network access are needed at runtime.

```bash
git clone <this repo> && cd <repo>
npm install
npm run dev        # web app on http://localhost:5173
npm run demo       # the whole case in the terminal, about 1 minute to read
npm test           # 159 engine tests, one or more per legal rule
npm run test:e2e   # 22 browser tests of the web app (downloads Chromium on first run)
npm run build      # typecheck everything and build the web app
```

## A three-minute tour

The easiest way in is the **guided tour** button on the Overview: nine steps that move you to the right screen and person each time. Every page also has its own URL (for example `#/ledger/de-sophie`), so you can share or reload any view.

1. **Overview.** The decision in one sentence and the nine-step spine every request takes.
2. **Request desk.** Lena (Groupon GmbH, Berlin) books 21 Dec 2026 to 8 Jan 2027.
   - The request is checked against Berlin's holiday calendar and split across two leave years.
   - Her balance is replayed and checked, the request is routed to her manager, and two payroll lines are exported.
   - Approve it, then report her sick on 29–30 Dec. BUrlG §9 gives the two days back, with the citation on the line. Untick "medical certificate" and the ledger explains why nothing comes back.
3. **Ledger.** Sophie Krüger's 2025 leave cannot lapse on 31 March: the legacy system holds no written warning (CJEU C-684/16). Tick the warning and watch the ledger replay.
4. **HR queue.** What is left for people once the typing is automated:
   - lapse warnings due before 31 December (Germany and, since 2024, the UK);
   - final-pay checks for leavers;
   - Polish replacement days off;
   - wellbeing check-ins for the people who have barely taken leave.
5. **Force-unify test.** Design one global leave policy and run it against all 30 people.
   - The simple version breaks local law 58 times.
   - A generous one still fails: Polish leave never lapses, and a UK 3-day worker ends up 0.2 days short because UK law counts in weeks.
   - Zero breaches costs about 13,900 days a year above the legal minimum at Groupon's size.
6. **Rule packs.** All local law, as data, with 59 of 78 rules checked against primary law. Use **Try a correction**: change any rule and every affected balance replays live. This is how iteration-2 feedback gets applied.
7. **Annual update.** Packs roll from 2026 to 2027:
   - holidays move;
   - Piotr crosses 10 years of Polish seniority;
   - Madrid's 2027 decree, published on 1 October 2026 in the middle of this build, was a single-file change.
8. **Decision & plan.** The written deliverables, rendered in-app from the files below.

## Where each part of the brief is answered

| Brief asks for | Where |
|---|---|
| A runnable build, end to end, for at least one real entity | `packages/engine`; Groupon GmbH (DE-BE) worked example in the desk, the guided tour and `npm run demo` §1 |
| An edge case that breaks "unify everything" | Sickness during leave (BUrlG §9), conditional lapse (CJEU C-684/16), Polish education-based seniority, Chicago location rule; summarised by the force-unify test |
| A written decision, with what's not done, assumptions and what to verify | [DECISION.md](DECISION.md), [ASSUMPTIONS-AND-VERIFICATION.md](ASSUMPTIONS-AND-VERIFICATION.md) |
| Use of AI in research, with my own judgment shown | DECISION.md, section "How AI was used, and where I overruled it" |
| A Change & Culture Plan | [CHANGE-AND-CULTURE-PLAN.md](CHANGE-AND-CULTURE-PLAN.md) |
| Asking what source material exists | [00-source-material-request.md](00-source-material-request.md): asked before any design work. Groupon replied (5 Oct 2026) that it wanted independent research, so every input comes from a public source, and every internal fact is a labelled assumption |

## How the code is laid out

```
packages/engine/            pure TypeScript; no runtime dependencies
  src/packs/*.json          the local law: 6 entities × 2 years, every rule cited and tagged
  src/packs/registry.ts     loads and validates packs; in-memory overrides for what-if corrections
  src/calendar.ts           expands a date range onto the person's pattern and holiday calendar
  src/strategies/           entitlement strategies plus the hooks that can't be data (PL seniority)
  src/ledger.ts             the unified record: replays grants, accruals, debits, carry-over, lapses
  src/pipeline.ts           the nine-stage request pipeline with an explanation trace
  src/jurisdiction.ts       which law applies (Chicago ordinance vs Illinois PLAWA)
  src/stressTest.ts         the force-unify comparison and policy simulator
  src/diff.ts               annual update: holiday moves, rule changes, seniority crossings, HR tasks
  src/queue.ts              the HR work queue generated from the ledgers
  src/data/                 30 fictional employees plus a scenario (today = 2 Oct 2026)
  test/                     159 tests (incl. fixes found by an adversarial fuzzer and a UX test)
e2e/                        22 Playwright browser tests (no console errors allowed, 400px layout checked)
apps/web/                   Vite + React UI, imports the engine directly
cli/demo.ts                 terminal walkthrough
docs/research/              raw research notes, including what was and wasn't verified
docs/specs, docs/plans      design spec and implementation plan
```

## Applying a correction (iteration 2)

A correction to a rule should be a small, reviewable change to data plus a test, not a rewrite.

1. Find the rule. Every number in the UI links to a `ruleId`, so the rule is in `packages/engine/src/packs/<ENTITY>.<YEAR>.json`.
2. Try the change live on the **Rule packs** page to see who it affects.
3. Edit the JSON, and update the citation and `verification` field.
4. Add or adjust a test in `packages/engine/test/` that pins the corrected behaviour, then run `npm test`.
5. If the correction can't be expressed as data, add a named hook in `src/strategies/` and list it in DECISION.md as something that can't be unified.

## How it was tested

- **159 engine tests:** one or more per legal rule.
- **22 browser tests:** they fail on any console error and check the 400px phone layout.
- **An adversarial fuzzer:** about 28,000 random employees and 150,000 requests, checking invariants (balances equal the sum of events, no approved request ever overdraws, no holiday is ever charged, deterministic replay). It found 7 real edge-case bugs, all fixed and pinned by tests.
- **Two first-time-reviewer UX passes** in a real browser across five screen sizes and dark mode, plus two independent code reviews. Every confirmed finding was fixed and pinned by a test.

## Known limits of this prototype

- **Calendar leave years only.** UK and FR employers often use other leave years; the validator rejects them rather than guessing.
- **Not modelled:** collective agreements, contractual days above the statutory minimum, irregular-hours workers, long-term-sickness carry-over (15 to 18 months) and FMLA.
- **Placeholder US holidays.** The US holiday calendar stands in for Groupon's real one.
- **A demo, not a product.** State lives in the browser and resets with **Reset demo**. There is no authentication, persistence or real HRIS integration.
