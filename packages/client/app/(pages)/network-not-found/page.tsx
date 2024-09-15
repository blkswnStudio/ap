'use client';

import { Button, Typography } from '@mui/material';
import { BrowserProvider, Network } from 'ethers';
import { useRouter } from 'next/navigation';
import { defaultNetwork } from '../../../config';
import ApollonLogo from '../../components/Icons/ApollonLogo';

function NetworkNotFound() {
  const router = useRouter();

  const changeNetworkAndConnectLatestAccount = async () => {
    const { blockExplorerUrls, chainId, chainName, nativeCurrency, rpcUrls } = defaultNetwork;

    const connectAccount = async () => {
      if (typeof window.ethereum !== 'undefined') {
        // @ts-ignore
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });

        if (accounts.length > 0) {
          const mmNetwork = new Network(chainName, chainId);
          const newProvider = new BrowserProvider(window.ethereum as any, mmNetwork);

          await newProvider!.getSigner(accounts[0]);
        }
      }
    };

    if (typeof window.ethereum !== 'undefined') {
      try {
        // @ts-ignore
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [
            {
              // All params must be provided to make it work
              chainId,
            },
          ],
        });

        await connectAccount();
        router.push('/spot');
      } catch (error) {
        try {
          // @ts-ignore
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                // All params must be provided to make it work
                chainId,
                rpcUrls,
                chainName,
                nativeCurrency,
                blockExplorerUrls,
              },
            ],
          });
        } catch (error) {
          if (typeof window.ethereum !== 'undefined') {
            await connectAccount();
            router.push('/spot');
          }
        }
      }
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 52px)',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <ApollonLogo />
      </div>

      <img
        src="assets/svgs/client-side-error.svg"
        alt="A shape with circles, white diamonds and a big yellow diamond."
        height="332"
        typeof="image/svg+xml"
      />

      <Typography variant="h6" sx={{ mt: '50px', mb: '10px' }}>
        You are not connected to a supported network.
      </Typography>

      <Typography variant="titleAlternate" fontWeight={400} fontSize={17} sx={{ maxWidth: 1000 }} textAlign="center">
        We are trying to navigate you through the Web3 landscape as conveniently as possible but sometimes things get
        stuck. You can switch to the default network and use the latest account you had connected and try again.
      </Typography>

      <Button
        sx={{ width: 500, borderColor: 'primary.contrastText', mt: '30px' }}
        variant="outlined"
        onClick={changeNetworkAndConnectLatestAccount}
      >
        Switch to default network and connect latest account
      </Button>
    </div>
  );
}

export default NetworkNotFound;
