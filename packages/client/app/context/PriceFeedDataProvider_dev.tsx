import { useQuery } from '@apollo/client';
import { parseEther } from 'ethers';
import { PropsWithChildren, useContext, useEffect } from 'react';
import { Contracts_ATC, isCollateralTokenAddress, isDebtTokenAddress } from '../../config';
import { GetTokenOraclesQuery, GetTokenOraclesQueryVariables } from '../generated/gql-types';
import { GET_TOKEN_ORACLES } from '../queries';
import { ContractDataFreshnessManagerType, isFieldOutdated } from './CustomApolloProvider';
import { useEthers } from './EthersProvider';
import { PriceFeedDataContext } from './PriceFeedDataProvider';
import { getActiveDataManger } from './utils';

/**
 * Mocked Provider for all local development and testing purposes.
 */
function PriceFeedDataProvider_DevMode({ children }: PropsWithChildren) {
  const {
    currentNetwork,
    contracts: { priceFeedContract },
  } = useEthers();

  const { data: tokenOracleData } = useQuery<GetTokenOraclesQuery, GetTokenOraclesQueryVariables>(GET_TOKEN_ORACLES);

  const activeDataManager = getActiveDataManger(currentNetwork!) as ContractDataFreshnessManagerType<
    typeof Contracts_ATC
  >;

  useEffect(() => {
    let demoPriceIntervall: NodeJS.Timer;

    if (tokenOracleData && process.env.MOCK_PRICING === 'true') {
      const oraclePriceIds = tokenOracleData.tokens.map((token) => token.oracleId);

      // Initialize with demo data to show something
      tokenOracleData.tokens.forEach((token) => {
        priceFeedContract.getPrice(token.address).then((price) => {
          if (isDebtTokenAddress(token.address)) {
            if (isFieldOutdated(activeDataManager.DebtToken[token.address], 'priceUSDOracle')) {
              activeDataManager.DebtToken[token.address].priceUSDOracle.fetch(price.price);
            }
          } else if (isCollateralTokenAddress(token?.address)) {
            if (isFieldOutdated(activeDataManager.ERC20[token.address], 'priceUSDOracle')) {
              activeDataManager.ERC20[token.address].priceUSDOracle.fetch(price.price);
            }
          }
        });
      });

      // const priceIds = [
      //   // You can find the ids of prices at https://pyth.network/developers/price-feed-ids#pyth-evm-stable
      //   "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", // BTC/USD price id
      //   "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", // ETH/USD price id
      // ];

      demoPriceIntervall = setInterval(() => {
        const randomTokenOracleId = oraclePriceIds[Math.floor(Math.random() * oraclePriceIds.length)];

        const token = tokenOracleData.tokens.find((token) => token.oracleId === randomTokenOracleId)!;

        priceFeedContract.getPrice(token.address).then((price) => {
          const newTokenPrice = (price.price * parseEther((Math.random() * 0.4 + 0.8).toString())) / parseEther('1');
          if (isDebtTokenAddress(token.address)) {
            if (isFieldOutdated(activeDataManager.DebtToken[token.address], 'priceUSDOracle')) {
              activeDataManager.DebtToken[token.address].priceUSDOracle.fetch(newTokenPrice);
            }
          } else if (isCollateralTokenAddress(token?.address)) {
            if (isFieldOutdated(activeDataManager.ERC20[token.address], 'priceUSDOracle')) {
              activeDataManager.ERC20[token.address].priceUSDOracle.fetch(newTokenPrice);
            }
          }
        });
      }, 10000);
    }

    return () => {
      clearInterval(demoPriceIntervall);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenOracleData]);

  const getPythUpdateData = async () => {
    if (tokenOracleData) {
      // This is the mocked priceFeed from local development, adjust it when more tokens are attached
      const mockedUpdateData: string[] = [
        '0x000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000004e3b2920000000000000000000000000000000000000000000000000000000030e4f9b400fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffa00000000000000000000000000000000000000000000000000000000662fa97200000000000000000000000000000000000000000000000000000004e3b2920000000000000000000000000000000000000000000000000000000030e4f9b400fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffa00000000000000000000000000000000000000000000000000000000662fa97200000000000000000000000000000000000000000000000000000000662fa972',
        '0x000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000f42400000000000000000000000000000000000000000000000000000000000989680fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffa00000000000000000000000000000000000000000000000000000000662fa97200000000000000000000000000000000000000000000000000000000000f42400000000000000000000000000000000000000000000000000000000000989680fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffa00000000000000000000000000000000000000000000000000000000662fa97200000000000000000000000000000000000000000000000000000000662fa972',
        '0x000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000004c4b400000000000000000000000000000000000000000000000000000000002faf080fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffa00000000000000000000000000000000000000000000000000000000662fa97200000000000000000000000000000000000000000000000000000000004c4b400000000000000000000000000000000000000000000000000000000002faf080fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffa00000000000000000000000000000000000000000000000000000000662fa97200000000000000000000000000000000000000000000000000000000662fa972',
        '0x000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000f42400000000000000000000000000000000000000000000000000000000000989680fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffa00000000000000000000000000000000000000000000000000000000662fa97200000000000000000000000000000000000000000000000000000000000f42400000000000000000000000000000000000000000000000000000000000989680fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffa00000000000000000000000000000000000000000000000000000000662fa97200000000000000000000000000000000000000000000000000000000662fa972',
        '0x00000000000000000000000000000000000000000000000000000000000000050000000000000000000000000000000000000000000000000000000008f0d1800000000000000000000000000000000000000000000000000000000059682f00fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffa00000000000000000000000000000000000000000000000000000000662fa9720000000000000000000000000000000000000000000000000000000008f0d1800000000000000000000000000000000000000000000000000000000059682f00fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffa00000000000000000000000000000000000000000000000000000000662fa97200000000000000000000000000000000000000000000000000000000662fa972',
        '0x00000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000014dc938000000000000000000000000000000000000000000000000000000000d09dc300fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffa00000000000000000000000000000000000000000000000000000000662fa9720000000000000000000000000000000000000000000000000000000014dc938000000000000000000000000000000000000000000000000000000000d09dc300fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffa00000000000000000000000000000000000000000000000000000000662fa97200000000000000000000000000000000000000000000000000000000662fa972',
      ];

      const priceUpdateFee = await priceFeedContract.getPythUpdateFee(mockedUpdateData);

      return { updateDataInBytes: mockedUpdateData, priceUpdateFee };
    } else {
      throw new Error('Calling "getPythUpdateData" without cache data, too early.');
    }
  };

  return (
    <PriceFeedDataContext.Provider value={{ getPythUpdateData, isMarketClosed: false }}>
      {children}
    </PriceFeedDataContext.Provider>
  );
}

export function usePriceFeedData(): {
  getPythUpdateData: () => Promise<{
    updateDataInBytes: string[];
    priceUpdateFee: bigint;
  }>;
} {
  const context = useContext(PriceFeedDataContext);
  if (context === undefined) {
    throw new Error('usePriceFeedData must be used within an PriceFeedDataProvider');
  }
  return context;
}

export default PriceFeedDataProvider_DevMode;
