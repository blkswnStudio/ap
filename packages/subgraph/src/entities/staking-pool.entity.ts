import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { PriceFeed } from '../../generated/PriceFeed/PriceFeed';
import { Staking, StakingPool, StakingPoolReward, SystemInfo } from '../../generated/schema';
import { SwapPair } from '../../generated/templates/SwapPairTemplate/SwapPair';
import { secondsToYear } from '../utils';
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
    pool.additionalRewardsPerYearUSD = BigInt.fromI32(0);
    pool.stakingAPR = BigInt.fromI32(0);
    pool.rewards = [];
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

export function handleUpdateStaking_additionalRewardsPerSecond(
  event: ethereum.Event,
  poolAddress: Address,
  reward: Address,
  rewardsPerSecond: BigInt,
): void {
  const id = `${poolAddress.toHexString()}-${reward.toHexString()}`;
  let poolReward = StakingPoolReward.load(id);

  if (poolReward === null) {
    poolReward = new StakingPoolReward(id);
    poolReward.token = reward;
    poolReward.rewardsPerSecond = BigInt.fromI32(0);
    poolReward.rewardsPerYearUSD = BigInt.fromI32(0);
    poolReward.save();

    // push new reward
    const pool = StakingPool.load(poolAddress)!;
    pool.rewards.push(id);
    pool.save();
  }

  // update
  poolReward.rewardsPerSecond = rewardsPerSecond;
  poolReward.save();

  updateStakingPool_additionalRewardUSD(event, poolAddress, reward);
}

export function updateStakingPool_additionalRewardUSD(
  event: ethereum.Event,
  poolAddress: Address,
  reward: Address,
): void {
  const systemInfo = SystemInfo.load(`SystemInfo`)!;
  const priceFeed = PriceFeed.bind(Address.fromBytes(systemInfo.priceFeed));
  const pool = StakingPool.load(poolAddress)!;
  const poolReward = StakingPoolReward.load(`${poolAddress.toHexString()}-${reward.toHexString()}`);
  if (poolReward == null) return; // skip if not exists

  pool.additionalRewardsPerYearUSD = pool.additionalRewardsPerYearUSD.minus(poolReward.rewardsPerYearUSD); // sub old
  poolReward.rewardsPerYearUSD = priceFeed.getUSDValue2(reward, poolReward.rewardsPerSecond.times(secondsToYear));
  pool.additionalRewardsPerYearUSD = pool.additionalRewardsPerYearUSD.plus(poolReward.rewardsPerYearUSD);
  poolReward.save();
  pool.save();

  handleUpdateStakingPool_totalDepositUSD_totalRewardUSD_stakingAPR(poolAddress, event); // APR changed
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
  const si = SystemInfo.load(`SystemInfo`)!;
  const staking = Staking.load(`Staking`)!;
  const stakingPool = StakingPool.load(poolAddress)!;
  const priceFeed = PriceFeed.bind(Address.fromBytes(si.priceFeed));
  const swapPair = SwapPair.bind(poolAddress);

  // get totalSupply/totalValueUSD (not up-to-date in pool, because event fires later)
  const token1 = swapPair.token1();
  const lpRes = swapPair.getReserves();
  const liquidity0USD = lpRes.get_reserve0(); // jUSD has always value of 1$
  const liquidity1USD = priceFeed.getUSDValue2(token1, lpRes.get_reserve1());
  const totalValueUSD = liquidity0USD.plus(liquidity1USD);
  const totalSupply = swapPair.totalSupply();

  stakingPool.totalDepositUSD = totalSupply.equals(BigInt.fromI32(0))
    ? BigInt.fromI32(0)
    : totalValueUSD.times(stakingPool.totalDeposit).div(totalSupply); // totalDeposit should always be totalSupply, but just to be sure
  stakingPool.totalRewardUSD = staking.totalAllocPoints.equals(BigInt.fromI32(0))
    ? BigInt.fromI32(0)
    : staking.rewardsPerYearUSD
        .times(stakingPool.allocPoints)
        .div(staking.totalAllocPoints)
        .plus(stakingPool.additionalRewardsPerYearUSD); //includes additional rewards
  stakingPool.stakingAPR = stakingPool.totalDepositUSD.equals(BigInt.fromI32(0))
    ? BigInt.fromI32(0)
    : stakingPool.totalRewardUSD.times(oneEther).div(stakingPool.totalDepositUSD);

  stakingPool.save();
}
