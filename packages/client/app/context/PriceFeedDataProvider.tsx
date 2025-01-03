import { useQuery } from '@apollo/client';
import { EvmPriceServiceConnection } from '@pythnetwork/pyth-evm-js';
import { parseUnits } from 'ethers';
import { useSnackbar } from 'notistack';
import { PropsWithChildren, createContext, useContext, useEffect, useRef, useState } from 'react';
import { Contracts_ATC, isCollateralTokenAddress, isDebtTokenAddress, isStableCoinAddress } from '../../config';
import { GetTokenOraclesQuery, GetTokenOraclesQueryVariables } from '../generated/gql-types';
import { GET_TOKEN_ORACLES } from '../queries';
import { ContractDataFreshnessManagerType, isFieldOutdated } from './CustomApolloProvider';
import { useErrorMonitoring } from './ErrorMonitoringContext';
import { useEthers } from './EthersProvider';
import { getActiveDataManger } from './utils';

export const PriceFeedDataContext = createContext<{
  getPythUpdateData: () => Promise<{
    updateDataInBytes: string[];
    priceUpdateFee: bigint;
  }>;
  isMarketClosed: boolean;
}>({
  getPythUpdateData: async () => ({
    updateDataInBytes: [],
    priceUpdateFee: 0n,
  }),
  isMarketClosed: false,
});

function PriceFeedDataProvider({ children }: PropsWithChildren) {
  const { enqueueSnackbar } = useSnackbar();

  const {
    currentNetwork,
    contracts: { priceFeedContract },
  } = useEthers();
  const { Sentry } = useErrorMonitoring();

  const [isMarketClosed, setIsMarketClosed] = useState(false);

  const { data: tokenOracleData } = useQuery<GetTokenOraclesQuery, GetTokenOraclesQueryVariables>(GET_TOKEN_ORACLES, {
    onError: (error) => {
      enqueueSnackbar('Error requesting the subgraph. Please reload the page and try again.');
      Sentry.captureException(error);
    },
  });

  const priceServiceRef = useRef<EvmPriceServiceConnection>();
  const oraclePricesInitialized = useRef(false);

  const activeDataManager = getActiveDataManger(currentNetwork!) as ContractDataFreshnessManagerType<
    typeof Contracts_ATC
  >;

  useEffect(() => {
    let connection: EvmPriceServiceConnection;

    if (tokenOracleData) {
      // TODO: Exchange for test net provider
      let connection: EvmPriceServiceConnection = new EvmPriceServiceConnection(
        process.env.NEXT_PUBLIC_PYTH_PROVIDER_URL!,
      );

      priceServiceRef.current = connection;

      const oraclePriceIds = tokenOracleData.tokens
        .filter(({ address }) => !isStableCoinAddress(address))
        .map((token) => token.oracleId);

      // TODO: Initially set market closure, do it in the websocket too.
      priceServiceRef.current.getLatestPriceFeeds(oraclePriceIds).then((res) => {
        const isClosedMarket = res?.some((priceFeed) => priceFeed.getPriceNoOlderThan(5 * 60) === undefined) ?? false;
        setIsMarketClosed(isClosedMarket);

        if (res && oraclePricesInitialized.current === false) {
          oraclePricesInitialized.current = true;
          // Update prices from every token we can find.
          res.forEach((priceFeed) => {
            const token = tokenOracleData.tokens.find((token) => token.oracleId.endsWith(priceFeed.id));
            if (!token) {
              Sentry.captureException(`Received update for unknown token: ${priceFeed.id}`);
              return;
            }

            if (isDebtTokenAddress(token.address)) {
              if (isFieldOutdated(activeDataManager.DebtToken[token.address], 'priceUSDOracle')) {
                const validatedPriceResult = priceFeed.getPriceUnchecked();

                if (validatedPriceResult) {
                  activeDataManager.DebtToken[token.address].priceUSDOracle.fetch(
                    parseUnits(validatedPriceResult.price, 18 - Math.abs(validatedPriceResult.expo)),
                  );
                }
              }
            } else if (isCollateralTokenAddress(token.address)) {
              if (isFieldOutdated(activeDataManager.ERC20[token.address], 'priceUSDOracle')) {
                const validatedPriceResult = priceFeed.getPriceUnchecked();

                if (validatedPriceResult) {
                  activeDataManager.ERC20[token.address].priceUSDOracle.fetch(
                    parseUnits(validatedPriceResult.price, 18 - Math.abs(validatedPriceResult.expo)),
                  );
                }
              }
            }
          });

          const hermesResponseIds = res.map(({ id }) => id);
          // Fetch prices from chain where we didn't get a response from websocket
          tokenOracleData.tokens
            .filter(({ oracleId }) => !hermesResponseIds.includes(oracleId))
            .forEach(({ address }) => {
              if (isDebtTokenAddress(address)) {
                // Only update from chain if price is older than 1min (e.g. websocket failed) and try to initialize with websocket data
                if (isFieldOutdated(activeDataManager.DebtToken[address], 'priceUSDOracle')) {
                  activeDataManager.DebtToken[address].priceUSDOracle.fetch(undefined, priceFeedContract);
                }

                return activeDataManager.DebtToken[address].priceUSDOracle.value();
              } else if (isCollateralTokenAddress(address)) {
                // Only update from chain if price is older than 1min (e.g. websocket failed) and try to initialize with websocket data
                if (isFieldOutdated(activeDataManager.ERC20[address], 'priceUSDOracle')) {
                  activeDataManager.ERC20[address].priceUSDOracle.fetch(undefined, priceFeedContract);
                }
                return activeDataManager.ERC20[address].priceUSDOracle.value();
              }
            });
        }
      });

      connection.subscribePriceFeedUpdates(oraclePriceIds, (priceFeed) => {
        // priceFeedId excludes 0x
        const token = tokenOracleData.tokens.find((token) => token.oracleId.endsWith(priceFeed.id));
        if (!token) {
          Sentry.captureException(`Received update for unknown token: ${priceFeed.id}`);
          return;
        }

        if (isDebtTokenAddress(token.address)) {
          if (isFieldOutdated(activeDataManager.DebtToken[token.address], 'priceUSDOracle')) {
            // FIXME: Maybe have to treat expo here => Take diff and modify Bigint
            const validatedPriceResult = priceFeed.getPriceUnchecked();

            if (validatedPriceResult) {
              activeDataManager.DebtToken[token.address].priceUSDOracle.fetch(
                parseUnits(validatedPriceResult.price, 18 - Math.abs(validatedPriceResult.expo)),
              );
            }
          }
        } else if (isCollateralTokenAddress(token.address)) {
          if (isFieldOutdated(activeDataManager.ERC20[token.address], 'priceUSDOracle')) {
            // FIXME: Maybe have to treat expo here => Take diff and modify Bigint
            const validatedPriceResult = priceFeed.getPriceUnchecked();

            if (validatedPriceResult) {
              // like "6236941729126" for BTC and expo = -8, must convert it to 18 decimals
              activeDataManager.ERC20[token.address].priceUSDOracle.fetch(
                parseUnits(validatedPriceResult.price, 18 - Math.abs(validatedPriceResult.expo)),
              );
            }
          }
        }
      });
    }

    return () => {
      // Clean up websocket connection
      connection?.closeWebSocket();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenOracleData]);

  const getPythUpdateData = async () => {
    if (tokenOracleData) {
      // Disregard Stable from price update
      const allOracleIds = tokenOracleData.tokens
        .filter(({ address }) => !isStableCoinAddress(address))
        .map((token) => token.oracleId);

      const updateDataInBytes = await priceServiceRef.current!.getPriceFeedsUpdateData(allOracleIds);

      const priceUpdateFee = await priceFeedContract.getPythUpdateFee(updateDataInBytes);
      return { updateDataInBytes, priceUpdateFee };
    } else {
      throw new Error('Calling "getPythUpdateData" without cache data, too early.');
    }
  };

  return (
    <PriceFeedDataContext.Provider value={{ getPythUpdateData, isMarketClosed }}>
      {children}
    </PriceFeedDataContext.Provider>
  );
}

export function usePriceFeedData(): {
  getPythUpdateData: () => Promise<{
    updateDataInBytes: string[];
    priceUpdateFee: bigint;
  }>;
  isMarketClosed: boolean;
} {
  const context = useContext(PriceFeedDataContext);
  if (context === undefined) {
    throw new Error('usePriceFeedData must be used within an PriceFeedDataProvider');
  }
  return context;
}

export default PriceFeedDataProvider;
