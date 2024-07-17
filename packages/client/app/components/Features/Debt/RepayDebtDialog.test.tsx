import { getAllByTestId, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { graphql } from 'msw';
import { GET_BORROWER_DEBT_TOKENS } from '../../../queries';
import MockedGetBorrowerDebtTokens from '../../tests/mockedResponses/GetBorrowerDebtTokens.mocked.json';
import { server } from '../../tests/setupMSW';
import { IntegrationWrapper } from '../../tests/test-utils';
import RepayDebtDialog from './RepayDebtDialog';

describe.skip('RepayDebtDialog', () => {
  it('should call function "repayDebt" and 2x "approve" of mocked contract', async () => {
    const contractMock = {
      borrowerOperationsContract: {
        repayDebt: jest.fn(async () => ({
          wait: async () => {},
        })),
      },
      debtTokenContracts: {
        [MockedGetBorrowerDebtTokens.data.debtTokenMetas[0].token.address]: {
          approve: jest.fn(async () => ({
            wait: async () => {},
          })),
        },
        [MockedGetBorrowerDebtTokens.data.debtTokenMetas[1].token.address]: {
          approve: jest.fn(async () => ({
            wait: async () => {},
          })),
        },
      },
    };

    // Mock response so tokens are always available
    server.use(
      graphql.query(GET_BORROWER_DEBT_TOKENS, (_, res, ctx) => {
        return res(ctx.status(200), ctx.data(MockedGetBorrowerDebtTokens.data));
      }),
    );

    const { getByRole } = render(
      <IntegrationWrapper
        shouldConnectWallet
        mockEthers={
          {
            contractMock,
          } as any
        }
      >
        <RepayDebtDialog />
      </IntegrationWrapper>,
    );

    const openButton = getByRole('button', { name: 'Repay' });

    await waitFor(
      () => {
        expect(openButton).toBeEnabled();
      },
      { timeout: 5000 },
    );

    await userEvent.click(openButton);

    await waitFor(() => {
      const firstTokenFormControl = getAllByTestId(
        document.querySelector('body')!,
        'apollon-repay-debt-dialog-input',
      )[0];
      expect(firstTokenFormControl).toBeDefined();
    });

    const firstTokenFormControl = getAllByTestId(document.querySelector('body')!, 'apollon-repay-debt-dialog-input')[0];
    const inputToken = firstTokenFormControl.querySelector<HTMLInputElement>('input')!;
    await userEvent.type(inputToken, '10');

    const secondTokenFormControl = getAllByTestId(
      document.querySelector('body')!,
      'apollon-repay-debt-dialog-input',
    )[1];
    const secondInputToken = secondTokenFormControl.querySelector<HTMLInputElement>('input')!;
    await userEvent.type(secondInputToken, '20');

    const submitButton = getByRole('button', { name: 'Repay Debt' });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(
        contractMock.debtTokenContracts[MockedGetBorrowerDebtTokens.data.debtTokenMetas[0].token.address].approve,
      ).toHaveBeenNthCalledWith(1, '0x509ee0d083ddf8ac028f2a56731412edd63223s8', 10000000000000000000n);
      expect(
        contractMock.debtTokenContracts[MockedGetBorrowerDebtTokens.data.debtTokenMetas[1].token.address].approve,
      ).toHaveBeenNthCalledWith(1, '0x509ee0d083ddf8ac028f2a56731412edd63223s8', 20000000000000000000n);
      expect(contractMock.borrowerOperationsContract.repayDebt).toHaveBeenNthCalledWith(1, [
        { amount: 10000000000000000000n, tokenAddress: '16fdb8e8-f202-4564-9af5-71b77ebc11a3' },
        { amount: 20000000000000000000n, tokenAddress: '6a5cebfd-4a4a-4340-a3a6-9a1de5bb955c' },
      ]);
    });
  });
});
