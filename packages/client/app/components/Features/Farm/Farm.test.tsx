import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parseEther } from 'ethers';
import { Contracts_Localhost } from '../../../../config';
import { IntegrationWrapper, PreselectedTestToken } from '../../tests/test-utils';
import Farm from './Farm';

jest.mock('../../../utils/crypto', () => {
  const originalModule = jest.requireActual('../../../utils/crypto');

  return {
    ...originalModule,
    getHints: jest.fn(() => ['upperHint', 'lowerHint']),
    getDynamicSwapFee: jest.fn(() => Promise.resolve(parseEther('0.03'))), // returns a bigint
  };
});

describe('Farm', () => {
  it('should call openLongPosition function of mocked contract', async () => {
    const contractMock = {
      swapOperationsContract: {
        openLongPosition: jest.fn(async () => ({
          wait: async () => {},
        })),
      },
      priceFeedContract: {
        getPythUpdateFee: jest.fn(async () => 20000000000000000n),
      },
      swapPairContracts: {
        [Contracts_Localhost.SwapPairs.USDT]: {} as any,
      },
    };
    const { getByRole, container } = render(
      <IntegrationWrapper
        shouldPreselectTokens
        shouldConnectWallet
        mockEthers={{
          contractMock,
        }}
      >
        <Farm />
      </IntegrationWrapper>,
    );

    const inputJUSD = container.querySelector<HTMLInputElement>('input[name="farmShortValue"]')!;

    await userEvent.type(inputJUSD, '10');

    const submitButton = getByRole('button', { name: 'EXECUTE' });

    await waitFor(
      () => {
        expect(submitButton).toBeEnabled();
      },
      { timeout: 5000 },
    );

    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(contractMock.swapOperationsContract.openLongPosition).toHaveBeenNthCalledWith(
        1,
        10000000000000000000n,
        8555400000000000000n,
        PreselectedTestToken.address,
        '0xc5a5c42992decbae36851359345fe25997f5c42d',
        { lowerHint: 'lowerHint', maxFeePercentage: 20000000000000000n, upperHint: 'upperHint' },
        expect.any(Number),
        expect.any(Array),
        { value: 20000000000000000n },
      );
    });
  });

  // TODO: Can not short the collateral demo token
  it.skip('should call openShortPosition function of mocked contract', async () => {
    const contractMock = {
      swapOperationsContract: {
        openShortPosition: jest.fn(async () => ({
          wait: async () => {},
        })),
      },
    };
    const { getByRole, container } = render(
      <IntegrationWrapper
        shouldPreselectTokens
        shouldConnectWallet
        mockEthers={{
          contractMock,
        }}
      >
        <Farm />
      </IntegrationWrapper>,
    );

    const shortTab = getByRole('tab', { name: 'SHORT' });
    await userEvent.click(shortTab);

    const inputJUSD = container.querySelector<HTMLInputElement>('input[name="farmShortValue"]')!;

    await userEvent.type(inputJUSD, '100');

    const submitButton = getByRole('button', { name: 'EXECUTE' });

    await waitFor(() => {
      expect(submitButton).toBeEnabled();
    });

    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(contractMock.swapOperationsContract.openShortPosition).toHaveBeenNthCalledWith(
        1,
        100000000000000000000n,
        93099999999999720700n,
        PreselectedTestToken.address,
        '0xb7278a61aa25c888815afc32ad3cc52ff24fe575',
        { lowerHint: 'lowerHint', maxFeePercentage: 20000000000000000n, upperHint: 'upperHint' },
        expect.any(Number),
      );
    });
  });
});
