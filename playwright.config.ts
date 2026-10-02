import { defineConfig, devices } from '@playwright/test';

// End-to-end checks of the web app: `npm run test:e2e` (starts the dev server itself).
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5174', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'npm -w apps/web run dev -- --port 5174 --strictPort', url: 'http://localhost:5174', reuseExistingServer: false, timeout: 60_000 },
});
