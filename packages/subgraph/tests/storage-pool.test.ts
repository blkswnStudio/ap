import { BigInt } from '@graphprotocol/graph-ts';
import { assert, beforeEach, test } from 'matchstick-as';
import { afterEach, clearStore, describe } from 'matchstick-as/assembly/index';
import { oneEther } from '../src/entities/token-candle-entity';
import { handleStoragePoolInitialized, handleStoragePoolValueUpdated } from '../src/storage-pool';
import {
  createStoragePoolInitializedEvent,
  createStoragePoolValueUpdatedEvent,
  mockStoragePool_checkRecoveryMode,
} from './storage-pool-utils';
import { MockDebtTokenAddress, MockDebtToken_STABLE_Address, initSystemInfo, initToken } from './utils';

describe('handleStoragePoolValueUpdated()', () => {
  beforeEach(() => {
    initSystemInfo();
    initToken(MockDebtToken_STABLE_Address);
    mockStoragePool_checkRecoveryMode();
  });

  afterEach(() => {
    clearStore();
  });

  test('handleUpdateSystemInfo_storagePool: set storagePool on systemInfo', () => {
    const event = createStoragePoolInitializedEvent(
      MockDebtTokenAddress,
      MockDebtTokenAddress,
      MockDebtTokenAddress,
      MockDebtTokenAddress,
      MockDebtTokenAddress,
    );

    handleStoragePoolInitialized(event);

    const entityId = `SystemInfo`;
    assert.entityCount('SystemInfo', 1);
    assert.fieldEquals('SystemInfo', entityId, 'storagePool', MockDebtTokenAddress.toHexString());
  });
});

describe('handleStoragePoolValueUpdated()', () => {
  beforeEach(() => {
    initSystemInfo();
    initToken(MockDebtToken_STABLE_Address);
    mockStoragePool_checkRecoveryMode();
  });

  afterEach(() => {
    clearStore();
  });

  test('handleCreateTotalValueMintedUSDHistoryChunk: create new chunk and set value to debt value', () => {
    const event = createStoragePoolValueUpdatedEvent(MockDebtToken_STABLE_Address, false, 0, oneEther);

    handleStoragePoolValueUpdated(event);

    const entityId = `TotalValueMintedUSDHistoryChunk-0`;
    assert.entityCount('TotalValueMintedUSDHistoryChunk', 1);
    assert.fieldEquals('TotalValueMintedUSDHistoryChunk', entityId, 'timestamp', event.block.timestamp.toString());
    assert.fieldEquals('TotalValueMintedUSDHistoryChunk', entityId, 'value', oneEther.toString());
    assert.fieldEquals('TotalValueMintedUSDHistoryChunk', entityId, 'size', (24 * 60 * 60).toString());
  });

  test('handleCreateTotalValueMintedUSDHistoryChunk: override value of existing chunk', () => {
    const event = createStoragePoolValueUpdatedEvent(MockDebtToken_STABLE_Address, false, 0, oneEther);
    handleStoragePoolValueUpdated(event);

    mockStoragePool_checkRecoveryMode(false, oneEther, oneEther, oneEther.times(BigInt.fromI32(2)));
    handleStoragePoolValueUpdated(event);

    const entityId = `TotalValueMintedUSDHistoryChunk-0`;
    assert.entityCount('TotalValueMintedUSDHistoryChunk', 1);
    assert.fieldEquals('TotalValueMintedUSDHistoryChunk', entityId, 'timestamp', event.block.timestamp.toString());
    assert.fieldEquals(
      'TotalValueMintedUSDHistoryChunk',
      entityId,
      'value',
      oneEther.times(BigInt.fromI32(2)).toString(),
    );
    assert.fieldEquals('TotalValueMintedUSDHistoryChunk', entityId, 'size', (24 * 60 * 60).toString());
  });

  test('handleCreateTotalValueMintedUSDHistoryChunk: create new chunk if older than 1d', () => {
    const event = createStoragePoolValueUpdatedEvent(MockDebtToken_STABLE_Address, false, 0, oneEther);
    handleStoragePoolValueUpdated(event);

    event.block.timestamp = event.block.timestamp.plus(BigInt.fromI32(24 * 60 * 60)).plus(BigInt.fromI32(100));

    mockStoragePool_checkRecoveryMode(false, oneEther, oneEther, oneEther.times(BigInt.fromI32(2)));
    handleStoragePoolValueUpdated(event);

    const entityId = `TotalValueMintedUSDHistoryChunk-1`;
    assert.entityCount('TotalValueMintedUSDHistoryChunk', 2);
    assert.fieldEquals('TotalValueMintedUSDHistoryChunk', entityId, 'timestamp', (1 + 24 * 60 * 60).toString());
    assert.fieldEquals(
      'TotalValueMintedUSDHistoryChunk',
      entityId,
      'value',
      oneEther.times(BigInt.fromI32(2)).toString(),
    );
    assert.fieldEquals('TotalValueMintedUSDHistoryChunk', entityId, 'size', (24 * 60 * 60).toString());
  });

  test('handleCreateTotalValueLockedUSDHistoryChunk: create new chunk and set value to debt value', () => {
    const event = createStoragePoolValueUpdatedEvent(MockDebtToken_STABLE_Address, false, 0, oneEther);

    handleStoragePoolValueUpdated(event);

    const entityId = `TotalValueLockedUSDHistoryChunk-0`;
    assert.entityCount('TotalValueLockedUSDHistoryChunk', 1);
    assert.fieldEquals('TotalValueLockedUSDHistoryChunk', entityId, 'timestamp', event.block.timestamp.toString());
    assert.fieldEquals(
      'TotalValueLockedUSDHistoryChunk',
      entityId,
      'value',
      oneEther.times(BigInt.fromI32(2)).toString(),
    );
    assert.fieldEquals('TotalValueLockedUSDHistoryChunk', entityId, 'size', (24 * 60 * 60).toString());
  });

  test('handleCreateTotalValueLockedUSDHistoryChunk: override value of existing chunk', () => {
    const event = createStoragePoolValueUpdatedEvent(MockDebtToken_STABLE_Address, false, 0, oneEther);
    handleStoragePoolValueUpdated(event);

    mockStoragePool_checkRecoveryMode(false, oneEther, oneEther.times(BigInt.fromI32(3)), oneEther);
    handleStoragePoolValueUpdated(event);

    const entityId = `TotalValueLockedUSDHistoryChunk-0`;
    assert.entityCount('TotalValueLockedUSDHistoryChunk', 1);
    assert.fieldEquals('TotalValueLockedUSDHistoryChunk', entityId, 'timestamp', event.block.timestamp.toString());
    assert.fieldEquals(
      'TotalValueLockedUSDHistoryChunk',
      entityId,
      'value',
      oneEther.times(BigInt.fromI32(3)).toString(),
    );
    assert.fieldEquals('TotalValueLockedUSDHistoryChunk', entityId, 'size', (24 * 60 * 60).toString());
  });

  test('handleCreateTotalValueLockedUSDHistoryChunk: create new chunk if older than 1d', () => {
    const event = createStoragePoolValueUpdatedEvent(MockDebtToken_STABLE_Address, false, 0, oneEther);
    handleStoragePoolValueUpdated(event);

    event.block.timestamp = event.block.timestamp.plus(BigInt.fromI32(24 * 60 * 60)).plus(BigInt.fromI32(100));

    mockStoragePool_checkRecoveryMode(false, oneEther, oneEther.times(BigInt.fromI32(3)), oneEther);
    handleStoragePoolValueUpdated(event);

    const entityId = `TotalValueLockedUSDHistoryChunk-1`;
    assert.entityCount('TotalValueLockedUSDHistoryChunk', 2);
    assert.fieldEquals('TotalValueLockedUSDHistoryChunk', entityId, 'timestamp', (1 + 24 * 60 * 60).toString());
    assert.fieldEquals(
      'TotalValueLockedUSDHistoryChunk',
      entityId,
      'value',
      oneEther.times(BigInt.fromI32(3)).toString(),
    );
    assert.fieldEquals('TotalValueLockedUSDHistoryChunk', entityId, 'size', (24 * 60 * 60).toString());
  });
});
