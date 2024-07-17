import { expect, test } from '@playwright/experimental-ct-react';
import { SetupServer } from 'msw/node';
import CollSurplus from '../Features/Collateral/CollSurplus';
import { integrationSuiteSetup, integrationTestSetup } from './integration-test.setup';
import { IntegrationWrapper } from './test-utils';
let server: SetupServer;

test.beforeAll(() => {
  server = integrationSuiteSetup();
});

test.beforeEach(async ({ page }) => {
  await integrationTestSetup(page);
});

test.afterEach(() => {
  server.resetHandlers();
});

test.afterAll(() => {
  server.close();
});

test.describe('CollSurplus', () => {
  test('should render CollSurplus with mocked data', async ({ mount, page }) => {
    const component = await mount(
      <IntegrationWrapper shouldPreselectTokens shouldConnectWallet>
        <CollSurplus />
      </IntegrationWrapper>,
    );

    await expect(component).toHaveScreenshot();
  });

  test('should show tooltip when hovered', async ({ mount, page }) => {
    await mount(
      <IntegrationWrapper shouldPreselectTokens shouldConnectWallet>
        <CollSurplus />
      </IntegrationWrapper>,
    );

    const button = await page.waitForSelector('button:has-text("Claim Collateral Surplus")');
    // Hover to show tooltip
    await button.hover();

    // wait for tooltip to appear
    const tooltip = await page.waitForSelector('div[role="tooltip"]');
    expect(tooltip).toBeDefined();
    await expect(page.getByRole('tooltip')).toHaveText('Your trove got liquidated! Claim your collateral surplus.');
  });

  test('should not show the button if there is no surplus collateral', async ({ mount, page }) => {
    await mount(
      <IntegrationWrapper
        shouldPreselectTokens
        shouldConnectWallet
        mockedContractData={{ CollateralTokenMeta_collSurplusAmount: 0n }}
      >
        <CollSurplus />
      </IntegrationWrapper>,
    );

    const buttons = page.locator('button');
    await expect(buttons).toHaveCount(0);
  });
});
