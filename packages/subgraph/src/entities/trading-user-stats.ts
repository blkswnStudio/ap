import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { PriceFeed } from '../../generated/PriceFeed/PriceFeed';
import { TokenManager } from '../../generated/TokenManager/TokenManager';
import { SystemInfo, TradingUserPosition, TradingUserStats } from '../../generated/schema';

export function handleUpdateTradingUserPosition_onTransfer(
  event: ethereum.Event,
  tokenAddress: Address,
  from: Address,
  to: Address,
  amount: BigInt,
): void {
  /*
  const systemInfo = SystemInfo.load(`SystemInfo`)!;
  const isMint = from == Address.fromString('0x0000000000000000000000000000000000000000');

  if (isMint) {
    // on mint, increase position at oracle price
    const position = getTradingUserPosition(`${to.toHexString()}-${tokenAddress.toHexString()}`);
    const priceFeed = PriceFeed.bind(Address.fromBytes(systemInfo.priceFeed));
    const value = priceFeed.getUSDValue2(tokenAddress, amount);
    position.amount = position.amount.plus(amount);
    position.value = position.value.plus(value);
    position.save();
  } else {
    const position = getTradingUserPosition(`${from.toHexString()}-${tokenAddress.toHexString()}`);
    // reduce amount and value (value in relation to) + remember values
    const positionAmountIn = position.amount.le(amount) ? position.amount : amount;
    const positionValueIn = position.amount.equals(BigInt.fromI32(0))
      ? BigInt.fromI32(0)
      : position.value.times(positionAmountIn).div(position.amount);
    position.lastTransferAmount = position.amount;
    position.lastTransferValue = position.value;
    position.amount = position.amount.minus(positionAmountIn);
    position.value = position.value.minus(positionValueIn);
    position.save();
  }
    */
}

export function handleUpdateTradingUserStats_onSwap(
  event: ethereum.Event,
  tokenAddress: Address,
  user: Address,
  // "LONG" | "SHORT"
  direction: string,
  // fee is returned in 1e18 (SWAP_FEE_PRECISION)
  feeUSD: BigInt,
  stableSize: BigInt,
  debtTokenSize: BigInt,
): void {
  const systemInfo = SystemInfo.load(`SystemInfo`)!;
  const tokenMgr = TokenManager.bind(Address.fromBytes(systemInfo.tokenManager));
  const stable = Address.fromBytes(systemInfo.stableCoin);
  const isLong = direction == 'LONG';
  const amountIn = isLong ? stableSize : debtTokenSize;
  const amountOut = isLong ? debtTokenSize : stableSize;
  const stats = getTradingUserStats(user.toHexString());
  if (!tokenMgr.isDebtToken(tokenAddress)) return;

  // increase output position (at dex price)
  const positionOut = getTradingUserPosition(`${user.toHexString()}-${(isLong ? tokenAddress : stable).toHexString()}`);
  updateTradingUserPosition(stats, positionOut, true, amountOut, stableSize);
  positionOut.save();

  // transfers reduce input position (at dex price)
  const positionIn = getTradingUserPosition(`${user.toHexString()}-${(isLong ? stable : tokenAddress).toHexString()}`);
  updateTradingUserPosition(stats, positionIn, false, amountIn, stableSize);
  positionIn.save();

  // user stats
  stats.volumeUSD = stats.volumeUSD.plus(stableSize);
  stats.feesUSD = stats.feesUSD.plus(feeUSD);
  stats.swapCount = stats.swapCount.plus(BigInt.fromI32(1));
  stats.profitToVolume = stats.profitUSD.times(BigInt.fromI32(10).pow(18)).div(stats.volumeUSD);
  stats.save();
}

const updateTradingUserPosition = (
  stats: TradingUserStats,
  position: TradingUserPosition,
  buy: bool,
  amount: BigInt,
  value: BigInt,
): void => {
  stats.profitUSD = stats.profitUSD.minus(position.profitUSD); // sub old

  // handle position
  if (buy) {
    position.buyAmount = position.buyAmount.plus(amount);
    position.buyValue = position.buyValue.plus(value);
  } else {
    position.sellAmount = position.sellAmount.plus(amount);
    position.sellValue = position.sellValue.plus(value);
  }

  // recalc profit
  const realAmount =
    BigInt.compare(position.buyAmount, position.sellAmount) == -1 ? position.buyAmount : position.sellAmount;
  if (realAmount.equals(BigInt.fromI32(0))) {
    position.profitUSD = BigInt.fromI32(0);
  } else {
    const realBuyValue = position.buyValue.times(realAmount).div(position.buyAmount);
    const realSellValue = position.sellValue.times(realAmount).div(position.sellAmount);
    position.profitUSD = realSellValue.minus(realBuyValue);
  }

  stats.profitUSD = stats.profitUSD.plus(position.profitUSD); // add new
};

const getTradingUserPosition = (id: string): TradingUserPosition => {
  let position = TradingUserPosition.load(id);
  if (position == null) {
    position = new TradingUserPosition(id);
    position.buyAmount = BigInt.fromI32(0);
    position.buyValue = BigInt.fromI32(0);
    position.sellAmount = BigInt.fromI32(0);
    position.sellValue = BigInt.fromI32(0);
    position.profitUSD = BigInt.fromI32(0);
  }
  return position;
};

const getTradingUserStats = (id: string): TradingUserStats => {
  let tradingUserStats = TradingUserStats.load(id);
  if (tradingUserStats == null) {
    tradingUserStats = new TradingUserStats(id);
    tradingUserStats.feesUSD = BigInt.fromI32(0);
    tradingUserStats.profitUSD = BigInt.fromI32(0);
    tradingUserStats.swapCount = BigInt.fromI32(0);
    tradingUserStats.volumeUSD = BigInt.fromI32(0);
    tradingUserStats.profitToVolume = BigInt.fromI32(0);
  }
  return tradingUserStats;
};
