import {
  AddPool,
  ConfigPool,
  Deposit,
  RewardsPerSecondChanged,
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
  handleUpdateStakingPool_allocPoints,
  handleUpdateStakingPool_totalDeposit,
} from './entities/staking-pool.entity';
import { handleUpdateSystemInfo_stakingOps } from './entities/system-info-entity';
// import { log } from '@graphprotocol/graph-ts';

export function handleInit(event: StakingOperationsInitialized): void {
  handleUpdateSystemInfo_stakingOps(event, event.address);
  handleCreateStaking();
}

export function handleAddPool(event: AddPool): void {
  handleCreateStakingPool(event, event.params.pid);
}

export function handleConfigPool(event: ConfigPool): void {
  handleUpdateStakingPool_allocPoints(event, event.params.pid, event.params.allocPoint);

  handleUpdateStaking_totalAllocPoints(event, event.params.totalAllocPoint);
}

export function handleRewardsChanged(event: RewardsPerSecondChanged): void {
  handleUpdateStaking_rewardsPerSecond(event, event.params.rewardsPerSecond);
}

export function handleDeposit(event: Deposit): void {
  handleUpdateStakingPool_totalDeposit(true, event.params.pid, event.params.amount);
}

export function handleWithdraw(event: Withdraw): void {
  handleUpdateStakingPool_totalDeposit(false, event.params.pid, event.params.amount);
}
