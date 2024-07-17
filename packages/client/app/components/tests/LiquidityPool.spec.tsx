import { expect, test } from '@playwright/experimental-ct-react';
import { SetupServer } from 'msw/node';
import LiquidityPool from '../Features/LiquidityPool/LiquidityPool';
import { integrationSuiteSetup, integrationTestSetup } from './integration-test.setup';
import {
  default as MockedBorrowerLiquidityPools,
  default as MockedLiquidityPools,
} from './mockedResponses/GetBorrowerLiquidityPools.mocked.json';
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

test.describe('LiquidityPool', () => {
  test('should render LiquidityPool with mocked data', async ({ mount, page }) => {
    // We need to mock the exact same data to generate the exact same snapshot
    await page.route('http://localhost:8000/subgraphs/name/subgraph', async (route) => {
      if (JSON.parse(route.request().postData()!).operationName === 'GetLiquidityPools') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(MockedLiquidityPools),
        });
      }
      if (JSON.parse(route.request().postData()!).operationName === 'GetBorrowerLiquidityPools') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(MockedBorrowerLiquidityPools),
        });
      } else {
        return route.abort();
      }
    });

    const component = await mount(
      <IntegrationWrapper shouldConnectWallet>
        <LiquidityPool />
      </IntegrationWrapper>,
    );

    await expect(component).toHaveScreenshot({ maxDiffPixelRatio: 0.1 });
  });

  test.describe('LiquidityPools Table', () => {
    test('should preselect first pool if not loged in', async ({ mount, page }) => {
      await mount(
        <IntegrationWrapper>
          <LiquidityPool />
        </IntegrationWrapper>,
      );

      await page.waitForSelector('[data-testid="apollon-liquidity-pool-table-row"]', {
        state: 'visible',
      });
      await page.waitForSelector('.Mui-selected', {
        state: 'visible',
      });

      const rows = page.getByTestId('apollon-liquidity-pool-table-row');
      expect(await rows.count()).toBe(12);

      const selectedRow = page.locator('tr.Mui-selected');
      expect(await selectedRow.count()).toBe(1);

      const firstRow = rows.nth(0);
      await expect(firstRow).toHaveClass(/Mui-selected/);
    });

    test('should preselect first pool but borrower pool if the user logs in between', async ({ mount, page }) => {
      await mount(
        <IntegrationWrapper shouldConnectWalletDelayed>
          <LiquidityPool />
        </IntegrationWrapper>,
      );

      await page.waitForSelector('[data-testid="apollon-liquidity-pool-table-row"]', {
        state: 'visible',
      });
      await page.waitForSelector('.Mui-selected', {
        state: 'visible',
      });

      // wait until login is done
      await page.waitForTimeout(500);

      const rows = page.getByTestId('apollon-liquidity-pool-table-row');
      const firstRow = rows.nth(0);
      await expect(firstRow).toHaveClass(/Mui-selected/);
    });

    test('should select a pool when clicked', async ({ mount, page }) => {
      await mount(
        <IntegrationWrapper>
          <LiquidityPool />
        </IntegrationWrapper>,
      );

      await page.waitForSelector('[data-testid="apollon-liquidity-pool-table-row"]', {
        state: 'visible',
      });
      await page.waitForSelector('.Mui-selected', {
        state: 'visible',
      });

      const rows = page.getByTestId('apollon-liquidity-pool-table-row');
      const secondRow = rows.nth(1);
      await secondRow.click();

      await page.waitForTimeout(500);
      const selectedRow = page.locator('tr.Mui-selected');
      expect(await selectedRow.count()).toBe(1);

      const secondRowAfterUpdate = page.getByTestId('apollon-liquidity-pool-table-row').nth(1);
      await expect(secondRowAfterUpdate).toHaveClass(/Mui-selected/);
    });

    test('should show selected table rows as default', async ({ mount, page }) => {
      await mount(
        <IntegrationWrapper>
          <LiquidityPool />
        </IntegrationWrapper>,
      );

      await page.waitForSelector('[data-testid="apollon-liquidity-pool-table-row"]', {
        state: 'visible',
      });

      const rows = page.getByTestId('apollon-liquidity-pool-table-row');
      const firstRow = rows.nth(0);
      await firstRow.hover();

      await expect(firstRow).toHaveCSS('cursor', 'default');
    });

    test('should show unselected table rows as selectable', async ({ mount, page }) => {
      await mount(
        <IntegrationWrapper>
          <LiquidityPool />
        </IntegrationWrapper>,
      );

      await page.waitForSelector('[data-testid="apollon-liquidity-pool-table-row"]', {
        state: 'visible',
      });

      const rows = page.getByTestId('apollon-liquidity-pool-table-row');
      const secondRow = rows.nth(1);
      await secondRow.hover();

      await expect(secondRow).toHaveCSS('cursor', 'pointer');
    });

    test('should order borrower pools to the top of the table', async ({ mount, page }) => {
      await mount(
        <IntegrationWrapper shouldConnectWallet>
          <LiquidityPool />
        </IntegrationWrapper>,
      );

      await page.waitForSelector('[data-testid="apollon-liquidity-pool-table-row-borrower-amount-token-a"]', {
        state: 'visible',
      });

      const rowsTokenAAmount = page.getByTestId('apollon-liquidity-pool-table-row-borrower-amount-token-a');
      const rowCount = await rowsTokenAAmount.count();

      let noBorrowerPoolAfterPoolWithoutBorrower = true;
      Array(rowCount).forEach(async (_, index) => {
        const rowA = page.getByTestId('apollon-liquidity-pool-table-row-borrower-amount-token-a').nth(index);
        const rowB = page.getByTestId('apollon-liquidity-pool-table-row-borrower-amount-token-b').nth(index);

        const rowAText = await rowA.innerText();
        const rowBText = await rowB.innerText();

        const borrowerParticipation = parseNumberString(rowAText) > 0 || parseNumberString(rowBText) > 0;
        if (!noBorrowerPoolAfterPoolWithoutBorrower) {
          expect(borrowerParticipation).toBe(false);
        }

        noBorrowerPoolAfterPoolWithoutBorrower = borrowerParticipation;
      });
    });

    test.describe('LiquidityPool Form behavior', () => {
      test('should reset input value after tab change', async ({ mount, page }) => {
        const component = await mount(
          <IntegrationWrapper shouldConnectWallet>
            <LiquidityPool />
          </IntegrationWrapper>,
        );

        await page.waitForSelector('[data-testid="apollon-liquidity-pool-deposit-token-a-amount"]', {
          state: 'visible',
        });

        const depositAmountInput = component
          .getByTestId('apollon-liquidity-pool-deposit-token-a-amount')
          .locator('input');
        await depositAmountInput.fill('1000');

        const withdrawTab = component.getByRole('tab', { name: 'Withdraw' });
        await withdrawTab.click();

        const withdrawAmountInput = component
          .getByTestId('apollon-liquidity-pool-withdraw-token-a-amount')
          .locator('input');
        await withdrawAmountInput.fill('1000');

        const depositTab = component.getByRole('tab', { name: 'Deposit' });
        await depositTab.click();

        await expect(
          component.getByTestId('apollon-liquidity-pool-deposit-token-a-amount').first().locator('input'),
        ).toHaveValue('');

        await withdrawTab.click();

        await expect(
          component.getByTestId('apollon-liquidity-pool-withdraw-token-a-amount').first().locator('input'),
        ).toHaveValue('');
      });

      test('should have the borrower amount on deposit tab as labels', async ({ mount, page }) => {
        const component = await mount(
          <IntegrationWrapper shouldConnectWallet>
            <LiquidityPool />
          </IntegrationWrapper>,
        );

        await page.waitForSelector('[data-testid="apollon-liquidity-pool-deposit-token-a-amount"]', {
          state: 'visible',
        });

        const tokenABorrowerText = await page
          .getByTestId('apollon-liquidity-pool-table-row-borrower-amount-token-a')
          .first()
          .innerText();
        const tokenABorrowerAmount = parseNumberString(tokenABorrowerText);
        const tokenBBorrowerText = await page
          .getByTestId('apollon-liquidity-pool-table-row-borrower-amount-token-b')
          .first()
          .innerText();
        const tokenBBorrowerAmount = parseNumberString(tokenBBorrowerText);

        const tokenADepositLabelText = await component
          .getByTestId('apollon-liquidity-pool-deposit-token-a-funds-label')
          .innerText();
        const tokenADepositLabelAmount = parseNumberString(tokenADepositLabelText);
        expect(tokenABorrowerAmount).toBe(tokenADepositLabelAmount);

        const tokenBDepositLabelText = await component
          .getByTestId('apollon-liquidity-pool-deposit-token-b-funds-label')
          .innerText();
        const tokenBDepositLabelAmount = parseNumberString(tokenBDepositLabelText);
        expect(tokenBBorrowerAmount).toBe(tokenBDepositLabelAmount);
      });

      // TODO: Write new test for pool token
      test.skip('should have the borrower amount on withdraw tab as labels', async ({ mount, page }) => {
        const component = await mount(
          <IntegrationWrapper shouldConnectWallet>
            <LiquidityPool />
          </IntegrationWrapper>,
        );

        await page.waitForSelector('[data-testid="apollon-liquidity-pool-deposit-token-a-amount"]', {
          state: 'visible',
        });

        const withdrawTab = component.getByRole('tab', { name: 'Withdraw' });
        await withdrawTab.click();

        const tokenABorrowerText = await page
          .getByTestId('apollon-liquidity-pool-table-row-borrower-amount-token-a')
          .first()
          .innerText();
        const tokenABorrowerAmount = parseNumberString(tokenABorrowerText);
        const tokenBBorrowerText = await page
          .getByTestId('apollon-liquidity-pool-table-row-borrower-amount-token-b')
          .first()
          .innerText();
        const tokenBBorrowerAmount = parseNumberString(tokenBBorrowerText);

        const tokenADepositLabelText = await component
          .getByTestId('apollon-liquidity-pool-withdraw-token-a-funds-label')
          .innerText();
        const tokenADepositLabelAmount = parseNumberString(tokenADepositLabelText);
        expect(tokenABorrowerAmount).toBe(tokenADepositLabelAmount);

        const tokenBDepositLabelText = await component
          .getByTestId('apollon-liquidity-pool-withdraw-token-b-funds-label')
          .innerText();
        const tokenBDepositLabelAmount = parseNumberString(tokenBDepositLabelText);
        expect(tokenBBorrowerAmount).toBe(tokenBDepositLabelAmount);
      });

      test('should fill withdraw input with borrower on "max"', async ({ mount, page }) => {
        const component = await mount(
          <IntegrationWrapper shouldConnectWallet>
            <LiquidityPool />
          </IntegrationWrapper>,
        );

        await page.waitForSelector('[data-testid="apollon-liquidity-pool-deposit-token-a-amount"]', {
          state: 'visible',
        });

        const withdrawTab = component.getByRole('tab', { name: 'Withdraw' });
        await withdrawTab.click();

        const tokenAWithdrawLabelText = await component
          .getByTestId('apollon-liquidity-pool-withdraw-token-a-funds-label')
          .innerText();
        const tokenAWithdrawLabelAmount = parseNumberString(tokenAWithdrawLabelText);
        await component.getByRole('button', { name: 'max' }).first().click();

        const withdrawTokenAAmountInput = component
          .getByTestId('apollon-liquidity-pool-withdraw-token-a-amount')
          .locator('input');
        await expect(withdrawTokenAAmountInput).toHaveValue(tokenAWithdrawLabelAmount.toString());
      });

      test.describe('Validation', () => {
        test('should show an error if negative amount is specified on Deposit tokenA input', async ({
          mount,
          page,
        }) => {
          const component = await mount(
            <IntegrationWrapper shouldConnectWallet>
              <LiquidityPool />
            </IntegrationWrapper>,
          );

          await page.waitForSelector('[data-testid="apollon-liquidity-pool-deposit-token-a-amount"]', {
            state: 'visible',
          });

          const depositTokenAAmountInput = component
            .getByTestId('apollon-liquidity-pool-deposit-token-a-amount')
            .locator('input');

          await depositTokenAAmountInput.fill('-1');

          const updateButton = component.getByRole('button', {
            name: 'Update',
          });
          await updateButton.click();

          // get the Mui-error class
          const tokenInputError = component
            .getByTestId('apollon-liquidity-pool-deposit-token-a-amount')
            .locator('p.Mui-error');
          expect(await tokenInputError.count()).toBe(1);

          const tokenInputErrorMessage = await tokenInputError.textContent();
          expect(tokenInputErrorMessage).toBe('You can only invest positive amounts.');
        });

        test('should show an error if negative amount is specified on Deposit tokenB input', async ({
          mount,
          page,
        }) => {
          const component = await mount(
            <IntegrationWrapper shouldConnectWallet>
              <LiquidityPool />
            </IntegrationWrapper>,
          );

          await page.waitForSelector('[data-testid="apollon-liquidity-pool-deposit-token-a-amount"]', {
            state: 'visible',
          });

          const depositTokenAAmountInput = component
            .getByTestId('apollon-liquidity-pool-deposit-token-b-amount')
            .locator('input');

          await depositTokenAAmountInput.fill('-1');

          const updateButton = component.getByRole('button', {
            name: 'Update',
          });
          await updateButton.click();

          // get the Mui-error class
          const tokenInputError = component
            .getByTestId('apollon-liquidity-pool-deposit-token-b-amount')
            .locator('p.Mui-error');
          expect(await tokenInputError.count()).toBe(1);

          const tokenInputErrorMessage = await tokenInputError.textContent();
          expect(tokenInputErrorMessage).toBe('You can only invest positive amounts.');
        });

        test('should show an error if negative amount is specified on Withdraw tokenA input', async ({
          mount,
          page,
        }) => {
          const component = await mount(
            <IntegrationWrapper shouldConnectWallet>
              <LiquidityPool />
            </IntegrationWrapper>,
          );

          await page.waitForSelector('[data-testid="apollon-liquidity-pool-deposit-token-a-amount"]', {
            state: 'visible',
          });

          const withdrawTab = component.getByRole('tab', { name: 'Withdraw' });
          await withdrawTab.click();

          const depositTokenAAmountInput = component
            .getByTestId('apollon-liquidity-pool-withdraw-token-a-amount')
            .locator('input');

          await depositTokenAAmountInput.fill('-1');

          const updateButton = component.getByRole('button', {
            name: 'Update',
          });
          await updateButton.click();

          // get the Mui-error class
          const tokenInputError = component
            .getByTestId('apollon-liquidity-pool-withdraw-token-a-amount')
            .locator('p.Mui-error');
          expect(await tokenInputError.count()).toBe(1);

          const tokenInputErrorMessage = await tokenInputError.textContent();
          expect(tokenInputErrorMessage).toBe('You can only withdraw positive amounts.');
        });

        test('should show an error if amount is higher than borrowers deposited amount on Withdraw tokenA input', async ({
          mount,
          page,
        }) => {
          const component = await mount(
            <IntegrationWrapper shouldConnectWallet>
              <LiquidityPool />
            </IntegrationWrapper>,
          );

          await page.waitForSelector('[data-testid="apollon-liquidity-pool-deposit-token-a-amount"]', {
            state: 'visible',
          });

          const withdrawTab = component.getByRole('tab', { name: 'Withdraw' });
          await withdrawTab.click();

          const depositTokenAAmountInput = component
            .getByTestId('apollon-liquidity-pool-withdraw-token-a-amount')
            .locator('input');

          await depositTokenAAmountInput.fill('9999999999');

          const updateButton = component.getByRole('button', {
            name: 'Update',
          });
          await updateButton.click();

          // get the Mui-error class
          const tokenInputError = component
            .getByTestId('apollon-liquidity-pool-withdraw-token-a-amount')
            .locator('p.Mui-error');
          expect(await tokenInputError.count()).toBe(1);

          const tokenInputErrorMessage = await tokenInputError.textContent();
          expect(tokenInputErrorMessage).toBe('This amount is greater than your deposited amount.');
        });
      });

      test.describe('Connected mode', () => {
        test('should have "Update" button enabled when logged in', async ({ mount }) => {
          const component = await mount(
            <IntegrationWrapper shouldConnectWallet>
              <LiquidityPool />
            </IntegrationWrapper>,
          );

          const updateButton = component.getByRole('button', {
            name: 'Update',
          });
          await expect(updateButton).toBeEnabled();
        });
      });

      test.describe('Guest mode', () => {
        test('should have "Update" button disabled as guest', async ({ mount }) => {
          const component = await mount(
            <IntegrationWrapper>
              <LiquidityPool />
            </IntegrationWrapper>,
          );

          const updateButton = component.getByRole('button', {
            name: 'Update',
          });
          await expect(updateButton).toBeDisabled();
        });
      });
    });
  });
});
