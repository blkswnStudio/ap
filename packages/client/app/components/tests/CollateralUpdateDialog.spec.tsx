import { expect, test } from '@playwright/experimental-ct-react';
import { SetupServer } from 'msw/node';
import CollateralUpdateDialog from '../Features/Collateral/CollateralUpdateDialog';
import { integrationSuiteSetup, integrationTestSetup } from './integration-test.setup';
import {
  default as MockedBorrowerCollateralTokens,
  default as MockedCollateralTokens,
} from './mockedResponses/GetBorrowerCollateralTokens.mocked.json';
import MockedBorrowerDebtTokens from './mockedResponses/GetBorrowerDebtTokens.mocked.json';
import { parseNumberString } from './test-helpers';
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

test.describe('CollateralUpdateDialog', () => {
  test('should render CollateralUpdateDialog with mocked data', async ({ mount, page }) => {
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
        <CollateralUpdateDialog buttonVariant="contained" />
      </IntegrationWrapper>,
    );

    const updateButton = page.getByRole('button', {
      name: 'Change',
    });
    await updateButton.click();

    await page.waitForSelector('[data-testid="apollon-collateral-update-dialog-USDT-amount"]', {
      state: 'visible',
    });
    await page.waitForSelector('[data-testid="apollon-collateral-ratio-visualization"]', {
      state: 'visible',
    });

    await expect(page).toHaveScreenshot({ maxDiffPixelRatio: 0.1 });
  });

  test('should render CollateralUpdateDialog with mocked data when not logged in', async ({ mount, page }) => {
    // We need to mock the exact same data to generate the exact same snapshot
    await page.route('http://localhost:8000/subgraphs/name/subgraph', async (route) => {
      if (JSON.parse(route.request().postData()!).operationName === 'GetBorrowerCollateralTokens') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(MockedCollateralTokens),
        });
      } else {
        return route.abort();
      }
    });

    await mount(
      <IntegrationWrapper>
        <CollateralUpdateDialog buttonVariant="contained" />
      </IntegrationWrapper>,
    );

    await expect(page).toHaveScreenshot({ maxDiffPixelRatio: 0.1 });
  });

  test('should close CollateralUpdateDialog when clicking the close button', async ({ mount, page }) => {
    await mount(
      <IntegrationWrapper shouldConnectWallet>
        <CollateralUpdateDialog buttonVariant="contained" />
      </IntegrationWrapper>,
    );

    const updateButton = page.getByRole('button', {
      name: 'Change',
    });
    await updateButton.click();

    await page.waitForSelector('[data-testid="apollon-collateral-update-dialog-USDT-amount"]', {
      state: 'visible',
    });

    const closeButton = (await page.$('button[aria-label="close collateral update dialog"]'))!;
    await closeButton.click();

    await page.waitForSelector('[data-testid="apollon-collateral-update-dialog-USDT-amount"]', {
      state: 'detached',
    });
  });

  test('should close CollateralUpdateDialog when clicking the background', async ({ mount, page }) => {
    await mount(
      <IntegrationWrapper shouldConnectWallet>
        <CollateralUpdateDialog buttonVariant="contained" />
      </IntegrationWrapper>,
    );

    const updateButton = page.getByRole('button', {
      name: 'Change',
    });
    await updateButton.click();

    await page.waitForSelector('[data-testid="apollon-collateral-update-dialog-USDT-amount"]', {
      state: 'visible',
    });

    const dialogBackground = page.getByTestId('apollon-collateral-update-dialog-backdrop');

    // must click somewhere but the middle (where the actual dialog is) and bypass actionability because the background is aria-hidden
    await dialogBackground.click({ position: { x: 50, y: 50 }, force: true });

    await page.waitForSelector('[data-testid="apollon-collateral-update-dialog-USDT-amount"]', {
      state: 'detached',
    });
  });

  test.describe('Form behavior', () => {
    test('should clear token input when changing tabs', async ({ mount, page }) => {
      await mount(
        <IntegrationWrapper shouldConnectWallet>
          <CollateralUpdateDialog buttonVariant="contained" />
        </IntegrationWrapper>,
      );

      const updateButton = page.getByRole('button', {
        name: 'Change',
      });
      await updateButton.click();

      await page.waitForSelector('[data-testid="apollon-collateral-update-dialog-USDT-amount"]', {
        state: 'visible',
      });

      const amountInput = page.getByTestId('apollon-collateral-update-dialog-USDT-amount').locator('input');
      await amountInput.fill('10');

      const withdrawTab = page.getByRole('tab', { name: 'Withdraw' });
      await withdrawTab.click();

      await expect(amountInput).toHaveValue('');

      await amountInput.fill('10');
      const depositTab = page.getByRole('tab', { name: 'Deposit' });
      await depositTab.click();

      await expect(amountInput).toHaveValue('');
    });

    test('should fill deposit token input when clicking "max"', async ({ mount, page }) => {
      await page.route('http://localhost:8000/subgraphs/name/subgraph', async (route) => {
        if (JSON.parse(route.request().postData()!).operationName === 'GetBorrowerCollateralTokens') {
          return route.fulfill({
            status: 200,
            body: JSON.stringify(MockedBorrowerCollateralTokens),
          });
        } else {
          return route.abort();
        }
      });

      await mount(
        <IntegrationWrapper shouldConnectWallet>
          <CollateralUpdateDialog buttonVariant="contained" />
        </IntegrationWrapper>,
      );

      const updateButton = page.getByRole('button', {
        name: 'Change',
      });
      await updateButton.click();

      await page.waitForSelector('[data-testid="apollon-collateral-update-dialog-USDT-amount"]', {
        state: 'visible',
      });

      const depositLabelText = await page
        .getByTestId('apollon-collateral-update-dialog-deposit-USDT-funds-label')
        .first()
        .innerText();
      const depositLabelAmount = parseNumberString(depositLabelText);
      await page.getByRole('button', { name: 'max' }).first().click();

      const amountInput = page.getByTestId('apollon-collateral-update-dialog-USDT-amount').locator('input');
      await expect(amountInput).toHaveValue(depositLabelAmount.toString());
    });

    test('should fill withdraw token input when clicking "max"', async ({ mount, page }) => {
      await page.route('http://localhost:8000/subgraphs/name/subgraph', async (route) => {
        if (JSON.parse(route.request().postData()!).operationName === 'GetBorrowerCollateralTokens') {
          return route.fulfill({
            status: 200,
            body: JSON.stringify(MockedBorrowerCollateralTokens),
          });
        } else {
          return route.abort();
        }
      });

      await mount(
        <IntegrationWrapper shouldConnectWallet>
          <CollateralUpdateDialog buttonVariant="contained" />
        </IntegrationWrapper>,
      );

      const updateButton = page.getByRole('button', {
        name: 'Change',
      });
      await updateButton.click();

      await page.waitForSelector('[data-testid="apollon-collateral-update-dialog-USDT-amount"]', {
        state: 'visible',
      });

      const withdrawTab = page.getByRole('tab', { name: 'Withdraw' });
      await withdrawTab.click();

      const withdrawLabelText = await page
        .getByTestId('apollon-collateral-update-dialog-withdraw-USDT-funds-label')
        .first()
        .innerText();
      const withdrawLabelAmount = parseNumberString(withdrawLabelText);
      await page.getByRole('button', { name: 'max' }).first().click();

      const amountInput = page.getByTestId('apollon-collateral-update-dialog-USDT-amount').locator('input');
      await expect(parseFloat(await amountInput.inputValue())).toBeCloseTo(withdrawLabelAmount);
    });
  });

  test.describe('Validation', () => {
    test.describe('Deposit', () => {
      test('should show an error if no input has been dirtied before submission and remove the error if valid data is supplied', async ({
        mount,
        page,
      }) => {
        await mount(
          <IntegrationWrapper shouldConnectWallet>
            <CollateralUpdateDialog buttonVariant="contained" />
          </IntegrationWrapper>,
        );

        const updateButton = page.getByRole('button', {
          name: 'Change',
        });
        await updateButton.click();

        await page.waitForSelector('[data-testid="apollon-collateral-update-dialog-USDT-amount"]', {
          state: 'visible',
        });

        const formSubmissionButton = page.getByRole('button', {
          name: 'Change',
        });

        await formSubmissionButton.click();

        const formError = page.getByTestId('apollon-collateral-update-dialog-error');
        expect(await formError.innerText()).toBe('You must specify at least one token to change.');

        const amountInput = page.getByTestId('apollon-collateral-update-dialog-USDT-amount').locator('input');
        await amountInput.fill('1');

        await page.waitForSelector('[data-testid="apollon-collateral-update-dialog-error"]', {
          state: 'detached',
        });
      });

      test('should show error on negative numbers', async ({ mount, page }) => {
        await mount(
          <IntegrationWrapper shouldConnectWallet>
            <CollateralUpdateDialog buttonVariant="contained" />
          </IntegrationWrapper>,
        );

        const updateButton = page.getByRole('button', {
          name: 'Change',
        });
        await updateButton.click();

        await page.waitForSelector('[data-testid="apollon-collateral-update-dialog-USDT-amount"]', {
          state: 'visible',
        });

        const amountInput = page.getByTestId('apollon-collateral-update-dialog-USDT-amount').locator('input');
        await amountInput.fill('-1');

        const formSubmissionButton = page.getByRole('button', {
          name: 'Change',
        });
        await formSubmissionButton.click();

        const tokenInputError = await page
          .getByTestId('apollon-collateral-update-dialog-USDT-amount')
          .locator('p.Mui-error');
        expect(await tokenInputError.count()).toBe(1);
        const tokenInputErrorText = await tokenInputError.textContent();
        expect(tokenInputErrorText).toBe('Amount needs to be positive.');
      });

      test('should clear error when positive number is input', async ({ mount, page }) => {
        await mount(
          <IntegrationWrapper shouldConnectWallet>
            <CollateralUpdateDialog buttonVariant="contained" />
          </IntegrationWrapper>,
        );

        const updateButton = page.getByRole('button', {
          name: 'Change',
        });
        await updateButton.click();

        await page.waitForSelector('[data-testid="apollon-collateral-update-dialog-USDT-amount"]', {
          state: 'visible',
        });

        const amountInput = page.getByTestId('apollon-collateral-update-dialog-USDT-amount').locator('input');
        await amountInput.fill('-1');

        const formSubmissionButton = page.getByRole('button', {
          name: 'Change',
        });
        await formSubmissionButton.click();

        await amountInput.fill('1');

        await page.waitForSelector('p.Mui-error', {
          state: 'detached',
        });
      });

      test('should show error if amount is too big', async ({ mount, page }) => {
        await mount(
          <IntegrationWrapper shouldConnectWallet>
            <CollateralUpdateDialog buttonVariant="contained" />
          </IntegrationWrapper>,
        );

        const updateButton = page.getByRole('button', {
          name: 'Change',
        });
        await updateButton.click();

        await page.waitForSelector('[data-testid="apollon-collateral-update-dialog-USDT-amount"]', {
          state: 'visible',
        });

        const amountInput = page.getByTestId('apollon-collateral-update-dialog-USDT-amount').locator('input');
        await amountInput.fill('101');

        const formSubmissionButton = page.getByRole('button', {
          name: 'Change',
        });
        await formSubmissionButton.click();

        const tokenInputError = await page
          .getByTestId('apollon-collateral-update-dialog-USDT-amount')
          .locator('p.Mui-error');
        expect(await tokenInputError.count()).toBe(1);
        const tokenInputErrorText = await tokenInputError.textContent();
        expect(tokenInputErrorText).toBe('Your wallet does not contain the specified amount.');
      });

      test('should remove error if amount is changed to a valid number', async ({ mount, page }) => {
        await mount(
          <IntegrationWrapper shouldConnectWallet>
            <CollateralUpdateDialog buttonVariant="contained" />
          </IntegrationWrapper>,
        );

        const updateButton = page.getByRole('button', {
          name: 'Change',
        });
        await updateButton.click();

        await page.waitForSelector('[data-testid="apollon-collateral-update-dialog-USDT-amount"]', {
          state: 'visible',
        });

        const amountInput = page.getByTestId('apollon-collateral-update-dialog-USDT-amount').locator('input');
        await amountInput.fill('101');

        const formSubmissionButton = page.getByRole('button', {
          name: 'Change',
        });
        await formSubmissionButton.click();

        await amountInput.fill('1');

        await page.waitForSelector('p.Mui-error', {
          state: 'detached',
        });
      });
    });

    test.describe('Withdraw', () => {
      test('should show an error if no input has been dirtied before submission and remove the error if valid data is supplied', async ({
        mount,
        page,
      }) => {
        await mount(
          <IntegrationWrapper shouldConnectWallet>
            <CollateralUpdateDialog buttonVariant="contained" />
          </IntegrationWrapper>,
        );

        const updateButton = page.getByRole('button', {
          name: 'Change',
        });
        await updateButton.click();

        await page.waitForSelector('[data-testid="apollon-collateral-update-dialog-USDT-amount"]', {
          state: 'visible',
        });

        const withdrawTab = page.getByRole('tab', { name: 'Withdraw' });
        await withdrawTab.click();

        const formSubmissionButton = page.getByRole('button', {
          name: 'Change',
        });

        await formSubmissionButton.click();

        const formError = page.getByTestId('apollon-collateral-update-dialog-error');
        expect(await formError.innerText()).toBe('You must specify at least one token to change.');

        const amountInput = page.getByTestId('apollon-collateral-update-dialog-USDT-amount').locator('input');
        await amountInput.fill('1');

        await page.waitForSelector('[data-testid="apollon-collateral-update-dialog-error"]', {
          state: 'detached',
        });
      });

      test('should show error on negative numbers', async ({ mount, page }) => {
        await mount(
          <IntegrationWrapper shouldConnectWallet>
            <CollateralUpdateDialog buttonVariant="contained" />
          </IntegrationWrapper>,
        );

        const updateButton = page.getByRole('button', {
          name: 'Change',
        });
        await updateButton.click();

        await page.waitForSelector('[data-testid="apollon-collateral-update-dialog-USDT-amount"]', {
          state: 'visible',
        });

        const withdrawTab = page.getByRole('tab', { name: 'Withdraw' });
        await withdrawTab.click();

        const amountInput = page.getByTestId('apollon-collateral-update-dialog-USDT-amount').locator('input');
        await amountInput.fill('-1');

        const formSubmissionButton = page.getByRole('button', {
          name: 'Change',
        });
        await formSubmissionButton.click();

        const tokenInputError = await page
          .getByTestId('apollon-collateral-update-dialog-USDT-amount')
          .locator('p.Mui-error');
        expect(await tokenInputError.count()).toBe(1);
        const tokenInputErrorText = await tokenInputError.textContent();
        expect(tokenInputErrorText).toBe('Amount needs to be positive.');
      });

      test('should clear error when positive number is input', async ({ mount, page }) => {
        await mount(
          <IntegrationWrapper shouldConnectWallet>
            <CollateralUpdateDialog buttonVariant="contained" />
          </IntegrationWrapper>,
        );

        const updateButton = page.getByRole('button', {
          name: 'Change',
        });
        await updateButton.click();

        await page.waitForSelector('[data-testid="apollon-collateral-update-dialog-USDT-amount"]', {
          state: 'visible',
        });

        const withdrawTab = page.getByRole('tab', { name: 'Withdraw' });
        await withdrawTab.click();

        const amountInput = page.getByTestId('apollon-collateral-update-dialog-USDT-amount').locator('input');
        await amountInput.fill('-1');

        const formSubmissionButton = page.getByRole('button', {
          name: 'Change',
        });
        await formSubmissionButton.click();

        await amountInput.fill('1');

        await page.waitForSelector('p.Mui-error', {
          state: 'detached',
        });
      });

      test('should show error if amount is too big', async ({ mount, page }) => {
        await mount(
          <IntegrationWrapper shouldConnectWallet>
            <CollateralUpdateDialog buttonVariant="contained" />
          </IntegrationWrapper>,
        );

        const updateButton = page.getByRole('button', {
          name: 'Change',
        });
        await updateButton.click();

        await page.waitForSelector('[data-testid="apollon-collateral-update-dialog-USDT-amount"]', {
          state: 'visible',
        });

        const withdrawTab = page.getByRole('tab', { name: 'Withdraw' });
        await withdrawTab.click();

        const amountInput = page.getByTestId('apollon-collateral-update-dialog-USDT-amount').locator('input');
        await amountInput.fill('10.1');

        const formSubmissionButton = page.getByRole('button', {
          name: 'Change',
        });
        await formSubmissionButton.click();

        const tokenInputError = await page
          .getByTestId('apollon-collateral-update-dialog-USDT-amount')
          .locator('p.Mui-error');
        expect(await tokenInputError.count()).toBe(1);
        const tokenInputErrorText = await tokenInputError.textContent();
        expect(tokenInputErrorText).toBe('Your trove does not contain the specified amount.');
      });

      test('should remove error if amount is changed to a valid number', async ({ mount, page }) => {
        await mount(
          <IntegrationWrapper shouldConnectWallet>
            <CollateralUpdateDialog buttonVariant="contained" />
          </IntegrationWrapper>,
        );

        const updateButton = page.getByRole('button', {
          name: 'Change',
        });
        await updateButton.click();

        await page.waitForSelector('[data-testid="apollon-collateral-update-dialog-USDT-amount"]', {
          state: 'visible',
        });

        const withdrawTab = page.getByRole('tab', { name: 'Withdraw' });
        await withdrawTab.click();

        const amountInput = page.getByTestId('apollon-collateral-update-dialog-USDT-amount').locator('input');
        await amountInput.fill('101');

        const formSubmissionButton = page.getByRole('button', {
          name: 'Change',
        });
        await formSubmissionButton.click();

        await amountInput.fill('1');

        await page.waitForSelector('p.Mui-error', {
          state: 'detached',
        });
      });
    });

    test('should remove any form errors on tab change', async ({ mount, page }) => {
      await mount(
        <IntegrationWrapper shouldConnectWallet>
          <CollateralUpdateDialog buttonVariant="contained" />
        </IntegrationWrapper>,
      );

      const updateButton = page.getByRole('button', {
        name: 'Change',
      });
      await updateButton.click();

      await page.waitForSelector('[data-testid="apollon-collateral-update-dialog-USDT-amount"]', {
        state: 'visible',
      });

      const formSubmissionButton = page.getByRole('button', {
        name: 'Change',
      });

      await formSubmissionButton.click();

      const withdrawTab = page.getByRole('tab', { name: 'Withdraw' });
      await withdrawTab.click();

      await page.waitForSelector('[data-testid="apollon-collateral-update-dialog-error"]', {
        state: 'detached',
      });
    });

    test('should remove any input errors on tab change', async ({ mount, page }) => {
      await mount(
        <IntegrationWrapper shouldConnectWallet>
          <CollateralUpdateDialog buttonVariant="contained" />
        </IntegrationWrapper>,
      );

      const updateButton = page.getByRole('button', {
        name: 'Change',
      });
      await updateButton.click();

      await page.waitForSelector('[data-testid="apollon-collateral-update-dialog-USDT-amount"]', {
        state: 'visible',
      });

      const amountInput = page.getByTestId('apollon-collateral-update-dialog-USDT-amount').locator('input');
      await amountInput.fill('-1');

      const formSubmissionButton = page.getByRole('button', {
        name: 'Change',
      });
      await formSubmissionButton.click();

      const withdrawTab = page.getByRole('tab', { name: 'Withdraw' });
      await withdrawTab.click();

      const tokenInputError = await page
        .getByTestId('apollon-collateral-update-dialog-USDT-amount')
        .locator('p.Mui-error');
      expect(await tokenInputError.count()).toBe(0);
    });
  });

  test.describe('Connected mode', () => {
    test('should have "Update" button enabled', async ({ mount, page }) => {
      await mount(
        <IntegrationWrapper shouldConnectWallet>
          <CollateralUpdateDialog buttonVariant="contained" />
        </IntegrationWrapper>,
      );

      const updateButton = page.getByRole('button', {
        name: 'Change',
      });
      await expect(updateButton).toBeEnabled();
    });

    test('should have inner "Update" button for form enabled', async ({ mount, page }) => {
      await mount(
        <IntegrationWrapper shouldConnectWallet>
          <CollateralUpdateDialog buttonVariant="contained" />
        </IntegrationWrapper>,
      );

      const updateButton = page.getByRole('button', {
        name: 'Change',
      });
      await updateButton.click();

      const formSubmissionButton = page.getByRole('button', {
        name: 'Change',
      });
      await expect(formSubmissionButton).toBeEnabled();
    });
  });

  test.describe('Guest mode', () => {
    test('should have "Update" button enabled', async ({ mount, page }) => {
      await mount(
        <IntegrationWrapper>
          <CollateralUpdateDialog buttonVariant="contained" />
        </IntegrationWrapper>,
      );

      const updateButton = page.getByRole('button', {
        name: 'Change',
      });
      await expect(updateButton).toBeDisabled();
    });
  });
});
