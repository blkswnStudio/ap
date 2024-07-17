import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { newMockEvent } from 'matchstick-as';
import {
  AddPool,
  ConfigPool,
  Deposit,
  RewardsPerSecondChanged,
  StakingOperationsInitialized,
  Withdraw,
} from '../generated/StakingOperations/StakingOperations';
import { Pool } from '../generated/schema';
import {
  handleAddPool,
  handleConfigPool,
  handleDeposit,
  handleInit,
  handleRewardsChanged,
} from '../src/staking-operations';
import { handlePairCreated } from '../src/swap-operations';
import { oneEther, secondsToYear } from '../src/utils';
import { mockPriceFeed_getPrice, mockPriceFeed_getUSDValue } from './price-feed-utils';
import { createPairCreatedEvent } from './swap-operations-utils';
import {
  mockSwapPair_getReserves,
  mockSwapPair_token0,
  mockSwapPair_token1,
  mockSwapPair_totalSupply,
} from './swap-pair-utils';
import {
  MockCollToken_GOV_Address,
  MockDebtTokenAddress,
  MockDebtToken_STABLE_Address,
  MockStakingOperationsAddress,
  MockSwapOperationsAddress,
  MockSwapPair_STABLE_MockDebtToken_Address,
  MockTokenManagerAddress,
  MockUserAddress,
  initSystemInfo,
} from './utils';

export function createStakingOperationsInitializedEvent(): StakingOperationsInitialized {
  let event = changetype<StakingOperationsInitialized>(newMockEvent());

  event.address = MockStakingOperationsAddress;

  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam('swapOperations', ethereum.Value.fromAddress(MockSwapOperationsAddress)),
  );
  event.parameters.push(new ethereum.EventParam('tokenManager', ethereum.Value.fromAddress(MockTokenManagerAddress)));

  return event;
}

export function createAddPoolEvent(pid: Address): AddPool {
  let event = changetype<AddPool>(newMockEvent());

  event.address = MockStakingOperationsAddress;

  event.parameters = new Array();
  event.parameters.push(new ethereum.EventParam('pid', ethereum.Value.fromAddress(pid)));

  return event;
}

export function createConfigPoolEvent(pid: Address, allocPoints: BigInt, totalAllocPoints: BigInt): ConfigPool {
  let event = changetype<ConfigPool>(newMockEvent());

  event.address = MockStakingOperationsAddress;

  event.parameters = new Array();
  event.parameters.push(new ethereum.EventParam('pid', ethereum.Value.fromAddress(pid)));
  event.parameters.push(new ethereum.EventParam('allocPoint', ethereum.Value.fromUnsignedBigInt(allocPoints)));
  event.parameters.push(
    new ethereum.EventParam('totalAllocPoint', ethereum.Value.fromUnsignedBigInt(totalAllocPoints)),
  );

  return event;
}

export function createRewardsPerSecondChangedEvent(rewardsPerSecond: BigInt): RewardsPerSecondChanged {
  let event = changetype<RewardsPerSecondChanged>(newMockEvent());

  event.address = MockStakingOperationsAddress;

  event.parameters = new Array();
  event.parameters.push(
    new ethereum.EventParam('rewardsPerSecond', ethereum.Value.fromUnsignedBigInt(rewardsPerSecond)),
  );

  return event;
}

export function createDepositEvent(user: Address, pid: Address, amount: BigInt): Deposit {
  let event = changetype<Deposit>(newMockEvent());

  event.address = MockStakingOperationsAddress;

  event.parameters = new Array();
  event.parameters.push(new ethereum.EventParam('user', ethereum.Value.fromAddress(user)));
  event.parameters.push(new ethereum.EventParam('pid', ethereum.Value.fromAddress(pid)));
  event.parameters.push(new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(amount)));

  return event;
}

export function createWithdrawEvent(user: Address, pid: Address, amount: BigInt): Withdraw {
  let event = changetype<Withdraw>(newMockEvent());

  event.address = MockStakingOperationsAddress;

  event.parameters = new Array();
  event.parameters.push(new ethereum.EventParam('user', ethereum.Value.fromAddress(user)));
  event.parameters.push(new ethereum.EventParam('pid', ethereum.Value.fromAddress(pid)));
  event.parameters.push(new ethereum.EventParam('amount', ethereum.Value.fromUnsignedBigInt(amount)));

  return event;
}

export function initStakingOpsTests(
  init: boolean = false,
  addPool: boolean = false,
  rewardsPerSecond: boolean = false,
  configPool: boolean = false,
  deposit: boolean = false,
): void {
  const rps = BigInt.fromI32(100);
  const pA = BigInt.fromI32(100);
  const tA = BigInt.fromI32(2000);
  const dA = oneEther;
  initSystemInfo();

  if (init) {
    handleInit(createStakingOperationsInitializedEvent());
  }

  if (addPool) {
    mockSwapPair_getReserves();
    mockSwapPair_totalSupply();
    mockPriceFeed_getPrice();
    handlePairCreated(
      createPairCreatedEvent(
        MockDebtToken_STABLE_Address,
        MockDebtTokenAddress,
        MockSwapPair_STABLE_MockDebtToken_Address,
      ),
    );

    handleAddPool(createAddPoolEvent(MockSwapPair_STABLE_MockDebtToken_Address));
  }

  if (rewardsPerSecond) {
    mockSwapPair_token0(MockSwapPair_STABLE_MockDebtToken_Address, MockDebtToken_STABLE_Address);
    mockSwapPair_token1(MockSwapPair_STABLE_MockDebtToken_Address, MockDebtTokenAddress);
    mockPriceFeed_getUSDValue(MockCollToken_GOV_Address, BigInt.fromI32(0));
    mockPriceFeed_getUSDValue(MockCollToken_GOV_Address, rps.times(secondsToYear));
    handleRewardsChanged(createRewardsPerSecondChangedEvent(rps));
  }

  if (configPool) {
    handleConfigPool(createConfigPoolEvent(MockSwapPair_STABLE_MockDebtToken_Address, pA, tA));
  }

  if (deposit) {
    // set liquidity value
    const lp = Pool.load(`Pool-${MockDebtToken_STABLE_Address.toHexString()}-${MockDebtTokenAddress.toHexString()}`)!;
    lp.totalValueUSD = rps.times(secondsToYear);
    lp.save();

    handleDeposit(createDepositEvent(MockUserAddress, MockSwapPair_STABLE_MockDebtToken_Address, dA));
  }
}
