import { BigInt, ethereum } from '@graphprotocol/graph-ts';
import { assert, beforeEach, test } from 'matchstick-as';
import { afterEach, clearStore, describe } from 'matchstick-as/assembly/index';
import { handleTroveCreated } from '../src/borrower-operations';
import { oneEther } from '../src/entities/token-candle-entity';
import { createTroveCreatedEvent } from './borrower-operations-utils';
import { mockPriceFeed_getPrice } from './price-feed-utils';
import { mockReservePool_govReserveCap } from './reserve-pool-utils';
import { mockStoragePool_getTokenTotalAmount } from './storage-pool-utils';
import {
  MockCollToken_GOV_Address,
  MockCollToken_OTHER_Address,
  MockUserAddress,
  initSystemInfo,
  initToken,
} from './utils';

describe('handleTroveCreated()', () => {
  beforeEach(() => {
    initToken(MockCollToken_GOV_Address);
    initSystemInfo();

    mockReservePool_govReserveCap();
    mockStoragePool_getTokenTotalAmount(MockCollToken_GOV_Address);
    mockStoragePool_getTokenTotalAmount(MockCollToken_OTHER_Address);
    mockPriceFeed_getPrice(MockCollToken_GOV_Address);
    mockPriceFeed_getPrice(MockCollToken_OTHER_Address);
  });

  afterEach(() => {
    clearStore();
  });

  test('handleCreateUpdateCollateralTokenMeta is called successfully', () => {
    let tupleValue = new ethereum.Tuple();
    tupleValue.push(ethereum.Value.fromAddress(MockCollToken_GOV_Address));
    tupleValue.push(ethereum.Value.fromSignedBigInt(oneEther.times(BigInt.fromI32(10))));

    const event = createTroveCreatedEvent(MockUserAddress, [tupleValue]);

    handleTroveCreated(event);

    const entityId = `CollateralTokenMeta-${MockCollToken_GOV_Address.toHexString()}`;
    assert.entityCount('CollateralTokenMeta', 1);
    assert.fieldEquals('CollateralTokenMeta', entityId, 'token', MockCollToken_GOV_Address.toHexString());
    assert.fieldEquals('CollateralTokenMeta', entityId, 'timestamp', event.block.timestamp.toString());
    assert.fieldEquals('CollateralTokenMeta', entityId, 'totalValueLockedUSD', oneEther.toString());
    assert.fieldEquals(
      'CollateralTokenMeta',
      entityId,
      'totalValueLockedUSD30dAverage',
      `TotalValueLockedAverage-${MockCollToken_GOV_Address.toHexString()}`,
    );
    assert.fieldEquals('CollateralTokenMeta', entityId, 'totalReserve', oneEther.toString());
    assert.fieldEquals(
      'CollateralTokenMeta',
      entityId,
      'totalReserve30dAverage',
      `TotalReserveAverage-${MockCollToken_GOV_Address.toHexString()}`,
    );
  });

  test('handleCreateUpdateCollateralTokenMeta is called successfully for 2 Tokens', () => {
    let tupleValue = new ethereum.Tuple();
    tupleValue.push(ethereum.Value.fromAddress(MockCollToken_GOV_Address));
    tupleValue.push(ethereum.Value.fromSignedBigInt(oneEther.times(BigInt.fromI32(10))));
    let tupleValue2 = new ethereum.Tuple();

    initToken(MockCollToken_OTHER_Address);
    tupleValue2.push(ethereum.Value.fromAddress(MockCollToken_OTHER_Address));
    tupleValue2.push(ethereum.Value.fromSignedBigInt(oneEther.times(BigInt.fromI32(10))));

    const event = createTroveCreatedEvent(MockUserAddress, [tupleValue, tupleValue2]);

    handleTroveCreated(event);

    assert.entityCount('CollateralTokenMeta', 2);
  });

  test('handleUpdateCollateralTokenMeta_totalValueLockedUSD30dAverage is just initialized', () => {
    let tupleValue = new ethereum.Tuple();
    tupleValue.push(ethereum.Value.fromAddress(MockCollToken_GOV_Address));
    tupleValue.push(ethereum.Value.fromSignedBigInt(oneEther.times(BigInt.fromI32(10))));

    const event = createTroveCreatedEvent(MockUserAddress, [tupleValue]);

    handleTroveCreated(event);

    const entityId = `TotalValueLockedChunk-${MockCollToken_GOV_Address.toHexString()}-1`;
    assert.entityCount('TotalValueLockedChunk', 1);
    assert.fieldEquals('TotalValueLockedChunk', entityId, 'timestamp', event.block.timestamp.toString());
    assert.fieldEquals('TotalValueLockedChunk', entityId, 'value', '0');

    const averageEntityId = `TotalValueLockedAverage-${MockCollToken_GOV_Address.toHexString()}`;
    assert.fieldEquals('TotalValueLockedAverage', averageEntityId, 'index', '1');
    assert.fieldEquals('TotalValueLockedAverage', averageEntityId, 'value', '0');
  });
});
