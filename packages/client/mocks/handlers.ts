import { faker } from '@faker-js/faker';
import { ethers } from 'ethers';
import { graphql } from 'msw';
import { Contracts_Localhost } from '../app/../config';
import { FAVORITE_ASSETS_LOCALSTORAGE_KEY } from '../app/components/Features/Assets/Assets';
import {
  BorrowerHistory,
  BorrowerHistoryType,
  CollateralTokenMeta,
  DebtTokenMeta,
  GetSelectedTokenQueryVariables,
  LongShortDirection,
  Pool,
  Query,
  QueryBorrowerHistoriesArgs,
  QueryCollateralTokenMetasArgs,
  QueryDebtTokenMetasArgs,
  QueryPoolsArgs,
  QuerySwapEventsArgs,
  QueryTokenArgs,
  QueryTokenCandleSingletonArgs,
  QueryTokenCandlesArgs,
  ReservePoolUsdHistoryChunk,
  SwapEvent,
  SystemInfo,
  Token,
  TokenAmount,
  TokenCandle,
  TokenCandleSingleton,
  TotalValueLockedUsdHistoryChunk,
  TotalValueMintedUsdHistoryChunk,
} from '../app/generated/gql-types';
import {
  GET_ALL_DEBT_TOKENS,
  GET_ALL_POOLS,
  GET_BORROWER_COLLATERAL_TOKENS,
  GET_BORROWER_DEBT_TOKENS,
  GET_BORROWER_LIQUIDITY_POOLS,
  GET_BORROWER_STABILITY_HISTORY,
  GET_BORROWER_SWAPS,
  GET_COLLATERAL_USD_HISTORY,
  GET_DEBT_USD_HISTORY,
  GET_RESERVE_USD_HISTORY,
  GET_SELECTED_TOKEN,
  GET_SYSTEMINFO,
  GET_TOKEN_ORACLES,
  GET_TOKEN_PRICES_24h_AGO,
  GET_TRADING_VIEW_CANDLES,
  GET_TRADING_VIEW_LATEST_CANDLE,
} from '../app/queries';
import { bigIntStringToFloat, floatToBigInt } from '../app/utils/math';

const getFavoritedAssetsFromLS = () => {
  return typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem(FAVORITE_ASSETS_LOCALSTORAGE_KEY) ?? '[]')
    : [];
};

const favoritedAssets: string[] = getFavoritedAssetsFromLS();
const now = Math.round(Date.now() / 1000);
const oneDayInSeconds = 24 * 60 * 60;

const STABLE: Omit<Token, 'priceUSDOracle' | 'borrowingRate'> = {
  id: faker.string.uuid(),
  __typename: 'Token',
  address: Contracts_Localhost.DebtToken.STABLE,
  symbol: 'JUSD',
  createdAt: (faker.date.past().getTime() / 1000).toString(),
  isPoolToken: faker.datatype.boolean(),
  decimals: 18,
  oracleId: faker.string.alphanumeric(10),
};

export const tokens: Omit<Token, 'priceUSDOracle' | 'borrowingRate'>[] = Array(10)
  .fill(null)
  .map<Omit<Token, 'priceUSDOracle' | 'borrowingRate'>>((_, index) => ({
    id: faker.string.uuid(),
    __typename: 'Token',
    address: index <= favoritedAssets.length - 1 ? favoritedAssets[index] : faker.finance.ethereumAddress(),
    symbol: faker.finance.currencyCode(),
    // Unix timestamp in seconds like the API returns it.
    createdAt: (faker.date.past().getTime() / 1000).toString(),
    isPoolToken: faker.datatype.boolean(),
    decimals: 18,
    oracleId: faker.string.alphanumeric(10),
  }))
  .concat(STABLE);

// 5 hard tokens always with JUSD
const collateralTokens: Omit<Token, 'priceUSDOracle' | 'borrowingRate'>[] = Object.entries(
  Contracts_Localhost.ERC20,
).map<Omit<Token, 'priceUSDOracle' | 'borrowingRate'>>(([symbol, address]) => ({
  id: faker.string.uuid(),
  __typename: 'Token',
  address,
  symbol,
  createdAt: (faker.date.past().getTime() / 1000).toString(),
  isPoolToken: faker.datatype.boolean(),
  decimals: 18,
  oracleId: faker.string.alphanumeric(10),
}));

const collateralTokenMeta: Omit<
  CollateralTokenMeta,
  'walletAmount' | 'troveLockedAmount' | 'stabilityGainedAmount' | 'collSurplusAmount'
>[] = collateralTokens.map<
  Omit<CollateralTokenMeta, 'walletAmount' | 'troveLockedAmount' | 'stabilityGainedAmount' | 'collSurplusAmount'>
>((collToken) => {
  return {
    __typename: 'CollateralTokenMeta',
    id: faker.string.uuid(),
    timestamp: now.toString(),
    token: collToken as Token,
    totalValueLockedUSD: floatToBigInt(faker.number.float({ min: 10000, max: 50000, multipleOf: 0.01 })).toString(),
    totalValueLockedUSD30dAverage: {
      __typename: 'TotalValueLockedAverage',
      id: faker.string.uuid(),
      index: 0,
      value: floatToBigInt(faker.number.float({ min: 10000, max: 50000, multipleOf: 0.01 })).toString(),
    },
    supportedCollateralRatio: floatToBigInt(faker.number.float({ min: 0.1, max: 10, multipleOf: 0.01 })).toString(),
  };
});

const userColl: Omit<
  CollateralTokenMeta,
  'walletAmount' | 'troveLockedAmount' | 'stabilityGainedAmount' | 'collSurplusAmount'
>[] = faker.helpers.arrayElements(collateralTokenMeta, { min: 0, max: collateralTokenMeta.length });

// Merge userCollateralTokenMeta and collateralTokenMeta but remove duplicates
const userCollateralTokenMeta = [
  ...userColl,
  ...collateralTokenMeta.filter((token) => !userColl.find(({ id }) => id === token.id)),
];

const debtTokenMeta = tokens.map<
  Omit<
    DebtTokenMeta,
    | 'troveMintedAmount'
    | 'compoundedDeposit'
    | 'walletAmount'
    | 'providedStability'
    | 'troveRepableDebtAmount'
    | 'troveDebtAmount'
  >
>((token, index) => {
  const isGovOrStableDebtToken = index === tokens.length - 1 || index === tokens.length - 2;

  return {
    __typename: 'DebtTokenMeta',
    id: faker.string.uuid(),
    timestamp: now.toString(),
    token: token as Token,

    totalDepositedStability: floatToBigInt(faker.number.float({ min: 1000, max: 5000, multipleOf: 0.0001 })).toString(),
    totalReserve: floatToBigInt(
      isGovOrStableDebtToken ? faker.number.float({ min: 1000, max: 5000, multipleOf: 0.0001 }) : 0,
    ).toString(),
    totalReserve30dAverage: isGovOrStableDebtToken
      ? {
          __typename: 'TotalReserveAverage',
          id: faker.string.uuid(),
          index: 0,
          value: floatToBigInt(faker.number.float({ min: 1000, max: 5000, multipleOf: 0.0001 })).toString(),
        }
      : null,
    totalSupplyUSD: floatToBigInt(faker.number.float({ min: 10000, max: 50000, multipleOf: 0.0001 })).toString(),
    totalSupplyUSD30dAverage: {
      __typename: 'TotalSupplyAverage',
      id: faker.string.uuid(),
      index: 0,
      value: floatToBigInt(faker.number.float({ min: 10000, max: 50000, multipleOf: 0.0001 })).toString(),
    },
    stabilityDepositAPY: {
      __typename: 'StabilityDepositAPY',
      id: faker.string.uuid(),
      index: 0,
      profit: floatToBigInt(faker.number.float({ min: 1, max: 100, multipleOf: 0.0001 })).toString(),
      volume: floatToBigInt(faker.number.float({ min: 100, max: 200, multipleOf: 0.0001 })).toString(),
    },
  };
});

const userDebt = faker.helpers.arrayElements(debtTokenMeta, { min: 0, max: debtTokenMeta.length });

// Merge userCollateralTokenMeta and collateralTokenMeta but remove duplicates
const userDebtTokenMeta = [
  ...userDebt,
  ...debtTokenMeta.filter((token) => !userDebt.find(({ id }) => id === token.id)),
];

// Generate pools once for each pair of tokens

export const pools: Omit<Pool, 'borrowerAmount' | 'swapFee' | 'pendingRewards'>[] = [];

const allTokens = tokens.concat(collateralTokens);

for (let i = 0; i < allTokens.length; i++) {
  const pairToken = allTokens[i];
  if (pairToken.address === Contracts_Localhost.DebtToken.STABLE) {
    continue;
  }

  const sortedPair = [STABLE, pairToken];

  pools.push({
    __typename: 'Pool',
    id: faker.string.uuid(),
    address: faker.finance.ethereumAddress(),
    liquidity: sortedPair.map((token) => ({
      id: faker.string.uuid(),
      __typename: 'PoolLiquidity',
      token: token as Token,
      totalAmount: floatToBigInt(faker.number.float({ min: 100000, max: 500000, multipleOf: 0.0001 })).toString(),
    })),
    liquidityDepositAPY: floatToBigInt(faker.number.float({ min: 0.01, max: 0.3, multipleOf: 0.0001 })).toString(),
    volume30dUSD: {
      __typename: 'PoolVolume30d',
      id: faker.string.uuid(),
      lastIndex: 0,
      leadingIndex: 0,
      value: floatToBigInt(faker.number.float({ min: 100000, max: 500000, multipleOf: 0.0001 })).toString(),
      feeUSD: floatToBigInt(faker.number.float({ min: 1000, max: 5000, multipleOf: 0.0001 })).toString(),
    },
    volume30dUSD30dAgo: {
      __typename: 'PoolVolume30d',
      id: faker.string.uuid(),
      lastIndex: 0,
      leadingIndex: 0,
      value: floatToBigInt(faker.number.float({ min: 100000, max: 500000, multipleOf: 0.0001 })).toString(),
      feeUSD: floatToBigInt(faker.number.float({ min: 1000, max: 5000, multipleOf: 0.0001 })).toString(),
    },
    totalSupply: floatToBigInt(faker.number.float({ min: 100000, max: 500000, multipleOf: 0.0001 })).toString(),
  });
}

const liquidityPools = pools;

const pastSwapEventsLength = faker.number.int({ min: 5, max: 90 });
const pastSwapEvents = Array(pastSwapEventsLength)
  .fill(null)
  .map<SwapEvent>(() => {
    const timestamp = Math.round(faker.date.past({ years: 1 }).getTime() / 1000).toString();
    const size = floatToBigInt(faker.number.float({ min: 1, max: 1000, multipleOf: 0.0001 })).toString();
    const token = faker.helpers.arrayElement(tokens);

    return {
      __typename: 'SwapEvent',
      id: faker.string.uuid(),
      timestamp,
      borrower: faker.finance.ethereumAddress(),
      totalPriceInStable: floatToBigInt(bigIntStringToFloat(size) * Math.random()).toString(),
      direction: faker.helpers.enumValue(LongShortDirection),
      size,
      swapFee: floatToBigInt(faker.number.float({ min: 0.01, max: 0.1, multipleOf: 0.0001 }), 6).toString(),
      token: token as Token,
    };
  })
  .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

// Define a helper function to generate pool price history data
const generatePoolPriceHistory = () => {
  return Array(90)
    .fill(null)
    .map((_, i) => {
      // Generate a timestamp for each day in the past month
      const timestamp = now - i * oneDayInSeconds;
      const price = floatToBigInt(faker.number.float({ min: 1, max: 5000, multipleOf: 0.01 })).toString();
      return [timestamp.toString(), price];
    })
    .reverse(); // reverse to get the timeline in chronological order
};

const generateTokenValues = (maxValue: number, tokens: Token[]) => {
  let leftValue = maxValue;

  return tokens.map((token, index) => {
    const value = parseFloat(faker.finance.amount({ min: 0, max: leftValue, dec: 2 }));
    // Last token gets all the left value
    const amount = index === tokens.length - 1 ? leftValue : value / Math.random();
    leftValue -= value;

    return {
      token,
      amount,
    };
  });
};

const borrowerHistory: BorrowerHistory[] = Array(faker.number.int({ min: 5, max: 90 }))
  .fill(null)
  .map<BorrowerHistory>(() => {
    const type = faker.helpers.enumValue(BorrowerHistoryType);

    const lostAmount = parseFloat(faker.finance.amount({ min: 1, max: 1000, dec: 2 }));
    const gainedAmount = faker.number.float({ min: lostAmount, max: lostAmount * 1.1, multipleOf: 0.0001 });

    // negative amount and only on lost token for claimed rewards
    const lostToken =
      type === BorrowerHistoryType.ClaimedRewards
        ? generateTokenValues(
            lostAmount,
            faker.helpers.arrayElements(tokens as Token[], { min: 1, max: 5 }),
          ).map<TokenAmount>(({ amount, token }) => ({
            __typename: 'TokenAmount',
            id: faker.string.uuid(),
            amount: floatToBigInt(amount * -1).toString(),
            token,
          }))
        : [];
    // positive amount and always bigger than any potential lost amount
    const gainedToken = generateTokenValues(
      gainedAmount,
      faker.helpers.arrayElements(tokens as Token[], { min: 1, max: 5 }),
    ).map<TokenAmount>(({ amount, token }) => ({
      __typename: 'TokenAmount',
      id: faker.string.uuid(),
      amount: floatToBigInt(amount).toString(),
      token,
    }));
    return {
      __typename: 'BorrowerHistory',
      id: faker.string.uuid(),
      borrower: faker.finance.ethereumAddress(),
      pool: faker.finance.ethereumAddress(),
      timestamp: (now - faker.number.int({ min: 0, max: 29 }) * oneDayInSeconds).toString(),
      type,
      values: [...lostToken, ...gainedToken],
      claimInUSD: type === BorrowerHistoryType.ClaimedRewards ? floatToBigInt(gainedAmount).toString() : null,
      lostDepositInUSD: type === BorrowerHistoryType.ClaimedRewards ? floatToBigInt(lostAmount).toString() : null,
    };
  })
  .sort((a, b) => Number(b.timestamp) - Number(a.timestamp));

// --------------- HANDLER ----------------

export const handlers = [
  // GetDebtTokens
  graphql.query<{ debtTokenMetas: Query['debtTokenMetas'] }, QueryDebtTokenMetasArgs>(
    GET_ALL_DEBT_TOKENS,
    (req, res, ctx) => {
      return res(ctx.data({ debtTokenMetas: debtTokenMeta as DebtTokenMeta[] }));
    },
  ),
  // GetAllPools
  graphql.query<{ pools: Query['pools'] }, QueryDebtTokenMetasArgs>(GET_ALL_POOLS, (req, res, ctx) => {
    const result: Query['pools'] = pools as Pool[];
    return res(ctx.data({ pools: result }));
  }),
  // // GetBorrowerRewards
  // graphql.query<{ pools: Query['pools'] }, QueryDebtTokenMetasArgs>(GET_BORROWER_REWARDS, (req, res, ctx) => {
  //   const result: Query['pools'] = pools;
  //   return res(ctx.data({ pools: result }));
  // }),

  // GetBorrowerDebtTokens
  graphql.query<{ debtTokenMetas: Query['debtTokenMetas'] }, QueryDebtTokenMetasArgs>(
    GET_BORROWER_DEBT_TOKENS,
    (req, res, ctx) => {
      const { borrower } = req.variables;

      if (borrower) {
        return res(ctx.data({ debtTokenMetas: userDebtTokenMeta as DebtTokenMeta[] }));
      } else {
        return res(ctx.data({ debtTokenMetas: debtTokenMeta as DebtTokenMeta[] }));
      }
    },
  ),

  // GetSelectedToken
  graphql.query<{ token: Query['token'] }, GetSelectedTokenQueryVariables>(GET_SELECTED_TOKEN, (req, res, ctx) => {
    const { address } = req.variables;

    const token = allTokens.find((token) => token.address === address)!;

    return res(ctx.data({ token: token as Token }));
  }),

  // GetCollateralTokens
  graphql.query<{ collateralTokenMetas: Query['collateralTokenMetas'] }, QueryCollateralTokenMetasArgs>(
    GET_BORROWER_COLLATERAL_TOKENS,
    (req, res, ctx) => {
      const { borrower } = req.variables;

      if (borrower) {
        return res(ctx.data({ collateralTokenMetas: userCollateralTokenMeta as CollateralTokenMeta[] }));
      } else {
        return res(ctx.data({ collateralTokenMetas: collateralTokenMeta as CollateralTokenMeta[] }));
      }
    },
  ),

  // GetBorrowerSwapEvents
  graphql.query<{ swapEvents: Query['swapEvents'] }, QuerySwapEventsArgs>(GET_BORROWER_SWAPS, (req, res, ctx) => {
    const { first, skip, where } = req.variables;
    if (!where?.borrower || skip === null || skip === undefined || first === null || first === undefined) {
      throw new Error('Required parameter not supplied');
    }
    const swapEvents = pastSwapEvents.slice(skip, skip + first);

    return res(ctx.data({ swapEvents }));
  }),

  // GetBorrowerLiquidityPools
  graphql.query<{ pools: Query['pools'] }, QueryPoolsArgs>(GET_BORROWER_LIQUIDITY_POOLS, (req, res, ctx) => {
    const { borrower } = req.variables;
    if (!borrower) {
      const result: Query['pools'] = liquidityPools as Pool[];

      return res(ctx.data({ pools: result }));
    }

    const borrowerLiquidityPools = faker.helpers.arrayElements(liquidityPools, { min: 1, max: 5 });

    const liqudityPoolsWithoutBorrower = liquidityPools.filter(
      (pool) => !borrowerLiquidityPools.find(({ id }) => id === pool.id),
    );

    const liqudityPoolsWithBorrower: Query['pools'] = borrowerLiquidityPools.map<
      Omit<Pool, 'borrowerAmount' | 'swapFee' | 'pendingRewards'>
    >((pool) => {
      return {
        ...pool,
        liquidity: pool.liquidity.map((liquidity) => ({
          ...liquidity,
        })),
      };
    }) as Pool[];

    return res(ctx.data({ pools: liqudityPoolsWithoutBorrower.concat(liqudityPoolsWithBorrower) as Pool[] }));
  }),

  // CHART DATA MOCK

  // GetCollateralUSDHistory
  graphql.query<{ totalValueLockedUSDHistoryChunks: Query['totalValueLockedUSDHistoryChunks'] }>(
    GET_COLLATERAL_USD_HISTORY,
    (req, res, ctx) => {
      const data = generatePoolPriceHistory();

      const result = data.map<TotalValueLockedUsdHistoryChunk>(([timestamp, value]) => {
        return {
          __typename: 'TotalValueLockedUSDHistoryChunk',
          id: faker.string.uuid(),
          timestamp: timestamp,
          value: value,
          size: 24 * 60 * 60,
        };
      });

      return res(ctx.data({ totalValueLockedUSDHistoryChunks: result }));
    },
  ),
  // GetDebtUSDHistory
  graphql.query<{ totalValueMintedUSDHistoryChunks: Query['totalValueMintedUSDHistoryChunks'] }>(
    GET_DEBT_USD_HISTORY,
    (req, res, ctx) => {
      const data = generatePoolPriceHistory();

      const result = data.map<TotalValueMintedUsdHistoryChunk>(([timestamp, value]) => {
        return {
          __typename: 'TotalValueMintedUSDHistoryChunk',
          id: faker.string.uuid(),
          timestamp: timestamp,
          value: value,
          size: 24 * 60 * 60,
        };
      });

      return res(ctx.data({ totalValueMintedUSDHistoryChunks: result }));
    },
  ),

  // GetReserveUSDHistory
  graphql.query<{ reservePoolUSDHistoryChunks: Query['reservePoolUSDHistoryChunks'] }>(
    GET_RESERVE_USD_HISTORY,
    (req, res, ctx) => {
      const data = generatePoolPriceHistory();

      const result = data.map<ReservePoolUsdHistoryChunk>(([timestamp, value]) => {
        return {
          __typename: 'ReservePoolUSDHistoryChunk',
          id: faker.string.uuid(),
          timestamp: timestamp,
          value: value,
          size: 24 * 60 * 60,
        };
      });

      return res(ctx.data({ reservePoolUSDHistoryChunks: result }));
    },
  ),

  // GetBorrowerStabilityHistory
  graphql.query<{ borrowerHistories: Query['borrowerHistories'] }, QueryBorrowerHistoriesArgs>(
    GET_BORROWER_STABILITY_HISTORY,
    (req, res, ctx) => {
      // For this mock, we ignore the actual poolId and just generate mock data
      const { first, skip, where } = req.variables;
      if (!where?.borrower || skip === null || skip === undefined || first === null || first === undefined) {
        throw new Error('Required parameter not supplied');
      }
      const borrowerHistories = borrowerHistory.slice(skip, skip + first);

      return res(ctx.data({ borrowerHistories }));
    },
  ),

  // GetTradingViewCandles
  graphql.query<{ tokenCandles: Query['tokenCandles'] }, QueryTokenCandlesArgs>(
    GET_TRADING_VIEW_CANDLES,
    (req, res, ctx) => {
      const { orderBy, orderDirection, where } = req.variables;

      const resolutionMultiplier = {
        1: 60 * 1000, // 1 minute in milliseconds
        10: 10 * 60 * 1000, // 5 minutes
        60: 60 * 60 * 1000, // 1 hour
        360: 6 * 60 * 60 * 1000, // 6 hour
        1440: 24 * 60 * 60 * 1000, // 1 day
        10080: 7 * 24 * 60 * 60 * 1000, // 1 day
        // Add more resolutions as needed
      };

      let bars = [];
      let timestamp = where!.timestamp_gte! * 1000; // Convert from seconds to milliseconds

      // Generate bars up to 'periodParams.to' or 'periodParams.countBack' number of bars
      while (timestamp < where!.timestamp_lte! * 1000) {
        // Randomly generate OHLC values (modify logic as needed)
        let open = Math.random() * 100 + 100; // Random value between 100 and 200
        let close = Math.random() * 100 + 100;
        let high = Math.max(open, close) + Math.random() * 10;
        let low = Math.min(open, close) - Math.random() * 10;
        let volume = Math.random() * 1000; // Random volume

        // Add the bar to the array
        bars.push({
          timestamp: timestamp.toString(),
          open: ethers.parseEther(open.toString()).toString(),
          openOracle: ethers.parseEther(open.toString()).toString(),
          high: ethers.parseEther(high.toString()).toString(),
          highOracle: ethers.parseEther(high.toString()).toString(),
          low: ethers.parseEther(low.toString()).toString(),
          lowOracle: ethers.parseEther(low.toString()).toString(),
          close: ethers.parseEther(close.toString()).toString(),
          closeOracle: ethers.parseEther(close.toString()).toString(),
          volume: ethers.parseEther(volume.toString()).toString(),
        });

        // Increment time by the resolution interval
        // @ts-ignore
        timestamp += resolutionMultiplier[where?.candleSize];
      }

      return res(
        ctx.data({
          tokenCandles: bars.map<TokenCandle>((bar) => ({
            ...bar,
            __typename: 'TokenCandle',
            candleSize: where!.candleSize!,
            token: tokens[0] as Token,
            id: faker.string.uuid(),
          })),
        }),
      );
    },
  ),

  // GetTradingViewCandles
  graphql.query<{ tokenCandleSingleton: Query['tokenCandleSingleton'] }, QueryTokenCandleSingletonArgs>(
    GET_TRADING_VIEW_LATEST_CANDLE,
    (req, res, ctx) => {
      const { id } = req.variables;

      let open = Math.random() * 100 + 100; // Random value between 100 and 200
      let close = Math.random() * 100 + 100;
      let high = Math.max(open, close) + Math.random() * 10;
      let low = Math.min(open, close) - Math.random() * 10;
      let volume = Math.random() * 1000; // Random volume

      const randomCandle: TokenCandleSingleton = {
        id,
        __typename: 'TokenCandleSingleton',
        timestamp: Date.now().toString(),
        token: {
          ...(tokens[0] as Token),
        },
        candleSize: 60,
        open: ethers.parseEther(open.toString()).toString(),
        openOracle: ethers.parseEther(open.toString()).toString(),
        close: ethers.parseEther(close.toString()).toString(),
        closeOracle: ethers.parseEther(close.toString()).toString(),
        high: ethers.parseEther(high.toString()).toString(),
        highOracle: ethers.parseEther(high.toString()).toString(),
        low: ethers.parseEther(low.toString()).toString(),
        lowOracle: ethers.parseEther(low.toString()).toString(),
        volume: ethers.parseEther(volume.toString()).toString(),
      };

      return res(
        ctx.data({
          tokenCandleSingleton: randomCandle,
        }),
      );
    },
  ),

  // GetPastTokenPrices
  graphql.query<{ tokenCandles: Query['tokenCandles'] }, QueryTokenCandlesArgs>(
    GET_TOKEN_PRICES_24h_AGO,
    (req, res, ctx) => {
      const tokenPrices24hAgo = tokens.concat(collateralTokens).map((token) => {
        let open = Math.random() * 100 + 100; // Random value between 100 and 200
        let close = Math.random() * 100 + 100;
        let high = Math.max(open, close) + Math.random() * 10;
        let low = Math.min(open, close) - Math.random() * 10;
        let volume = Math.random() * 1000; // Random volume

        const randomCandle: TokenCandle = {
          id: faker.string.uuid(),
          __typename: 'TokenCandle',
          timestamp: Date.now().toString(),
          token: token as Token,
          candleSize: 60,
          open: ethers.parseEther(open.toString()).toString(),
          openOracle: ethers.parseEther(open.toString()).toString(),
          close: ethers.parseEther(close.toString()).toString(),
          closeOracle: ethers.parseEther(close.toString()).toString(),
          high: ethers.parseEther(high.toString()).toString(),
          highOracle: ethers.parseEther(high.toString()).toString(),
          low: ethers.parseEther(low.toString()).toString(),
          lowOracle: ethers.parseEther(low.toString()).toString(),
          volume: ethers.parseEther(volume.toString()).toString(),
        };

        return randomCandle;
      });

      return res(
        ctx.data({
          tokenCandles: tokenPrices24hAgo,
        }),
      );
    },
  ),

  // GetTokenOracles
  graphql.query<{ tokens: Query['tokens'] }, QueryTokenArgs>(GET_TOKEN_ORACLES, (req, res, ctx) => {
    return res(
      ctx.data({
        tokens: tokens as Token[],
      }),
    );
  }),

  // -------------- Only resolved by local cache ---------------- only for local testing purposes

  // GetSystemInfo
  graphql.query<{ getSystemInfo: Query['getSystemInfo'] }>(GET_SYSTEMINFO, (req, res, ctx) => {
    const totalCollateralRatio = faker.number.float({ min: 0.9, max: 2.5, multipleOf: 0.0001 });

    return res(
      ctx.data({
        getSystemInfo: {
          __typename: 'SystemInfo',
          id: faker.string.uuid(),
          recoveryModeActive: totalCollateralRatio < 1.5,
        } as SystemInfo,
      }),
    );
  }),
];
