import { expect, test } from '@playwright/experimental-ct-react';
import { parseEther } from 'ethers';
import { SetupServer } from 'msw/node';
import { Contracts_Localhost } from '../../../config';
import Farm from '../Features/Farm/Farm';
import { integrationSuiteSetup, integrationTestSetup } from './integration-test.setup';
import MockedDebtTokens from './mockedResponses/GetBorrowerDebtTokens.mocked.json';
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

test.describe('Farm', () => {
  test('should render Farm with mocked data', async ({ mount, page }) => {
    // We need to mock the exact same data to generate the exact same snapshot
    await page.route('http://localhost:8000/subgraphs/name/subgraph', async (route) => {
      if (JSON.parse(route.request().postData()!).operationName === 'GetBorrowerDebtTokens') {
        return route.fulfill({
          status: 200,
          body: JSON.stringify(MockedDebtTokens),
        });
      } else {
        return route.abort();
      }
    });

    const component = await mount(
      <IntegrationWrapper shouldPreselectTokens>
        <Farm />
      </IntegrationWrapper>,
    );

    await expect(component).toHaveScreenshot();
  });

  test.describe('Form behavior', () => {
    test('should reset position size on either position type change', async ({ mount }) => {
      const component = await mount(
        <IntegrationWrapper shouldPreselectTokens>
          <Farm />
        </IntegrationWrapper>,
      );

      const amountInput = component.getByTestId('apollon-farm-amount').locator('input');
      await amountInput.fill('1000');

      const shortTab = component.getByRole('tab', { name: 'Short' });
      await shortTab.click();

      await expect(amountInput).toHaveValue('');

      await amountInput.fill('1000');

      const longButton = component.getByRole('tab', { name: 'Long' });
      await longButton.click();

      await expect(amountInput).toHaveValue('');
    });

    test('should reset slippage amount on either position type change', async ({ mount, page }) => {
      const component = await mount(
        <IntegrationWrapper shouldPreselectTokens>
          <Farm />
        </IntegrationWrapper>,
      );

      const showSlippageButton = component.getByRole('button', {
        name: 'More',
      });
      await showSlippageButton.click();

      await page.waitForSelector("[data-testid='apollon-farm-slippage-amount']", {
        state: 'visible',
      });
      const slippageInput = component.getByTestId('apollon-farm-slippage-amount').locator('input');
      await slippageInput.fill('10');

      const shortTab = component.getByRole('tab', { name: 'Short' });
      await shortTab.click();

      await expect(slippageInput).toHaveValue('2');
      await slippageInput.fill('10');

      const longButton = component.getByRole('tab', { name: 'Long' });
      await longButton.click();

      await expect(slippageInput).toHaveValue('2');
    });

    test.describe('Long Tab', () => {
      // TODO: Flaky on webkit, or is it a bug?
      test('should update position size on long position amount change', async ({ mount }) => {
        const component = await mount(
          <IntegrationWrapper shouldPreselectTokens>
            <Farm />
          </IntegrationWrapper>,
        );

        const positionSize = component.getByTestId('apollon-farm-position-size');
        const positionSizeText = await positionSize.innerText();
        expect(positionSizeText).toBe('-');

        const amountInput = component.getByTestId('apollon-farm-amount').locator('input');
        await amountInput.fill('1000');
        const positionSizeValueForSmallAmountText = await positionSize.innerText();
        expect(positionSizeValueForSmallAmountText).not.toBe(positionSizeText);
        const positionSizeValueForSmallAmountValue = parseNumberString(
          positionSizeValueForSmallAmountText.split(' jUSD')[0],
        );
        expect(positionSizeValueForSmallAmountValue).not.toBeNaN();

        await amountInput.fill('10000');

        const positionSizeValueForBigAmountText = await positionSize.innerText();
        const positionSizeValueForBigAmountValue = parseNumberString(
          positionSizeValueForBigAmountText.split(' jUSD')[0],
        );

        expect(positionSizeValueForSmallAmountValue * 10).toBeCloseTo(positionSizeValueForBigAmountValue, 0.01);
      });

      test('should show protocol fee amount', async ({ mount }) => {
        const component = await mount(
          <IntegrationWrapper
            shouldPreselectTokens
            mockedUtilities={{ getDynamicSwapFeeOverride: async () => parseEther('0.05') }}
          >
            <Farm />
          </IntegrationWrapper>,
        );

        const protocolFee = component.getByTestId('apollon-farm-protocol-fee');
        const protocolFeeText = await protocolFee.innerText();
        expect(protocolFeeText).toBe('5.00 %');
      });

      test('should show error if amount is not positive', async ({ mount }) => {
        const contractMock = {
          swapPairContracts: {
            [Contracts_Localhost.SwapPairs.USDT]: {},
          },
        };
        const component = await mount(
          <IntegrationWrapper
            mockEthers={
              {
                contractMock,
              } as any
            }
            shouldPreselectTokens
            shouldConnectWallet
            mockedUtilities={{ getDynamicSwapFeeOverride: async () => parseEther('0.05') }}
          >
            <Farm />
          </IntegrationWrapper>,
        );

        const tokenInput = component.getByTestId('apollon-farm-amount').locator('input');
        await tokenInput.fill('-1');

        const executeButton = component.getByRole('button', {
          name: 'Execute',
        });
        await executeButton.click();

        // get the Mui-error class
        const tokenInputError = component.getByTestId('apollon-farm-amount').locator('p.Mui-error');
        expect(await tokenInputError.count()).toBe(1);
        const tokenInputErrorMessage = await tokenInputError.textContent();
        expect(tokenInputErrorMessage).toBe('Amount needs to be positive.');
      });

      test('should show error if amount is not specified', async ({ mount }) => {
        const component = await mount(
          <IntegrationWrapper shouldPreselectTokens shouldConnectWallet>
            <Farm />
          </IntegrationWrapper>,
        );

        const executeButton = component.getByRole('button', {
          name: 'Execute',
        });
        await executeButton.click();

        // get the Mui-error class
        const tokenInputError = component.getByTestId('apollon-farm-amount').locator('p.Mui-error');
        expect(await tokenInputError.count()).toBe(1);
        const tokenInputErrorMessage = await tokenInputError.textContent();
        expect(tokenInputErrorMessage).toBe('You need to specify an amount.');
      });

      test('should hide error if valid data is input', async ({ mount }) => {
        const contractMock = {
          swapPairContracts: {
            [Contracts_Localhost.SwapPairs.USDT]: {},
          },
        };
        const component = await mount(
          <IntegrationWrapper
            mockEthers={
              {
                contractMock,
              } as any
            }
            shouldPreselectTokens
            shouldConnectWallet
            mockedUtilities={{ getDynamicSwapFeeOverride: async () => parseEther('0.05') }}
          >
            <Farm />
          </IntegrationWrapper>,
        );

        const executeButton = component.getByRole('button', {
          name: 'Execute',
        });
        await executeButton.click();

        const tokenInput = component.getByTestId('apollon-farm-amount').locator('input');
        await tokenInput.fill('10');

        await expect(executeButton).toBeEnabled();
        await executeButton.click();

        const tokenInputError = component.getByTestId('apollon-farm-amount').locator('p.Mui-error');
        expect(await tokenInputError.count()).toBe(0);
      });
    });

    test.describe('Short Tab', () => {
      test('should update position size on short position amount change', async ({ mount }) => {
        const component = await mount(
          <IntegrationWrapper shouldPreselectTokens>
            <Farm />
          </IntegrationWrapper>,
        );

        const shortTab = component.getByRole('tab', { name: 'Short' });
        await shortTab.click();

        const positionSize = component.getByTestId('apollon-farm-position-size');
        const positionSizeText = await positionSize.innerText();
        expect(positionSizeText).toBe('-');

        const amountInput = component.getByTestId('apollon-farm-amount').locator('input');
        await amountInput.fill('1000');
        const positionSizeValueForSmallAmountText = await positionSize.innerText();
        expect(positionSizeValueForSmallAmountText).not.toBe(positionSizeText);
        const positionSizeValueForSmallAmountValue = parseNumberString(
          positionSizeValueForSmallAmountText.split(' jUSD')[0],
        );
        expect(positionSizeValueForSmallAmountValue).not.toBeNaN();

        await amountInput.fill('10000');

        const positionSizeValueForBigAmountText = await positionSize.innerText();
        const positionSizeValueForBigAmountValue = parseNumberString(
          positionSizeValueForBigAmountText.split(' jUSD')[0],
        );

        expect(positionSizeValueForSmallAmountValue * 10).toBeCloseTo(positionSizeValueForBigAmountValue, 0.01);
      });

      test('should show protocol fee amount', async ({ mount }) => {
        const component = await mount(
          <IntegrationWrapper shouldPreselectTokens>
            <Farm />
          </IntegrationWrapper>,
        );

        const shortTab = component.getByRole('tab', { name: 'Short' });
        await shortTab.click();

        const protocolFee = component.getByTestId('apollon-farm-protocol-fee');
        const protocolFeeText = await protocolFee.innerText();
        expect(protocolFeeText).toBe('5.00 %');
      });

      test('should show error if amount is not positive', async ({ mount }) => {
        const contractMock = {
          swapPairContracts: {
            [Contracts_Localhost.SwapPairs.USDT]: {},
          },
        };
        const component = await mount(
          <IntegrationWrapper
            mockEthers={
              {
                contractMock,
              } as any
            }
            shouldPreselectTokens
            shouldConnectWallet
            mockedUtilities={{ getDynamicSwapFeeOverride: async () => parseEther('0.05') }}
          >
            <Farm />
          </IntegrationWrapper>,
        );

        const shortTab = component.getByRole('tab', { name: 'Short' });
        await shortTab.click();

        const tokenInput = component.getByTestId('apollon-farm-amount').locator('input');
        await tokenInput.fill('-1');

        const executeButton = component.getByRole('button', {
          name: 'Execute',
        });
        await executeButton.click();

        // get the Mui-error class
        const tokenInputError = component.getByTestId('apollon-farm-amount').locator('p.Mui-error');
        expect(await tokenInputError.count()).toBe(1);
        const tokenInputErrorMessage = await tokenInputError.textContent();
        expect(tokenInputErrorMessage).toBe('Amount needs to be positive.');
      });

      test('should show error if amount is not specified', async ({ mount }) => {
        const component = await mount(
          <IntegrationWrapper shouldPreselectTokens shouldConnectWallet>
            <Farm />
          </IntegrationWrapper>,
        );

        const shortTab = component.getByRole('tab', { name: 'Short' });
        await shortTab.click();

        const executeButton = component.getByRole('button', {
          name: 'Execute',
        });
        await executeButton.click();

        // get the Mui-error class
        const tokenInputError = component.getByTestId('apollon-farm-amount').locator('p.Mui-error');
        expect(await tokenInputError.count()).toBe(1);
        const tokenInputErrorMessage = await tokenInputError.textContent();
        expect(tokenInputErrorMessage).toBe('You need to specify an amount.');
      });

      test('should hide error when valid data is input', async ({ mount }) => {
        const contractMock = {
          swapPairContracts: {
            [Contracts_Localhost.SwapPairs.USDT]: {},
          },
        };
        const component = await mount(
          <IntegrationWrapper
            mockEthers={
              {
                contractMock,
              } as any
            }
            mockedUtilities={{ getDynamicSwapFeeOverride: async () => parseEther('0.05') }}
            shouldPreselectTokens
            shouldConnectWallet
          >
            <Farm />
          </IntegrationWrapper>,
        );

        const shortTab = component.getByRole('tab', { name: 'Short' });
        await shortTab.click();

        const executeButton = component.getByRole('button', {
          name: 'Execute',
        });
        await executeButton.click();

        const tokenInput = component.getByTestId('apollon-farm-amount').locator('input');
        await tokenInput.fill('10');

        await expect(executeButton).toBeEnabled();
        await executeButton.click();

        const tokenInputError = component.getByTestId('apollon-farm-amount').locator('p.Mui-error');
        expect(await tokenInputError.count()).toBe(0);
      });
    });
  });

  test.describe('Slippage', () => {
    test('should not show slippage input by default', async ({ mount, page }) => {
      const component = await mount(
        <IntegrationWrapper shouldPreselectTokens>
          <Farm />
        </IntegrationWrapper>,
      );

      const slippageBox = component.locator("[data-testid='apollon-farm-slippage-amount']");

      expect(await slippageBox.count()).toBe(0);
    });

    test('should show slippage input when "More" button is clicked', async ({ mount, page }) => {
      const component = await mount(
        <IntegrationWrapper shouldPreselectTokens>
          <Farm />
        </IntegrationWrapper>,
      );

      const showSlippageButton = component.getByRole('button', {
        name: 'More',
      });
      await showSlippageButton.click();

      await page.waitForSelector("[data-testid='apollon-farm-slippage-amount']", {
        state: 'visible',
      });
      const slippageInput = component.getByTestId('apollon-farm-slippage-amount').locator('input');
      await expect(slippageInput).toHaveValue('2');
    });

    test('should hide slippage input when "Less" button is clicked and keep its value', async ({ mount, page }) => {
      const component = await mount(
        <IntegrationWrapper shouldPreselectTokens>
          <Farm />
        </IntegrationWrapper>,
      );

      const showSlippageButton = component.getByRole('button', {
        name: 'More',
      });
      await showSlippageButton.click();

      await page.waitForSelector("[data-testid='apollon-farm-slippage-amount']", {
        state: 'visible',
      });
      const slippageInput = component.getByTestId('apollon-farm-slippage-amount').locator('input');
      await slippageInput.fill('10');

      const hideSlippageButton = component.getByRole('button', {
        name: 'Less',
      });
      await hideSlippageButton.click();

      await page.waitForSelector("[data-testid='apollon-farm-slippage-amount']", {
        state: 'detached',
      });

      const slippageBox = component.locator("[data-testid='apollon-farm-slippage-amount']");
      expect(await slippageBox.count()).toBe(0);

      await showSlippageButton.click();

      expect(await slippageInput.inputValue()).toBe('10');
    });
  });

  test.describe('Guest mode', () => {
    test('should have "Execute" button disabled as guest', async ({ mount }) => {
      const component = await mount(
        <IntegrationWrapper shouldPreselectTokens>
          <Farm />
        </IntegrationWrapper>,
      );

      const swapButton = component.getByRole('button', {
        name: 'Execute',
      });
      await expect(swapButton).toBeDisabled();
    });
  });

  test.describe('Connected mode', () => {
    test('should have "Execute" button enabled when logged in', async ({ mount }) => {
      const component = await mount(
        <IntegrationWrapper shouldPreselectTokens shouldConnectWallet>
          <Farm />
        </IntegrationWrapper>,
      );

      const swapButton = component.getByRole('button', {
        name: 'Execute',
      });
      await expect(swapButton).toBeEnabled();
    });
  });
});
