import { defineConfig, devices } from '@playwright/experimental-ct-react';
import { config } from 'dotenv';

config({ path: '.env.development' });

// TODO: Cant use MSW for playwright-ct because service workers are not supported :(
// https://github.com/microsoft/playwright/issues/20659
// Have to mock network instead via playwright

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  // TODO: Hardcode it for now into one directoy because it clashes with the unit tests.
  testDir: './app/components/tests',
  /* The base directory, relative to the config file, for snapshot files created with toMatchSnapshot and toHaveScreenshot. */
  snapshotDir: './__snapshots__',
  /* Maximum time one test can run for. */
  timeout: 10 * 1000,
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  // reporter: process.env.CI ? [['html', { outputFolder: 'playwright-report-integration' }]] : [],
  reporter: [['html', { outputFolder: 'playwright-report-integration' }]],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    // headless: false,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Port to use for Playwright component endpoint. */
    ctPort: 3100,
    timezoneId: 'Europe/London',
    // headless: false,

    viewport: {
      height: 1000,
      width: 500,
    },
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // TODO: Add again later
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // TODO: Just ignoring it for now because Mint doesnt have the deps. Let samP make the screenshots.
    // TODO: Can run it locally on darwin but not on CI since snapshots are missing.
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
});
