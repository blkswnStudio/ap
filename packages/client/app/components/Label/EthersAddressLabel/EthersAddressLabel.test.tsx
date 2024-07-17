import { fireEvent, render, waitFor } from '@testing-library/react';

import { IntegrationWrapper } from '../../tests/test-utils';
import EthersAddressLabel from './EthersAddressLabel';

// TODO: Write tests to expect arguments in the contract call once they are concluded

describe('EthersAddressLabel', () => {
  it('should call "connectWallet" function of ethers.js', async () => {
    const connectWalletMock = jest.fn();
    const { getByRole } = render(
      <IntegrationWrapper
        mockEthers={{
          connectWalletMock,
        }}
      >
        <EthersAddressLabel />
      </IntegrationWrapper>,
    );

    const loginButton = getByRole('button', { name: 'Connect Wallet' });

    fireEvent(
      loginButton,
      new MouseEvent('click', {
        bubbles: true,
      }),
    );

    await waitFor(() => {
      expect(connectWalletMock).toHaveBeenCalled();
    });
  });
});
