import { expect, test } from '@playwright/experimental-ct-react';
import { SetupServer } from 'msw/node';
import StabilityPoolTable from '../Features/Stability/StabilityBalance/StabilityPoolTable';
import { integrationSuiteSetup, integrationTestSetup } from './integration-test.setup';
import MockedBorrowerCollateralTokens from './mockedResponses/GetBorrowerCollateralTokens.mocked.json';
import MockedBorrowerDebtTokens from './mockedResponses/GetBorrowerDebtTokens.mocked.json';
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

test.describe('StabilityPoolTable', () => {
  test('should render StabilityPoolTable with mocked data', async ({ mount, page }) => {
    // We need to mock the exact same data to generate the exact same snapshot
    await page.route('http://localhost:8000/subgraphs/name/subgraph', async (route) => {
      if (JSON.parse(route.request().postData()!).operationName === 'GetBorrowerCollateralTokens') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(MockedBorrowerCollateralTokens),
        });
      }
      if (JSON.parse(route.request().postData()!).operationName === 'GetBorrowerDebtTokens') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(MockedBorrowerDebtTokens),
        });
      } else {
        return route.abort();
      }
    });

    const component = await mount(
      <IntegrationWrapper shouldConnectWallet>
        <StabilityPoolTable />
      </IntegrationWrapper>,
    );

    await page.waitForSelector('[data-testid="apollon-stability-pool-table-lost-token"]', {
      state: 'visible',
    });

    await expect(component).toHaveScreenshot({ maxDiffPixelRatio: 0.01 });
  });

  test('should render StabilityPoolTable empty when not logged in', async ({ mount, page }) => {
    const component = await mount(
      <IntegrationWrapper>
        <StabilityPoolTable />
      </IntegrationWrapper>,
    );

    await page.waitForSelector('[data-testid="apollon-stability-pool-table"]', {
      state: 'visible',
    });

    await expect(component).toHaveScreenshot();
  });

  test.describe('Connected mode', () => {
    test('should have "Claim" button enabled when logged in', async ({ mount }) => {
      const component = await mount(
        <IntegrationWrapper shouldConnectWallet>
          <StabilityPoolTable />
        </IntegrationWrapper>,
      );

      const claimButton = component.getByRole('button', {
        name: 'Claim',
      });
      await expect(claimButton).toBeEnabled();
    });
  });

  test.describe('Guest mode', () => {
    test('should have "Claim" button disabled as guest', async ({ mount }) => {
      const component = await mount(
        <IntegrationWrapper>
          <StabilityPoolTable />
        </IntegrationWrapper>,
      );

      const claimButton = component.getByRole('button', {
        name: 'Claim',
      });
      await expect(claimButton).toBeDisabled();
    });
  });
});
