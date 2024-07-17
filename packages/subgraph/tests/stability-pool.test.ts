import { BigInt, ethereum } from '@graphprotocol/graph-ts';
import { assert, beforeEach, test } from 'matchstick-as';
import { afterEach, clearStore, describe } from 'matchstick-as/assembly/index';
import { oneEther } from '../src/entities/token-candle-entity';
import {
  handleStabilityGainsWithdrawn,
  handleStabilityOffset,
  handleStabilityProvided,
  handleStabilityWithdrawn,
} from '../src/stability-pool';
import { handleStabilityPoolAdded } from '../src/stability-pool-manager';
import {
  mockDebtToken_stabilityPoolManagerAddress,
  mockDebtToken_symbol,
  mockDebtToken_totalSupply,
} from './debt-token-utils';
import { mockPriceFeed_getPrice } from './price-feed-utils';
import {
  createStabilityPoolAddedEvent,
  mockStabilityPoolManager_getStabilityPool,
} from './stability-pool-manager-utils';
import {
  createStabilityGainsWithdrawnEvent,
  createStabilityOffsetEvent,
  createStabilityProvidedEvent,
  createStabilityWithdrawnEvent,
  mockStabilityPool_depositToken,
  mockStabilityPool_getTotalDeposit,
  mockStabilityPool_stabilityPoolManagerAddress,
} from './stability-pool-utils';
import {
  MockCollToken_GOV_Address,
  MockDebtTokenAddress,
  MockStabilityPoolAddress,
  MockUserAddress,
  initSystemInfo,
  initToken,
} from './utils';

describe('handleStabilityProvided()', () => {
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

  test('handleCreateUpdateDebtTokenMeta is called successfully', () => {
    const event = createStabilityProvidedEvent(MockUserAddress, BigInt.fromI32(10));

    // create Stability pool first
    const addStabilityPoolEvent = createStabilityPoolAddedEvent(event.address);
    handleStabilityPoolAdded(addStabilityPoolEvent);

    handleStabilityProvided(event);

    const entityId = `DebtTokenMeta-${MockDebtTokenAddress.toHexString()}`;
    assert.entityCount('DebtTokenMeta', 1);
    assert.fieldEquals('DebtTokenMeta', entityId, 'token', MockDebtTokenAddress.toHexString());
    assert.fieldEquals('DebtTokenMeta', entityId, 'totalDepositedStability', '10000000000000000000');
    assert.fieldEquals('DebtTokenMeta', entityId, 'totalReserve', '0');
    assert.fieldEquals('DebtTokenMeta', entityId, 'totalSupplyUSD', '100000000000000000000');
  });

  test('borrower history event entity is created', () => {
    const event = createStabilityProvidedEvent(MockUserAddress, oneEther.times(BigInt.fromI32(10)));
    const addStabilityPoolEvent = createStabilityPoolAddedEvent(event.address);
    handleStabilityPoolAdded(addStabilityPoolEvent);

    handleStabilityProvided(event);

    assert.entityCount('BorrowerHistory', 1);
    assert.fieldEquals(
      'BorrowerHistory',
      event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString(),
      'pool',
      event.address.toHexString(),
    );
    assert.fieldEquals(
      'BorrowerHistory',
      event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString(),
      'borrower',
      MockUserAddress.toHexString(),
    );
    assert.fieldEquals(
      'BorrowerHistory',
      event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString(),
      'type',
      'DEPOSITED',
    );
    const linkedTokenAmount = event.transaction.hash
      .concatI32(event.logIndex.toI32())
      .concat(MockDebtTokenAddress)
      .toHexString();
    assert.fieldEquals(
      'BorrowerHistory',
      event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString(),
      'values',
      `[${linkedTokenAmount}]`,
    );

    assert.entityCount('TokenAmount', 1);
    assert.fieldEquals('TokenAmount', linkedTokenAmount, 'token', MockDebtTokenAddress.toHexString());
    assert.fieldEquals('TokenAmount', linkedTokenAmount, 'amount', oneEther.times(BigInt.fromI32(10)).toString());
  });
});

describe('handleStabilityWithdrawn()', () => {
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

  test('handleCreateUpdateDebtTokenMeta is called successfully', () => {
    const event = createStabilityWithdrawnEvent(MockUserAddress, BigInt.fromI32(10));

    // create Stability pool first
    const addStabilityPoolEvent = createStabilityPoolAddedEvent(event.address);
    handleStabilityPoolAdded(addStabilityPoolEvent);

    handleStabilityWithdrawn(event);

    const entityId = `DebtTokenMeta-${MockDebtTokenAddress.toHexString()}`;
    assert.entityCount('DebtTokenMeta', 1);
    assert.fieldEquals('DebtTokenMeta', entityId, 'token', MockDebtTokenAddress.toHexString());
    assert.fieldEquals('DebtTokenMeta', entityId, 'totalDepositedStability', '10000000000000000000');
    assert.fieldEquals('DebtTokenMeta', entityId, 'totalReserve', '0');
    assert.fieldEquals('DebtTokenMeta', entityId, 'totalSupplyUSD', '100000000000000000000');
  });

  test('borrower history event entity is created', () => {
    const event = createStabilityWithdrawnEvent(MockUserAddress, oneEther.times(BigInt.fromI32(10)));
    const addStabilityPoolEvent = createStabilityPoolAddedEvent(event.address);
    handleStabilityPoolAdded(addStabilityPoolEvent);

    handleStabilityWithdrawn(event);

    assert.entityCount('BorrowerHistory', 1);
    assert.fieldEquals(
      'BorrowerHistory',
      event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString(),
      'pool',
      event.address.toHexString(),
    );
    assert.fieldEquals(
      'BorrowerHistory',
      event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString(),
      'borrower',
      MockUserAddress.toHexString(),
    );
    assert.fieldEquals(
      'BorrowerHistory',
      event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString(),
      'type',
      'WITHDRAWN',
    );
    const linkedTokenAmount = event.transaction.hash
      .concatI32(event.logIndex.toI32())
      .concat(MockDebtTokenAddress)
      .toHexString();
    assert.fieldEquals(
      'BorrowerHistory',
      event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString(),
      'values',
      `[${linkedTokenAmount}]`,
    );

    assert.entityCount('TokenAmount', 1);
    assert.fieldEquals('TokenAmount', linkedTokenAmount, 'token', MockDebtTokenAddress.toHexString());
    assert.fieldEquals('TokenAmount', linkedTokenAmount, 'amount', oneEther.times(BigInt.fromI32(10)).toString());
  });
});

describe('handleStabilityOffset()', () => {
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

    mockPriceFeed_getPrice(MockCollToken_GOV_Address);
  });

  afterEach(() => {
    clearStore();
  });

  test('handleCreateUpdateDebtTokenMeta is called successfully', () => {
    let tupleValue = new ethereum.Tuple();
    tupleValue.push(ethereum.Value.fromAddress(MockCollToken_GOV_Address));
    tupleValue.push(ethereum.Value.fromSignedBigInt(oneEther.times(BigInt.fromI32(10))));

    const event = createStabilityOffsetEvent(oneEther, [tupleValue]);

    const addStabilityPoolEvent = createStabilityPoolAddedEvent(event.address);
    handleStabilityPoolAdded(addStabilityPoolEvent);

    handleStabilityOffset(event);

    const entityId = `DebtTokenMeta-${MockDebtTokenAddress.toHexString()}`;
    assert.entityCount('DebtTokenMeta', 1);
    assert.fieldEquals('DebtTokenMeta', entityId, 'token', MockDebtTokenAddress.toHexString());
    assert.fieldEquals('DebtTokenMeta', entityId, 'totalDepositedStability', '10000000000000000000');
    assert.fieldEquals('DebtTokenMeta', entityId, 'totalReserve', '0');
    assert.fieldEquals('DebtTokenMeta', entityId, 'totalSupplyUSD', '100000000000000000000');
  });

  test('handleUpdateDebtTokenMeta_stabilityDepositAPY is called successfully', () => {
    let tupleValue = new ethereum.Tuple();
    tupleValue.push(ethereum.Value.fromAddress(MockCollToken_GOV_Address));
    tupleValue.push(ethereum.Value.fromSignedBigInt(oneEther.times(BigInt.fromI32(10))));

    const event = createStabilityOffsetEvent(oneEther, [tupleValue]);

    const addStabilityPoolEvent = createStabilityPoolAddedEvent(event.address);
    handleStabilityPoolAdded(addStabilityPoolEvent);

    handleStabilityOffset(event);

    const entityId = `StabilityDepositChunk-${MockDebtTokenAddress.toHexString()}-1`;
    assert.entityCount('StabilityDepositChunk', 1);
    assert.fieldEquals('StabilityDepositChunk', entityId, 'timestamp', event.block.timestamp.toString());
    assert.fieldEquals('StabilityDepositChunk', entityId, 'profit', '9000000000000000000');
    assert.fieldEquals('StabilityDepositChunk', entityId, 'volume', '1000000000000000000');
  });

  test('handleUpdateDebtTokenMeta_stabilityDepositAPY accumulates chunks correctly and creates average', () => {
    let tupleValue = new ethereum.Tuple();
    tupleValue.push(ethereum.Value.fromAddress(MockCollToken_GOV_Address));
    tupleValue.push(ethereum.Value.fromSignedBigInt(oneEther.times(BigInt.fromI32(10))));

    const event = createStabilityOffsetEvent(oneEther, [tupleValue]);

    const addStabilityPoolEvent = createStabilityPoolAddedEvent(event.address);
    handleStabilityPoolAdded(addStabilityPoolEvent);

    handleStabilityOffset(event);

    // Should add up both values
    const secondEvent = createStabilityOffsetEvent(oneEther, [tupleValue]);
    handleStabilityOffset(secondEvent);

    const entityId = `StabilityDepositChunk-${MockDebtTokenAddress.toHexString()}-1`;
    assert.entityCount('StabilityDepositChunk', 1);
    assert.fieldEquals('StabilityDepositChunk', entityId, 'timestamp', event.block.timestamp.toString());
    assert.fieldEquals('StabilityDepositChunk', entityId, 'profit', '18000000000000000000');
    assert.fieldEquals('StabilityDepositChunk', entityId, 'volume', '2000000000000000000');

    const entityIdAverage = `StabilityDepositAPY-${MockDebtTokenAddress.toHexString()}`;
    assert.entityCount('StabilityDepositAPY', 1);
    assert.fieldEquals('StabilityDepositAPY', entityIdAverage, 'index', '1');
    assert.fieldEquals('StabilityDepositAPY', entityIdAverage, 'profit', '18000000000000000000');
    assert.fieldEquals('StabilityDepositAPY', entityIdAverage, 'volume', '2000000000000000000');
  });

  test('handleUpdateDebtTokenMeta_stabilityDepositAPY creates 2 chunks after more than 60min', () => {
    let tupleValue = new ethereum.Tuple();
    tupleValue.push(ethereum.Value.fromAddress(MockCollToken_GOV_Address));
    tupleValue.push(ethereum.Value.fromSignedBigInt(oneEther.times(BigInt.fromI32(10))));

    const event = createStabilityOffsetEvent(oneEther, [tupleValue]);

    const addStabilityPoolEvent = createStabilityPoolAddedEvent(event.address);
    handleStabilityPoolAdded(addStabilityPoolEvent);

    handleStabilityOffset(event);

    // Should add up both values
    const secondEventLater = createStabilityOffsetEvent(oneEther, [tupleValue]);
    secondEventLater.block.timestamp = event.block.timestamp.plus(BigInt.fromI32(60 * 60 + 1));
    handleStabilityOffset(secondEventLater);

    assert.entityCount('StabilityDepositChunk', 2);

    const firstEntityId = `StabilityDepositChunk-${MockDebtTokenAddress.toHexString()}-1`;
    assert.fieldEquals('StabilityDepositChunk', firstEntityId, 'timestamp', event.block.timestamp.toString());
    assert.fieldEquals('StabilityDepositChunk', firstEntityId, 'profit', '9000000000000000000');
    assert.fieldEquals('StabilityDepositChunk', firstEntityId, 'volume', '1000000000000000000');

    const secondEntityId = `StabilityDepositChunk-${MockDebtTokenAddress.toHexString()}-2`;
    assert.fieldEquals(
      'StabilityDepositChunk',
      secondEntityId,
      'timestamp',
      secondEventLater.block.timestamp.toString(),
    );
    assert.fieldEquals('StabilityDepositChunk', secondEntityId, 'profit', '9000000000000000000');
    assert.fieldEquals('StabilityDepositChunk', secondEntityId, 'volume', '1000000000000000000');

    const entityIdAverage = `StabilityDepositAPY-${MockDebtTokenAddress.toHexString()}`;
    assert.entityCount('StabilityDepositAPY', 1);
    assert.fieldEquals('StabilityDepositAPY', entityIdAverage, 'index', '2');
    assert.fieldEquals('StabilityDepositAPY', entityIdAverage, 'profit', '18000000000000000000');
    assert.fieldEquals('StabilityDepositAPY', entityIdAverage, 'volume', '2000000000000000000');
  });

  test('handleUpdateDebtTokenMeta_stabilityDepositAPY update average correctly after more than one month', () => {
    // Make the first chunk special to exclude it later
    let tupleValueFirstChunk = new ethereum.Tuple();
    tupleValueFirstChunk.push(ethereum.Value.fromAddress(MockCollToken_GOV_Address));
    tupleValueFirstChunk.push(ethereum.Value.fromSignedBigInt(oneEther.times(BigInt.fromI32(100))));
    const firstChunkEvent = createStabilityOffsetEvent(oneEther.plus(oneEther), [tupleValueFirstChunk]);
    handleStabilityOffset(firstChunkEvent);

    let tupleValue = new ethereum.Tuple();
    tupleValue.push(ethereum.Value.fromAddress(MockCollToken_GOV_Address));
    tupleValue.push(ethereum.Value.fromSignedBigInt(oneEther.times(BigInt.fromI32(10))));
    // fill a complete month with data
    for (let i = 1; i <= 30 * 24; i++) {
      const event = createStabilityOffsetEvent(oneEther, [tupleValue]);
      event.block.timestamp = BigInt.fromI32(i * (60 * 60 + 1));
      handleStabilityOffset(event);
    }

    assert.entityCount('StabilityDepositChunk', 30 * 24);

    const entityIdAverage = `StabilityDepositAPY-${MockDebtTokenAddress.toHexString()}`;
    assert.entityCount('StabilityDepositAPY', 1);
    assert.fieldEquals('StabilityDepositAPY', entityIdAverage, 'index', (30 * 24).toString());
    assert.fieldEquals(
      'StabilityDepositAPY',
      entityIdAverage,
      'profit',
      oneEther.times(BigInt.fromI32(30 * 24 * 9 + 98)).toString(),
    );
    assert.fieldEquals(
      'StabilityDepositAPY',
      entityIdAverage,
      'volume',
      oneEther.times(BigInt.fromI32(30 * 24 + 2)).toString(),
    );

    // Now push out the latest chunk and increase the average with the next chunk (use a huge value)
    let hugeTupleValue = new ethereum.Tuple();
    hugeTupleValue.push(ethereum.Value.fromAddress(MockCollToken_GOV_Address));
    hugeTupleValue.push(ethereum.Value.fromSignedBigInt(oneEther.times(BigInt.fromI32(10000))));

    // This will increase volume and profit by quite a bit
    const event = createStabilityOffsetEvent(oneEther.times(BigInt.fromI32(1000)), [hugeTupleValue]);
    event.block.timestamp = event.block.timestamp.plus(BigInt.fromI32((30 * 24 + 1) * (60 * 60 + 1)));
    handleStabilityOffset(event);

    assert.entityCount('StabilityDepositChunk', 30 * 24 + 1);

    assert.fieldEquals('StabilityDepositAPY', entityIdAverage, 'index', (30 * 24 + 1).toString());
    // exclude fist chunk and include last biggy chunk
    assert.fieldEquals(
      'StabilityDepositAPY',
      entityIdAverage,
      'profit',
      oneEther.times(BigInt.fromI32((30 * 24 - 1) * 9 + 9000)).toString(),
    );
    // exclude fist chunk and include last biggy chunk
    assert.fieldEquals(
      'StabilityDepositAPY',
      entityIdAverage,
      'volume',
      oneEther.times(BigInt.fromI32(30 * 24 - 1 + 1000)).toString(),
    );
  });
});

describe('handleStabilityGainsWithdrawn()', () => {
  beforeEach(() => {
    initToken();
    initSystemInfo();

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

  test('handleCreateBorrowerHistory is called successfully', () => {
    let tupleValue = new ethereum.Tuple();
    tupleValue.push(ethereum.Value.fromAddress(MockCollToken_GOV_Address));
    tupleValue.push(ethereum.Value.fromSignedBigInt(oneEther.times(BigInt.fromI32(10))));

    const event = createStabilityGainsWithdrawnEvent(MockUserAddress, oneEther, [tupleValue]);

    // create Stability pool first
    const addStabilityPoolEvent = createStabilityPoolAddedEvent(event.address);
    handleStabilityPoolAdded(addStabilityPoolEvent);

    handleStabilityGainsWithdrawn(event);

    const entityId = event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString();
    assert.entityCount('BorrowerHistory', 1);
    assert.fieldEquals('BorrowerHistory', entityId, 'pool', MockStabilityPoolAddress.toHexString());
    assert.fieldEquals('BorrowerHistory', entityId, 'timestamp', event.block.timestamp.toString());
    assert.fieldEquals('BorrowerHistory', entityId, 'type', 'CLAIMED_REWARDS');
    assert.fieldEquals('BorrowerHistory', entityId, 'claimInUSD', '10000000000000000000');
    assert.fieldEquals('BorrowerHistory', entityId, 'lostDepositInUSD', '1000000000000000000');

    const linkedTokenAmount1 = event.transaction.hash
      .concatI32(event.logIndex.toI32())
      .concat(MockDebtTokenAddress)
      .toHexString();
    const linkedTokenAmount2 = event.transaction.hash
      .concatI32(event.logIndex.toI32())
      .concat(MockCollToken_GOV_Address)
      .toHexString();
    assert.fieldEquals(
      'BorrowerHistory',
      event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString(),
      'values',
      `[${linkedTokenAmount1}, ${linkedTokenAmount2}]`,
    );

    assert.entityCount('TokenAmount', 2);
    assert.fieldEquals('TokenAmount', linkedTokenAmount1, 'token', MockDebtTokenAddress.toHexString());
    assert.fieldEquals('TokenAmount', linkedTokenAmount1, 'amount', oneEther.toString());

    assert.fieldEquals('TokenAmount', linkedTokenAmount2, 'token', MockCollToken_GOV_Address.toHexString());
    assert.fieldEquals('TokenAmount', linkedTokenAmount2, 'amount', oneEther.times(BigInt.fromI32(10)).toString());
  });
});
