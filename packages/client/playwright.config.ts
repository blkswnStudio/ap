import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',

    viewport: {
      height: 1080,
      width: 1920,
    },
  },
  testDir: './e2e',
  testMatch: '*.e2e.ts',
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
  },
  reporter: [['html', { outputFolder: 'playwright-report-e2e' }]],
});
