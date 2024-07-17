import { expect, test } from '@playwright/experimental-ct-react';
import { SetupServer } from 'msw/node';
import TreasuryTable from '../Features/ReservePool/TreasuryTable';
import { integrationSuiteSetup, integrationTestSetup } from './integration-test.setup';
import MockedDebtTokensWithoutBorrower from './mockedResponses/GetDebtTokens.mocked.json';
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

test.describe('TreasuryTable', () => {
  test('should render TreasuryTable with mocked data', async ({ mount, page }) => {
    // We need to mock the exact same data to generate the exact same snapshot
    await page.route('http://localhost:8000/subgraphs/name/subgraph', async (route) => {
      if (JSON.parse(route.request().postData()!).operationName === 'GetDebtTokens') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(MockedDebtTokensWithoutBorrower),
        });
      } else {
        return route.abort();
      }
    });

    const component = await mount(
      <IntegrationWrapper>
        <TreasuryTable />
      </IntegrationWrapper>,
    );

    await page.waitForSelector('[data-testid="apollon-treasury-table"]', {
      state: 'visible',
    });

    await expect(component).toHaveScreenshot();
  });
});
