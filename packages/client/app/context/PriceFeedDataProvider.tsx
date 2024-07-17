import { useQuery } from '@apollo/client';
import { EvmPriceServiceConnection } from '@pythnetwork/pyth-evm-js';
import { PropsWithChildren, createContext, useContext, useEffect, useRef, useState } from 'react';
import { Contracts_ATC, isStableCoinAddress } from '../../config';
import { GetTokenOraclesQuery, GetTokenOraclesQueryVariables } from '../generated/gql-types';
import { GET_TOKEN_ORACLES } from '../queries';
import { ContractDataFreshnessManagerType } from './CustomApolloProvider';
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
  const {
    currentNetwork,
    contracts: { priceFeedContract },
  } = useEthers();

  const [isMarketClosed, setIsMarketClosed] = useState(false);

  const { data: tokenOracleData } = useQuery<GetTokenOraclesQuery, GetTokenOraclesQueryVariables>(GET_TOKEN_ORACLES);

  const priceServiceRef = useRef<EvmPriceServiceConnection>();

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

      // TODO: Initially set market clossure, do it in the websocket too.
      priceServiceRef.current.getLatestPriceFeeds(oraclePriceIds).then((res) => {
        const isClosedMarket = res?.some((priceFeed) => priceFeed.getPriceNoOlderThan(5 * 60) === undefined) ?? false;
        setIsMarketClosed(isClosedMarket);
      });

      // TODO: Also get real price from API instead of contract priceFeed
      // connection.subscribePriceFeedUpdates(oraclePriceIds, (priceFeed) => {
      //   const token = tokenOracleData.tokens.find((token) => token.oracleId === priceFeed.id);

      //   if (!token) {
      //     // This should never happen, just observe
      //     console.error(`Received update for unknown token: ${priceFeed.id}`);
      //     return;
      //   }

      //   if (isDebtTokenAddress(token.address)) {
      //     if (isFieldOutdated(activeDataManager.DebtToken[token.address], 'priceUSDOracle')) {
      //       // FIXME: Maybe have to treat expo here => Take diff and modify Bigint
      //       const validatedPriceResult = priceFeed.getPriceNoOlderThan(10);
      //       if (validatedPriceResult) {
      //         activeDataManager.DebtToken[token.address].priceUSDOracle.fetch(BigInt(validatedPriceResult.price));
      //       }
      //     }
      //   } else if (isCollateralTokenAddress(token.address)) {
      //     if (isFieldOutdated(activeDataManager.ERC20[token.address], 'priceUSDOracle')) {
      //       // FIXME: Maybe have to treat expo here => Take diff and modify Bigint
      //       const validatedPriceResult = priceFeed.getPriceNoOlderThan(10);
      //       if (validatedPriceResult) {
      //         activeDataManager.ERC20[token.address].priceUSDOracle.fetch(BigInt(validatedPriceResult.price));
      //       }
      //     }
      //   }
      // });
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
