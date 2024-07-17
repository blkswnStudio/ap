export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  BigInt: { input: string; output: string; }
  Bytes: { input: string; output: string; }
  bigint: { input: bigint; output: bigint; }
};

export type BorrowerHistory = {
  __typename: 'BorrowerHistory';
  borrower: Scalars['Bytes']['output'];
  claimInUSD?: Maybe<Scalars['BigInt']['output']>;
  id: Scalars['Bytes']['output'];
  lostDepositInUSD?: Maybe<Scalars['BigInt']['output']>;
  pool: Scalars['Bytes']['output'];
  timestamp: Scalars['BigInt']['output'];
  type: BorrowerHistoryType;
  values: Array<TokenAmount>;
};

export enum BorrowerHistoryType {
  ClaimedRewards = 'CLAIMED_REWARDS',
  Deposited = 'DEPOSITED',
  Withdrawn = 'WITHDRAWN'
}

export type BorrowerHistory_Filter = {
  borrower?: InputMaybe<Scalars['Bytes']['input']>;
};

export enum BorrowerHistory_OrderBy {
  Timestamp = 'timestamp'
}

export type CollateralTokenMeta = {
  __typename: 'CollateralTokenMeta';
  collSurplusAmount: Scalars['bigint']['output'];
  id: Scalars['ID']['output'];
  stabilityGainedAmount: Scalars['bigint']['output'];
  supportedCollateralRatio: Scalars['BigInt']['output'];
  timestamp: Scalars['BigInt']['output'];
  token: Token;
  totalValueLockedUSD: Scalars['BigInt']['output'];
  totalValueLockedUSD30dAverage: TotalValueLockedAverage;
  troveLockedAmount: Scalars['bigint']['output'];
  walletAmount: Scalars['bigint']['output'];
};

export type DebtTokenMeta = {
  __typename: 'DebtTokenMeta';
  compoundedDeposit: Scalars['bigint']['output'];
  id: Scalars['ID']['output'];
  providedStability: Scalars['bigint']['output'];
  stabilityDepositAPY: StabilityDepositApy;
  timestamp: Scalars['BigInt']['output'];
  token: Token;
  totalDepositedStability: Scalars['BigInt']['output'];
  totalReserve: Scalars['BigInt']['output'];
  totalReserve30dAverage?: Maybe<TotalReserveAverage>;
  totalSupplyUSD: Scalars['BigInt']['output'];
  totalSupplyUSD30dAverage: TotalSupplyAverage;
  troveDebtAmount: Scalars['bigint']['output'];
  troveMintedAmount: Scalars['bigint']['output'];
  troveRepableDebtAmount: Scalars['bigint']['output'];
  walletAmount: Scalars['bigint']['output'];
};

export enum LongShortDirection {
  Long = 'LONG',
  Short = 'SHORT'
}

export enum OrderDirection {
  Asc = 'asc',
  Desc = 'desc'
}

export type Pool = {
  __typename: 'Pool';
  address: Scalars['Bytes']['output'];
  borrowerAmount: Scalars['bigint']['output'];
  id: Scalars['ID']['output'];
  liquidity: Array<PoolLiquidity>;
  liquidityDepositAPY: Scalars['BigInt']['output'];
  swapFee: Scalars['bigint']['output'];
  totalSupply: Scalars['BigInt']['output'];
  volume30dUSD: PoolVolume30d;
  volume30dUSD30dAgo: PoolVolume30d;
};

export type PoolLiquidity = {
  __typename: 'PoolLiquidity';
  id: Scalars['Bytes']['output'];
  token: Token;
  totalAmount: Scalars['BigInt']['output'];
};

export type PoolVolume30d = {
  __typename: 'PoolVolume30d';
  feeUSD: Scalars['BigInt']['output'];
  id: Scalars['Bytes']['output'];
  lastIndex: Scalars['Int']['output'];
  leadingIndex: Scalars['Int']['output'];
  value: Scalars['BigInt']['output'];
};

export type Query = {
  __typename: 'Query';
  borrowerHistories: Array<BorrowerHistory>;
  collateralTokenMetas: Array<CollateralTokenMeta>;
  debtTokenMetas: Array<DebtTokenMeta>;
  getRedemtionOperations: RedemptionOperations;
  getSystemInfo: SystemInfo;
  pools: Array<Pool>;
  reservePoolUSDHistoryChunks: Array<ReservePoolUsdHistoryChunk>;
  swapEvents: Array<SwapEvent>;
  token: Token;
  tokenCandleSingleton: TokenCandleSingleton;
  tokenCandles: Array<TokenCandle>;
  tokens: Array<Token>;
  totalValueLockedUSDHistoryChunks: Array<TotalValueLockedUsdHistoryChunk>;
  totalValueMintedUSDHistoryChunks: Array<TotalValueMintedUsdHistoryChunk>;
};


export type QueryBorrowerHistoriesArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<BorrowerHistory_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<BorrowerHistory_Filter>;
};


export type QueryCollateralTokenMetasArgs = {
  borrower?: InputMaybe<Scalars['String']['input']>;
};


export type QueryDebtTokenMetasArgs = {
  borrower?: InputMaybe<Scalars['String']['input']>;
};


export type QueryPoolsArgs = {
  borrower?: InputMaybe<Scalars['String']['input']>;
};


export type QueryReservePoolUsdHistoryChunksArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<ReservePoolUsdHistoryChunk_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
};


export type QuerySwapEventsArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<SwapEvent_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<SwapEvent_Filter>;
};


export type QueryTokenArgs = {
  id: Scalars['String']['input'];
};


export type QueryTokenCandleSingletonArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTokenCandlesArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<TokenCandle_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
  where?: InputMaybe<TokenCandle_Filter>;
};


export type QueryTotalValueLockedUsdHistoryChunksArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<TotalValueLockedUsdHistoryChunk_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryTotalValueMintedUsdHistoryChunksArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<TotalValueMintedUsdHistoryChunk_OrderBy>;
  orderDirection?: InputMaybe<OrderDirection>;
  skip?: InputMaybe<Scalars['Int']['input']>;
};

export type RedemptionOperations = {
  __typename: 'RedemptionOperations';
  id: Scalars['ID']['output'];
  redemptionRateWithDecay: Scalars['bigint']['output'];
};

export type ReservePoolUsdHistoryChunk = {
  __typename: 'ReservePoolUSDHistoryChunk';
  id: Scalars['String']['output'];
  size: Scalars['Int']['output'];
  timestamp: Scalars['BigInt']['output'];
  value: Scalars['BigInt']['output'];
};

export enum ReservePoolUsdHistoryChunk_OrderBy {
  Timestamp = 'timestamp'
}

export type StabilityDepositApy = {
  __typename: 'StabilityDepositAPY';
  id: Scalars['ID']['output'];
  index: Scalars['Int']['output'];
  profit: Scalars['BigInt']['output'];
  volume: Scalars['BigInt']['output'];
};

export type SwapEvent = {
  __typename: 'SwapEvent';
  borrower: Scalars['Bytes']['output'];
  direction: LongShortDirection;
  id: Scalars['Bytes']['output'];
  size: Scalars['BigInt']['output'];
  swapFee: Scalars['BigInt']['output'];
  timestamp: Scalars['BigInt']['output'];
  token: Token;
  totalPriceInStable: Scalars['BigInt']['output'];
};

export type SwapEvent_Filter = {
  borrower?: InputMaybe<Scalars['Bytes']['input']>;
};

export enum SwapEvent_OrderBy {
  Timestamp = 'timestamp'
}

export type SystemInfo = {
  __typename: 'SystemInfo';
  borrowerICR: Scalars['bigint']['output'];
  borrowerIMCR: Scalars['bigint']['output'];
  borrowingInterestRate: Scalars['bigint']['output'];
  id: Scalars['ID']['output'];
  recoveryModeActive: Scalars['Boolean']['output'];
  totalCollateralRatio: Scalars['bigint']['output'];
};

export type Token = {
  __typename: 'Token';
  address: Scalars['Bytes']['output'];
  borrowingRate: Scalars['bigint']['output'];
  createdAt: Scalars['BigInt']['output'];
  decimals: Scalars['Int']['output'];
  id: Scalars['Bytes']['output'];
  isPoolToken: Scalars['Boolean']['output'];
  oracleId: Scalars['Bytes']['output'];
  priceUSDOracle: Scalars['bigint']['output'];
  symbol: Scalars['String']['output'];
};

export type TokenAmount = {
  __typename: 'TokenAmount';
  amount: Scalars['BigInt']['output'];
  id: Scalars['Bytes']['output'];
  token: Token;
};

export type TokenCandle = {
  __typename: 'TokenCandle';
  candleSize: Scalars['Int']['output'];
  close: Scalars['BigInt']['output'];
  high: Scalars['BigInt']['output'];
  id: Scalars['Bytes']['output'];
  low: Scalars['BigInt']['output'];
  open: Scalars['BigInt']['output'];
  timestamp: Scalars['BigInt']['output'];
  token: Token;
  volume: Scalars['BigInt']['output'];
};

export type TokenCandleSingleton = {
  __typename: 'TokenCandleSingleton';
  candleSize: Scalars['Int']['output'];
  close: Scalars['BigInt']['output'];
  high: Scalars['BigInt']['output'];
  id: Scalars['ID']['output'];
  low: Scalars['BigInt']['output'];
  open: Scalars['BigInt']['output'];
  timestamp: Scalars['BigInt']['output'];
  token: Scalars['Bytes']['output'];
  volume: Scalars['BigInt']['output'];
};

export type TokenCandle_Filter = {
  candleSize?: InputMaybe<Scalars['Int']['input']>;
  timestamp?: InputMaybe<Scalars['Int']['input']>;
  timestamp_gt?: InputMaybe<Scalars['Int']['input']>;
  timestamp_gte?: InputMaybe<Scalars['Int']['input']>;
  timestamp_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  timestamp_lt?: InputMaybe<Scalars['Int']['input']>;
  timestamp_lte?: InputMaybe<Scalars['Int']['input']>;
  timestamp_not?: InputMaybe<Scalars['Int']['input']>;
  timestamp_not_in?: InputMaybe<Array<Scalars['Int']['input']>>;
  token_?: InputMaybe<Token_Filter>;
};

export enum TokenCandle_OrderBy {
  CandleSize = 'candleSize',
  Close = 'close',
  High = 'high',
  Id = 'id',
  Low = 'low',
  Open = 'open',
  Timestamp = 'timestamp',
  Token = 'token',
  TokenAddress = 'token__address',
  TokenCreatedAt = 'token__createdAt',
  TokenId = 'token__id',
  TokenIsPoolToken = 'token__isPoolToken',
  TokenPriceUsd = 'token__priceUSD',
  TokenSymbol = 'token__symbol',
  Volume = 'volume'
}

export type Token_Filter = {
  id?: InputMaybe<Scalars['Bytes']['input']>;
  symbol?: InputMaybe<Scalars['String']['input']>;
};

export type TotalReserveAverage = {
  __typename: 'TotalReserveAverage';
  id: Scalars['ID']['output'];
  index: Scalars['Int']['output'];
  value: Scalars['BigInt']['output'];
};

export type TotalSupplyAverage = {
  __typename: 'TotalSupplyAverage';
  id: Scalars['ID']['output'];
  index: Scalars['Int']['output'];
  value: Scalars['BigInt']['output'];
};

export type TotalValueLockedAverage = {
  __typename: 'TotalValueLockedAverage';
  id: Scalars['ID']['output'];
  index: Scalars['Int']['output'];
  value: Scalars['BigInt']['output'];
};

export type TotalValueLockedUsdHistoryChunk = {
  __typename: 'TotalValueLockedUSDHistoryChunk';
  id: Scalars['String']['output'];
  size: Scalars['Int']['output'];
  timestamp: Scalars['BigInt']['output'];
  value: Scalars['BigInt']['output'];
};

export enum TotalValueLockedUsdHistoryChunk_OrderBy {
  Timestamp = 'timestamp'
}

export type TotalValueMintedUsdHistoryChunk = {
  __typename: 'TotalValueMintedUSDHistoryChunk';
  id: Scalars['String']['output'];
  size: Scalars['Int']['output'];
  timestamp: Scalars['BigInt']['output'];
  value: Scalars['BigInt']['output'];
};

export enum TotalValueMintedUsdHistoryChunk_OrderBy {
  Timestamp = 'timestamp'
}

export type GetTokenOraclesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetTokenOraclesQuery = { __typename: 'Query', tokens: Array<{ __typename: 'Token', id: string, address: string, oracleId: string }> };

export type GetAllPoolsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetAllPoolsQuery = { __typename: 'Query', pools: Array<{ __typename: 'Pool', id: string, address: string, swapFee: bigint, volume30dUSD: { __typename: 'PoolVolume30d', id: string, value: string }, liquidity: Array<{ __typename: 'PoolLiquidity', id: string, totalAmount: string, token: { __typename: 'Token', id: string, address: string, symbol: string, decimals: number, priceUSDOracle: bigint, borrowingRate: bigint } }> }> };

export type GetSelectedTokenQueryVariables = Exact<{
  address: Scalars['String']['input'];
}>;


export type GetSelectedTokenQuery = { __typename: 'Query', token: { __typename: 'Token', id: string, address: string, priceUSDOracle: bigint } };

export type GetDebtTokensQueryVariables = Exact<{ [key: string]: never; }>;


export type GetDebtTokensQuery = { __typename: 'Query', debtTokenMetas: Array<{ __typename: 'DebtTokenMeta', id: string, totalSupplyUSD: string, totalReserve: string, totalReserve30dAverage?: { __typename: 'TotalReserveAverage', id: string, value: string } | null, token: { __typename: 'Token', id: string, address: string, symbol: string, priceUSDOracle: bigint, decimals: number } }> };

export type GetBorrowerDebtTokensQueryVariables = Exact<{
  borrower: Scalars['String']['input'];
}>;


export type GetBorrowerDebtTokensQuery = { __typename: 'Query', debtTokenMetas: Array<{ __typename: 'DebtTokenMeta', id: string, troveMintedAmount: bigint, walletAmount: bigint, providedStability: bigint, compoundedDeposit: bigint, troveRepableDebtAmount: bigint, troveDebtAmount: bigint, totalDepositedStability: string, totalSupplyUSD: string, stabilityDepositAPY: { __typename: 'StabilityDepositAPY', id: string, profit: string, volume: string }, totalSupplyUSD30dAverage: { __typename: 'TotalSupplyAverage', id: string, value: string }, token: { __typename: 'Token', id: string, address: string, symbol: string, isPoolToken: boolean, borrowingRate: bigint, priceUSDOracle: bigint, decimals: number } }> };

export type GetBorrowerSwapEventsQueryVariables = Exact<{
  where: SwapEvent_Filter;
  first?: InputMaybe<Scalars['Int']['input']>;
  skip: Scalars['Int']['input'];
}>;


export type GetBorrowerSwapEventsQuery = { __typename: 'Query', swapEvents: Array<{ __typename: 'SwapEvent', id: string, timestamp: string, direction: LongShortDirection, size: string, totalPriceInStable: string, swapFee: string, token: { __typename: 'Token', id: string, address: string, symbol: string, priceUSDOracle: bigint, decimals: number } }> };

export type GetBorrowerLiquidityPoolsQueryVariables = Exact<{
  borrower?: InputMaybe<Scalars['String']['input']>;
}>;


export type GetBorrowerLiquidityPoolsQuery = { __typename: 'Query', pools: Array<{ __typename: 'Pool', id: string, address: string, liquidityDepositAPY: string, totalSupply: string, borrowerAmount: bigint, liquidity: Array<{ __typename: 'PoolLiquidity', id: string, totalAmount: string, token: { __typename: 'Token', id: string, address: string, symbol: string, priceUSDOracle: bigint, decimals: number } }>, volume30dUSD: { __typename: 'PoolVolume30d', value: string }, volume30dUSD30dAgo: { __typename: 'PoolVolume30d', value: string } }> };

export type GetBorrowerCollateralTokensQueryVariables = Exact<{
  borrower: Scalars['String']['input'];
}>;


export type GetBorrowerCollateralTokensQuery = { __typename: 'Query', collateralTokenMetas: Array<{ __typename: 'CollateralTokenMeta', id: string, walletAmount: bigint, troveLockedAmount: bigint, stabilityGainedAmount: bigint, collSurplusAmount: bigint, totalValueLockedUSD: string, supportedCollateralRatio: string, token: { __typename: 'Token', id: string, address: string, symbol: string, priceUSDOracle: bigint, decimals: number }, totalValueLockedUSD30dAverage: { __typename: 'TotalValueLockedAverage', id: string, value: string } }> };

export type GetBorrowerStabilityHistoryQueryVariables = Exact<{
  where: BorrowerHistory_Filter;
  first?: InputMaybe<Scalars['Int']['input']>;
  skip: Scalars['Int']['input'];
}>;


export type GetBorrowerStabilityHistoryQuery = { __typename: 'Query', borrowerHistories: Array<{ __typename: 'BorrowerHistory', id: string, timestamp: string, type: BorrowerHistoryType, claimInUSD?: string | null, lostDepositInUSD?: string | null, values: Array<{ __typename: 'TokenAmount', amount: string, token: { __typename: 'Token', id: string, address: string, symbol: string, priceUSDOracle: bigint, decimals: number } }> }> };

export type GetCollateralUsdHistoryQueryVariables = Exact<{ [key: string]: never; }>;


export type GetCollateralUsdHistoryQuery = { __typename: 'Query', totalValueLockedUSDHistoryChunks: Array<{ __typename: 'TotalValueLockedUSDHistoryChunk', id: string, timestamp: string, value: string }> };

export type GetDebtUsdHistoryQueryVariables = Exact<{ [key: string]: never; }>;


export type GetDebtUsdHistoryQuery = { __typename: 'Query', totalValueMintedUSDHistoryChunks: Array<{ __typename: 'TotalValueMintedUSDHistoryChunk', id: string, timestamp: string, value: string }> };

export type GetReserveUsdHistoryQueryVariables = Exact<{ [key: string]: never; }>;


export type GetReserveUsdHistoryQuery = { __typename: 'Query', reservePoolUSDHistoryChunks: Array<{ __typename: 'ReservePoolUSDHistoryChunk', id: string, timestamp: string, value: string }> };

export type GetTradingViewCandlesQueryVariables = Exact<{
  where: TokenCandle_Filter;
  first: Scalars['Int']['input'];
}>;


export type GetTradingViewCandlesQuery = { __typename: 'Query', tokenCandles: Array<{ __typename: 'TokenCandle', id: string, timestamp: string, open: string, high: string, low: string, close: string, volume: string }> };

export type GetTradingViewLatestCandleQueryVariables = Exact<{
  id: Scalars['ID']['input'];
}>;


export type GetTradingViewLatestCandleQuery = { __typename: 'Query', tokenCandleSingleton: { __typename: 'TokenCandleSingleton', id: string, timestamp: string, open: string, high: string, low: string, close: string, volume: string } };

export type GetPastTokenPricesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetPastTokenPricesQuery = { __typename: 'Query', tokenCandles: Array<{ __typename: 'TokenCandle', id: string, timestamp: string, close: string, volume: string, token: { __typename: 'Token', id: string, address: string } }> };

export type TokenFragmentFragment = { __typename: 'Token', id: string, address: string };

export type LiquidityFragmentFragment = { __typename: 'PoolLiquidity', id: string, totalAmount: string };

export type GetSystemInfoQueryVariables = Exact<{ [key: string]: never; }>;


export type GetSystemInfoQuery = { __typename: 'Query', getSystemInfo: { __typename: 'SystemInfo', id: string, recoveryModeActive: boolean, totalCollateralRatio: bigint, borrowerICR: bigint, borrowerIMCR: bigint, borrowingInterestRate: bigint } };

export type GetRedemptionsOperationsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetRedemptionsOperationsQuery = { __typename: 'Query', getRedemtionOperations: { __typename: 'RedemptionOperations', id: string, redemptionRateWithDecay: bigint } };
