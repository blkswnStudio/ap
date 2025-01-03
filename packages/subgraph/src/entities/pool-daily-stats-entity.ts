import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { PriceFeed } from '../../generated/PriceFeed/PriceFeed';
import { Pool, PoolDailyStat, PoolLiquidity, StakingPool, SystemInfo, Token } from '../../generated/schema';
import { ERC20 } from '../../generated/templates/ERC20Template/ERC20';

export const handleUpdatePoolDailyStats = (token1: Address, event: ethereum.Event): void => {
  const systemInfo = SystemInfo.load(`SystemInfo`)!;
  const pool = Pool.load(`Pool-${Address.fromBytes(systemInfo.stableCoin).toHexString()}-${token1.toHexString()}`);
  if (pool == null) return;

  // normalize timestamp
  const t: Date = new Date(event.block.timestamp.toI32() * 1000);
  t.setUTCSeconds(0);
  t.setUTCMinutes(0);
  t.setUTCHours(0);
  const ts = t.getTime() / i64(1000);

  // load / create
  let stat = PoolDailyStat.load(`${token1.toHexString()}-${ts}`);
  if (stat === null) {
    stat = new PoolDailyStat(`${token1.toHexString()}-${ts}`);
    stat.token1 = token1.toHexString();
    stat.timestamp = BigInt.fromI64(ts);
    stat.liquidityPool = pool.id;
  }

  // update all data
  {
    const stakingPool = StakingPool.load(pool.address);

    // APR
    stat.swapAPR = pool.liquidityDepositAPY;
    stat.stakingAPR = stakingPool == null ? BigInt.fromI32(0) : stakingPool.stakingAPR;

    // Liquidity
    stat.totalLiquidity = pool.totalSupply;
    stat.totalLiquidityUSD = pool.totalValueUSD;
    for (let n = 0; n < pool.liquidity.length; n++) {
      const liq = PoolLiquidity.load(pool.liquidity[n])!;
      if (Token.load(liq.token)!.address == systemInfo.stableCoin.toHexString()) stat.token0Amount = liq.totalAmount;
      else stat.token1Amount = liq.totalAmount;
    }

    // Price
    const priceFeed = PriceFeed.bind(Address.fromBytes(systemInfo.priceFeed));
    const erc20_token1 = ERC20.bind(token1);
    const token1_decimals = u8(erc20_token1.decimals());
    const oneToken1 = BigInt.fromI32(10).pow(token1_decimals);
    stat.poolPrice = stat.token1Amount.equals(BigInt.fromI32(0))
      ? BigInt.fromI32(0)
      : stat.token0Amount.times(oneToken1).div(stat.token1Amount);
    stat.oraclePrice = priceFeed.getPrice(token1).getPrice();

    // empty
    stat.oraclePrice = BigInt.fromI32(0);
    stat.feeUSD = BigInt.fromI32(0);
  }

  stat.save();
};
