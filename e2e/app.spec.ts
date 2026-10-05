import { test, expect, type Page } from '@playwright/test';

// Fail any test that logs a console error or throws in the page.
test.beforeEach(async ({ page }) => {
  const problems: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(e.message));
  (page as any).__problems = problems;
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
});
test.afterEach(async ({ page }) => expect((page as any).__problems).toEqual([]));

const nav = (page: Page, name: string) => page.getByRole('navigation', { name: 'Sections' }).getByRole('button', { name }).click();

test('overview states the decision and the force-unify result', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Unify the process and the record. Keep the law local.');
  await expect(page.getByText(/breaks local law 66 times/)).toBeVisible();
});

test('Berlin pilot: nine stages, approval, then certified sickness restores 2 days (BUrlG §9)', async ({ page }) => {
  await page.getByRole('button', { name: 'Run the Berlin example' }).click();
  await expect(page.locator('.rail-step.ok, .rail-step.warn')).toHaveCount(9);
  await expect(page.getByText('Charged to 2026 leave')).toBeVisible();
  await expect(page.getByText('Charged to 2027 leave')).toBeVisible();
  await page.getByRole('button', { name: 'Approve as line manager' }).click();
  await expect(page.getByLabel('Sick from')).toHaveValue('2026-12-29'); // prefilled for the pilot story
  await page.locator('aside .receipt').getByRole('button', { name: 'Report sickness' }).click();
  await expect(page.getByText(/Certified sickness 2026-12-29 → 2026-12-30 during leave: 2 days/)).toBeVisible();
  await expect(page.getByText('20 to 22 days')).toBeVisible();
  // Withdrawing the certificate replaces the report and the ledger explains why nothing comes back.
  await page.getByLabel('Medical certificate provided').uncheck();
  await page.locator('aside .receipt').getByRole('button', { name: 'Update sickness report' }).click();
  await expect(page.getByText(/no medical certificate provided/)).toBeVisible();
  await expect(page.getByText(/Certified sickness 2026-12-29/)).toHaveCount(0);
});

test('a second booking over approved leave is refused as an overlap', async ({ page }) => {
  await page.getByRole('button', { name: 'Run the Berlin example' }).click();
  await page.getByRole('button', { name: 'Approve as line manager' }).click();
  await page.getByRole('button', { name: /^21 Dec 2026/ }).click();
  await page.getByRole('button', { name: /^23 Dec 2026/ }).click();
  await page.getByRole('button', { name: 'Check request' }).click();
  await expect(page.getByText('Overlaps the approved request 21 Dec 2026 to 8 Jan 2027.').last()).toBeVisible();
});

test('Madrid 2027: the decree published on 1 Oct 2026 is loaded, so Carmen\'s pending January request now processes', async ({ page }) => {
  await nav(page, 'Request desk');
  await page.getByRole('button', { name: /Carmen López/ }).click();
  await page.getByRole('button', { name: 'Process' }).click();
  await expect(page.getByText('Ready for approval')).toBeVisible();
  await expect(page.getByText('Charged to 2027 leave')).toBeVisible();
});

test('withdrawing approved leave keeps it in the audit trail and drops its sickness report', async ({ page }) => {
  await page.getByRole('button', { name: 'Run the Berlin example' }).click();
  await page.getByRole('button', { name: 'Approve as line manager' }).click();
  await page.locator('aside .receipt').getByRole('button', { name: 'Report sickness' }).click();
  await page.getByRole('row', { name: /21 Dec 2026 to 8 Jan 2027/ }).getByRole('button', { name: 'Withdraw' }).click();
  await page.getByRole('button', { name: 'Confirm withdraw' }).click();
  await expect(page.getByRole('cell', { name: 'withdrawn' })).toBeVisible();
  await page.getByRole('button', { name: /^21 Dec 2026/ }).click();
  await page.getByRole('button', { name: /^8 Jan 2027/ }).click();
  await page.getByRole('button', { name: 'Check request' }).click();
  await expect(page.locator('.rail-step.ok, .rail-step.warn')).toHaveCount(9);
  await expect(page.getByText(/BUrlG §9/)).toHaveCount(0);
});

test('US: Springfield is processed under Illinois PLAWA, Dallas under flexible PTO, Prague in hours', async ({ page }) => {
  await nav(page, 'Request desk');
  await page.getByRole('button', { name: /Sam Patel/ }).click();
  await expect(page.getByText(/Illinois paid leave/).first()).toBeVisible();
  await page.getByRole('button', { name: /Marcus Lee/ }).click();
  await expect(page.getByText('Unlimited').first()).toBeVisible();
  await page.getByRole('button', { name: /Tereza Dvořáková/ }).click();
  await expect(page.getByText(/160\s*hours|160 hours/).first()).toBeVisible();
});

test('force-unify matrix explains the Polish seniority breach with its statute', async ({ page }) => {
  await nav(page, 'Force-unify');
  await page.getByRole('button', { name: /PL, Seniority/ }).click();
  const kasia = page.locator('.panel-flat', { hasText: 'Katarzyna Nowak' });
  await expect(kasia.getByText('Breaks local law')).toBeVisible();
  await expect(kasia.getByText(/art\. 155/)).toBeVisible();
});

test('ledger: German lapse is blocked without a written warning, and replays when one is ticked', async ({ page }) => {
  await nav(page, 'Ledger');
  await page.getByRole('button', { name: /Sophie Krüger/ }).click();
  await expect(page.getByText('Lapse blocked').first()).toBeVisible();
  await page.getByLabel(/Warning sent for 2025 leave/).check();
  await expect(page.getByText(/lapse — employee was warned/).first()).toBeVisible();
});

test('rule packs: a live correction shows who it affects, and an invalid one is refused', async ({ page }) => {
  await nav(page, 'Rule packs');
  await page.getByRole('group', { name: 'Entity' }).getByRole('button', { name: 'UK' }).click();
  await page.getByLabel('public holidays count toward leave').selectOption('false');
  await expect(page.getByRole('heading', { name: 'Who this changes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Hannah Clarke' })).toBeVisible();
  await page.getByRole('button', { name: 'Discard correction' }).click();
  const expiry = page.getByLabel('Additional leave: carried leave expires (MM-DD)');
  await expiry.fill('13-45');
  await expiry.blur();
  await expect(page.getByRole('alert')).toContainText('use a real date as MM-DD');
});

test('annual update shows the Madrid 2027 decree and the Polish seniority step', async ({ page }) => {
  await nav(page, 'Annual update');
  await expect(page.getByText(/Piotr Wiśniewski/).first()).toBeVisible();
  await page.getByRole('button', { name: /ES-MD/ }).click();
  await expect(page.getByText('San José').first()).toBeVisible();
});

test('docs render inside the app', async ({ page }) => {
  await nav(page, 'Decision & plan');
  await expect(page.getByRole('heading', { name: /Decision: unify the process and the record/ })).toBeVisible();
  await page.getByRole('button', { name: 'Change and culture plan' }).click();
  await expect(page.getByRole('heading', { name: /honestly/ }).first()).toBeVisible();
});

test('every view fits a 400px phone without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 860 });
  for (const name of ['Overview', 'Request desk', 'Ledger', 'HR queue', 'Force-unify', 'Rule packs', 'Annual update', 'Decision & plan']) {
    await nav(page, name);
    const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(sw, name).toBeLessThanOrEqual(cw);
  }
});

test('Chicago unlimited-PTO option: switching the strategy applies the 40-hour separation floor', async ({ page }) => {
  await nav(page, 'Rule packs');
  await page.getByRole('group', { name: 'Entity' }).getByRole('button', { name: 'US-CHI' }).click();
  await page.getByLabel('Chicago Paid Leave: accrual method').selectOption('unlimited-with-floor');
  await expect(page.getByRole('heading', { name: 'Who this changes' })).toBeVisible();
  await nav(page, 'Ledger');
  await page.getByRole('button', { name: /Derek Thompson/ }).click();
  await expect(page.getByText(/unlimited PTO, so pay out 40 hours/)).toBeVisible();
});

test('guided tour walks all nine steps across the app', async ({ page }) => {
  await page.getByRole('button', { name: 'Take the 3-minute guided tour' }).click();
  const tour = page.getByRole('dialog', { name: 'Guided tour' });
  await expect(tour).toContainText('step 1 of 9');
  await tour.getByRole('button', { name: /^Next/ }).click();
  await expect(page.locator('.rail-step.ok, .rail-step.warn')).toHaveCount(9);
  for (let i = 3; i <= 9; i++) {
    await tour.getByRole('button', { name: /^Next/ }).click();
    await expect(tour).toContainText(`step ${i} of 9`);
  }
  await expect(page.getByRole('heading', { name: /Decision: unify the process and the record/ })).toBeVisible();
  await tour.getByRole('button', { name: 'Finish the tour' }).click();
  await expect(tour).toHaveCount(0);
});

test('tour lands on the HR queue, on Sophie, and on the Madrid 2027 update', async ({ page }) => {
  await page.getByRole('button', { name: 'Take the 3-minute guided tour' }).click();
  const tour = page.getByRole('dialog', { name: 'Guided tour' });
  for (let i = 0; i < 3; i++) await tour.getByRole('button', { name: /^Next/ }).click();
  await expect(page.getByRole('heading', { name: 'HR work queue' })).toBeVisible();
  await tour.getByRole('button', { name: /^Next/ }).click();
  await expect(page.getByText('Lapse blocked').first()).toBeVisible();
  for (let i = 0; i < 3; i++) await tour.getByRole('button', { name: /^Next/ }).click();
  await expect(page.getByText('San José').first()).toBeVisible();
});

test('pages have their own URL: reload and Back keep the reviewer in place', async ({ page }) => {
  await nav(page, 'Ledger');
  await page.getByRole('button', { name: /Sophie Krüger/ }).click();
  await expect(page).toHaveURL(/#\/ledger\/de-sophie$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ledger' })).toBeVisible();
  await expect(page.locator('.person[aria-pressed="true"]')).toContainText('Sophie Krüger');
  await nav(page, 'Rule packs');
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Ledger' })).toBeVisible();
});

test('policy simulator: presets move from 66 breaches to 9 to zero, with the cost shown', async ({ page }) => {
  await nav(page, 'Force-unify');
  await expect(page.getByText(/breaks local law 66 times/)).toBeVisible();
  await page.getByRole('group', { name: 'Policy presets' }).getByRole('button', { name: 'Generous global policy' }).click();
  await expect(page.getByText(/breaks local law 9 times/)).toBeVisible();
  await page.getByRole('group', { name: 'Policy presets' }).getByRole('button', { name: 'Zero-breach policy' }).click();
  await expect(page.getByText(/Zero breaches, but only because/)).toBeVisible();
  await expect(page.getByText(/days a year above the legal minimum/)).toBeVisible();
  await page.getByLabel('Days a year').fill('20');
  await expect(page.getByText(/breaks local law \d+ times/)).toBeVisible();
});

test('Back to the Overview re-renders it (hash routing)', async ({ page }) => {
  await nav(page, 'Ledger');
  await page.goBack();
  await expect(page).toHaveURL(/#\/overview$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Unify the process and the record. Keep the law local.');
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Ledger' })).toBeVisible();
});

test('simulator "Days a year" can be typed into freely', async ({ page }) => {
  await nav(page, 'Force-unify');
  const f = page.getByLabel('Days a year (15–40)');
  await f.click();
  await f.press('ControlOrMeta+a');
  await f.pressSequentially('27');
  await f.blur();
  await expect(f).toHaveValue('27');
  await expect(page.getByText(/27 working days for everyone/)).toBeVisible();
});

test('the example can be replayed: if already booked, the desk shows the booking instead of a refusal', async ({ page }) => {
  await page.getByRole('button', { name: 'Run the Berlin example' }).click();
  await page.getByRole('button', { name: 'Approve as line manager' }).click();
  await nav(page, 'Overview');
  await page.getByRole('button', { name: 'Run the Berlin example' }).click();
  await expect(page.getByText(/Already booked in this demo/)).toBeVisible();
  await expect(page.getByText('Refused')).toHaveCount(0);
  await expect(page.getByLabel('Sick from')).toHaveValue('2026-12-29');
});

test('tour step 3 can approve and report the sickness for the reviewer', async ({ page }) => {
  await page.getByRole('button', { name: 'Take the 3-minute guided tour' }).click();
  const tour = page.getByRole('dialog', { name: 'Guided tour' });
  await tour.getByRole('button', { name: /^Next/ }).click();
  await tour.getByRole('button', { name: /^Next/ }).click();
  await tour.getByRole('button', { name: 'Approve and report the sickness for me' }).click();
  await expect(page.getByText(/Certified sickness 2026-12-29 → 2026-12-30 during leave: 2 days/)).toBeVisible();
  await expect(page.getByText('20 to 22 days')).toBeVisible();
});

test('opening a shared link lands on that page without a stray history entry', async ({ page }) => {
  await page.goto('/#/ledger/de-sophie');
  await expect(page.getByRole('heading', { name: 'Ledger' })).toBeVisible();
  await expect(page.locator('.person[aria-pressed="true"]')).toContainText('Sophie Krüger');
  await nav(page, 'Rule packs');
  await page.goBack();
  await expect(page).toHaveURL(/#\/ledger\/de-sophie$/);
});

test('stale demo state saved by an older version of the app is discarded', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('spine-state-v1', JSON.stringify({ inputs: { requests: [], sickness: [], notices: [] }, overrides: [], employeeId: 'de-lena', rev: 0 })));
  await page.goto('/#/queue');
  await page.reload(); // a hash-only navigation doesn't restart the app
  await expect(page.locator('.tile-v').nth(2)).toHaveText('4');
  expect(await page.evaluate(() => localStorage.getItem('spine-state-v1'))).toBeNull();
});
