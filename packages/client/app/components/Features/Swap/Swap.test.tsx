import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { parseEther } from 'ethers';
import { Contracts_Localhost } from '../../../../config';
import { IntegrationWrapper, PreselectedTestToken } from '../../tests/test-utils';
import Swap from './Swap';

jest.mock('@apollo/client', () => {
  const originalModule = jest.requireActual('@apollo/client');

  return {
    ...originalModule,
    useApolloClient: jest.fn(() => ({
      refetchQueries: jest.fn(),
    })),
  };
});

jest.mock('../../../utils/crypto', () => {
  const originalModule = jest.requireActual('../../../utils/crypto');

  return {
    ...originalModule,
    getDynamicSwapFee: jest.fn(() => Promise.resolve(parseEther('0.03'))), // returns a bigint
  };
});

describe('Swap', () => {
  it('should call "swapTokensForExactTokens" function and "approve" function of collateral Token of mocked contract', async () => {
    const contractMock = {
      swapOperationsContract: {
        swapExactTokensForTokens: jest.fn(async () => ({
          wait: async () => {},
        })),
      },
      debtTokenContracts: {
        [Contracts_Localhost.DebtToken.STABLE]: {
          approve: jest.fn(async () => ({
            wait: async () => {},
          })),
        },
      },
      priceFeedContract: {
        getPythUpdateFee: jest.fn(async () => 20000000000000000n),
      },
      swapPairContracts: {
        [Contracts_Localhost.SwapPairs.USDT]: {},
      },
    };

    const { getByRole, container } = render(
      <IntegrationWrapper
        shouldPreselectTokens
        shouldConnectWallet
        mockEthers={
          {
            contractMock,
          } as any
        }
      >
        <Swap />
      </IntegrationWrapper>,
    );

    await new Promise((resolve) => setTimeout(resolve, 500));

    const inputJUSD = container.querySelector<HTMLInputElement>('input[name="jUSDAmount"]')!;

    await userEvent.type(inputJUSD, '10');

    const submitButton = getByRole('button', { name: 'SWAP' });

    expect(submitButton).toBeEnabled();
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(contractMock.debtTokenContracts[Contracts_Localhost.DebtToken.STABLE].approve).toHaveBeenCalledTimes(1);
      expect(contractMock.swapOperationsContract.swapExactTokensForTokens).toHaveBeenNthCalledWith(
        1,
        10000000000000000000n,
        9514565199999999834n,
        [Contracts_Localhost.DebtToken.STABLE, PreselectedTestToken.address],
        '0xc5a5c42992decbae36851359345fe25997f5c42d',
        expect.any(Number),
        expect.any(Array),
        { value: 20000000000000000n },
      );
    });
  });

  it('should call swapExactTokensForTokens function of mocked contract', async () => {
    const contractMock = {
      swapOperationsContract: {
        swapTokensForExactTokens: jest.fn(async () => ({
          wait: async () => {},
        })),
      },
      debtTokenContracts: {
        [Contracts_Localhost.DebtToken.STABLE]: {
          approve: jest.fn(async () => ({
            wait: async () => {},
          })),
        },
      },
      collateralTokenContracts: {
        [PreselectedTestToken.address]: {
          approve: jest.fn(async () => ({
            wait: async () => {},
          })),
        },
      },
      priceFeedContract: {
        getPythUpdateFee: jest.fn(async () => 20000000000000000n),
      },
      swapPairContracts: {
        [Contracts_Localhost.SwapPairs.USDT]: {},
      },
    };
    const { getByRole, container } = render(
      <IntegrationWrapper
        shouldPreselectTokens
        shouldConnectWallet
        mockEthers={{
          // @ts-ignore
          contractMock,
        }}
      >
        <Swap />
      </IntegrationWrapper>,
    );

    await new Promise((resolve) => setTimeout(resolve, 500));

    const inputTokenAmount = container.querySelector<HTMLInputElement>('input[name="tokenAmount"]')!;

    await userEvent.type(inputTokenAmount, '5');

    const submitButton = getByRole('button', { name: 'SWAP' });

    expect(submitButton).toBeEnabled();
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(contractMock.debtTokenContracts[Contracts_Localhost.DebtToken.STABLE].approve).toHaveBeenCalledTimes(1);
      expect(contractMock.swapOperationsContract.swapTokensForExactTokens).toHaveBeenNthCalledWith(
        1,
        5000000000000000000n,
        5253000000000000114n,
        [Contracts_Localhost.DebtToken.STABLE, PreselectedTestToken.address],
        '0xc5a5c42992decbae36851359345fe25997f5c42d',
        expect.any(Number),
        expect.any(Array),
        { value: 20000000000000000n },
      );
    });
  });
});
