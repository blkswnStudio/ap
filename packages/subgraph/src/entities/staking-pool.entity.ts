import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { Staking, StakingPool } from '../../generated/schema';
import { SwapPair } from '../../generated/templates/SwapPairTemplate/SwapPair';
import { handleUpdatePoolDailyStats } from './pool-daily-stats-entity';
import { oneEther } from './token-candle-entity';

export function handleCreateStakingPool(event: ethereum.Event, address: Address): void {
  const staking = Staking.load(`Staking`)!;
  let pool = StakingPool.load(address);

  if (pool === null) {
    pool = new StakingPool(address);
    pool.allocPoints = BigInt.fromI32(0);
    pool.totalDeposit = BigInt.fromI32(0);
    pool.totalDepositUSD = BigInt.fromI32(0);
    pool.totalRewardUSD = BigInt.fromI32(0);
    pool.stakingAPR = BigInt.fromI32(0);
    pool.save();

    staking.pools.push(address);
    staking.save();
  }
}

export function handleUpdateStakingPool_allocPoints(
  event: ethereum.Event,
  poolAddress: Address,
  allocPoints: BigInt,
): void {
  const stakingPool = StakingPool.load(poolAddress)!;

  stakingPool.allocPoints = allocPoints;
  stakingPool.save();
  handleUpdateStakingPool_totalDepositUSD_totalRewardUSD_stakingAPR(poolAddress, event);
}

export function handleUpdateStakingPool_totalDeposit(
  isDeposit: boolean,
  poolAddress: Address,
  amount: BigInt,
  event: ethereum.Event,
): void {
  const pool = StakingPool.load(poolAddress)!;

  if (isDeposit) pool.totalDeposit = pool.totalDeposit.plus(amount);
  else pool.totalDeposit = pool.totalDeposit.minus(amount);

  pool.save();

  handleUpdateStakingPool_totalDepositUSD_totalRewardUSD_stakingAPR(poolAddress, event);
}

export function handleUpdateStakingPool_totalDepositUSD_totalRewardUSD_stakingAPR(
  poolAddress: Address,
  event: ethereum.Event,
): void {
  const staking = Staking.load(`Staking`)!;
  const stakingPool = StakingPool.load(poolAddress)!;
  const pools = stakingPool.liquidityPool.load();

  if (pools.length > 0) {
    const lp = stakingPool.liquidityPool.load()[0];

    stakingPool.totalDepositUSD = lp.totalSupply.equals(BigInt.fromI32(0))
      ? BigInt.fromI32(0)
      : lp.totalValueUSD.times(stakingPool.totalDeposit).div(lp.totalSupply); // totalDeposit should always be totalSupply, but just to be sure
  } else {
    stakingPool.totalDepositUSD = BigInt.fromI32(0);
  }

  stakingPool.totalRewardUSD = staking.totalAllocPoints.equals(BigInt.fromI32(0))
    ? BigInt.fromI32(0)
    : staking.rewardsPerYearUSD.times(stakingPool.allocPoints).div(staking.totalAllocPoints);
  stakingPool.stakingAPR = stakingPool.totalDepositUSD.equals(BigInt.fromI32(0))
    ? BigInt.fromI32(0)
    : stakingPool.totalRewardUSD.times(oneEther).div(stakingPool.totalDepositUSD);

  stakingPool.save();

  handleUpdatePoolDailyStats(SwapPair.bind(poolAddress).token1(), event);
}
