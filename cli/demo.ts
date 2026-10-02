// npm run demo — the whole case in a terminal: one real request end to end, the edge cases, and why "unify everything" breaks.
import {
  annualEntitlement, annualUpdateImpact, approveRequest, getPack, buildLedger, employeeById, employees, runStressTest, scenario, submitRequest,
  type Employee, type Inputs, type LedgerEvent, type PipelineResult,
} from '../packages/engine/src/index';

const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code: string) => (s: string | number) => (tty ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const bold = c('1'), dim = c('2'), red = c('31'), green = c('32'), amber = c('33'), blue = c('34'), cyan = c('36');
const W = Math.min(process.stdout.columns || 100, 110);
const rule = (ch = '─') => dim(ch.repeat(W));
const fmt = (n: number) => (Math.round(n * 100) / 100).toString();
const badge = (v: string) => (v === 'public-verified' ? green('● verified') : v === 'public-unverified' ? amber('◐ unverified') : blue('○ assumption'));

function h1(n: number, title: string, sub: string) {
  console.log('\n' + rule('━'));
  console.log(bold(` ${n}. ${title}`));
  console.log(dim(` ${sub}`));
  console.log(rule('━'));
}

function stages(r: PipelineResult) {
  for (const s of r.stages) {
    const icon = s.status === 'ok' ? green('✔') : s.status === 'warn' ? amber('▲') : red('✖');
    console.log(` ${icon} ${bold(s.label.padEnd(22))} ${s.detail}`);
    for (const x of s.rules.slice(0, 2)) console.log(`   ${dim('↳')} ${dim(wrap(x.citation, W - 22, '     '))} ${badge(x.verification)}`);
  }
}

function wrap(text: string, width: number, indent: string): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > width) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  return lines.join('\n' + indent);
}

function receipt(events: LedgerEvent[], title: string) {
  console.log(`\n ${bold(title)}`);
  console.log(dim(' ' + '┄'.repeat(W - 2)));
  for (const ev of events) {
    const amt = ev.amount === 0 ? dim('   ·  ') : ev.amount > 0 ? green(('+' + fmt(ev.amount)).padStart(6)) : red(fmt(ev.amount).padStart(6));
    const tag = ev.type.padEnd(14);
    const ind = ' '.repeat(41);
    console.log(` ${dim(ev.date)}  ${cyan(tag)} ${amt} ${dim(ev.unit.padEnd(5))} ${wrap(ev.explanation, W - 42, ind)}`);
    console.log(`${ind}${dim('§ ' + wrap(ev.rule.citation, W - 46, ind + '  '))} ${badge(ev.rule.verification)}`);
  }
}

const today = scenario.today;
let inputs: Inputs = structuredClone(scenario.inputs);
const lena = employeeById('de-lena')!;

console.log('\n' + bold(' GLOBAL SPINE · LOCAL RULE PACKS') + dim('  — absence management for Groupon\'s legal entities'));
console.log(dim(` Scenario date ${today}. All people are fictional. Rules are cited; badges show what is verified vs assumed.`));

// 1 ──────────────────────────────────────────────────────────────
h1(1, 'The pilot: Groupon GmbH (Berlin) — one request, end to end',
  `${lena.name} (${lena.title}) asks for 21 Dec 2026 → 8 Jan 2027. Same nine stages run in every entity; only the rule pack differs.`);
const res = submitRequest(lena, { employeeId: lena.id, from: '2026-12-21', to: '2027-01-08', kind: 'annual', submittedOn: today }, inputs, today);
stages(res);
console.log(`\n Payroll export (common format, every entity):`);
for (const p of res.payroll) console.log(`   ${dim(JSON.stringify(p))}`);
const approved = approveRequest(res);
inputs = { ...inputs, requests: [...inputs.requests, approved] };
console.log(`\n ${green('Approved')} by ${res.approverId}. Posted to the ledger.`);

// 2 ──────────────────────────────────────────────────────────────
h1(2, 'Edge case: she falls sick on 29–30 December',
  'German law (BUrlG §9): certified sick days during leave are not leave. A "one global rule" system keeps them consumed.');
inputs = { ...inputs, sickness: [...inputs.sickness, { id: 's-lena', employeeId: lena.id, from: '2026-12-29', to: '2026-12-30', certified: true }] };
const led = buildLedger(lena, inputs, '2027-04-30', { today });
receipt(led.events, `Balance receipt — ${lena.name}, every line traceable to a rule`);
const feb = buildLedger(lena, inputs, '2027-02-01', { today });
const noCert = buildLedger(lena, { ...inputs, sickness: inputs.sickness.map((s) => (s.id === 's-lena' ? { ...s, certified: false } : s)) }, '2027-02-01', { today });
console.log(`\n ${bold('Balance on 1 Feb 2027:')} ${green(fmt(feb.balances.annual.available) + ' days')} with the certificate · ${amber(fmt(noCert.balances.annual.available) + ' days')} without one — and that receipt says why.`);
console.log(dim(` By 30 Apr: ${fmt(led.balances.annual.available)} days — she was warned in writing, so 2026 leftovers (incl. the restored days) lapse on 31 Mar.`));

// 3 ──────────────────────────────────────────────────────────────
h1(3, 'Edge case: the 31 March lapse that isn\'t',
  'Two colleagues, identical leftover leave from 2025. Only one was warned in writing. CJEU C-684/16 decides the rest.');
for (const id of ['de-felix', 'de-sophie']) {
  const e = employeeById(id)!;
  const l = buildLedger(e, inputs, '2026-04-30', { today });
  const ev = l.events.find((x) => (x.type === 'EXPIRE' || x.type === 'EXPIRY_BLOCKED') && x.date === '2026-03-31');
  console.log(` ${bold(e.name.padEnd(16))} ${ev?.type === 'EXPIRE' ? red('EXPIRED ') : amber('BLOCKED ')} ${ev?.explanation}`);
}
console.log(dim(' Migration finding: the legacy system holds no warning letters → every German carry-over balance survives until notices exist.'));

// 4 ──────────────────────────────────────────────────────────────
h1(4, 'Edge case: Poland counts your degree, not your tenure',
  'Kodeks pracy art. 155: years of education count toward seniority. A tenure-based global rule underpays graduates on day one.');
for (const id of ['pl-kasia', 'pl-marta']) {
  const e = employeeById(id)!;
  const ent = annualEntitlement(e, getPack('PL', 2026), 'annual', 2026);
  const g = buildLedger(e, inputs, '2026-12-31', { today }).events.find((x) => x.type === 'GRANT')!;
  console.log(` ${bold(e.name.padEnd(22))} ${wrap(ent.explanation, W - 26, ' '.repeat(24))}`);
  console.log(` ${' '.repeat(22)} ${dim(wrap('→ ledger: ' + g.explanation, W - 26, ' '.repeat(24)))}`);
}
console.log(dim(' Marta is half-time on 4-hour days: 13 leave-days × 8h = 104h = 26 of her own days off (art. 154²) — counting in "days" alone would halve it.'));

// 5 ──────────────────────────────────────────────────────────────
h1(5, 'Edge case: Chicago — where you sit decides the law',
  'Chicago Ord. 6-130 gives two hour-banks with different rules; Illinois PLAWA covers the rest of the state.');
for (const id of ['us-maya', 'us-ana', 'us-derek', 'us-sam']) {
  const e = employeeById(id)!;
  const r = submitRequest(e, { employeeId: e.id, from: '2026-10-12', to: '2026-10-12', kind: 'annual', submittedOn: today }, inputs, today);
  const verdict = r.ok ? green('OK  ') : red(r.error!.code);
  console.log(` ${bold(e.name.padEnd(16))} ${verdict} ${dim(r.ok ? r.stages.find((s) => s.id === 'balance')!.detail : r.error!.message)}`);
}
const derek = buildLedger(employeeById('us-derek')!, inputs, '2026-12-31', { today });
for (const ev of derek.events.filter((x) => x.date === '2026-11-30' && x.amount < 0)) console.log(`   ${cyan(ev.type.padEnd(7))} ${ev.bucket.padEnd(11)} ${fmt(ev.amount)} h  ${dim(ev.explanation)}`);

// 6 ──────────────────────────────────────────────────────────────
h1(6, 'Force-unify: run one global policy against all 30 people',
  'Policy: ' + runStressTest(employees, inputs).policy.description.join(' · '));
const st = runStressTest(employees, inputs);
console.log(` ${red(bold(st.summary.breaches + ' statutory breaches'))} affecting ${bold(st.summary.employeesAffected)} of ${employees.length} people · ${amber(st.summary.overspendDays + ' days')} of part-timer overspend · ${blue(st.summary.reviews + ' need legal review')}\n`);
console.log(dim(' Entity     People  Breaches  Overspend(d)'));
for (const [ent, v] of Object.entries(st.summary.byEntity))
  console.log(` ${ent.padEnd(10)} ${String(v.employees).padStart(6)}  ${(v.breaches ? red : green)(String(v.breaches).padStart(8))}  ${String(v.overspend).padStart(12)}`);
console.log('\n ' + bold('Examples:'));
for (const [id, dimn] of [['pl-kasia', 'seniority'], ['de-sophie', 'carry-over'], ['ie-cian', 'holidays'], ['de-jonas', 'entitlement']] as const) {
  const r = st.rows.find((x) => x.employeeId === id && x.dimension === dimn)!;
  const e = employeeById(id) as Employee;
  console.log(` ${(r.verdict === 'breach' ? red : amber)(r.verdict.toUpperCase().padEnd(9))} ${bold(e.name.padEnd(18))} ${dimn.padEnd(12)} global: ${r.global}  ·  law: ${r.local}`);
}

// 7 ──────────────────────────────────────────────────────────────
h1(7, 'Annual update: rolling every pack from 2026 to 2027',
  'Holidays move, seniority thresholds are crossed, calendars may not be published yet. See the impact before anything goes live.');
for (const id of ['DE-BE', 'PL', 'IE', 'UK', 'ES-MD', 'US-CHI']) {
  const imp = annualUpdateImpact(id, 2026, 2027, employees, inputs);
  const state = imp.diff.blocked ? red('BLOCKED') : amber('PENDING SIGN-OFF');
  console.log(` ${bold(id.padEnd(7))} ${state.padEnd(20)} ${imp.diff.moved.length} holidays moved, ${imp.diff.added.length} added, ${imp.diff.ruleChanges.length} rule changes, ${imp.seniorityCrossings.length} seniority crossings, ${imp.tasks.length} HR tasks`);
  if (imp.diff.blocked) console.log(`         ${dim(imp.diff.reason!)}`);
  for (const r of imp.affectedRequests.filter((x) => x.status === 'blocked')) console.log(`         ${red('↳')} request ${r.requestId} (${r.from} → ${r.to}) cannot be processed: ${dim(r.reason!.slice(0, 90))}`);
  for (const s of imp.seniorityCrossings) console.log(`         ${green('↳')} ${employeeById(s.employeeId)!.name} reaches 10 years on ${s.date}: ${s.from} → ${s.to} days`);
}

console.log('\n' + rule('━'));
console.log(` ${bold('Next:')} ${cyan('npm run dev')} for the interactive desk · ${cyan('npm test')} for ${dim('the rule-by-rule test suite')} · DECISION.md · CHANGE-AND-CULTURE-PLAN.md`);
console.log(rule('━') + '\n');
