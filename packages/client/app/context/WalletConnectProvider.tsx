'use client';

import { PaletteMode, useTheme } from '@mui/material';
import { createWeb3Modal, defaultConfig } from '@web3modal/ethers/react';
import { PropsWithChildren, useEffect } from 'react';
import { NETWORKS } from '../../config';

const metadata = {
  name: 'jAssets',
  description: 'AppKit for jAssets',
  url: 'https://www.jassets.org', // origin must match your domain & subdomain
  icons: ['https://www.jassets.org/assets/svgs/Apollon_logo_negative.svg'],
};

const ethersConfig = defaultConfig({
  /*Required*/
  metadata,
  /*Optional*/
  enableCoinbase: false, // true by default
});

const chains = NETWORKS.filter(({ environment }) =>
  environment.includes(process.env.NEXT_PUBLIC_ENVIRONMENT as any),
).map(({ chainIdNumber, chainName, blockExplorerUrls, nativeCurrency, rpcUrls }) => ({
  chainId: chainIdNumber,
  name: chainName,
  currency: nativeCurrency.symbol,
  explorerUrl: blockExplorerUrls[0],
  rpcUrl: rpcUrls[0],
}));
const sharedThemeVariables = {
  '--w3m-font-family': 'Space Grotesk Variable',
  '--w3m-font-size-master': '14px',
  '--w3m-border-radius-master': '4px',
};
const appKit = createWeb3Modal({
  ethersConfig,
  chains,
  //   TODO: This is still buggy
  // defaultChain: (process.env.NEXT_PUBLIC_ENVIRONMENT === "staging" ? chains[1] : chains[0]) as any,
  //   This is not immediately available on runtime on dev... It must be hardcoded...
  projectId: '7b9c6d4c6ec87ad7c14c87057a307384',
  // FIXME: Set this to production only later
  enableAnalytics: true, // Optional - defaults to your Cloud configuration
  enableOnramp: false,
  enableSwaps: false,
  includeWalletIds: [
    'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96',
    '18388be9ac2d02726dbac9777c96efaac06d744b2f6d580fccdd4127a6d01fd1',
  ],
  allWallets: 'HIDE',
  // https://docs.walletconnect.com/appkit/react/core/theming
  themeVariables: {
    ...sharedThemeVariables,
  },
  chainImages: NETWORKS.reduce(
    (acc, { chainIdNumber, image }) => {
      acc[chainIdNumber] = image;
      return acc;
    },
    {} as Record<string, string>,
  ),
});

export function Web3Modal({
  children,
  themeMode,
}: PropsWithChildren<{
  themeMode: PaletteMode;
}>) {
  const theme = useTheme();

  useEffect(() => {
    if (appKit) {
      appKit.setThemeMode(themeMode);
    }
  }, [themeMode]);
  useEffect(() => {
    if (appKit) {
      appKit.setThemeVariables({
        ...sharedThemeVariables,
        '--w3m-accent': theme.palette.info.main,
      });
    }
  }, [theme]);

  return children;
}
