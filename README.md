# Spine: absence management across Groupon's legal entities

My answer to the HR Transformation case study, iteration 1. It has three parts:

- **A decision.** Unify the process and the record, and keep the law local.
- **A working build.** A rules engine, a web desk and a CLI run real leave requests and accruals end to end.
- **A change and culture plan.**

All employees in the build are fictional. Every rule is cited and tagged with how far it has been verified. Groupon legal has not signed off any of it.

## Run it

Requires Node 20 or newer (tested on Node 24). No database, keys or network access are needed at runtime.

```bash
git clone <this repo> && cd <repo>
npm install
npm run dev        # web app on http://localhost:5173
npm run demo       # the whole case in the terminal, about 1 minute to read
npm test           # 102 engine tests, one or more per legal rule
npm run build      # typecheck everything and build the web app
```

## A three-minute tour

1. **Overview.** The decision in one sentence and the nine-step spine every request takes. Press **Run the Berlin pilot request**.
2. **Request desk.** Lena (Groupon GmbH, Berlin) books 21 Dec 2026 to 8 Jan 2027.
   - The request is checked against Berlin's holiday calendar and split across two leave years.
   - Her balance is replayed and checked, the request is routed to her manager, and two payroll lines are exported.
   - Approve it, then report her sick on 29–30 Dec. BUrlG §9 gives the two days back, and the receipt says so with the citation.
   - Untick "medical certificate" and nothing is restored; the ledger says why.
3. **Ledger.** Every balance is replayed from events, and every line names its rule. Open Sophie Krüger: her 2025 leave cannot lapse on 31 March because the legacy system holds no written warning (CJEU C-684/16). Tick the warning and watch the ledger replay.
4. **Force-unify test.** One sensible-looking global policy is run against all 30 people. It produces 54 breaches of local law, and it overpays part-timers by 35 days a year.
5. **Rule packs.** All local law, as data. Use **Try a correction**: change any rule and every affected balance replays live. This is how I expect iteration-2 feedback to be applied.
6. **Annual update.** Packs roll from 2026 to 2027:
   - holidays move;
   - Piotr crosses 10 years of Polish seniority;
   - Madrid's 2027 holiday decree isn't published yet, so the Spanish pack is blocked rather than guessed.
7. **Decision & plan.** The written deliverables, rendered in-app from the files below.

## Where each part of the brief is answered

| Brief asks for | Where |
|---|---|
| A runnable build, end to end, for at least one real entity | `packages/engine`, Groupon GmbH (DE-BE) pilot in the desk and in `npm run demo` §1 |
| An edge case that breaks "unify everything" | Sickness during leave (BUrlG §9), conditional lapse (CJEU C-684/16), Polish education-based seniority, Chicago location rule; summarised by the force-unify test |
| A written decision, with what's not done, assumptions and what to verify | [DECISION.md](DECISION.md), [ASSUMPTIONS-AND-VERIFICATION.md](ASSUMPTIONS-AND-VERIFICATION.md) |
| Use of AI in research, with my own judgment shown | DECISION.md, section "How AI was used, and where I overruled it" |
| A Change & Culture Plan | [CHANGE-AND-CULTURE-PLAN.md](CHANGE-AND-CULTURE-PLAN.md) |
| Asking what source material exists | [00-source-material-request.md](00-source-material-request.md), drafted before any design work |

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
  src/stressTest.ts         the force-unify comparison
  src/diff.ts               annual update: holiday moves, rule changes, seniority crossings, HR tasks
  src/data/                 30 fictional employees plus a scenario (today = 2 Oct 2026)
  test/                     102 tests
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

## Known limits of this prototype

- **Calendar leave years only.** UK and FR employers often use other leave years; the validator rejects them rather than guessing.
- **Not modelled:** collective agreements, contractual days above the statutory minimum, irregular-hours workers, long-term-sickness carry-over (15 to 18 months) and FMLA.
- **Placeholder US holidays.** The US holiday calendar stands in for Groupon's real one.
- **A demo, not a product.** State lives in the browser and resets with **Reset demo**. There is no authentication, persistence or real HRIS integration.
