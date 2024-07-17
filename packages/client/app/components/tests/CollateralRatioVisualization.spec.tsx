import { expect, test } from '@playwright/experimental-ct-react';
import { SetupServer } from 'msw/node';
import CollateralRatioVisualization from '../Visualizations/CollateralRatioVisualization';
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

// TODO: Write test for error message on filling max input (dirty => error message disappear)

test.describe('CollateralRatioVisualization', () => {
  test('should render CollateralRatioVisualization with mocked data', async ({ mount, page }) => {
    // We need to mock the exact same data to generate the exact same snapshot
    await page.route('http://localhost:8000/subgraphs/name/subgraph', async (route) => {
      if (JSON.parse(route.request().postData()!).operationName === 'GetBorrowerCollateralTokens') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(MockedBorrowerCollateralTokens),
        });
      } else if (JSON.parse(route.request().postData()!).operationName === 'GetBorrowerDebtTokens') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(MockedBorrowerDebtTokens),
        });
      } else {
        return route.abort();
      }
    });

    await mount(
      <IntegrationWrapper shouldConnectWallet>
        <CollateralRatioVisualization addedDebtUSD={1000} />
      </IntegrationWrapper>,
    );

    await page.waitForSelector('[data-testid="apollon-collateral-ratio-visualization"]', {
      state: 'visible',
    });

    await expect(page).toHaveScreenshot();
  });

  test('should show new collateral ratio when debt is added', async ({ mount, page }) => {
    // We need to mock the exact same data to generate the exact same snapshot
    await page.route('http://localhost:8000/subgraphs/name/subgraph', async (route) => {
      if (JSON.parse(route.request().postData()!).operationName === 'GetBorrowerCollateralTokens') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(MockedBorrowerCollateralTokens),
        });
      } else if (JSON.parse(route.request().postData()!).operationName === 'GetBorrowerDebtTokens') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(MockedBorrowerDebtTokens),
        });
      } else {
        return route.abort();
      }
    });

    await mount(
      <IntegrationWrapper shouldConnectWallet>
        <CollateralRatioVisualization addedDebtUSD={20} />
      </IntegrationWrapper>,
    );

    await page.waitForSelector('[data-testid="apollon-collateral-ratio-visualization"]', {
      state: 'visible',
    });

    const newPositionMarker = page.getByTestId('apollon-collateral-ratio-visualization-new-position');
    await expect(newPositionMarker).toBeVisible();
  });

  test.skip('should not show new position when added Deposit cancels Debt completely', async ({ mount, page }) => {
    // We need to mock the exact same data to generate the exact same snapshot
    await page.route('http://localhost:8000/subgraphs/name/subgraph', async (route) => {
      if (JSON.parse(route.request().postData()!).operationName === 'GetBorrowerCollateralTokens') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(MockedBorrowerCollateralTokens),
        });
      } else if (JSON.parse(route.request().postData()!).operationName === 'GetBorrowerDebtTokens') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(MockedBorrowerDebtTokens),
        });
      } else {
        return route.abort();
      }
    });

    await mount(
      <IntegrationWrapper shouldConnectWallet>
        <CollateralRatioVisualization
          addedCollateral={[
            {
              tokenAddress: MockedBorrowerCollateralTokens.data.collateralTokenMetas[0].token.address,
              amountUSD: 200000000,
            },
          ]}
        />
      </IntegrationWrapper>,
    );

    await page.waitForSelector('[data-testid="apollon-collateral-ratio-visualization"]', {
      state: 'visible',
    });

    const newPositionMarker = await page.$('[data-testid="apollon-collateral-ratio-visualization-new-position"]');
    expect(newPositionMarker).toBeNull();
  });

  test('should not show new position when no Debt is added', async ({ mount, page }) => {
    // We need to mock the exact same data to generate the exact same snapshot
    await page.route('http://localhost:8000/subgraphs/name/subgraph', async (route) => {
      if (JSON.parse(route.request().postData()!).operationName === 'GetBorrowerCollateralTokens') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(MockedBorrowerCollateralTokens),
        });
      } else if (JSON.parse(route.request().postData()!).operationName === 'GetBorrowerDebtTokens') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(MockedBorrowerDebtTokens),
        });
      } else {
        return route.abort();
      }
    });

    await mount(
      <IntegrationWrapper shouldConnectWallet>
        <CollateralRatioVisualization />
      </IntegrationWrapper>,
    );

    await page.waitForSelector('[data-testid="apollon-collateral-ratio-visualization"]', {
      state: 'visible',
    });

    const newPositionMarker = await page.$('[data-testid="apollon-collateral-ratio-visualization-new-position"]');
    expect(newPositionMarker).toBeNull();
  });

  test('should render CollateralRatioVisualization in network loading state', async ({ mount, page }) => {
    // never resolve the network request with data
    await page.route('http://localhost:8000/subgraphs/name/subgraph', async (route) => {
      return route.abort();
    });

    await mount(
      <IntegrationWrapper shouldConnectWallet>
        <CollateralRatioVisualization />
      </IntegrationWrapper>,
    );

    await expect(page).toHaveScreenshot();
  });

  test('should render CollateralRatioVisualization in loading state', async ({ mount, page }) => {
    await mount(
      <IntegrationWrapper shouldConnectWallet>
        <CollateralRatioVisualization loading />
      </IntegrationWrapper>,
    );

    const newPositionMarker = page.getByTestId('apollon-collateral-ratio-visualization-loader');
    await expect(newPositionMarker).toBeVisible();
  });
});
