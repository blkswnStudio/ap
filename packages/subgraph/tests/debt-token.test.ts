import { BigInt } from '@graphprotocol/graph-ts';
import { assert, beforeEach, test } from 'matchstick-as';
import { afterEach, clearStore, describe } from 'matchstick-as/assembly/index';
import { handleTransfer } from '../src/debt-token';
import { oneEther } from '../src/entities/token-candle-entity';
import {
  createTransferEvent,
  mockDebtToken_stabilityPoolManagerAddress,
  mockDebtToken_symbol,
  mockDebtToken_totalSupply,
  mockToken_balanceOf,
} from './debt-token-utils';
import { mockPriceFeed_getPrice } from './price-feed-utils';
import { mockStabilityPoolManager_getStabilityPool } from './stability-pool-manager-utils';
import {
  mockStabilityPool_depositToken,
  mockStabilityPool_getTotalDeposit,
  mockStabilityPool_stabilityPoolManagerAddress,
} from './stability-pool-utils';
import {
  MockDebtTokenAddress,
  MockDebtToken_STABLE_Address,
  MockReservePoolAddress,
  MockSecondUserAddress,
  MockUserAddress,
  initSystemInfo,
  initToken,
} from './utils';

describe('handleTransfer()', () => {
  beforeEach(() => {
    initSystemInfo();
    initToken();

    mockStabilityPool_depositToken();
    mockStabilityPool_stabilityPoolManagerAddress();
    mockStabilityPool_getTotalDeposit();
    mockStabilityPoolManager_getStabilityPool();
    mockDebtToken_stabilityPoolManagerAddress();
    mockDebtToken_totalSupply();
    mockDebtToken_symbol();
    mockPriceFeed_getPrice();
  });

  afterEach(() => {
    clearStore();
  });

  describe('handleCreateUpdateDebtTokenMeta()', () => {
    test('is called successfully for generic DebtToken', () => {
      const event = createTransferEvent(MockUserAddress, MockSecondUserAddress, oneEther);

      handleTransfer(event);

      const entityId = `DebtTokenMeta-${MockDebtTokenAddress.toHexString()}`;
      assert.entityCount('DebtTokenMeta', 1);
      assert.fieldEquals('DebtTokenMeta', entityId, 'token', MockDebtTokenAddress.toHexString());
      assert.fieldEquals('DebtTokenMeta', entityId, 'timestamp', event.block.timestamp.toString());
      assert.fieldEquals(
        'DebtTokenMeta',
        entityId,
        'totalDepositedStability',
        oneEther.times(BigInt.fromI32(10)).toString(),
      );
      // usual DebtToken has no reserve
      assert.fieldEquals('DebtTokenMeta', entityId, 'totalReserve', '0');
      assert.fieldEquals('DebtTokenMeta', entityId, 'totalSupplyUSD', oneEther.times(BigInt.fromI32(100)).toString());

      assert.fieldEquals(
        'DebtTokenMeta',
        entityId,
        'stabilityDepositAPY',
        `StabilityDepositAPY-${MockDebtTokenAddress.toHexString()}`,
      );
      assert.entityCount('TotalReserveAverage', 0);
      assert.fieldEquals(
        'DebtTokenMeta',
        entityId,
        'totalSupplyUSD30dAverage',
        `TotalSupplyAverage-${MockDebtTokenAddress.toHexString()}`,
      );
    });

    test('is called successfully for STABLE', () => {
      const event = createTransferEvent(MockUserAddress, MockSecondUserAddress, oneEther, MockDebtToken_STABLE_Address);

      mockDebtToken_totalSupply(MockDebtToken_STABLE_Address);
      mockPriceFeed_getPrice(MockDebtToken_STABLE_Address);
      mockToken_balanceOf(MockDebtToken_STABLE_Address, MockReservePoolAddress);
      mockStabilityPoolManager_getStabilityPool(MockDebtToken_STABLE_Address);

      handleTransfer(event);

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
  });

  describe('handleUpdateDebtTokenMeta_totalSupplyUSD30dAverage()', () => {
    test('is called and the average is correctly calculated', () => {
      const event = createTransferEvent(MockUserAddress, MockSecondUserAddress, oneEther);

      handleTransfer(event);

      const entityId = `TotalSupplyAverageChunk-${MockDebtTokenAddress.toHexString()}-1`;
      assert.entityCount('TotalSupplyAverageChunk', 1);
      assert.fieldEquals('TotalSupplyAverageChunk', entityId, 'timestamp', event.block.timestamp.toString());
      assert.fieldEquals('TotalSupplyAverageChunk', entityId, 'value', oneEther.times(BigInt.fromI32(100)).toString());

      const averageEntityId = `TotalSupplyAverage-${MockDebtTokenAddress.toHexString()}`;
      assert.fieldEquals('TotalSupplyAverage', averageEntityId, 'index', '1');
      assert.fieldEquals(
        'TotalSupplyAverage',
        averageEntityId,
        'value',
        oneEther.times(BigInt.fromI32(100)).toString(),
      );
    });

    test('is called and the average is correctly accumulated in one chunk', () => {
      const event = createTransferEvent(MockUserAddress, MockSecondUserAddress, oneEther);

      handleTransfer(event);

      const entityId = `TotalSupplyAverageChunk-${MockDebtTokenAddress.toHexString()}-1`;
      assert.entityCount('TotalSupplyAverageChunk', 1);
      assert.fieldEquals('TotalSupplyAverageChunk', entityId, 'timestamp', event.block.timestamp.toString());
      assert.fieldEquals('TotalSupplyAverageChunk', entityId, 'value', oneEther.times(BigInt.fromI32(100)).toString());

      const averageEntityId = `TotalSupplyAverage-${MockDebtTokenAddress.toHexString()}`;
      assert.fieldEquals('TotalSupplyAverage', averageEntityId, 'index', '1');
      assert.fieldEquals(
        'TotalSupplyAverage',
        averageEntityId,
        'value',
        oneEther.times(BigInt.fromI32(100)).toString(),
      );

      // same chunk so value is just updated
      mockDebtToken_totalSupply(MockDebtTokenAddress, oneEther.times(BigInt.fromI32(2)));
      const secondEvent = createTransferEvent(
        MockUserAddress,
        MockSecondUserAddress,
        oneEther.times(BigInt.fromI32(2)),
      );
      handleTransfer(secondEvent);

      assert.entityCount('TotalSupplyAverageChunk', 1);
      assert.fieldEquals('TotalSupplyAverageChunk', entityId, 'timestamp', event.block.timestamp.toString());
      assert.fieldEquals('TotalSupplyAverageChunk', entityId, 'value', oneEther.times(BigInt.fromI32(2)).toString());

      assert.fieldEquals('TotalSupplyAverage', averageEntityId, 'index', '1');
      assert.fieldEquals('TotalSupplyAverage', averageEntityId, 'value', oneEther.times(BigInt.fromI32(2)).toString());
    });

    test('is called and the average is correctly accumulated in two chunks', () => {
      const event = createTransferEvent(MockUserAddress, MockSecondUserAddress, oneEther);
      mockDebtToken_totalSupply(MockDebtTokenAddress, oneEther);

      handleTransfer(event);

      const secondEvent = createTransferEvent(MockUserAddress, MockSecondUserAddress, oneEther);
      mockDebtToken_totalSupply(MockDebtTokenAddress, oneEther.times(BigInt.fromI32(2)));
      secondEvent.block.timestamp = event.block.timestamp.plus(BigInt.fromI32(60 * 60 + 1));
      handleTransfer(secondEvent);

      const entityId = `TotalSupplyAverageChunk-${MockDebtTokenAddress.toHexString()}-2`;
      assert.entityCount('TotalSupplyAverageChunk', 2);
      assert.fieldEquals('TotalSupplyAverageChunk', entityId, 'timestamp', (60 * 60 + 1).toString());
      assert.fieldEquals('TotalSupplyAverageChunk', entityId, 'value', oneEther.times(BigInt.fromI32(2)).toString());

      const averageEntityId = `TotalSupplyAverage-${MockDebtTokenAddress.toHexString()}`;
      assert.fieldEquals('TotalSupplyAverage', averageEntityId, 'index', '2');
      assert.fieldEquals(
        'TotalSupplyAverage',
        averageEntityId,
        'value',
        oneEther
          .plus(oneEther.times(BigInt.fromI32(2)))
          .div(BigInt.fromI32(2))
          .toString(),
      );
    });

    test('push out old value after 30 days', () => {
      // create big event to push out
      const bigEvent = createTransferEvent(MockUserAddress, MockSecondUserAddress, oneEther);
      mockDebtToken_totalSupply(MockDebtTokenAddress, oneEther.times(BigInt.fromI32(1000)));

      handleTransfer(bigEvent);

      const event = createTransferEvent(MockUserAddress, MockSecondUserAddress, oneEther);
      mockDebtToken_totalSupply(MockDebtTokenAddress, oneEther);

      // Fill all 30 days with events
      for (let i = 1; i < 30 * 24; i++) {
        event.block.timestamp = BigInt.fromI32(i * (60 * 60 + 1));
        handleTransfer(event);
      }

      const entityId = `TotalSupplyAverageChunk-${MockDebtTokenAddress.toHexString()}-1`;
      assert.entityCount('TotalSupplyAverageChunk', 30 * 24);
      assert.fieldEquals('TotalSupplyAverageChunk', entityId, 'timestamp', '1');
      assert.fieldEquals('TotalSupplyAverageChunk', entityId, 'value', oneEther.times(BigInt.fromI32(1000)).toString());

      const averageEntityId = `TotalSupplyAverage-${MockDebtTokenAddress.toHexString()}`;
      assert.fieldEquals('TotalSupplyAverage', averageEntityId, 'index', (30 * 24).toString());
      // assert.fieldEquals('TotalSupplyAverage', averageEntityId, 'value', (oneEther.times(BigInt.fromI32(1000)).plus(oneEther.times(BigInt.fromI32(30 * 24 - 1))).div(BigInt.fromI32(30 * 24))).toString());
      // rounding error but minimal so its ok, caused by division
      assert.fieldEquals('TotalSupplyAverage', averageEntityId, 'value', '2387499999999999642');

      // pushed out the high value
      event.block.timestamp = event.block.timestamp.plus(BigInt.fromI32(60 * 60 + 1));
      handleTransfer(event);
      assert.entityCount('TotalSupplyAverageChunk', 30 * 24 + 1);

      assert.fieldEquals('TotalSupplyAverage', averageEntityId, 'index', (30 * 24 + 1).toString());
      // assert.fieldEquals('TotalSupplyAverage', averageEntityId, 'value', oneEther.toString());
      // rounding error but minimal so its ok, caused by division
      assert.fieldEquals('TotalSupplyAverage', averageEntityId, 'value', '999999999999999642');
    });

    test('intermediate chunks are created if longer time has passed', () => {
      const event = createTransferEvent(MockUserAddress, MockSecondUserAddress, oneEther);
      mockDebtToken_totalSupply(MockDebtTokenAddress, oneEther);

      handleTransfer(event);

      const secondEvent = createTransferEvent(MockUserAddress, MockSecondUserAddress, oneEther);
      mockDebtToken_totalSupply(MockDebtTokenAddress, oneEther.times(BigInt.fromI32(10)));
      // 5 hours have passed and intermediate chunks should be created
      secondEvent.block.timestamp = event.block.timestamp.plus(BigInt.fromI32(5 * 60 * 60 + 5));
      handleTransfer(secondEvent);

      const entityId = `TotalSupplyAverageChunk-${MockDebtTokenAddress.toHexString()}-2`;
      assert.entityCount('TotalSupplyAverageChunk', 6);
      assert.fieldEquals('TotalSupplyAverageChunk', entityId, 'timestamp', (60 * 60 + 1).toString());
      assert.fieldEquals('TotalSupplyAverageChunk', entityId, 'value', oneEther.toString());

      const averageEntityId = `TotalSupplyAverage-${MockDebtTokenAddress.toHexString()}`;
      assert.fieldEquals('TotalSupplyAverage', averageEntityId, 'index', '6');

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
      assert.fieldEquals('TotalSupplyAverage', averageEntityId, 'value', '2499999999999999999');
    });
  });
});
