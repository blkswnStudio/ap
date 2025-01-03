import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { PriceFeed } from '../../generated/PriceFeed/PriceFeed';
import { Staking, SystemInfo } from '../../generated/schema';
import { secondsToYear } from '../utils';
import { handleUpdateStakingPool_totalDepositUSD_totalRewardUSD_stakingAPR } from './staking-pool.entity';

export function handleCreateStaking(): void {
  const systemInfo = SystemInfo.load(`SystemInfo`)!;
  let staking = Staking.load('Staking');

  if (staking === null) {
    staking = new Staking('Staking');
    staking.rewardsPerSecond = BigInt.fromI32(0);
    staking.rewardsPerYearUSD = BigInt.fromI32(0);
    staking.totalAllocPoints = BigInt.fromI32(0);
    staking.pools = [];
    staking.save();
  }
}

export function handleUpdateStaking_totalAllocPoints(event: ethereum.Event, totalAllocPoint: BigInt): void {
  const staking = Staking.load(`Staking`)!;

  staking.totalAllocPoints = totalAllocPoint;
  staking.save();
}

export function handleUpdateStaking_rewardsPerSecond(event: ethereum.Event, rewardsPerSecond: BigInt): void {
  const staking = Staking.load(`Staking`)!;
  const systemInfo = SystemInfo.load(`SystemInfo`)!;
  const priceFeed = PriceFeed.bind(Address.fromBytes(systemInfo.priceFeed));

  staking.rewardsPerSecond = rewardsPerSecond;

  staking.rewardsPerYearUSD = priceFeed.getUSDValue2(
    Address.fromBytes(systemInfo.govToken),
    staking.rewardsPerSecond.times(secondsToYear),
  );
  staking.save();

  // iterate over all pools and update USD and APR
  for (let n = 0; n < staking.pools.length; n++) {
    const poolAddress = Address.fromBytes(staking.pools[n]);
    handleUpdateStakingPool_totalDepositUSD_totalRewardUSD_stakingAPR(poolAddress, event);
  }
}
