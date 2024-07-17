import { render, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { graphql } from 'msw';
import { Contracts_Localhost } from '../../../../config';
import { GET_BORROWER_COLLATERAL_TOKENS, GET_BORROWER_DEBT_TOKENS } from '../../../queries';
import MockedCollateralTokens from '../../tests/mockedResponses/GetBorrowerCollateralTokens.mocked.json';
import MockedBorrowerDebtTokens from '../../tests/mockedResponses/GetBorrowerDebtTokens.mocked.json';
import { server } from '../../tests/setupMSW';
import { IntegrationWrapper } from '../../tests/test-utils';
import CollateralUpdateDialog from './CollateralUpdateDialog';

jest.mock('../../../utils/crypto', () => {
  const originalModule = jest.requireActual('../../../utils/crypto');

  return {
    ...originalModule,
    getHints: jest.fn(() => ['upperHint', 'lowerHint']),
  };
});

describe('CollateralUpdateDialog', () => {
  it('DEPOSIT: should call function of mocked contract', async () => {
    const contractMock = {
      borrowerOperationsContract: {
        addColl: jest.fn(async () => ({
          wait: async () => {},
        })),
      },
      collateralTokenContracts: {
        [Contracts_Localhost.ERC20.USDT]: {
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
    );

    const { getByRole, getByTestId } = render(
      <IntegrationWrapper
        shouldConnectWallet
        mockEthers={
          {
            contractMock,
          } as any
        }
      >
        <CollateralUpdateDialog buttonVariant="contained" />
      </IntegrationWrapper>,
    );

    await waitFor(
      () => {
        const openButton = getByRole('button', { name: 'Change' });
        expect(openButton).toBeEnabled();
      },
      { timeout: 5000 },
    );

    const openButton = getByRole('button', { name: 'Change' });
    await userEvent.click(openButton);

    await waitFor(() => {
      const USDTFormControl = getByTestId('apollon-collateral-update-dialog-USDT-amount');
      expect(USDTFormControl).toBeDefined();
    });

    const inputTokenAmount = document.querySelector<HTMLInputElement>(
      `input[name="${Contracts_Localhost.ERC20.USDT}"]`,
    )!;
    await userEvent.type(inputTokenAmount, '10');

    const submitButton = getByRole('button', { name: 'Change' });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(contractMock.collateralTokenContracts[Contracts_Localhost.ERC20.USDT].approve).toHaveBeenCalledTimes(1);
      expect(contractMock.borrowerOperationsContract.addColl).toHaveBeenNthCalledWith(
        1,
        [{ amount: 10000000000000000000n, tokenAddress: Contracts_Localhost.ERC20.USDT }],
        'upperHint',
        'lowerHint',
        expect.any(Array),
        { value: 20000000000000000n },
      );
    });
  });

  it('WITHDRAW: should call function of mocked contract', async () => {
    const contractMock = {
      borrowerOperationsContract: {
        withdrawColl: jest.fn(async () => ({
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
    );

    const { getByRole, getByTestId } = render(
      <IntegrationWrapper
        shouldConnectWallet
        mockEthers={{
          contractMock,
        }}
      >
        <CollateralUpdateDialog buttonVariant="contained" />
      </IntegrationWrapper>,
    );

    await waitFor(
      () => {
        const openButton = getByRole('button', { name: 'Change' });
        expect(openButton).toBeDefined();
      },
      { timeout: 5000 },
    );

    const openButton = getByRole('button', { name: 'Change' });
    await userEvent.click(openButton);

    await waitFor(
      () => {
        const withdrawTab = getByRole('tab', { name: 'WITHDRAW' });
        expect(withdrawTab).toBeEnabled();
      },
      { timeout: 5000 },
    );

    const withdrawTab = getByRole('tab', { name: 'WITHDRAW' });
    await userEvent.click(withdrawTab);

    await waitFor(() => {
      const USDTFormControl = getByTestId('apollon-collateral-update-dialog-USDT-amount');
      expect(USDTFormControl).toBeDefined();
    });

    const inputTokenAmount = document.querySelector<HTMLInputElement>(
      `input[name="${Contracts_Localhost.ERC20.USDT}"]`,
    )!;
    await userEvent.type(inputTokenAmount, '1');

    const submitButton = getByRole('button', { name: 'Change' });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(contractMock.borrowerOperationsContract.withdrawColl).toHaveBeenNthCalledWith(
        1,
        [{ amount: 1000000000000000000n, tokenAddress: Contracts_Localhost.ERC20.USDT }],
        'upperHint',
        'lowerHint',
        expect.any(Array),
        { value: 20000000000000000n },
      );
    });
  });
});
