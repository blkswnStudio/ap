import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { PriceFeed } from '../../generated/PriceFeed/PriceFeed';
import { SystemInfo, Token, TokenCandle, TokenCandleSingleton } from '../../generated/schema';
import { SwapPair } from '../../generated/templates/SwapPairTemplate/SwapPair';
// import { log } from '@graphprotocol/graph-ts';

// 1min, 10min, 1hour, 6hour, 1day, 1week
export const CandleSizes = [1, 10, 60, 360, 1440, 10080];
export const oneEther = BigInt.fromI64(1000000000000000000);

/**
 * Cant convert a float64 to a BigInt so have to do a workaround
 *
 * @param n numbers of zeros
 * @returns A Bigint with 10^n
 */
export function bigIntWithZeros(n: i32): BigInt {
  const str = '1' + '0'.repeat(n);
  return BigInt.fromString(str);
}

/**
 * Initializes the Singleton once for a new Token
 */
export function handleCreateTokenCandleSingleton(event: ethereum.Event, tokenAddress: Address): void {
  let candleSingleton: TokenCandleSingleton | null;

  const systemInfo = SystemInfo.load(`SystemInfo`)!;
  const priceFeedContract = PriceFeed.bind(Address.fromBytes(systemInfo.priceFeed));

  const tokenPrice = priceFeedContract.getPrice(tokenAddress).getPrice();

  for (let i = 0; i < CandleSizes.length; i++) {
    candleSingleton = TokenCandleSingleton.load(
      `TokenCandleSingleton-${tokenAddress.toHexString()}-${CandleSizes[i].toString()}`,
    );

    if (!candleSingleton) {
      candleSingleton = new TokenCandleSingleton(
        `TokenCandleSingleton-${tokenAddress.toHexString()}-${CandleSizes[i].toString()}`,
      );

      candleSingleton.token = tokenAddress;
      candleSingleton.candleSize = CandleSizes[i];
      candleSingleton.timestamp = event.block.timestamp;
      candleSingleton.open = tokenPrice;
      candleSingleton.high = tokenPrice;
      candleSingleton.low = tokenPrice;
      candleSingleton.close = tokenPrice;
      candleSingleton.volume = BigInt.fromI32(0);
      candleSingleton.openOracle = tokenPrice;
      candleSingleton.highOracle = tokenPrice;
      candleSingleton.lowOracle = tokenPrice;
      candleSingleton.closeOracle = tokenPrice;

      candleSingleton.save();
    }
  }
}

/**
 * Updates the Singleton and creates new Candles if candle is closed
 */
export function handleUpdateTokenCandle_lowOracle_highOracle(
  event: ethereum.Event,
  tokenAddress: Bytes,
  tokenPriceOracle: BigInt,
): void {
  const token = Token.load(tokenAddress)!;
  const pairToken = Address.fromString(token.address);

  // FIXME: Workaround for timing issue in the deployment
  if (!TokenCandleSingleton.load(`TokenCandleSingleton-${pairToken.toHexString()}-${CandleSizes[0].toString()}`)) {
    return;
  }

  for (let i = 0; i < CandleSizes.length; i++) {
    const candleSingleton = TokenCandleSingleton.load(
      `TokenCandleSingleton-${pairToken.toHexString()}-${CandleSizes[i].toString()}`,
    )!;

    if (candleSingleton.timestamp.plus(BigInt.fromI32(CandleSizes[i] * 60)) < event.block.timestamp) {
      handleCloseCandle(event, pairToken, CandleSizes[i], tokenPriceOracle);
    } else {
      // Oracle
      if (candleSingleton.lowOracle.gt(tokenPriceOracle)) {
        candleSingleton.lowOracle = tokenPriceOracle;
      } else if (candleSingleton.highOracle.lt(tokenPriceOracle)) {
        candleSingleton.highOracle = tokenPriceOracle;
      }
      // Add close so that previous price is known
      candleSingleton.closeOracle = tokenPriceOracle;

      candleSingleton.save();
    }
  }
}

/**
 * Updates the Singleton and creates new Candles if candle is closed
 */
export function handleUpdateTokenCandle_low_high(event: ethereum.Event, swapPair: Address, pairToken: Address): void {
  const token = Token.load(pairToken)!;
  const systemInfo = SystemInfo.load(`SystemInfo`)!;
  const priceFeedContract = PriceFeed.bind(Address.fromBytes(systemInfo.priceFeed));

  const swapPairReserves = SwapPair.bind(swapPair).getReserves();
  const tokenPriceInStable = swapPairReserves
    .get_reserve0()
    .times(bigIntWithZeros(token.decimals))
    .div(swapPairReserves.get_reserve1());
  const tokenPriceOracle = priceFeedContract.getPrice(pairToken).getPrice();

  for (let i = 0; i < CandleSizes.length; i++) {
    const candleSingleton = TokenCandleSingleton.load(
      `TokenCandleSingleton-${pairToken.toHexString()}-${CandleSizes[i].toString()}`,
    )!;

    if (candleSingleton.timestamp.plus(BigInt.fromI32(CandleSizes[i] * 60)) < event.block.timestamp) {
      handleCloseCandle(event, pairToken, CandleSizes[i], tokenPriceOracle, tokenPriceInStable);
    } else {
      // Swap Pair
      if (candleSingleton.low.gt(tokenPriceInStable)) {
        candleSingleton.low = tokenPriceInStable;
      } else if (candleSingleton.high.lt(tokenPriceInStable)) {
        candleSingleton.high = tokenPriceInStable;
      }
      candleSingleton.close = tokenPriceInStable;

      // Oracle
      if (candleSingleton.lowOracle.gt(tokenPriceOracle)) {
        candleSingleton.lowOracle = tokenPriceOracle;
      } else if (candleSingleton.highOracle.lt(tokenPriceOracle)) {
        candleSingleton.highOracle = tokenPriceOracle;
      }
      // Add close so that previous price is known
      candleSingleton.closeOracle = tokenPriceOracle;

      candleSingleton.save();
    }
  }
}

/**
 * Updates the Singleton and creates new Candles if candle is closed
 */
export function handleUpdateTokenCandle_volume(
  event: ethereum.Event,
  swapPair: Address,
  pairToken: Address,
  additionalTradeVolume: BigInt,
): void {
  // calculate price from ratio to stable and oraclePrice
  const token = Token.load(pairToken)!;
  const systemInfo = SystemInfo.load(`SystemInfo`)!;
  const priceFeedContract = PriceFeed.bind(Address.fromBytes(systemInfo.priceFeed));

  const swapPairReserves = SwapPair.bind(swapPair).getReserves();
  const tokenPriceInStable = swapPairReserves
    .get_reserve1()
    .times(bigIntWithZeros(token.decimals))
    .div(swapPairReserves.get_reserve0());
  const tokenPriceOracle = priceFeedContract.getPrice(pairToken).getPrice();

  for (let i = 0; i < CandleSizes.length; i++) {
    const candleSingleton = TokenCandleSingleton.load(
      `TokenCandleSingleton-${pairToken.toHexString()}-${CandleSizes[i].toString()}`,
    )!;

    if (candleSingleton.timestamp.plus(BigInt.fromI32(CandleSizes[i] * 60)) < event.block.timestamp) {
      handleCloseCandle(event, pairToken, CandleSizes[i], tokenPriceOracle, tokenPriceInStable, additionalTradeVolume);
    } else {
      candleSingleton.volume = candleSingleton.volume.plus(additionalTradeVolume);
      candleSingleton.save();
    }
  }
}

function handleCloseCandle(
  event: ethereum.Event,
  pairToken: Address,
  candleSize: i32,
  tokenPriceOracle: BigInt,
  tokenPriceStable: BigInt = BigInt.fromI32(0),
  initialTradeVolume: BigInt = BigInt.fromI32(0),
): void {
  const candleSingleton = TokenCandleSingleton.load(
    `TokenCandleSingleton-${pairToken.toHexString()}-${candleSize.toString()}`,
  )!;

  // while is fill-up candle
  while (candleSingleton.timestamp.plus(BigInt.fromI32(candleSize * 60)).lt(event.block.timestamp)) {
    // Save away new closed candle
    const newClosedCandle = new TokenCandle(
      `TokenCandle-${pairToken.toHexString()}-${candleSize.toString()}-${candleSingleton.timestamp.toString()}`,
    );
    newClosedCandle.timestamp = candleSingleton.timestamp;

    newClosedCandle.token = pairToken;
    newClosedCandle.candleSize = candleSize;
    newClosedCandle.open = candleSingleton.open;
    newClosedCandle.high = candleSingleton.high;
    newClosedCandle.low = candleSingleton.low;
    newClosedCandle.close = candleSingleton.close;
    newClosedCandle.volume = candleSingleton.volume;
    newClosedCandle.openOracle = candleSingleton.openOracle;
    newClosedCandle.highOracle = candleSingleton.highOracle;
    newClosedCandle.lowOracle = candleSingleton.lowOracle;
    newClosedCandle.closeOracle = candleSingleton.closeOracle;
    newClosedCandle.save();

    // Prepare new candle to be populated
    candleSingleton.timestamp = candleSingleton.timestamp.plus(BigInt.fromI32(candleSize * 60));
    // on fill up open price is the same as closed
    candleSingleton.open = candleSingleton.close;
    candleSingleton.high = candleSingleton.close;
    candleSingleton.low = candleSingleton.close;
    candleSingleton.openOracle = candleSingleton.closeOracle;
    candleSingleton.highOracle = candleSingleton.closeOracle;
    candleSingleton.lowOracle = candleSingleton.closeOracle;

    // If candle is to fill the time in between the volume is 0
    candleSingleton.volume = BigInt.fromI32(0);

    candleSingleton.save();
  }

  // Lastly update with current candle
  // candleSingleton.timestamp = candleSingleton.timestamp.plus(BigInt.fromI32(candleSize * 60));
  candleSingleton.open = candleSingleton.close;
  // Only update the DEX price when there is new data from the DEX
  if (tokenPriceStable.gt(BigInt.fromI32(0))) {
    candleSingleton.high = candleSingleton.close.gt(tokenPriceStable) ? candleSingleton.close : tokenPriceStable;
    candleSingleton.low = candleSingleton.close.lt(tokenPriceStable) ? candleSingleton.close : tokenPriceStable;
    candleSingleton.close = tokenPriceStable;
  }
  candleSingleton.volume = initialTradeVolume;
  candleSingleton.openOracle = candleSingleton.closeOracle;
  candleSingleton.highOracle = candleSingleton.closeOracle.gt(tokenPriceOracle)
    ? candleSingleton.closeOracle
    : tokenPriceOracle;
  candleSingleton.lowOracle = candleSingleton.closeOracle.lt(tokenPriceOracle)
    ? candleSingleton.closeOracle
    : tokenPriceOracle;
  candleSingleton.closeOracle = tokenPriceOracle;

  candleSingleton.save();
}
