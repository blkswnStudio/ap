// import { log } from '@graphprotocol/graph-ts';
import { SystemInfo } from '../generated/schema';
import {
  AddPool,
  ConfigPool,
  Deposit,
  AdditionalRewardsPerSecondChanged,
  StakingOperationsInitialized,
  Withdraw,
} from '../generated/StakingOperations/StakingOperations';
import {
  handleCreateStaking,
  handleUpdateStaking_rewardsPerSecond,
  handleUpdateStaking_totalAllocPoints,
} from './entities/staking-entity';
import {
  handleCreateStakingPool,
  handleUpdateStaking_additionalRewardsPerSecond,
  handleUpdateStakingPool_allocPoints,
  handleUpdateStakingPool_totalDeposit,
} from './entities/staking-pool.entity';
import { handleUpdateSystemInfo_stakingOps } from './entities/system-info-entity';

export function handleInit(event: StakingOperationsInitialized): void {
  handleUpdateSystemInfo_stakingOps(event, event.address);
  handleCreateStaking();
}

export function handleAddPool(event: AddPool): void {
  handleCreateStakingPool(event, event.params.pid);
}

export function handleConfigPool(event: ConfigPool): void {
  handleUpdateStaking_totalAllocPoints(event, event.params.totalAllocPoint);
  handleUpdateStakingPool_allocPoints(event, event.params.pid, event.params.allocPoint);
}

export function handleAdditionalRewardsPerSecondChanged(event: AdditionalRewardsPerSecondChanged): void {
    const systemInfo = SystemInfo.load(`SystemInfo`)!;
  
  if (event.params.token.toHexString() == systemInfo.govToken.toHexString()) {
    handleUpdateStaking_rewardsPerSecond(event, event.params.rewardsPerSecond);
  } else {
    handleUpdateStaking_additionalRewardsPerSecond(event, event.params.pid, event.params.token, event.params.rewardsPerSecond);
  }
}

export function handleDeposit(event: Deposit): void {
  handleUpdateStakingPool_totalDeposit(true, event.params.pid, event.params.amount, event);
}

export function handleWithdraw(event: Withdraw): void {
  handleUpdateStakingPool_totalDeposit(false, event.params.pid, event.params.amount, event);
}
