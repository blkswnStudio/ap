import { useQuery } from '@apollo/client';
import { parseEther, parseUnits } from 'ethers';
import { useSnackbar } from 'notistack';
import { PropsWithChildren, useContext, useEffect } from 'react';
import { Contracts_ATC, isCollateralTokenAddress, isDebtTokenAddress } from '../../config';
import { GetTokenOraclesQuery, GetTokenOraclesQueryVariables } from '../generated/gql-types';
import { GET_TOKEN_ORACLES } from '../queries';
import { ContractDataFreshnessManagerType, isFieldOutdated } from './CustomApolloProvider';
import { useErrorMonitoring } from './ErrorMonitoringContext';
import { useEthers } from './EthersProvider';
import { PriceFeedDataContext } from './PriceFeedDataProvider';
import { getActiveDataManger } from './utils';

/**
 * Mocked Provider for all local development and testing purposes.
 */
function PriceFeedDataProvider_DevMode({ children }: PropsWithChildren) {
  const { enqueueSnackbar } = useSnackbar();

  const {
    currentNetwork,
    provider,
    contracts: { priceFeedContract, mockPythContract },
  } = useEthers();
  const { Sentry } = useErrorMonitoring();

  const { data: tokenOracleData } = useQuery<GetTokenOraclesQuery, GetTokenOraclesQueryVariables>(GET_TOKEN_ORACLES, {
    onError: (error) => {
      enqueueSnackbar('Error requesting the subgraph. Please reload the page and try again.');
      Sentry.captureException(error);
    },
  });

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
      const priceData = [
        {
          token: 'BTC',
          id: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
          price: 21000,
        },
        {
          token: 'USDT',
          id: '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
          price: 1,
        },
        {
          token: 'STOCK',
          id: '0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688',
          price: 150,
        },
        {
          token: 'STOCK_2',
          id: '0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1',
          price: 350,
        },
        {
          token: 'STABLE',
          id: '0x0000000000000000000000000000000000000000000000000000000000000000',
          price: 1,
        },
        {
          token: 'GOV',
          id: '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
          price: 5,
        },
      ];

      const generatePriceUpdateDataWithFee = async (timeOffset: number = 0) => {
        const ret: any[] = await generatePriceUpdateData(timeOffset);
        const fee = await priceFeedContract.getPythUpdateFee(ret);
        return {
          data: ret,
          fee: fee,
          payableData: { value: fee, gasLimit: 15000000n },
        };
      };

      const generatePriceUpdateData = async (timeOffset: number = 0): Promise<any> => {
        let ret: any[] = [];

        const latestBlock = await provider!.getBlock('latest');
        const now = latestBlock!.timestamp;
        console.log('latestBlock: ', latestBlock);
        console.log('now: ', now);

        for (let n = 0; n < priceData.length; n++) {
          const d = priceData[n];
          const p = parseUnits(d.price.toFixed(6), 6);
          const u = await mockPythContract.createPriceFeedUpdateData(d.id, p, 10n * p, -6, p, 10n * p, now, now);
          ret.push(u);
        }
        return ret;
      };
      // This is the mocked priceFeed from local development, adjust it when more tokens are attached, from "generatePriceUpdateDataWithFee"
      const { data, fee } = await generatePriceUpdateDataWithFee();
      console.log('data: ', data);

      return { updateDataInBytes: data, priceUpdateFee: fee };
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
