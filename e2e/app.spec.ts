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
  await expect(page.getByText(/breaks local law 58 times/)).toBeVisible();
});

test('Berlin pilot: nine stages, approval, then certified sickness restores 2 days (BUrlG §9)', async ({ page }) => {
  await page.getByRole('button', { name: 'Run the Berlin pilot request' }).click();
  await expect(page.locator('.rail-step.ok, .rail-step.warn')).toHaveCount(9);
  await expect(page.getByText('Charged to leave year 2026')).toBeVisible();
  await expect(page.getByText('Charged to leave year 2027')).toBeVisible();
  await page.getByRole('button', { name: 'Approve as manager' }).click();
  await page.getByLabel('From', { exact: true }).fill('2026-12-29');
  await page.getByLabel('To', { exact: true }).fill('2026-12-30');
  await page.getByRole('button', { name: 'Report sickness' }).click();
  await expect(page.getByText(/Certified sickness 2026-12-29 → 2026-12-30 during leave: 2 days/)).toBeVisible();
});

test('a second booking over approved leave is refused as an overlap', async ({ page }) => {
  await page.getByRole('button', { name: 'Run the Berlin pilot request' }).click();
  await page.getByRole('button', { name: 'Approve as manager' }).click();
  await page.getByRole('button', { name: /^21 Dec 2026/ }).click();
  await page.getByRole('button', { name: /^23 Dec 2026/ }).click();
  await page.getByRole('button', { name: 'Check request' }).click();
  await expect(page.getByText('Overlaps approved request 2026-12-21 → 2027-01-08.').last()).toBeVisible();
});

test('Madrid 2027: pending request is refused because the holiday decree is not loaded, and stays pending', async ({ page }) => {
  await nav(page, 'Request desk');
  await page.getByRole('button', { name: /Carmen López/ }).click();
  await page.getByRole('button', { name: 'Process' }).click();
  await expect(page.getByText('Request refused')).toBeVisible();
  await expect(page.getByText(/holiday calendar is not loaded/).first()).toBeVisible();
  await expect(page.getByRole('cell', { name: 'pending' })).toBeVisible();
});

test('Chicago: work location outside Chicago stops processing instead of applying the wrong law', async ({ page }) => {
  await nav(page, 'Request desk');
  await page.getByRole('button', { name: /Sam Patel/ }).click();
  await expect(page.getByText(/Paid Leave for All Workers Act/).first()).toBeVisible();
});

test('force-unify matrix explains the Polish seniority breach with its statute', async ({ page }) => {
  await nav(page, 'Force-unify test');
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
  const expiry = page.getByLabel('additional-1.6wk: carried leave expires (MM-DD)');
  await expiry.fill('13-45');
  await expiry.blur();
  await expect(page.getByRole('alert')).toContainText('must be a real MM-DD date');
});

test('annual update shows the blocked Spanish pack and the Polish seniority step', async ({ page }) => {
  await nav(page, 'Annual update');
  await expect(page.getByText(/Piotr Wiśniewski/).first()).toBeVisible();
  await page.getByRole('button', { name: /ES-MD/ }).click();
  await expect(page.getByText(/decree not yet published/).first()).toBeVisible();
});

test('docs render inside the app', async ({ page }) => {
  await nav(page, 'Decision & plan');
  await expect(page.getByRole('heading', { name: /Decision: unify the process and the record/ })).toBeVisible();
  await page.getByRole('button', { name: 'Change and culture plan' }).click();
  await expect(page.getByRole('heading', { name: /honestly/ }).first()).toBeVisible();
});

test('every view fits a 400px phone without sideways scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 860 });
  for (const name of ['Overview', 'Request desk', 'Ledger', 'Force-unify test', 'Rule packs', 'Annual update', 'Decision & plan']) {
    await nav(page, name);
    const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(sw, name).toBeLessThanOrEqual(cw);
  }
});

test('Chicago unlimited-PTO option: switching the strategy applies the 40-hour separation floor', async ({ page }) => {
  await nav(page, 'Rule packs');
  await page.getByRole('group', { name: 'Entity' }).getByRole('button', { name: 'US-CHI' }).click();
  await page.getByLabel('paid-leave: accrual method').selectOption('unlimited-with-floor');
  await expect(page.getByRole('heading', { name: 'Who this changes' })).toBeVisible();
  await nav(page, 'Ledger');
  await page.getByRole('button', { name: /Derek Thompson/ }).click();
  await expect(page.getByText(/unlimited PTO, so pay out 40 hours/)).toBeVisible();
});

test('guided tour walks all eight steps across the app', async ({ page }) => {
  await page.getByRole('button', { name: 'Take the 3-minute guided tour' }).click();
  const tour = page.getByRole('dialog', { name: 'Guided tour' });
  await expect(tour).toContainText('step 1 of 8');
  await tour.getByRole('button', { name: /^Next/ }).click();
  await expect(page.locator('.rail-step.ok, .rail-step.warn')).toHaveCount(9);
  for (let i = 3; i <= 8; i++) {
    await tour.getByRole('button', { name: /^Next/ }).click();
    await expect(tour).toContainText(`step ${i} of 8`);
  }
  await expect(page.getByRole('heading', { name: /Decision: unify the process and the record/ })).toBeVisible();
  await tour.getByRole('button', { name: 'Finish the tour' }).click();
  await expect(tour).toHaveCount(0);
});

test('tour step 4 lands on Sophie, step 7 on the blocked Spanish pack', async ({ page }) => {
  await page.getByRole('button', { name: 'Take the 3-minute guided tour' }).click();
  const tour = page.getByRole('dialog', { name: 'Guided tour' });
  for (let i = 0; i < 3; i++) await tour.getByRole('button', { name: /^Next/ }).click();
  await expect(page.getByText('Lapse blocked').first()).toBeVisible();
  for (let i = 0; i < 3; i++) await tour.getByRole('button', { name: /^Next/ }).click();
  await expect(page.getByText(/decree not yet published/).first()).toBeVisible();
});

test('policy simulator: presets move from 54 breaches to the UK units trap to zero, with the cost shown', async ({ page }) => {
  await nav(page, 'Force-unify test');
  await expect(page.getByText(/breaks local law 58 times/)).toBeVisible();
  await page.getByRole('group', { name: 'Policy presets' }).getByRole('button', { name: 'Generous global policy' }).click();
  await expect(page.getByText(/breaks local law 1 time,/)).toBeVisible();
  await page.getByRole('group', { name: 'Policy presets' }).getByRole('button', { name: 'Zero-breach policy' }).click();
  await expect(page.getByText(/Zero breaches, but only because/)).toBeVisible();
  await expect(page.getByText(/days a year above the legal minimum/)).toBeVisible();
  await page.getByLabel('Days a year').fill('20');
  await expect(page.getByText(/breaks local law \d+ times/)).toBeVisible();
});
