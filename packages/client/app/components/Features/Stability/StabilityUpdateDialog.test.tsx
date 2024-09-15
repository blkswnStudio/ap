import { getAllByTestId, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { graphql } from 'msw';
import { GET_BORROWER_DEBT_TOKENS } from '../../../queries';
import MockedGetBorrowerDebtTokens from '../../tests/mockedResponses/GetBorrowerDebtTokens.mocked.json';
import { server } from '../../tests/setupMSW';
import { IntegrationWrapper } from '../../tests/test-utils';
import StabilityUpdateDialog from './StabilityUpdateDialog';

describe('StabilityUpdateDialog', () => {
  it('should call function "provideStability" and 2x "approve" of mocked contract', async () => {
    const contractMock = {
      stabilityPoolManagerContract: {
        provideStability: jest.fn(),
      },
      debtTokenContracts: {
        [MockedGetBorrowerDebtTokens.data.debtTokenMetas[0].token.address]: {
          approve: jest.fn(),
        },
        [MockedGetBorrowerDebtTokens.data.debtTokenMetas[1].token.address]: {
          approve: jest.fn(),
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
        <StabilityUpdateDialog />
      </IntegrationWrapper>,
    );

    const openButton = getByRole('button', { name: 'Update' });

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
        'apollon-stability-update-dialog-input',
      )[0];
      expect(firstTokenFormControl).toBeDefined();
    });

    const firstTokenFormControl = getAllByTestId(
      document.querySelector('body')!,
      'apollon-stability-update-dialog-input',
    )[0];
    const inputToken = firstTokenFormControl.querySelector<HTMLInputElement>('input')!;
    await userEvent.type(inputToken, '10');

    const secondTokenFormControl = getAllByTestId(
      document.querySelector('body')!,
      'apollon-stability-update-dialog-input',
    )[1];
    const secondInputToken = secondTokenFormControl.querySelector<HTMLInputElement>('input')!;
    await userEvent.type(secondInputToken, '20');

    const submitButton = getByRole('button', { name: 'Update' });
    await userEvent.click(submitButton);

    expect(
      contractMock.debtTokenContracts[MockedGetBorrowerDebtTokens.data.debtTokenMetas[0].token.address].approve,
    ).toHaveBeenNthCalledWith(1, '0x509ee0d083ddf8ac028f2a56731412edd63223s8', 10000000000000000000n);
    expect(
      contractMock.debtTokenContracts[MockedGetBorrowerDebtTokens.data.debtTokenMetas[1].token.address].approve,
    ).toHaveBeenNthCalledWith(1, '0x509ee0d083ddf8ac028f2a56731412edd63223s8', 20000000000000000000n);
    expect(contractMock.stabilityPoolManagerContract.provideStability).toHaveBeenNthCalledWith(1, [
      { amount: 10000000000000000000n, tokenAddress: '16fdb8e8-f202-4564-9af5-71b77ebc11a3' },
      { amount: 20000000000000000000n, tokenAddress: '6a5cebfd-4a4a-4340-a3a6-9a1de5bb955c' },
    ]);
  });

  it('should call function "withdrawStability" of mocked contract', async () => {
    const contractMock = {
      stabilityPoolManagerContract: {
        withdrawStability: jest.fn(),
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
        <StabilityUpdateDialog />
      </IntegrationWrapper>,
    );

    const openButton = getByRole('button', { name: 'Update' });

    await waitFor(
      () => {
        expect(openButton).toBeEnabled();
      },
      { timeout: 5000 },
    );

    await userEvent.click(openButton);

    // Open WITHDRAW TAB
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
      const firstTokenFormControl = getAllByTestId(
        document.querySelector('body')!,
        'apollon-stability-update-dialog-input',
      )[0];
      expect(firstTokenFormControl).toBeDefined();
    });

    const firstTokenFormControl = getAllByTestId(
      document.querySelector('body')!,
      'apollon-stability-update-dialog-input',
    )[0];
    const inputToken = firstTokenFormControl.querySelector<HTMLInputElement>('input')!;
    await userEvent.type(inputToken, '10');

    const secondTokenFormControl = getAllByTestId(
      document.querySelector('body')!,
      'apollon-stability-update-dialog-input',
    )[1];
    const secondInputToken = secondTokenFormControl.querySelector<HTMLInputElement>('input')!;
    await userEvent.type(secondInputToken, '20');

    const submitButton = getByRole('button', { name: 'Update' });
    await userEvent.click(submitButton);

    expect(contractMock.stabilityPoolManagerContract.withdrawStability).toHaveBeenNthCalledWith(1, [
      { amount: 10000000000000000000n, tokenAddress: '16fdb8e8-f202-4564-9af5-71b77ebc11a3' },
      { amount: 20000000000000000000n, tokenAddress: '6a5cebfd-4a4a-4340-a3a6-9a1de5bb955c' },
    ]);
  });
});
