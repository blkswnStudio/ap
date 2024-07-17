import { BigInt } from '@graphprotocol/graph-ts';
import { assert, beforeEach, test } from 'matchstick-as';
import { afterEach, clearStore, describe } from 'matchstick-as/assembly/index';
import { handleAddPool, handleInit, handleRewardsChanged } from '../src/staking-operations';
import { secondsToYear } from '../src/utils';
import { mockPriceFeed_getUSDValue } from './price-feed-utils';
import {
  createAddPoolEvent,
  createRewardsPerSecondChangedEvent,
  createStakingOperationsInitializedEvent,
  initStakingOpsTests,
} from './staking-operations-utils';
import { MockCollToken_GOV_Address, MockSwapPair_STABLE_MockDebtToken_Address } from './utils';
// import { log } from '@graphprotocol/graph-ts';

describe('StakingOperationsInitialized()', () => {
  beforeEach(() => {
    initStakingOpsTests(false, false, false);
  });

  afterEach(() => {
    clearStore();
  });

  test('StakingOperationsInitialized()', () => {
    const event = createStakingOperationsInitializedEvent();

    handleInit(event);

    const entityId = `Staking`;
    assert.entityCount('Staking', 1);
    assert.fieldEquals('Staking', entityId, 'rewardsPerSecond', '0');
    assert.fieldEquals('Staking', entityId, 'rewardsPerYearUSD', '0');
    assert.fieldEquals('Staking', entityId, 'totalAllocPoints', '0');
  });
});

describe('RewardsPerSecondChanged()', () => {
  beforeEach(() => {
    initStakingOpsTests(true, false, false);

    const rps = BigInt.fromI32(100);
    mockPriceFeed_getUSDValue(MockCollToken_GOV_Address, rps.times(secondsToYear));
  });

  afterEach(() => {
    clearStore();
  });

  test('RewardsPerSecondChanged()', () => {
    const rps = BigInt.fromI32(100);
    const event = createRewardsPerSecondChangedEvent(rps);

    handleRewardsChanged(event);

    const entityId = `Staking`;
    assert.fieldEquals('Staking', entityId, 'rewardsPerSecond', rps.toString());
    assert.fieldEquals('Staking', entityId, 'rewardsPerYearUSD', rps.times(secondsToYear).toString());
  });
});

describe('AddPool()', () => {
  beforeEach(() => {
    initStakingOpsTests(true, false, false);
  });

  afterEach(() => {
    clearStore();
  });

  test('AddPool()', () => {
    const event = createAddPoolEvent(MockSwapPair_STABLE_MockDebtToken_Address);

    handleAddPool(event);

    const entityId = MockSwapPair_STABLE_MockDebtToken_Address.toHexString();
    assert.entityCount('StakingPool', 1);
    assert.fieldEquals('StakingPool', entityId, 'allocPoints', '0');
    assert.fieldEquals('StakingPool', entityId, 'totalDeposit', '0');
    assert.fieldEquals('StakingPool', entityId, 'totalDepositUSD', '0');
    assert.fieldEquals('StakingPool', entityId, 'totalRewardUSD', '0');
    assert.fieldEquals('StakingPool', entityId, 'stakingAPR', '0');
  });
});

// describe('ConfigPool()', () => {
//   beforeEach(() => {
//     initStakingOpsTests(true, true, true);
//   });

//   afterEach(() => {
//     clearStore();
//   });

//   test('ConfigPool()', () => {
//     const rps = BigInt.fromI32(100);
//     const pA = BigInt.fromI32(100);
//     const tA = BigInt.fromI32(2000);
//     const event = createConfigPoolEvent(MockSwapPair_STABLE_MockDebtToken_Address, pA, tA);

//     handleConfigPool(event);

//     const entityIdS = `Staking`;
//     assert.fieldEquals('Staking', entityIdS, 'rewardsPerSecond', rps.toString());
//     assert.fieldEquals('Staking', entityIdS, 'rewardsPerYearUSD', rps.times(secondsToYear).toString());
//     assert.fieldEquals('Staking', entityIdS, 'totalAllocPoints', tA.toString());

//     const entityId = MockSwapPair_STABLE_MockDebtToken_Address.toHexString();
//     assert.fieldEquals('StakingPool', entityId, 'allocPoints', pA.toString());
//     assert.fieldEquals(
//       'StakingPool',
//       entityId,
//       'totalRewardUSD',
//       rps.times(secondsToYear).times(pA).div(tA).toString(),
//     );
//   });
// });

// describe('Deposit()', () => {
//   beforeEach(() => {
//     const rps = BigInt.fromI32(100);

//     initStakingOpsTests(true, true, true, true);

//     // set liquidity value
//     const lp = Pool.load(`Pool-${MockDebtToken_STABLE_Address.toHexString()}-${MockDebtTokenAddress.toHexString()}`)!;
//     lp.totalValueUSD = rps.times(secondsToYear);
//     lp.save();
//   });

//   afterEach(() => {
//     clearStore();
//   });

//   test('Deposit()', () => {
//     const rps = BigInt.fromI32(100);
//     const dA = oneEther;

//     const event = createDepositEvent(MockUserAddress, MockSwapPair_STABLE_MockDebtToken_Address, dA);
//     handleDeposit(event);

//     const entityId = MockSwapPair_STABLE_MockDebtToken_Address.toHexString();
//     assert.fieldEquals('StakingPool', entityId, 'totalDeposit', dA.toString());
//     assert.fieldEquals('StakingPool', entityId, 'totalDepositUSD', rps.times(secondsToYear).toString());
//     assert.fieldEquals('StakingPool', entityId, 'stakingAPR', oneEther.div(BigInt.fromI32(20)).toString()); // 5%
//   });
// });

// describe('Withdraw()', () => {
//   beforeEach(() => {
//     initStakingOpsTests(true, true, true, true, true);
//   });

//   afterEach(() => {
//     clearStore();
//   });

//   test('Withdraw()', () => {
//     const rps = BigInt.fromI32(100);
//     const wA = oneEther.div(BigInt.fromI32(2));

//     const event = createWithdrawEvent(MockUserAddress, MockSwapPair_STABLE_MockDebtToken_Address, wA);
//     handleWithdraw(event);

//     const entityId = MockSwapPair_STABLE_MockDebtToken_Address.toHexString();
//     assert.fieldEquals('StakingPool', entityId, 'totalDeposit', oneEther.minus(wA).toString());
//     assert.fieldEquals(
//       'StakingPool',
//       entityId,
//       'totalDepositUSD',
//       rps.times(secondsToYear).div(BigInt.fromI32(2)).toString(),
//     );
//     assert.fieldEquals(
//       'StakingPool',
//       entityId,
//       'stakingAPR',
//       oneEther.div(BigInt.fromI32(20)).times(BigInt.fromI32(2)).toString(),
//     ); // 10%
//   });
// });
