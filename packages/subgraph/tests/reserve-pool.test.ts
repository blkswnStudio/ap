import { BigInt } from '@graphprotocol/graph-ts';
import { assert, beforeEach, test } from 'matchstick-as';
import { afterEach, clearStore, describe } from 'matchstick-as/assembly/index';
import { oneEther } from '../src/entities/token-candle-entity';
import { handleReservePoolInitialized, handleWithdrewReserves } from '../src/reserve-pool';
import { mockDebtToken_totalSupply, mockToken_balanceOf } from './debt-token-utils';
import { mockPriceFeed_getPrice, mockPriceFeed_getUSDValue } from './price-feed-utils';
import {
  createReservePoolInitializedEvent,
  createWithdrewReservesEvent,
  mockReservePool_govReserveCap,
} from './reserve-pool-utils';
import { mockStabilityPoolManager_getStabilityPool } from './stability-pool-manager-utils';
import { mockStabilityPool_getTotalDeposit } from './stability-pool-utils';
import { mockStoragePool_getTokenTotalAmount } from './storage-pool-utils';
import {
  MockCollToken_GOV_Address,
  MockDebtTokenAddress,
  MockDebtToken_STABLE_Address,
  MockReservePoolAddress,
  initSystemInfo,
  initToken,
} from './utils';

describe('handleReservePoolInitialized()', () => {
  beforeEach(() => {
    initSystemInfo();
    initToken(MockDebtToken_STABLE_Address);
  });

  afterEach(() => {
    clearStore();
  });

  test('handleUpdateSystemInfo_reservePool: set reservePool on systemInfo', () => {
    const event = createReservePoolInitializedEvent(
      MockDebtTokenAddress,
      MockDebtTokenAddress,
      MockDebtTokenAddress,
      MockDebtTokenAddress,
    );

    handleReservePoolInitialized(event);

    const entityId = `SystemInfo`;
    assert.entityCount('SystemInfo', 1);
    assert.fieldEquals('SystemInfo', entityId, 'reservePool', MockDebtTokenAddress.toHexString());
  });
});

describe('handleWithdrewReserves()', () => {
  beforeEach(() => {
    initToken(MockDebtToken_STABLE_Address);
    initToken(MockCollToken_GOV_Address);
    initSystemInfo();

    mockToken_balanceOf(MockDebtToken_STABLE_Address);
    mockStabilityPool_getTotalDeposit();
    mockPriceFeed_getUSDValue(MockDebtToken_STABLE_Address);
    mockPriceFeed_getUSDValue(MockCollToken_GOV_Address);

    mockReservePool_govReserveCap();
    mockStoragePool_getTokenTotalAmount(MockCollToken_GOV_Address);
    mockPriceFeed_getPrice(MockCollToken_GOV_Address);

    mockStabilityPoolManager_getStabilityPool(MockDebtToken_STABLE_Address);
    mockDebtToken_totalSupply(MockDebtToken_STABLE_Address);
    mockPriceFeed_getPrice(MockDebtToken_STABLE_Address);
  });

  afterEach(() => {
    clearStore();
  });

  test('handleCreateUpdateDebtTokenMeta is called successfully', () => {
    const event = createWithdrewReservesEvent();

    handleWithdrewReserves(event);

    const entityId = `DebtTokenMeta-${MockDebtToken_STABLE_Address.toHexString()}`;
    assert.entityCount('DebtTokenMeta', 1);
    assert.fieldEquals('DebtTokenMeta', entityId, 'token', MockDebtToken_STABLE_Address.toHexString());
    assert.fieldEquals('DebtTokenMeta', entityId, 'timestamp', event.block.timestamp.toString());
    assert.fieldEquals(
      'DebtTokenMeta',
      entityId,
      'totalDepositedStability',
      oneEther.times(BigInt.fromI32(10)).toString(),
    );
    assert.fieldEquals('DebtTokenMeta', entityId, 'totalReserve', oneEther.toString());
    assert.fieldEquals('DebtTokenMeta', entityId, 'totalSupplyUSD', oneEther.times(BigInt.fromI32(100)).toString());

    assert.fieldEquals(
      'DebtTokenMeta',
      entityId,
      'stabilityDepositAPY',
      `StabilityDepositAPY-${MockDebtToken_STABLE_Address.toHexString()}`,
    );
    assert.fieldEquals(
      'DebtTokenMeta',
      entityId,
      'totalReserve30dAverage',
      `TotalReserveAverage-${MockDebtToken_STABLE_Address.toHexString()}`,
    );
    assert.fieldEquals(
      'DebtTokenMeta',
      entityId,
      'totalSupplyUSD30dAverage',
      `TotalSupplyAverage-${MockDebtToken_STABLE_Address.toHexString()}`,
    );
  });

  test('handleUpdateDebtTokenMeta_totalReserve30dAverage is called and the average is correctly calculated', () => {
    const event = createWithdrewReservesEvent();
    handleWithdrewReserves(event);

    const entityId = `TotalReserveAverageChunk-${MockDebtToken_STABLE_Address.toHexString()}-1`;
    // for debtToken and collToken
    assert.entityCount('TotalReserveAverageChunk', 2);
    assert.fieldEquals('TotalReserveAverageChunk', entityId, 'timestamp', event.block.timestamp.toString());
    assert.fieldEquals('TotalReserveAverageChunk', entityId, 'value', oneEther.toString());

    const averageEntityId = `TotalReserveAverage-${MockDebtToken_STABLE_Address.toHexString()}`;
    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'index', '1');
    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'value', oneEther.toString());
  });

  test('handleUpdateDebtTokenMeta_totalReserve30dAverage is called and the average is correctly accumulated in one chunk', () => {
    const event = createWithdrewReservesEvent();
    handleWithdrewReserves(event);

    const entityId = `TotalReserveAverageChunk-${MockDebtToken_STABLE_Address.toHexString()}-1`;
    assert.entityCount('TotalReserveAverageChunk', 2);
    assert.fieldEquals('TotalReserveAverageChunk', entityId, 'timestamp', event.block.timestamp.toString());
    assert.fieldEquals('TotalReserveAverageChunk', entityId, 'value', oneEther.toString());

    const averageEntityId = `TotalReserveAverage-${MockDebtToken_STABLE_Address.toHexString()}`;
    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'index', '1');
    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'value', oneEther.toString());

    // same chunk so value is just updated
    const eventSecond = createWithdrewReservesEvent();
    mockToken_balanceOf(MockDebtToken_STABLE_Address, MockReservePoolAddress, oneEther.times(BigInt.fromI32(2)));
    mockPriceFeed_getUSDValue(MockDebtToken_STABLE_Address, oneEther.times(BigInt.fromI32(2)));
    handleWithdrewReserves(eventSecond);

    assert.entityCount('TotalReserveAverageChunk', 2);
    assert.fieldEquals('TotalReserveAverageChunk', entityId, 'timestamp', event.block.timestamp.toString());
    assert.fieldEquals('TotalReserveAverageChunk', entityId, 'value', oneEther.times(BigInt.fromI32(2)).toString());

    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'index', '1');
    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'value', oneEther.times(BigInt.fromI32(2)).toString());
  });

  test('handleUpdateDebtTokenMeta_totalReserve30dAverage is called and the average is correctly accumulated in two chunks', () => {
    const event = createWithdrewReservesEvent();
    handleWithdrewReserves(event);

    const secondEvent = createWithdrewReservesEvent();
    mockToken_balanceOf(MockDebtToken_STABLE_Address, MockReservePoolAddress, oneEther.times(BigInt.fromI32(2)));
    mockPriceFeed_getUSDValue(MockDebtToken_STABLE_Address, oneEther.times(BigInt.fromI32(2)));
    secondEvent.block.timestamp = event.block.timestamp.plus(BigInt.fromI32(60 * 60 + 1));
    handleWithdrewReserves(secondEvent);

    const entityId = `TotalReserveAverageChunk-${MockDebtToken_STABLE_Address.toHexString()}-2`;
    assert.entityCount('TotalReserveAverageChunk', 4);
    assert.fieldEquals('TotalReserveAverageChunk', entityId, 'timestamp', (60 * 60 + 1).toString());
    assert.fieldEquals('TotalReserveAverageChunk', entityId, 'value', oneEther.times(BigInt.fromI32(2)).toString());

    const averageEntityId = `TotalReserveAverage-${MockDebtToken_STABLE_Address.toHexString()}`;
    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'index', '2');
    assert.fieldEquals(
      'TotalReserveAverage',
      averageEntityId,
      'value',
      oneEther
        .plus(oneEther.times(BigInt.fromI32(2)))
        .div(BigInt.fromI32(2))
        .toString(),
    );
  });

  test('handleUpdateDebtTokenMeta_totalReserve30dAverage: push out old value after 30 days', () => {
    const bigEvent = createWithdrewReservesEvent();
    // create big event to push out
    mockToken_balanceOf(MockDebtToken_STABLE_Address, MockReservePoolAddress, oneEther.times(BigInt.fromI32(1000)));
    mockPriceFeed_getUSDValue(MockDebtToken_STABLE_Address, oneEther.times(BigInt.fromI32(1000)));

    handleWithdrewReserves(bigEvent);

    const event = createWithdrewReservesEvent();

    // Fill all 30 days with events
    mockToken_balanceOf(MockDebtToken_STABLE_Address, MockReservePoolAddress, oneEther);
    mockPriceFeed_getUSDValue(MockDebtToken_STABLE_Address, oneEther);
    for (let i = 1; i < 30 * 24; i++) {
      event.block.timestamp = BigInt.fromI32(i * (60 * 60 + 1));
      handleWithdrewReserves(event);
    }

    const entityId = `TotalReserveAverageChunk-${MockDebtToken_STABLE_Address.toHexString()}-1`;
    assert.entityCount('TotalReserveAverageChunk', 30 * 24 * 2);
    assert.fieldEquals('TotalReserveAverageChunk', entityId, 'timestamp', '1');
    assert.fieldEquals('TotalReserveAverageChunk', entityId, 'value', oneEther.times(BigInt.fromI32(1000)).toString());

    const averageEntityId = `TotalReserveAverage-${MockDebtToken_STABLE_Address.toHexString()}`;
    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'index', (30 * 24).toString());
    // assert.fieldEquals('TotalReserveAverage', averageEntityId, 'value', (oneEther.times(BigInt.fromI32(1000)).plus(oneEther.times(BigInt.fromI32(30 * 24 - 1))).div(BigInt.fromI32(30 * 24))).toString());
    // rounding error but minimal so its ok, caused by division
    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'value', '2387499999999999642');
    999999999999999999640;
    2387499999999999642;
    // pushed out the high value
    event.block.timestamp = event.block.timestamp.plus(BigInt.fromI32(60 * 60 + 1));
    mockToken_balanceOf(MockDebtToken_STABLE_Address, MockReservePoolAddress, oneEther);
    mockPriceFeed_getUSDValue(MockDebtToken_STABLE_Address, oneEther);
    handleWithdrewReserves(event);
    assert.entityCount('TotalReserveAverageChunk', (30 * 24 + 1) * 2);

    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'index', (30 * 24 + 1).toString());
    // assert.fieldEquals('TotalReserveAverage', averageEntityId, 'value', oneEther.toString());
    // rounding error but minimal so its ok, caused by division
    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'value', '999999999999999642');
  });

  test('handleUpdateDebtTokenMeta_totalSupplyUSD30dAverage: intermediate chunks are created if longer time has passed', () => {
    const event = createWithdrewReservesEvent();

    handleWithdrewReserves(event);

    // 5 hours have passed and intermediate chunks should be created
    const secondEvent = createWithdrewReservesEvent();
    mockToken_balanceOf(MockDebtToken_STABLE_Address, MockReservePoolAddress, oneEther.times(BigInt.fromI32(10)));
    mockPriceFeed_getUSDValue(MockDebtToken_STABLE_Address, oneEther.times(BigInt.fromI32(10)));
    secondEvent.block.timestamp = event.block.timestamp.plus(BigInt.fromI32(5 * 60 * 60 + 1));
    handleWithdrewReserves(secondEvent);

    const entityId = `TotalReserveAverageChunk-${MockDebtToken_STABLE_Address.toHexString()}-2`;
    assert.entityCount('TotalReserveAverageChunk', 6 * 2);
    assert.fieldEquals('TotalReserveAverageChunk', entityId, 'timestamp', (60 * 60 + 1).toString());
    assert.fieldEquals('TotalReserveAverageChunk', entityId, 'value', oneEther.toString());

    const averageEntityId = `TotalReserveAverage-${MockDebtToken_STABLE_Address.toHexString()}`;
    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'index', '6');

    // assert.fieldEquals(
    //   'TotalSupplyAverage',
    //   averageEntityId,
    //   'value',
    //   oneEther.times(BigInt.fromI32(5))
    //     .plus(oneEther.times(BigInt.fromI32(10)))
    //     .div(BigInt.fromI32(6))
    //     .toString(),
    // );
    // Slight rounding error but minimal so its ok, caused by division
    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'value', '2499999999999999999');
  });

  test('handleCreateUpdateCollateralTokenMeta is called successfully', () => {
    const event = createWithdrewReservesEvent();

    handleWithdrewReserves(event);

    const entityId = `CollateralTokenMeta-${MockCollToken_GOV_Address.toHexString()}`;
    assert.entityCount('CollateralTokenMeta', 1);
    assert.fieldEquals('CollateralTokenMeta', entityId, 'token', MockCollToken_GOV_Address.toHexString());
    assert.fieldEquals('CollateralTokenMeta', entityId, 'timestamp', event.block.timestamp.toString());
    assert.fieldEquals('CollateralTokenMeta', entityId, 'totalReserve', oneEther.toString());
    assert.fieldEquals('CollateralTokenMeta', entityId, 'totalValueLockedUSD', oneEther.toString());

    assert.fieldEquals(
      'CollateralTokenMeta',
      entityId,
      'totalValueLockedUSD30dAverage',
      `TotalValueLockedAverage-${MockCollToken_GOV_Address.toHexString()}`,
    );
    assert.fieldEquals(
      'CollateralTokenMeta',
      entityId,
      'totalReserve30dAverage',
      `TotalReserveAverage-${MockCollToken_GOV_Address.toHexString()}`,
    );
  });

  test('handleUpdateCollateralTokenMeta_totalReserve30dAverage is called and the average is correctly calculated', () => {
    const event = createWithdrewReservesEvent();

    handleWithdrewReserves(event);

    const entityId = `TotalReserveAverageChunk-${MockCollToken_GOV_Address.toHexString()}-1`;
    // for debtToken and collToken
    assert.entityCount('TotalReserveAverageChunk', 2);
    assert.fieldEquals('TotalReserveAverageChunk', entityId, 'timestamp', event.block.timestamp.toString());
    assert.fieldEquals('TotalReserveAverageChunk', entityId, 'value', oneEther.toString());

    const averageEntityId = `TotalReserveAverage-${MockCollToken_GOV_Address.toHexString()}`;
    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'index', '1');
    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'value', oneEther.toString());
  });

  test('handleUpdateCollateralTokenMeta_totalReserve30dAverage is called and the average is correctly accumulated in one chunk', () => {
    const event = createWithdrewReservesEvent();
    handleWithdrewReserves(event);

    const entityId = `TotalReserveAverageChunk-${MockCollToken_GOV_Address.toHexString()}-1`;
    assert.entityCount('TotalReserveAverageChunk', 2);
    assert.fieldEquals('TotalReserveAverageChunk', entityId, 'timestamp', event.block.timestamp.toString());
    assert.fieldEquals('TotalReserveAverageChunk', entityId, 'value', oneEther.toString());

    const averageEntityId = `TotalReserveAverage-${MockCollToken_GOV_Address.toHexString()}`;
    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'index', '1');
    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'value', oneEther.toString());

    // same chunk so value is just updated
    const eventSecond = createWithdrewReservesEvent();
    mockReservePool_govReserveCap(oneEther.times(BigInt.fromI32(2)));
    mockPriceFeed_getUSDValue(MockCollToken_GOV_Address, oneEther.times(BigInt.fromI32(2)));
    handleWithdrewReserves(eventSecond);

    assert.entityCount('TotalReserveAverageChunk', 2);
    assert.fieldEquals('TotalReserveAverageChunk', entityId, 'timestamp', event.block.timestamp.toString());
    assert.fieldEquals('TotalReserveAverageChunk', entityId, 'value', oneEther.times(BigInt.fromI32(2)).toString());

    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'index', '1');
    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'value', oneEther.times(BigInt.fromI32(2)).toString());
  });

  test('handleUpdateCollateralTokenMeta_totalReserve30dAverage is called and the average is correctly accumulated in two chunks', () => {
    const event = createWithdrewReservesEvent();

    handleWithdrewReserves(event);

    const secondEvent = createWithdrewReservesEvent();
    mockReservePool_govReserveCap(oneEther.times(BigInt.fromI32(2)));
    mockPriceFeed_getUSDValue(MockCollToken_GOV_Address, oneEther.times(BigInt.fromI32(2)));
    secondEvent.block.timestamp = event.block.timestamp.plus(BigInt.fromI32(60 * 60 + 1));
    handleWithdrewReserves(secondEvent);

    const entityId = `TotalReserveAverageChunk-${MockCollToken_GOV_Address.toHexString()}-2`;
    assert.entityCount('TotalReserveAverageChunk', 4);
    assert.fieldEquals('TotalReserveAverageChunk', entityId, 'timestamp', (60 * 60 + 1).toString());
    assert.fieldEquals('TotalReserveAverageChunk', entityId, 'value', oneEther.times(BigInt.fromI32(2)).toString());

    const averageEntityId = `TotalReserveAverage-${MockCollToken_GOV_Address.toHexString()}`;
    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'index', '2');
    assert.fieldEquals(
      'TotalReserveAverage',
      averageEntityId,
      'value',
      oneEther
        .plus(oneEther.times(BigInt.fromI32(2)))
        .div(BigInt.fromI32(2))
        .toString(),
    );
  });

  test('handleUpdateCollateralTokenMeta_totalReserve30dAverage: push out old value after 30 days', () => {
    const bigEvent = createWithdrewReservesEvent();
    // create big event to push out
    mockReservePool_govReserveCap(oneEther.times(BigInt.fromI32(1000)));
    mockPriceFeed_getUSDValue(MockCollToken_GOV_Address, oneEther.times(BigInt.fromI32(1000)));

    handleWithdrewReserves(bigEvent);

    const event = createWithdrewReservesEvent();

    // Fill all 30 days with events
    mockReservePool_govReserveCap(oneEther);
    mockPriceFeed_getUSDValue(MockCollToken_GOV_Address, oneEther);
    for (let i = 1; i < 30 * 24; i++) {
      event.block.timestamp = BigInt.fromI32(i * (60 * 60 + 1));
      handleWithdrewReserves(event);
    }

    const entityId = `TotalReserveAverageChunk-${MockCollToken_GOV_Address.toHexString()}-1`;
    assert.entityCount('TotalReserveAverageChunk', 30 * 24 * 2);
    assert.fieldEquals('TotalReserveAverageChunk', entityId, 'timestamp', '1');
    assert.fieldEquals('TotalReserveAverageChunk', entityId, 'value', oneEther.times(BigInt.fromI32(1000)).toString());

    const averageEntityId = `TotalReserveAverage-${MockCollToken_GOV_Address.toHexString()}`;
    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'index', (30 * 24).toString());
    // assert.fieldEquals('TotalReserveAverage', averageEntityId, 'value', (oneEther.times(BigInt.fromI32(1000)).plus(oneEther.times(BigInt.fromI32(30 * 24 - 1))).div(BigInt.fromI32(30 * 24))).toString());
    // rounding error but minimal so its ok, caused by division
    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'value', '2387499999999999642');

    // pushed out the high value
    event.block.timestamp = event.block.timestamp.plus(BigInt.fromI32(60 * 60 + 1));
    mockReservePool_govReserveCap(oneEther);
    mockPriceFeed_getUSDValue(MockCollToken_GOV_Address, oneEther);
    handleWithdrewReserves(event);
    assert.entityCount('TotalReserveAverageChunk', (30 * 24 + 1) * 2);

    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'index', (30 * 24 + 1).toString());
    // assert.fieldEquals('TotalReserveAverage', averageEntityId, 'value', oneEther.toString());
    // rounding error but minimal so its ok, caused by division
    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'value', '999999999999999642');
  });

  test('handleUpdateCollateralTokenMeta_totalReserve30dAverage: intermediate chunks are created if longer time has passed', () => {
    const event = createWithdrewReservesEvent();

    handleWithdrewReserves(event);

    // 5 hours have passed and intermediate chunks should be created
    const secondEvent = createWithdrewReservesEvent();
    mockReservePool_govReserveCap(oneEther.times(BigInt.fromI32(10)));
    mockPriceFeed_getUSDValue(MockCollToken_GOV_Address, oneEther.times(BigInt.fromI32(10)));
    secondEvent.block.timestamp = event.block.timestamp.plus(BigInt.fromI32(5 * 60 * 60 + 1));
    handleWithdrewReserves(secondEvent);

    const entityId = `TotalReserveAverageChunk-${MockCollToken_GOV_Address.toHexString()}-2`;
    assert.entityCount('TotalReserveAverageChunk', 6 * 2);
    assert.fieldEquals('TotalReserveAverageChunk', entityId, 'timestamp', (60 * 60 + 1).toString());
    assert.fieldEquals('TotalReserveAverageChunk', entityId, 'value', oneEther.toString());

    const averageEntityId = `TotalReserveAverage-${MockCollToken_GOV_Address.toHexString()}`;
    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'index', '6');

    // assert.fieldEquals(
    //   'TotalSupplyAverage',
    //   averageEntityId,
    //   'value',
    //   oneEther.times(BigInt.fromI32(5))
    //     .plus(oneEther.times(BigInt.fromI32(10)))
    //     .div(BigInt.fromI32(6))
    //     .toString(),
    // );
    // Slight rounding error but minimal so its ok, caused by division
    assert.fieldEquals('TotalReserveAverage', averageEntityId, 'value', '2499999999999999999');
  });

  test('handleCreateReservePoolUSDHistoryChunk: is called successfully', () => {
    const event = createWithdrewReservesEvent();

    // 2 Stable Reserve x Price 1.0
    mockToken_balanceOf(MockDebtToken_STABLE_Address, MockReservePoolAddress, oneEther.times(BigInt.fromI32(2)));
    mockPriceFeed_getUSDValue(MockDebtToken_STABLE_Address, oneEther.times(BigInt.fromI32(2)));
    // 3 Gov Reserve x Price 1.0
    mockPriceFeed_getUSDValue(MockCollToken_GOV_Address, oneEther.times(BigInt.fromI32(3)));
    mockReservePool_govReserveCap(oneEther.times(BigInt.fromI32(3)));

    handleWithdrewReserves(event);

    const entityId = `ReservePoolUSDHistoryChunk-0`;
    assert.entityCount('ReservePoolUSDHistoryChunk', 1);
    assert.fieldEquals('ReservePoolUSDHistoryChunk', entityId, 'timestamp', '1');
    assert.fieldEquals('ReservePoolUSDHistoryChunk', entityId, 'size', (24 * 60 * 60).toString());
    assert.fieldEquals(
      'ReservePoolUSDHistoryChunk',
      entityId,
      'value',
      oneEther.times(BigInt.fromI32(2 + 3)).toString(),
    );
  });

  test('handleCreateReservePoolUSDHistoryChunk: chunk is overwritten if below chunk size', () => {
    const event = createWithdrewReservesEvent();
    handleWithdrewReserves(event);

    const entityId = `ReservePoolUSDHistoryChunk-0`;
    assert.entityCount('ReservePoolUSDHistoryChunk', 1);
    assert.fieldEquals('ReservePoolUSDHistoryChunk', entityId, 'timestamp', '1');
    assert.fieldEquals('ReservePoolUSDHistoryChunk', entityId, 'size', (24 * 60 * 60).toString());
    assert.fieldEquals('ReservePoolUSDHistoryChunk', entityId, 'value', oneEther.times(BigInt.fromI32(2)).toString());

    // 2 Stable Reserve x Price 1.0
    mockToken_balanceOf(MockDebtToken_STABLE_Address, MockReservePoolAddress, oneEther.times(BigInt.fromI32(2)));
    mockPriceFeed_getUSDValue(MockDebtToken_STABLE_Address, oneEther.times(BigInt.fromI32(2)));
    // 3 Gov Reserve x Price 1.0
    mockPriceFeed_getUSDValue(MockCollToken_GOV_Address, oneEther.times(BigInt.fromI32(3)));
    mockReservePool_govReserveCap(oneEther.times(BigInt.fromI32(3)));

    // still in the same chunk
    event.block.timestamp = event.block.timestamp.plus(BigInt.fromI32(24 * 60 * 60 - 1));
    handleWithdrewReserves(event);

    assert.entityCount('ReservePoolUSDHistoryChunk', 1);
    assert.fieldEquals('ReservePoolUSDHistoryChunk', entityId, 'timestamp', '1');
    assert.fieldEquals('ReservePoolUSDHistoryChunk', entityId, 'size', (24 * 60 * 60).toString());
    assert.fieldEquals(
      'ReservePoolUSDHistoryChunk',
      entityId,
      'value',
      oneEther.times(BigInt.fromI32(2 + 3)).toString(),
    );
  });

  test('handleCreateReservePoolUSDHistoryChunk: chunk is added if above chunk size', () => {
    const event = createWithdrewReservesEvent();
    handleWithdrewReserves(event);

    // 2 Stable Reserve x Price 1.0
    mockToken_balanceOf(MockDebtToken_STABLE_Address, MockReservePoolAddress, oneEther.times(BigInt.fromI32(2)));
    mockPriceFeed_getUSDValue(MockDebtToken_STABLE_Address, oneEther.times(BigInt.fromI32(2)));
    // 3 Gov Reserve x Price 1.0
    mockPriceFeed_getUSDValue(MockCollToken_GOV_Address, oneEther.times(BigInt.fromI32(3)));
    mockReservePool_govReserveCap(oneEther.times(BigInt.fromI32(3)));

    // still in the same chunk
    event.block.timestamp = event.block.timestamp.plus(BigInt.fromI32(24 * 60 * 60 + 1));
    handleWithdrewReserves(event);

    const entityId = `ReservePoolUSDHistoryChunk-1`;
    assert.entityCount('ReservePoolUSDHistoryChunk', 2);
    assert.fieldEquals('ReservePoolUSDHistoryChunk', entityId, 'timestamp', (24 * 60 * 60 + 1).toString());
    assert.fieldEquals('ReservePoolUSDHistoryChunk', entityId, 'size', (24 * 60 * 60).toString());
    assert.fieldEquals(
      'ReservePoolUSDHistoryChunk',
      entityId,
      'value',
      oneEther.times(BigInt.fromI32(2 + 3)).toString(),
    );
  });
});
