import { gql } from '@apollo/client';

export const GET_TOKEN_ORACLES = gql`
  query GetTokenOracles {
    tokens {
      id
      address
      oracleId
    }
  }
`;

export const GET_ALL_POOLS = gql`
  query GetAllPools {
    pools {
      id
      address
      swapFee @client
      volume30dUSD {
        id
        value
      }
      liquidity {
        id
        totalAmount
        token {
          id
          address
          symbol
          decimals
          priceUSDOracle @client
          borrowingRate @client
        }
      }
    }
  }
`;

export const GET_SELECTED_TOKEN = gql`
  query GetSelectedToken($address: String!) {
    token(id: $address) {
      id
      address
      priceUSDOracle @client
    }
  }
`;

export const GET_ALL_DEBT_TOKENS = gql`
  query GetDebtTokens {
    debtTokenMetas {
      id
      # TODO: Implement sort in query or sort server side
      totalSupplyUSD
      totalReserve
      totalReserve30dAverage {
        id
        value
      }

      token {
        id
        address
        symbol
        priceUSDOracle @client
        decimals
      }
    }
  }
`;

export const GET_BORROWER_DEBT_TOKENS = gql`
  query GetBorrowerDebtTokens($borrower: String!) {
    debtTokenMetas(borrower: $borrower) {
      id
      troveMintedAmount @client
      walletAmount @client
      providedStability @client
      compoundedDeposit @client
      troveRepableDebtAmount @client
      troveDebtAmount @client

      stabilityDepositAPY {
        id
        profit
        volume
      }
      totalDepositedStability
      totalSupplyUSD
      totalSupplyUSD30dAverage {
        id
        value
      }
      token {
        id
        address
        symbol
        isPoolToken
        borrowingRate @client
        priceUSDOracle @client
        decimals
      }
    }
  }
`;

export const GET_BORROWER_LIQUIDITY_POOLS = gql`
  query GetBorrowerLiquidityPools($borrower: String) {
    pools(borrower: $borrower) {
      id
      address
      liquidity {
        id
        token {
          id
          address
          symbol
          priceUSDOracle @client
          decimals
        }
        totalAmount
      }
      liquidityDepositAPY
      volume30dUSD {
        value
      }
      volume30dUSD30dAgo {
        value
      }

      totalSupply
      borrowerAmount @client
      pendingRewards @client

      stakingPool {
        id
        stakingAPR
      }
    }
  }
`;

export const GET_BORROWER_SWAPS = gql`
  query GetBorrowerSwapEvents($where: SwapEvent_filter!, $first: Int = 30, $skip: Int!) {
    swapEvents(first: $first, orderBy: timestamp, orderDirection: desc, skip: $skip, where: $where) {
      id
      timestamp
      timestamp
      token {
        id
        address
        symbol
        priceUSDOracle @client
        decimals
      }
      direction
      size
      totalPriceInStable
      swapFee
    }
  }
`;

// BALANCE PAGE

export const GET_BORROWER_COLLATERAL_TOKENS = gql`
  query GetBorrowerCollateralTokens($borrower: String!) {
    collateralTokenMetas(borrower: $borrower) {
      id
      token {
        id
        address
        symbol
        priceUSDOracle @client
        decimals
      }
      walletAmount @client
      troveLockedAmount @client
      stabilityGainedAmount @client
      collSurplusAmount @client

      totalValueLockedUSD
      totalValueLockedUSD30dAverage {
        id
        value
      }
      supportedCollateralRatio
    }
  }
`;

export const GET_BORROWER_STABILITY_HISTORY = gql`
  query GetBorrowerStabilityHistory($where: BorrowerHistory_filter!, $first: Int = 30, $skip: Int!) {
    borrowerHistories(first: $first, orderBy: timestamp, orderDirection: desc, skip: $skip, where: $where) {
      id
      timestamp
      type
      values {
        token {
          id
          address
          symbol
          priceUSDOracle @client
          decimals
        }
        amount
      }
      claimInUSD
      lostDepositInUSD
    }
  }
`;

// CHARTS

export const GET_COLLATERAL_USD_HISTORY = gql`
  query GetCollateralUSDHistory {
    totalValueLockedUSDHistoryChunks(orderBy: timestamp, orderDirection: asc) {
      id
      timestamp
      value
    }
  }
`;

export const GET_DEBT_USD_HISTORY = gql`
  query GetDebtUSDHistory {
    totalValueMintedUSDHistoryChunks(orderBy: timestamp, orderDirection: asc) {
      id
      timestamp
      value
    }
  }
`;

export const GET_RESERVE_USD_HISTORY = gql`
  query GetReserveUSDHistory {
    reservePoolUSDHistoryChunks(orderBy: timestamp, orderDirection: asc) {
      id
      timestamp
      value
    }
  }
`;

// TRADING VIEW

export const GET_TRADING_VIEW_CANDLES = gql`
  query GetTradingViewCandles($where: TokenCandle_filter!, $first: Int!) {
    tokenCandles(where: $where, first: $first, orderBy: timestamp, orderDirection: asc) {
      id
      timestamp
      open
      openOracle
      high
      highOracle
      low
      lowOracle
      close
      closeOracle
      volume
    }
  }
`;

export const GET_TRADING_VIEW_LATEST_CANDLE = gql`
  query GetTradingViewLatestCandle($id: ID!) {
    # "TokenCandleSingleton" + token + candleSize
    tokenCandleSingleton(id: $id) {
      id
      timestamp
      open
      openOracle
      high
      highOracle
      low
      lowOracle
      close
      closeOracle
      volume
    }
  }
`;

// USE CANDLE TO GET PAST PRICE
// Get hourly candles but skip the last day
export const GET_TOKEN_PRICES_24h_AGO = gql`
  query GetPastTokenPrices {
    tokenCandles(where: { candleSize: 60 }, skip: 24, first: 1) {
      id
      token {
        id
        address
      }
      timestamp
      # The price 24h ago
      close
      volume
    }
  }
`;

// -------------------- Fragments used by the cache itself --------------------

export const TOKEN_FRAGMENT = gql`
  fragment TokenFragment on Token {
    id
    address
  }
`;

export const LIQUIDITY_FRAGMENT = gql`
  fragment LiquidityFragment on PoolLiquidity {
    id
    totalAmount
  }
`;

// -------------------- Client side queries that are only resolved by the cache --------------------

export const GET_SYSTEMINFO = gql`
  query GetSystemInfo {
    getSystemInfo @client {
      id
      recoveryModeActive
      totalCollateralRatio
      borrowerICR
      borrowerIMCR
      borrowingInterestRate
    }
  }
`;

export const GET_REDEMPTIONS_OPERATIONS = gql`
  query GetRedemptionsOperations {
    getRedemtionOperations @client {
      id
      redemptionRateWithDecay
    }
  }
`;
