import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { graphql } from 'msw';
import { Contracts_Localhost } from '../../../../config';
import {
  GET_BORROWER_COLLATERAL_TOKENS,
  GET_BORROWER_DEBT_TOKENS,
  GET_BORROWER_LIQUIDITY_POOLS,
} from '../../../queries';
import MockedCollateralTokens from '../../tests/mockedResponses/GetBorrowerCollateralTokens.mocked.json';
import MockedBorrowerDebtTokens from '../../tests/mockedResponses/GetBorrowerDebtTokens.mocked.json';
import MockedBorrowerLiquidityPools from '../../tests/mockedResponses/GetBorrowerLiquidityPools.mocked.json';
import { server } from '../../tests/setupMSW';
import { IntegrationWrapper } from '../../tests/test-utils';
import LiquidityDepositWithdraw from './LiquidityDepositWithdraw';

jest.mock('../../../utils/crypto', () => {
  const originalModule = jest.requireActual('../../../utils/crypto');

  return {
    ...originalModule,
    getHints: jest.fn(() => ['upperHint', 'lowerHint']),
  };
});

jest.mock('../../../../config', () => {
  const originalModule = jest.requireActual('../../../../config');

  return {
    ...originalModule,
    isDebtTokenAddress: jest.fn(() => true),
  };
});

jest.mock('../../../context/utils', () => {
  const originalModule = jest.requireActual('../../../context/utils');

  return {
    ...originalModule,
    evictCacheTimoutForObject: jest.fn(),
  };
});

// TODO: Write tests to expect arguments in the contract call once they are concluded

describe('LiquidityPool', () => {
  it('Deposit: should call function of mocked contract', async () => {
    const mockedPool = MockedBorrowerLiquidityPools.data.pools[0];

    const contractMock = {
      swapOperationsContract: {
        target: 'swapOperationsContractAddress',
        addLiquidity: jest.fn(async () => ({
          wait: async () => {},
        })),
      },
      debtTokenContracts: {
        [mockedPool.liquidity[0].token.address]: {
          approve: jest.fn(async () => ({
            wait: async () => {},
          })),
        },
        [mockedPool.liquidity[1].token.address]: {
          approve: jest.fn(async () => ({
            wait: async () => {},
          })),
        },
      },
      priceFeedContract: {
        getPythUpdateFee: jest.fn(async () => 20000000000000000n),
      },
    };

    // Mock response so tokens are always available
    server.use(
      graphql.query(GET_BORROWER_COLLATERAL_TOKENS, (_, res, ctx) => {
        return res(ctx.status(200), ctx.data(MockedCollateralTokens.data));
      }),

      graphql.query(GET_BORROWER_DEBT_TOKENS, (_, res, ctx) => {
        return res(ctx.status(200), ctx.data(MockedBorrowerDebtTokens.data));
      }),

      graphql.query(GET_BORROWER_LIQUIDITY_POOLS, (_, res, ctx) => {
        return res(ctx.status(200), ctx.data(MockedBorrowerLiquidityPools.data));
      }),
    );

    const { getByRole, container, getByTestId } = render(
      <IntegrationWrapper
        shouldConnectWallet
        mockEthers={
          {
            contractMock,
          } as any
        }
      >
        <LiquidityDepositWithdraw selectedPoolId={mockedPool.id} />
      </IntegrationWrapper>,
    );

    await waitFor(() => {
      const firstTokenFormControl = getByTestId('apollon-liquidity-pool-deposit-token-a-amount');
      expect(firstTokenFormControl).toBeDefined();
    });

    const inputTokenAmount = container.querySelector<HTMLInputElement>('input[name="tokenAAmount"]')!;
    await userEvent.type(inputTokenAmount, '1');

    const openButton = getByRole('button', { name: 'Update' });
    await userEvent.click(openButton);

    await waitFor(() => {
      expect(contractMock.debtTokenContracts[mockedPool.liquidity[0].token.address].approve).toHaveBeenNthCalledWith(
        1,
        'swapOperationsContractAddress',
        1000000000000000000n,
      );
      expect(contractMock.debtTokenContracts[mockedPool.liquidity[1].token.address].approve).toHaveBeenNthCalledWith(
        1,
        'swapOperationsContractAddress',
        397380000000000011n,
      );
      expect(contractMock.swapOperationsContract.addLiquidity).toHaveBeenNthCalledWith(
        1,
        mockedPool.liquidity[0].token.address,
        mockedPool.liquidity[1].token.address,
        1000000000000000000n,
        397380000000000011n,
        979999999999999982n,
        389432400000000012n,
        {
          meta: { lowerHint: 'lowerHint', maxFeePercentage: 20000000000000000n, upperHint: 'upperHint' },
          priceUpdateData: expect.any(Array),
        },
        expect.any(Number),
        { value: 20000000000000000n },
      );
    });
  });

  it('Withdraw: should call function of mocked contract', async () => {
    const mockedPool = MockedBorrowerLiquidityPools.data.pools[0];

    const contractMock = {
      swapOperationsContract: {
        removeLiquidity: jest.fn(async () => ({
          wait: async () => {},
        })),
      },
      priceFeedContract: {
        getPythUpdateFee: jest.fn(async () => 20000000000000000n),
      },
    };

    // Mock response so tokens are always available
    server.use(
      graphql.query(GET_BORROWER_COLLATERAL_TOKENS, (_, res, ctx) => {
        return res(ctx.status(200), ctx.data(MockedCollateralTokens.data));
      }),

      graphql.query(GET_BORROWER_DEBT_TOKENS, (_, res, ctx) => {
        return res(ctx.status(200), ctx.data(MockedBorrowerDebtTokens.data));
      }),

      graphql.query(GET_BORROWER_LIQUIDITY_POOLS, (_, res, ctx) => {
        return res(ctx.status(200), ctx.data(MockedBorrowerLiquidityPools.data));
      }),
    );

    const { getByRole, container, getByTestId } = render(
      <IntegrationWrapper
        shouldConnectWallet
        mockEthers={
          {
            contractMock,
          } as any
        }
      >
        <LiquidityDepositWithdraw selectedPoolId={mockedPool.id} />
      </IntegrationWrapper>,
    );

    await waitFor(() => {
      const firstTokenFormControl = getByTestId('apollon-liquidity-pool-deposit-token-a-amount');
      expect(firstTokenFormControl).toBeDefined();
    });

    const withdrawTab = getByRole('tab', { name: 'WITHDRAW' });
    await userEvent.click(withdrawTab);

    const inputTokenAmount = container.querySelector<HTMLInputElement>('input[name="tokenAAmount"]')!;
    await userEvent.type(inputTokenAmount, '10');

    const openButton = getByRole('button', { name: 'Update' });
    await userEvent.click(openButton);

    await waitFor(() => {
      expect(contractMock.swapOperationsContract.removeLiquidity).toHaveBeenNthCalledWith(
        1,
        Contracts_Localhost.DebtToken.STABLE,
        MockedBorrowerLiquidityPools.data.pools[0].liquidity[1].token.address,
        10000000000000000000n,
        10427246820671802752n,
        4143556398381570638n,
        'upperHint',
        'lowerHint',
        expect.any(Number),
        expect.any(Array),
        { value: 20000000000000000n },
      );
    });
  });

  // TODO: Write some more unit tests for edge cases
  it.skip('calculate token amount when walletAmount is 0', () => {
    // const tokenA = MockedGetBorrowerLiquidityPools.data.pools[0].liquidity[0] as PoolLiquidity;
    // const tokenB = MockedGetBorrowerLiquidityPools.data.pools[0].liquidity[1] as PoolLiquidity;
    // const result = calculate150PercentTokenValue(
    //   1000,
    //   6000,
    //   tokenA,
    //   tokenB,
    //   { walletAmount: 0 } as any,
    //   { walletAmount: 0 } as any,
    // );
    // const tokenAUSD = result * tokenA.token.priceUSDOracle;
    // expect(tokenAUSD).toBeCloseTo(2474.71);
    // const tokenBUSD = ((result * tokenA.totalAmount) / tokenB.totalAmount) * tokenB.token.priceUSDOracle;
    // expect(tokenBUSD).toBeCloseTo(525.285);
    // expect(tokenAUSD + tokenBUSD).toBeCloseTo(3000);
  });
});
