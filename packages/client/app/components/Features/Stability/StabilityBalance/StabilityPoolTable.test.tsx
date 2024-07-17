import { act, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { graphql } from 'msw';
import { GET_BORROWER_COLLATERAL_TOKENS } from '../../../../queries';
import MockedGetCollateralTokens from '../../../tests/mockedResponses/GetBorrowerCollateralTokens.mocked.json';
import { server } from '../../../tests/setupMSW';
import { IntegrationWrapper } from '../../../tests/test-utils';
import StabilityPoolTable from './StabilityPoolTable';

describe('StabilityPoolTable', () => {
  it('should call withdrawGains function of mocked contract', async () => {
    const contractMock = {
      stabilityPoolManagerContract: {
        withdrawGains: jest.fn(async () => ({
          wait: async () => {},
        })),
      },
    };

    // Mock response so tokens are always available
    server.use(
      graphql.query(GET_BORROWER_COLLATERAL_TOKENS, (_, res, ctx) => {
        return res(ctx.status(200), ctx.data(MockedGetCollateralTokens.data));
      }),
    );

    const { getByRole } = await render(
      <IntegrationWrapper
        shouldConnectWallet
        mockEthers={{
          contractMock,
        }}
      >
        <StabilityPoolTable />
      </IntegrationWrapper>,
    );

    await act(async () => {
      // wait until component is stable. Jest component tests are sooo bad and buggy
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    const claimButton = getByRole('button', { name: 'CLAIM' });

    await waitFor(() => {
      expect(claimButton).toBeEnabled();
    });

    await userEvent.click(claimButton);

    expect(contractMock.stabilityPoolManagerContract.withdrawGains).toHaveBeenCalledTimes(1);
  });
});
