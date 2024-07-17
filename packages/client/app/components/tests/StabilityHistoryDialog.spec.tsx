import { expect, test } from '@playwright/experimental-ct-react';
import { SetupServer } from 'msw/node';
import StabilityHistoryDialog from '../Features/Stability/StabilityHistoryDialog';
import { integrationSuiteSetup, integrationTestSetup } from './integration-test.setup';
import MockedBorrowerStabilityHistory from './mockedResponses/GetBorrowerStabilityHistory.json';
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

test.describe('StabilityHistoryDialog', () => {
  test('should render StabilityHistoryDialog with mocked data', async ({ mount, page }) => {
    // We need to mock the exact same data to generate the exact same snapshot
    await page.route('http://localhost:8000/subgraphs/name/subgraph', async (route) => {
      if (JSON.parse(route.request().postData()!).operationName === 'GetBorrowerStabilityHistory') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(MockedBorrowerStabilityHistory),
        });
      } else {
        return route.abort();
      }
    });

    await mount(
      <IntegrationWrapper shouldConnectWallet>
        <StabilityHistoryDialog />
      </IntegrationWrapper>,
    );

    const historyButton = page.getByRole('button', {
      name: 'History',
    });

    await historyButton.click();

    await page.waitForSelector('[data-testid="apollon-stability-history-dialog-history"]', {
      state: 'visible',
    });

    await expect(page).toHaveScreenshot();
  });

  test('should close StabilityHistoryDialog when clicking the close button', async ({ mount, page }) => {
    await mount(
      <IntegrationWrapper shouldConnectWallet>
        <StabilityHistoryDialog />
      </IntegrationWrapper>,
    );

    const historyButton = page.getByRole('button', {
      name: 'History',
    });

    await historyButton.click();

    await page.waitForSelector('[data-testid="apollon-stability-history-dialog-history"]', {
      state: 'visible',
    });

    const closeButton = (await page.$('button[aria-label="close stability history dialog"]'))!;
    await closeButton.click();

    await page.waitForSelector('[data-testid="apollon-stability-history-dialog-history"]', {
      state: 'detached',
    });
  });

  test('should close StabilityHistoryDialog when clicking the background', async ({ mount, page }) => {
    await mount(
      <IntegrationWrapper shouldConnectWallet>
        <StabilityHistoryDialog />
      </IntegrationWrapper>,
    );

    const historyButton = page.getByRole('button', {
      name: 'History',
    });

    await historyButton.click();

    await page.waitForSelector('[data-testid="apollon-stability-history-dialog-history"]', {
      state: 'visible',
    });

    const dialogBackground = page.getByTestId('apollon-stability-history-dialog-backdrop');

    // must click somewhere but the middle (where the actual dialog is) and bypass actionability because the background is aria-hidden
    await dialogBackground.click({ position: { x: 50, y: 50 }, force: true });

    await page.waitForSelector('[data-testid="apollon-stability-history-dialog-history"]', {
      state: 'detached',
    });
  });

  test.describe('Connected mode', () => {
    test('should have "History" button enabled when logged in', async ({ mount, page }) => {
      await mount(
        <IntegrationWrapper shouldConnectWallet>
          <StabilityHistoryDialog />
        </IntegrationWrapper>,
      );

      const historyButton = page.getByRole('button', {
        name: 'History',
      });
      await expect(historyButton).toBeEnabled();
    });
  });

  test.describe('Guest mode', () => {
    test('should have "History" button disabled as guest', async ({ mount, page }) => {
      await mount(
        <IntegrationWrapper>
          <StabilityHistoryDialog />
        </IntegrationWrapper>,
      );

      const historyButton = page.getByRole('button', {
        name: 'History',
      });
      await expect(historyButton).toBeDisabled();
    });
  });
});
