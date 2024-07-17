import { ApolloClient, InMemoryCache } from '@apollo/client';
import { ThemeProvider } from '@emotion/react';
import { SnackbarProvider } from 'notistack';
import { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import 'whatwg-fetch';
import { NETWORKS, defaultNetwork } from '../../../config';
import { CustomApolloProvider_DevMode, MockedContractData } from '../../context/CustomApolloProvider_dev';
import { ErrorMonitoringContext } from '../../context/ErrorMonitoringContext';
import { EthersContext, useEthers } from '../../context/EthersProvider';
import SelectedTokenProvider, { useSelectedToken } from '../../context/SelectedTokenProvider';
import TransactionDialogProvider from '../../context/TransactionDialogProvider';
import UtilityProvider, { UtilityProviderProps } from '../../context/UtilityProvider';
import buildTheme from '../../theme';
import MockedDebtTokens from './mockedResponses/GetBorrowerDebtTokens.mocked.json';

// This is just the default client config when testing against the dev server
export const client = new ApolloClient({
  // TODO: replace with your own graphql server
  uri: 'https://flyby-router-demo.herokuapp.com/',
  cache: new InMemoryCache(),
});

type Props = {
  shouldPreselectTokens?: boolean;
  shouldConnectWallet?: boolean;
  shouldConnectWalletDelayed?: boolean;
  mockEthers?: {
    contractMock?: Partial<
      Record<keyof ReturnType<typeof useEthers>['contracts'], jest.Mock | Record<string, jest.Mock>>
    >;
    connectWalletMock?: jest.Mock;
  };
  mockedContractData?: Partial<MockedContractData>;
  mockedUtilities?: Partial<UtilityProviderProps>;
  mockSentry?: any;
};

export const IntegrationWrapper = ({
  children,
  mockSentry = {
    addBreadcrumb: () => {},
    // , captureException: () => {}
  },
  mockedContractData,
  mockedUtilities,
  ...stateProps
}: PropsWithChildren<Props>) => {
  const theme = useMemo(() => buildTheme('dark'), []);

  return (
    <ErrorMonitoringContext.Provider
      value={{
        Sentry: mockSentry,
      }}
    >
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          {/* Not using MockedProvider as we are using the same dev server for mocking */}
          <MockEthersProvider {...stateProps}>
            <CustomApolloProvider_DevMode {...mockedContractData}>
              <UtilityProvider {...mockedUtilities}>
                <SelectedTokenProvider>
                  <TransactionDialogProvider>
                    <SetupState {...stateProps}>{children}</SetupState>
                  </TransactionDialogProvider>
                </SelectedTokenProvider>
              </UtilityProvider>
            </CustomApolloProvider_DevMode>
          </MockEthersProvider>
        </SnackbarProvider>
      </ThemeProvider>
    </ErrorMonitoringContext.Provider>
  );
};

export const PreselectedTestToken = MockedDebtTokens.data.debtTokenMetas[0].token;

/**
 * This component is used as a wrapper to mock library Providers and other Context state.
 * Actual calls to the modules of these libraries (ethers) must be made as a unit test because jest provides excellent module mocking.
 */
function SetupState({ children, shouldPreselectTokens }: PropsWithChildren<Pick<Props, 'shouldPreselectTokens'>>) {
  const { setSelectedToken, selectedToken } = useSelectedToken();

  useEffect(() => {
    if (shouldPreselectTokens && !selectedToken) {
      const { address, symbol, id } = PreselectedTestToken;
      setSelectedToken({
        id,
        address,
        change: 0.01,
        decimals: 18,
        isFavorite: true,
        swapFee: BigInt(50000000000000000),
        priceUSDOracle: BigInt(10000000000000000000),
        symbol,
        priceUSD24hAgo: BigInt(10000000000000000000),
        volume30dUSD: BigInt(100000000000000000000000),
        borrowingRate: BigInt(3000),
        pool: {
          id: 'd04e6d77-6a45-4872-a15d-8359e853d5a2',
          address: '0xb7278a61aa25c888815afc32ad3cc52ff24fe575',
          liquidityPair: [BigInt(10000000000000000000000), BigInt(10000000000000000000000)],
          totalValueUSD: BigInt(10000000000000000000000),
        },
      });
    }
  });

  return children;
}

function MockEthersProvider({
  children,
  shouldConnectWallet,
  shouldConnectWalletDelayed,
  mockEthers,
}: PropsWithChildren<Omit<Props, 'mockSentry' | 'shouldPreselectTokens'>>) {
  const [address, setAddress] = useState<string>('');

  if (shouldConnectWallet && !address) {
    // Select local USDT
    setAddress('0xc5a5c42992decbae36851359345fe25997f5c42d');
  }

  if (shouldConnectWalletDelayed && !address) {
    setTimeout(() => {
      setAddress('0xc5a5c42992decbae36851359345fe25997f5c42d');
    }, 500);
  }

  return (
    <EthersContext.Provider
      value={{
        contracts: mockEthers?.contractMock ? mockEthers.contractMock : ({} as any),
        provider: {} as any,
        signer: {} as any,
        currentNetwork: NETWORKS[1] as unknown as typeof defaultNetwork,
        address,
        setCurrentNetwork: () => {},
        connectWallet: () => mockEthers?.connectWalletMock?.(),
      }}
    >
      {children}
    </EthersContext.Provider>
  );
}

// https://playwright.dev/docs/test-fixtures#creating-a-fixture
// https://github.com/microsoft/playwright/issues/27137
// TODO: Not yet implemented
// export const test = base.extend<{ testHook: void }>({
//   testHook: [
//     async ({}, use) => {
//       console.log('BEFORE EACH HOOK FROM FIXTURE');
//       // Any code here will be run as a before each hook

//       await use();

//       console.log('AFTER EACH HOOK FROM FIXTURE');
//       // Put any code you want run automatically after each test here
//     },
//     { auto: true },
//   ],
// });
