import { render, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { graphql } from 'msw';
import { GET_BORROWER_COLLATERAL_TOKENS } from '../../../queries';
import MockedGetCollateralTokens from '../../tests/mockedResponses/GetBorrowerCollateralTokens.mocked.json';
import { server } from '../../tests/setupMSW';
import { IntegrationWrapper } from '../../tests/test-utils';
import CloseTroveDialog from './CloseTroveDialog';

describe('CloseTroveDialog', () => {
  it('should call "closeTrove" function of mocked contract', async () => {
    const contractMock = {
      borrowerOperationsContract: {
        closeTrove: jest.fn(async () => ({
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
        return res(ctx.status(200), ctx.data(MockedGetCollateralTokens.data));
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
        <CloseTroveDialog buttonVariant="contained" />
      </IntegrationWrapper>,
    );

    await waitFor(
      () => {
        const openButton = getByRole('button', { name: 'Close Trove' });
        expect(openButton).toBeEnabled();
      },
      { timeout: 5000 },
    );

    const openButton = getByRole('button', { name: 'Close Trove' });
    await userEvent.click(openButton);

    const submitButton = getByRole('button', { name: 'Close Trove' });
    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(contractMock.borrowerOperationsContract.closeTrove).toHaveBeenCalledTimes(1);
    });
  });
});
