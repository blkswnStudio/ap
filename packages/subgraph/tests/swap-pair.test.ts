import { BigInt } from '@graphprotocol/graph-ts';
import { assert, beforeEach, test } from 'matchstick-as';
import { afterEach, clearStore, describe } from 'matchstick-as/assembly/index';
import { handleUpdatePool_volume30dUSD } from '../src/entities/pool-entity';
import { CandleSizes } from '../src/entities/token-candle-entity';
import { handlePairCreated } from '../src/swap-operations';
import { handleBurn, handleMint, handleSwap, handleSync, handleTransfer } from '../src/swap-pair';
import { oneEther } from '../src/utils';
import { mockPriceFeed_getPrice } from './price-feed-utils';
import { createPairCreatedEvent } from './swap-operations-utils';
import {
  createBurnEvent,
  createMintEvent,
  createSwapEvent,
  createSyncEvent,
  createTransferEvent,
  mockSwapPair_getReserves,
  mockSwapPair_token0,
  mockSwapPair_token1,
  mockSwapPair_totalSupply,
} from './swap-pair-utils';
import {
  MockDebtTokenAddress,
  MockDebtToken_STABLE_Address,
  MockReservePoolAddress,
  MockSwapPair_STABLE_MockDebtToken_Address,
  MockUserAddress,
  initSystemInfo,
  initToken,
} from './utils';

describe('handleMint()', () => {
  beforeEach(() => {
    initSystemInfo();
    initToken();

    mockSwapPair_getReserves();
    mockSwapPair_totalSupply();
    mockPriceFeed_getPrice();

    // Initialize SwapPair first
    const event = createPairCreatedEvent(
      MockDebtToken_STABLE_Address,
      MockDebtTokenAddress,
      MockSwapPair_STABLE_MockDebtToken_Address,
    );

    handlePairCreated(event);

    mockSwapPair_token0();
    mockSwapPair_token1();
    mockPriceFeed_getPrice(MockDebtToken_STABLE_Address);
  });

  afterEach(() => {
    clearStore();
  });

  test('handleUpdatePool_totalSupply: Update total supply of the pool', () => {
    const event = createMintEvent(MockReservePoolAddress, oneEther, oneEther);
    mockSwapPair_totalSupply(MockSwapPair_STABLE_MockDebtToken_Address, oneEther.times(BigInt.fromI32(10)));

    handleMint(event);

    const entityId = `Pool-${MockDebtToken_STABLE_Address.toHexString()}-${MockDebtTokenAddress.toHexString()}`;
    assert.entityCount('Pool', 1);
    assert.fieldEquals('Pool', entityId, 'totalSupply', oneEther.times(BigInt.fromI32(10)).toString());
  });
});

describe('handleBurn()', () => {
  beforeEach(() => {
    initSystemInfo();
    initToken();

    mockSwapPair_getReserves();
    mockSwapPair_totalSupply();
    mockPriceFeed_getPrice();

    // Initialize SwapPair first
    const event = createPairCreatedEvent(
      MockDebtToken_STABLE_Address,
      MockDebtTokenAddress,
      MockSwapPair_STABLE_MockDebtToken_Address,
    );

    handlePairCreated(event);

    mockSwapPair_token0();
    mockSwapPair_token1();
    mockPriceFeed_getPrice(MockDebtToken_STABLE_Address);
  });

  afterEach(() => {
    clearStore();
  });

  test('handleUpdatePool_totalSupply: Update total supply of the pool', () => {
    const event = createBurnEvent(MockUserAddress, oneEther, oneEther, MockReservePoolAddress);
    mockSwapPair_totalSupply(MockSwapPair_STABLE_MockDebtToken_Address, oneEther.times(BigInt.fromI32(10)));

    handleBurn(event);

    const entityId = `Pool-${MockDebtToken_STABLE_Address.toHexString()}-${MockDebtTokenAddress.toHexString()}`;
    assert.entityCount('Pool', 1);
    assert.fieldEquals('Pool', entityId, 'totalSupply', oneEther.times(BigInt.fromI32(10)).toString());
  });
});

describe('handleTransfer()', () => {
  beforeEach(() => {
    initSystemInfo();
    initToken();

    mockSwapPair_getReserves();
    mockSwapPair_totalSupply();
    mockPriceFeed_getPrice();

    // Initialize SwapPair first
    const event = createPairCreatedEvent(
      MockDebtToken_STABLE_Address,
      MockDebtTokenAddress,
      MockSwapPair_STABLE_MockDebtToken_Address,
    );

    handlePairCreated(event);

    mockSwapPair_token0();
    mockSwapPair_token1();
    mockPriceFeed_getPrice(MockDebtToken_STABLE_Address);
  });

  afterEach(() => {
    clearStore();
  });

  test('handleUpdatePool_totalSupply: Update total supply of the pool', () => {
    const event = createTransferEvent(MockUserAddress, MockReservePoolAddress, oneEther);
    mockSwapPair_totalSupply(MockSwapPair_STABLE_MockDebtToken_Address, oneEther.times(BigInt.fromI32(10)));

    handleTransfer(event);

    const entityId = `Pool-${MockDebtToken_STABLE_Address.toHexString()}-${MockDebtTokenAddress.toHexString()}`;
    assert.entityCount('Pool', 1);
    assert.fieldEquals('Pool', entityId, 'totalSupply', oneEther.times(BigInt.fromI32(10)).toString());
  });
});

describe('handleSync()', () => {
  beforeEach(() => {
    initSystemInfo();
    initToken();

    mockSwapPair_getReserves();
    mockSwapPair_totalSupply();
    mockPriceFeed_getPrice();

    // Initialize SwapPair first
    const event = createPairCreatedEvent(
      MockDebtToken_STABLE_Address,
      MockDebtTokenAddress,
      MockSwapPair_STABLE_MockDebtToken_Address,
    );

    handlePairCreated(event);

    mockSwapPair_token0();
    mockSwapPair_token1();
    mockPriceFeed_getPrice(MockDebtToken_STABLE_Address);
  });

  afterEach(() => {
    clearStore();
  });

  test('handleUpdateLiquidity_totalAmount: Update total amount of the pool', () => {
    const event = createSyncEvent(oneEther.times(BigInt.fromI32(2)), oneEther.times(BigInt.fromI32(3)));

    handleSync(event);

    assert.entityCount('PoolLiquidity', 2);

    const liquidity_STABLE_EntityId = MockDebtToken_STABLE_Address.concat(MockDebtTokenAddress).toHexString();
    assert.fieldEquals('PoolLiquidity', liquidity_STABLE_EntityId, 'token', MockDebtToken_STABLE_Address.toHexString());
    assert.fieldEquals(
      'PoolLiquidity',
      liquidity_STABLE_EntityId,
      'totalAmount',
      oneEther.times(BigInt.fromI32(2)).toString(),
    );

    const liquidity_DebtToken_EntityId = MockDebtTokenAddress.concat(MockDebtToken_STABLE_Address).toHexString();
    assert.fieldEquals('PoolLiquidity', liquidity_DebtToken_EntityId, 'token', MockDebtTokenAddress.toHexString());
    assert.fieldEquals(
      'PoolLiquidity',
      liquidity_DebtToken_EntityId,
      'totalAmount',
      oneEther.times(BigInt.fromI32(3)).toString(),
    );
  });

  test('handleUpdateTokenCandle_low_high: update low candle price of DebtToken', () => {
    const event = createSyncEvent(oneEther, oneEther);

    mockSwapPair_getReserves(MockSwapPair_STABLE_MockDebtToken_Address, oneEther, oneEther.times(BigInt.fromI32(10)));
    mockPriceFeed_getPrice(MockDebtTokenAddress, oneEther.div(BigInt.fromI32(2)));

    handleSync(event);

    CandleSizes.forEach((size) => {
      const entityId = `TokenCandleSingleton-${MockDebtTokenAddress.toHexString()}-${size.toString()}`;
      assert.fieldEquals('TokenCandleSingleton', entityId, 'high', oneEther.toString());
      assert.fieldEquals('TokenCandleSingleton', entityId, 'low', oneEther.div(BigInt.fromI32(10)).toString());
      assert.fieldEquals('TokenCandleSingleton', entityId, 'open', oneEther.toString());
      assert.fieldEquals('TokenCandleSingleton', entityId, 'close', oneEther.div(BigInt.fromI32(10)).toString());

      assert.fieldEquals('TokenCandleSingleton', entityId, 'highOracle', oneEther.toString());
      assert.fieldEquals('TokenCandleSingleton', entityId, 'lowOracle', oneEther.div(BigInt.fromI32(2)).toString());
      assert.fieldEquals('TokenCandleSingleton', entityId, 'openOracle', oneEther.toString());
      assert.fieldEquals('TokenCandleSingleton', entityId, 'closeOracle', oneEther.div(BigInt.fromI32(2)).toString());
    });
  });

  test('handleUpdateTokenCandle_low_high: update high candle price of DebtToken', () => {
    const event = createSyncEvent(oneEther, oneEther);

    mockSwapPair_getReserves(MockSwapPair_STABLE_MockDebtToken_Address, oneEther.times(BigInt.fromI32(10)), oneEther);
    mockPriceFeed_getPrice(MockDebtTokenAddress, oneEther.times(BigInt.fromI32(2)));

    handleSync(event);

    CandleSizes.forEach((size) => {
      const entityId = `TokenCandleSingleton-${MockDebtTokenAddress.toHexString()}-${size.toString()}`;
      assert.fieldEquals('TokenCandleSingleton', entityId, 'high', oneEther.times(BigInt.fromI32(10)).toString());
      assert.fieldEquals('TokenCandleSingleton', entityId, 'low', oneEther.toString());
      assert.fieldEquals('TokenCandleSingleton', entityId, 'open', oneEther.toString());
      assert.fieldEquals('TokenCandleSingleton', entityId, 'close', oneEther.times(BigInt.fromI32(10)).toString());

      assert.fieldEquals('TokenCandleSingleton', entityId, 'highOracle', oneEther.times(BigInt.fromI32(2)).toString());
      assert.fieldEquals('TokenCandleSingleton', entityId, 'lowOracle', oneEther.toString());
      assert.fieldEquals('TokenCandleSingleton', entityId, 'openOracle', oneEther.toString());
      assert.fieldEquals('TokenCandleSingleton', entityId, 'closeOracle', oneEther.times(BigInt.fromI32(2)).toString());
    });
  });

  test('handleUpdateTokenCandle_low_high: create a new candle but define open/close/high to old candles if below candle size since last event', () => {
    const event = createSyncEvent(oneEther, oneEther);

    mockSwapPair_getReserves(MockSwapPair_STABLE_MockDebtToken_Address, oneEther.times(BigInt.fromI32(10)), oneEther);
    mockPriceFeed_getPrice(MockDebtTokenAddress, oneEther.times(BigInt.fromI32(3)));

    handleSync(event);

    // another event to update close price
    mockSwapPair_getReserves(MockSwapPair_STABLE_MockDebtToken_Address, oneEther.times(BigInt.fromI32(5)), oneEther);
    mockPriceFeed_getPrice(MockDebtTokenAddress, oneEther.times(BigInt.fromI32(2)));

    handleSync(event);

    const secondEvent = createSyncEvent(oneEther, oneEther);
    // strikes 2 candles but adds to the bigger candles
    secondEvent.block.timestamp = event.block.timestamp.plus(BigInt.fromI32(10 * 60 + 1));

    handleSync(secondEvent);

    assert.entityCount('TokenCandleSingleton', 6);
    assert.entityCount('TokenCandle', 11);

    const smallestCandleEntityId = `TokenCandle-${MockDebtTokenAddress.toHexString()}-1-${event.block.timestamp.toString()}`;
    assert.fieldEquals('TokenCandle', smallestCandleEntityId, 'timestamp', event.block.timestamp.toString());
    assert.fieldEquals('TokenCandle', smallestCandleEntityId, 'high', oneEther.times(BigInt.fromI32(10)).toString());
    assert.fieldEquals('TokenCandle', smallestCandleEntityId, 'low', oneEther.toString());
    assert.fieldEquals('TokenCandle', smallestCandleEntityId, 'open', oneEther.toString());
    assert.fieldEquals('TokenCandle', smallestCandleEntityId, 'close', oneEther.times(BigInt.fromI32(5)).toString());

    assert.fieldEquals(
      'TokenCandle',
      smallestCandleEntityId,
      'highOracle',
      oneEther.times(BigInt.fromI32(3)).toString(),
    );
    assert.fieldEquals('TokenCandle', smallestCandleEntityId, 'lowOracle', oneEther.toString());
    assert.fieldEquals('TokenCandle', smallestCandleEntityId, 'openOracle', oneEther.toString());
    assert.fieldEquals(
      'TokenCandle',
      smallestCandleEntityId,
      'closeOracle',
      oneEther.times(BigInt.fromI32(2)).toString(),
    );

    // Fill up candle
    const nextCandleEntityId = `TokenCandle-${MockDebtTokenAddress.toHexString()}-1-${event.block.timestamp.plus(BigInt.fromI32(1 * 60)).toString()}`;
    assert.fieldEquals(
      'TokenCandle',
      nextCandleEntityId,
      'timestamp',
      event.block.timestamp.plus(BigInt.fromI32(1 * 60)).toString(),
    );
    assert.fieldEquals('TokenCandle', nextCandleEntityId, 'high', oneEther.times(BigInt.fromI32(5)).toString());
    assert.fieldEquals('TokenCandle', nextCandleEntityId, 'low', oneEther.times(BigInt.fromI32(5)).toString());
    assert.fieldEquals('TokenCandle', nextCandleEntityId, 'open', oneEther.times(BigInt.fromI32(5)).toString());
    assert.fieldEquals('TokenCandle', nextCandleEntityId, 'close', oneEther.times(BigInt.fromI32(5)).toString());

    assert.fieldEquals('TokenCandle', nextCandleEntityId, 'highOracle', oneEther.times(BigInt.fromI32(2)).toString());
    assert.fieldEquals('TokenCandle', nextCandleEntityId, 'lowOracle', oneEther.times(BigInt.fromI32(2)).toString());
    assert.fieldEquals('TokenCandle', nextCandleEntityId, 'openOracle', oneEther.times(BigInt.fromI32(2)).toString());
    assert.fieldEquals('TokenCandle', nextCandleEntityId, 'closeOracle', oneEther.times(BigInt.fromI32(2)).toString());

    // 10 min candle spans all events
    const candleEntityTenMinutesId = `TokenCandle-${MockDebtTokenAddress.toHexString()}-10-${event.block.timestamp.toString().toString()}`;
    assert.fieldEquals('TokenCandle', candleEntityTenMinutesId, 'timestamp', event.block.timestamp.toString());
    assert.fieldEquals('TokenCandle', candleEntityTenMinutesId, 'high', oneEther.times(BigInt.fromI32(10)).toString());
    assert.fieldEquals('TokenCandle', candleEntityTenMinutesId, 'low', oneEther.toString());
    assert.fieldEquals('TokenCandle', candleEntityTenMinutesId, 'open', oneEther.toString());
    assert.fieldEquals('TokenCandle', candleEntityTenMinutesId, 'close', oneEther.times(BigInt.fromI32(5)).toString());

    assert.fieldEquals(
      'TokenCandle',
      candleEntityTenMinutesId,
      'highOracle',
      oneEther.times(BigInt.fromI32(3)).toString(),
    );
    assert.fieldEquals('TokenCandle', candleEntityTenMinutesId, 'lowOracle', oneEther.toString());
    assert.fieldEquals('TokenCandle', candleEntityTenMinutesId, 'openOracle', oneEther.toString());
    assert.fieldEquals(
      'TokenCandle',
      candleEntityTenMinutesId,
      'closeOracle',
      oneEther.times(BigInt.fromI32(2)).toString(),
    );
  });

  test('handleUpdatePool_liquidityDepositAPY: update APY after sync for fees and totalAmount', () => {
    // Do a swap first do generate fees and volume
    const swapEvent = createSwapEvent(
      MockSwapPair_STABLE_MockDebtToken_Address,
      oneEther, // amount0In
      BigInt.fromI32(0), // amount1In
      BigInt.fromI32(0), // amount0Out
      oneEther, // amount1Out
      oneEther, // amount0InFee
      BigInt.fromI32(0), // amount1InFee
      MockUserAddress, // to
    );

    handleSwap(swapEvent);

    const event = createSyncEvent(oneEther.times(BigInt.fromI32(50)), oneEther.times(BigInt.fromI32(50)));
    handleSync(event);

    const entityId = `Pool-${MockDebtToken_STABLE_Address.toHexString()}-${MockDebtTokenAddress.toHexString()}`;
    // Fee * 10¹8 / totalAmount
    assert.fieldEquals(
      'Pool',
      entityId,
      'liquidityDepositAPY',
      oneEther
        .times(BigInt.fromI32(12))
        .times(oneEther)
        .div(oneEther.times(BigInt.fromI32(50 + 50)))
        .toString(),
    );
  });

  test('handleUpdatePool_liquidityDepositAPY: update APY after multiple trades', () => {
    // Do a swap first do generate fees and volume
    const swapEvent = createSwapEvent(
      MockSwapPair_STABLE_MockDebtToken_Address,
      oneEther, // amount0In
      BigInt.fromI32(0), // amount1In
      BigInt.fromI32(0), // amount0Out
      oneEther, // amount1Out
      oneEther, // amount0InFee
      BigInt.fromI32(0), // amount1InFee
      MockUserAddress, // to
    );

    handleSwap(swapEvent);
    handleSwap(swapEvent);
    handleSwap(swapEvent);

    const event = createSyncEvent(oneEther.times(BigInt.fromI32(50)), oneEther.times(BigInt.fromI32(50)));
    handleSync(event);

    const entityId = `Pool-${MockDebtToken_STABLE_Address.toHexString()}-${MockDebtTokenAddress.toHexString()}`;
    // Fee * 10¹8 / totalAmount
    assert.fieldEquals(
      'Pool',
      entityId,
      'liquidityDepositAPY',
      oneEther
        .times(BigInt.fromI32(3))
        .times(BigInt.fromI32(12))
        .times(oneEther)
        .div(oneEther.times(BigInt.fromI32(50 + 50)))
        .toString(),
    );
  });
});

describe('handleSwap()', () => {
  beforeEach(() => {
    initSystemInfo();

    initToken();

    mockSwapPair_getReserves();
    mockSwapPair_totalSupply();
    mockPriceFeed_getPrice();

    // Initialize SwapPair first
    const event = createPairCreatedEvent(
      MockDebtToken_STABLE_Address,
      MockDebtTokenAddress,
      MockSwapPair_STABLE_MockDebtToken_Address,
    );

    handlePairCreated(event);

    // mockSwapPair_token0();
    // mockSwapPair_token1();
    // mockPriceFeed_getPrice(MockDebtToken_STABLE_Address);
  });

  afterEach(() => {
    clearStore();
  });

  describe('handleCreateSwapEvent()', () => {
    test('create LONG for DebtToken', () => {
      const event = createSwapEvent(
        MockSwapPair_STABLE_MockDebtToken_Address,
        oneEther, // amount0In
        BigInt.fromI32(0), // amount1In
        BigInt.fromI32(0), // amount0Out
        oneEther, // amount1Out
        oneEther.div(BigInt.fromI32(10)), // amount0InFee
        BigInt.fromI32(0), // amount1InFee
        MockUserAddress, // to
      );

      handleSwap(event);

      assert.entityCount('SwapEvent', 1);

      const entityId = event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString();
      assert.fieldEquals('SwapEvent', entityId, 'borrower', MockUserAddress.toHexString());
      assert.fieldEquals('SwapEvent', entityId, 'token', MockDebtTokenAddress.toHexString());
      assert.fieldEquals('SwapEvent', entityId, 'direction', 'LONG');
      assert.fieldEquals('SwapEvent', entityId, 'timestamp', event.block.timestamp.toString());
      assert.fieldEquals('SwapEvent', entityId, 'size', oneEther.toString());
      assert.fieldEquals('SwapEvent', entityId, 'totalPriceInStable', oneEther.toString());
      assert.fieldEquals('SwapEvent', entityId, 'swapFee', oneEther.div(BigInt.fromI32(10)).toString());
    });

    test('create SHORT for DebtToken', () => {
      const event = createSwapEvent(
        MockSwapPair_STABLE_MockDebtToken_Address,
        BigInt.fromI32(0), // amount0In
        oneEther, // amount1In
        oneEther, // amount0Out
        BigInt.fromI32(0), // amount1Out
        BigInt.fromI32(0), // amount0InFee
        oneEther.div(BigInt.fromI32(10)), // amount1InFee
        MockUserAddress, // to
      );

      handleSwap(event);

      assert.entityCount('SwapEvent', 1);

      const entityId = event.transaction.hash.concatI32(event.logIndex.toI32()).toHexString();
      assert.fieldEquals('SwapEvent', entityId, 'borrower', MockUserAddress.toHexString());
      assert.fieldEquals('SwapEvent', entityId, 'token', MockDebtTokenAddress.toHexString());
      assert.fieldEquals('SwapEvent', entityId, 'direction', 'SHORT');
      assert.fieldEquals('SwapEvent', entityId, 'timestamp', event.block.timestamp.toString());
      assert.fieldEquals('SwapEvent', entityId, 'size', oneEther.toString());
      assert.fieldEquals('SwapEvent', entityId, 'totalPriceInStable', oneEther.toString());
      assert.fieldEquals('SwapEvent', entityId, 'swapFee', oneEther.div(BigInt.fromI32(10)).toString());
    });
  });

  describe('handleUpdatePool_volume30dUSD()', () => {
    test('create volume for DebtToken', () => {
      const event = createSwapEvent(
        MockSwapPair_STABLE_MockDebtToken_Address,
        oneEther, // amount0In
        BigInt.fromI32(0), // amount1In
        BigInt.fromI32(0), // amount0Out
        oneEther, // amount1Out
        oneEther.div(BigInt.fromI32(10)), // amount0InFee
        BigInt.fromI32(0), // amount1InFee
        MockUserAddress, // to
      );

      handleSwap(event);

      assert.entityCount('PoolVolume30d', 2);
      assert.entityCount('PoolVolumeChunk', 1);

      const volumeEntityId = `PoolVolume30d-${MockSwapPair_STABLE_MockDebtToken_Address.toHexString()}`;
      assert.fieldEquals('PoolVolume30d', volumeEntityId, 'leadingIndex', '1');
      assert.fieldEquals('PoolVolume30d', volumeEntityId, 'lastIndex', '1');
      assert.fieldEquals('PoolVolume30d', volumeEntityId, 'value', oneEther.toString());
      assert.fieldEquals('PoolVolume30d', volumeEntityId, 'feeUSD', oneEther.div(BigInt.fromI32(10)).toString());

      const chunkEntityId = `PoolVolumeChunk-${MockDebtToken_STABLE_Address.toHexString()}-${MockDebtTokenAddress.toHexString()}-1`;
      assert.fieldEquals('PoolVolumeChunk', chunkEntityId, 'timestamp', '1');
      assert.fieldEquals('PoolVolumeChunk', chunkEntityId, 'value', oneEther.toString());
      assert.fieldEquals('PoolVolumeChunk', chunkEntityId, 'feeUSD', oneEther.div(BigInt.fromI32(10)).toString());
    });

    test('accumulate volume for DebtToken from 2 events', () => {
      const event = createSwapEvent(
        MockSwapPair_STABLE_MockDebtToken_Address,
        oneEther, // amount0In
        BigInt.fromI32(0), // amount1In
        BigInt.fromI32(0), // amount0Out
        oneEther, // amount1Out
        oneEther.div(BigInt.fromI32(10)), // amount0InFee
        BigInt.fromI32(0), // amount1InFee
        MockUserAddress, // to
      );

      handleSwap(event);
      handleSwap(event);

      assert.entityCount('PoolVolume30d', 2);
      assert.entityCount('PoolVolumeChunk', 1);

      const volumeEntityId = `PoolVolume30d-${MockSwapPair_STABLE_MockDebtToken_Address.toHexString()}`;
      assert.fieldEquals('PoolVolume30d', volumeEntityId, 'leadingIndex', '1');
      assert.fieldEquals('PoolVolume30d', volumeEntityId, 'lastIndex', '1');
      assert.fieldEquals('PoolVolume30d', volumeEntityId, 'value', oneEther.times(BigInt.fromI32(2)).toString());
      assert.fieldEquals(
        'PoolVolume30d',
        volumeEntityId,
        'feeUSD',
        oneEther.div(BigInt.fromI32(10)).times(BigInt.fromI32(2)).toString(),
      );

      const chunkEntityId = `PoolVolumeChunk-${MockDebtToken_STABLE_Address.toHexString()}-${MockDebtTokenAddress.toHexString()}-1`;
      assert.fieldEquals('PoolVolumeChunk', chunkEntityId, 'timestamp', '1');
      assert.fieldEquals('PoolVolumeChunk', chunkEntityId, 'value', oneEther.times(BigInt.fromI32(2)).toString());
      assert.fieldEquals(
        'PoolVolumeChunk',
        chunkEntityId,
        'feeUSD',
        oneEther.div(BigInt.fromI32(10)).times(BigInt.fromI32(2)).toString(),
      );
    });

    test('create second volume chunk when outdated after 60min', () => {
      const event = createSwapEvent(
        MockSwapPair_STABLE_MockDebtToken_Address,
        oneEther, // amount0In
        BigInt.fromI32(0), // amount1In
        BigInt.fromI32(0), // amount0Out
        oneEther, // amount1Out
        oneEther.div(BigInt.fromI32(10)), // amount0InFee
        BigInt.fromI32(0), // amount1InFee
        MockUserAddress, // to
      );

      handleSwap(event);

      event.block.timestamp = event.block.timestamp.plus(BigInt.fromI32(60 * 60 + 2));
      handleSwap(event);

      assert.entityCount('PoolVolume30d', 2);
      assert.entityCount('PoolVolumeChunk', 2);

      const volumeEntityId = `PoolVolume30d-${MockSwapPair_STABLE_MockDebtToken_Address.toHexString()}`;
      assert.fieldEquals('PoolVolume30d', volumeEntityId, 'leadingIndex', '2');
      assert.fieldEquals('PoolVolume30d', volumeEntityId, 'lastIndex', '1');
      assert.fieldEquals('PoolVolume30d', volumeEntityId, 'value', oneEther.times(BigInt.fromI32(2)).toString());
      assert.fieldEquals(
        'PoolVolume30d',
        volumeEntityId,
        'feeUSD',
        oneEther.div(BigInt.fromI32(10)).times(BigInt.fromI32(2)).toString(),
      );

      const chunkEntityId = `PoolVolumeChunk-${MockDebtToken_STABLE_Address.toHexString()}-${MockDebtTokenAddress.toHexString()}-2`;
      assert.fieldEquals('PoolVolumeChunk', chunkEntityId, 'timestamp', (1 + 60 * 60).toString());
      assert.fieldEquals('PoolVolumeChunk', chunkEntityId, 'value', oneEther.toString());
      assert.fieldEquals('PoolVolumeChunk', chunkEntityId, 'feeUSD', oneEther.div(BigInt.fromI32(10)).toString());
    });

    test('no 30dAgo volume on recent event', () => {
      const event = createSwapEvent(
        MockSwapPair_STABLE_MockDebtToken_Address,
        oneEther, // amount0In
        BigInt.fromI32(0), // amount1In
        BigInt.fromI32(0), // amount0Out
        oneEther, // amount1Out
        oneEther.div(BigInt.fromI32(10)), // amount0InFee
        BigInt.fromI32(0), // amount1InFee
        MockUserAddress, // to
      );

      handleSwap(event);

      event.block.timestamp = event.block.timestamp.plus(BigInt.fromI32(60 * 60 + 2));
      handleSwap(event);

      assert.entityCount('PoolVolume30d', 2);
      assert.entityCount('PoolVolumeChunk', 2);

      const volumeEntityId = `PoolVolume30dAgo-${MockSwapPair_STABLE_MockDebtToken_Address.toHexString()}`;
      assert.fieldEquals('PoolVolume30d', volumeEntityId, 'leadingIndex', '1');
      assert.fieldEquals('PoolVolume30d', volumeEntityId, 'lastIndex', '1');
      assert.fieldEquals('PoolVolume30d', volumeEntityId, 'value', '0');
      assert.fieldEquals('PoolVolume30d', volumeEntityId, 'feeUSD', '0');
    });

    test('30dAgo one first chunk after 30d', () => {
      const firstEvent = createSwapEvent(
        MockSwapPair_STABLE_MockDebtToken_Address,
        oneEther.times(BigInt.fromI32(10)), // amount0In
        BigInt.fromI32(0), // amount1In
        BigInt.fromI32(0), // amount0Out
        oneEther.times(BigInt.fromI32(10)), // amount1Out
        oneEther.times(BigInt.fromI32(10)).div(BigInt.fromI32(10)), // amount0InFee
        BigInt.fromI32(0), // amount1InFee
        MockUserAddress, // to
      );
      handleUpdatePool_volume30dUSD(
        firstEvent,
        MockDebtToken_STABLE_Address,
        MockDebtTokenAddress,
        oneEther.times(BigInt.fromI32(10)),
        oneEther.times(BigInt.fromI32(10)).div(BigInt.fromI32(10)),
      );

      // fill a complete month with data
      for (let i = 1; i <= 30 * 24; i++) {
        const event = createSwapEvent(
          MockSwapPair_STABLE_MockDebtToken_Address,
          oneEther, // amount0In
          BigInt.fromI32(0), // amount1In
          BigInt.fromI32(0), // amount0Out
          oneEther, // amount1Out
          oneEther.div(BigInt.fromI32(10)), // amount0InFee
          BigInt.fromI32(0), // amount1InFee
          MockUserAddress, // to
        );
        event.block.timestamp = BigInt.fromI32(i * 60 * 60 + 2);
        // TODO: Needs to long over 30d so I use the entity mapper instead
        // handleSwap(event);
        // handleUpdatePool_volume30dUSD(event, stableCoin, nonStableCoin, stableSize, feeUSD);
        handleUpdatePool_volume30dUSD(
          event,
          MockDebtToken_STABLE_Address,
          MockDebtTokenAddress,
          oneEther,
          oneEther.div(BigInt.fromI32(10)),
        );
      }

      assert.entityCount('PoolVolume30d', 2);
      assert.entityCount('PoolVolumeChunk', 30 * 24 + 1);

      // 30dAgo volume with single big chunk
      const volume30dAgoEntityId = `PoolVolume30dAgo-${MockSwapPair_STABLE_MockDebtToken_Address.toHexString()}`;
      assert.fieldEquals('PoolVolume30d', volume30dAgoEntityId, 'leadingIndex', '2');
      assert.fieldEquals('PoolVolume30d', volume30dAgoEntityId, 'lastIndex', '1');
      assert.fieldEquals('PoolVolume30d', volume30dAgoEntityId, 'value', oneEther.times(BigInt.fromI32(10)).toString());
      assert.fieldEquals(
        'PoolVolume30d',
        volume30dAgoEntityId,
        'feeUSD',
        oneEther.times(BigInt.fromI32(10)).div(BigInt.fromI32(10)).toString(),
      );

      // Recent volume without bigger chunk
      const volumeEntityId = `PoolVolume30d-${MockSwapPair_STABLE_MockDebtToken_Address.toHexString()}`;
      assert.fieldEquals('PoolVolume30d', volumeEntityId, 'leadingIndex', (30 * 24 + 1).toString());
      assert.fieldEquals('PoolVolume30d', volumeEntityId, 'lastIndex', '2');
      assert.fieldEquals('PoolVolume30d', volumeEntityId, 'value', oneEther.times(BigInt.fromI32(30 * 24)).toString());
      assert.fieldEquals(
        'PoolVolume30d',
        volumeEntityId,
        'feeUSD',
        oneEther
          .div(BigInt.fromI32(10))
          .times(BigInt.fromI32(30 * 24))
          .toString(),
      );
    });
  });

  describe('handleUpdateTokenCandle_volume()', () => {
    test('Update traded volume of the pool for all candles - LONG', () => {
      // LONG
      const event = createSwapEvent(
        MockSwapPair_STABLE_MockDebtToken_Address,
        oneEther.times(BigInt.fromI32(2)), // amount0In
        BigInt.fromI32(0), // amount1In
        BigInt.fromI32(0), // amount0Out
        oneEther, // amount1Out
        oneEther.div(BigInt.fromI32(10)), // amount0InFee
        BigInt.fromI32(0), // amount1InFee
        MockUserAddress, // to
      );

      handleSwap(event);

      CandleSizes.forEach((size) => {
        const entityId = `TokenCandleSingleton-${MockDebtTokenAddress.toHexString()}-${size.toString()}`;
        assert.fieldEquals('TokenCandleSingleton', entityId, 'volume', oneEther.times(BigInt.fromI32(2)).toString());
      });
    });

    test('Update traded volume of the pool for all candles - SHORT', () => {
      // SHORT
      const event = createSwapEvent(
        MockSwapPair_STABLE_MockDebtToken_Address,
        BigInt.fromI32(0), // amount0In
        oneEther, // amount1In
        oneEther.times(BigInt.fromI32(2)), // amount0Out
        BigInt.fromI32(0), // amount1Out
        BigInt.fromI32(0), // amount0InFee
        oneEther.div(BigInt.fromI32(10)), // amount1InFee
        MockUserAddress, // to
      );

      handleSwap(event);

      CandleSizes.forEach((size) => {
        const entityId = `TokenCandleSingleton-${MockDebtTokenAddress.toHexString()}-${size.toString()}`;
        assert.fieldEquals('TokenCandleSingleton', entityId, 'volume', oneEther.times(BigInt.fromI32(2)).toString());
      });
    });

    test('Add traded volume to the same candle', () => {
      // LONG
      const event = createSwapEvent(
        MockSwapPair_STABLE_MockDebtToken_Address,
        oneEther.times(BigInt.fromI32(2)), // amount0In
        BigInt.fromI32(0), // amount1In
        BigInt.fromI32(0), // amount0Out
        oneEther, // amount1Out
        oneEther.div(BigInt.fromI32(10)), // amount0InFee
        BigInt.fromI32(0), // amount1InFee
        MockUserAddress, // to
      );

      // Add volume twice
      handleSwap(event);
      handleSwap(event);

      CandleSizes.forEach((size) => {
        const entityId = `TokenCandleSingleton-${MockDebtTokenAddress.toHexString()}-${size.toString()}`;
        assert.fieldEquals(
          'TokenCandleSingleton',
          entityId,
          'volume',
          oneEther.times(BigInt.fromI32(2 * 2)).toString(),
        );
      });
    });

    test('create a new candle but add volume to old candles if below candle size since last event', () => {
      const event = createSwapEvent(
        MockSwapPair_STABLE_MockDebtToken_Address,
        oneEther.times(BigInt.fromI32(10)), // amount0In
        BigInt.fromI32(0), // amount1In
        BigInt.fromI32(0), // amount0Out
        oneEther, // amount1Out
        oneEther.div(BigInt.fromI32(10)), // amount0InFee
        BigInt.fromI32(0), // amount1InFee
        MockUserAddress, // to
      );

      handleSwap(event);

      const secondEvent = createSwapEvent(
        MockSwapPair_STABLE_MockDebtToken_Address,
        oneEther.times(BigInt.fromI32(10)), // amount0In
        BigInt.fromI32(0), // amount1In
        BigInt.fromI32(0), // amount0Out
        oneEther, // amount1Out
        oneEther.div(BigInt.fromI32(10)), // amount0InFee
        BigInt.fromI32(0), // amount1InFee
        MockUserAddress, // to
      );

      // strikes 2 candles but adds to the bigger candles
      secondEvent.block.timestamp = event.block.timestamp.plus(BigInt.fromI32(10 * 60 + 1));

      handleSwap(secondEvent);

      assert.entityCount('TokenCandleSingleton', 6);
      assert.entityCount('TokenCandle', 11);

      const smallestCandleEntityId = `TokenCandle-${MockDebtTokenAddress.toHexString()}-1-${event.block.timestamp.toString()}`;
      assert.fieldEquals('TokenCandle', smallestCandleEntityId, 'timestamp', event.block.timestamp.toString());
      assert.fieldEquals(
        'TokenCandle',
        smallestCandleEntityId,
        'volume',
        oneEther.times(BigInt.fromI32(10)).toString(),
      );

      const nextCandleEntityId = `TokenCandle-${MockDebtTokenAddress.toHexString()}-1-${event.block.timestamp.plus(BigInt.fromI32(1 * 60)).toString()}`;
      assert.fieldEquals(
        'TokenCandle',
        nextCandleEntityId,
        'timestamp',
        event.block.timestamp.plus(BigInt.fromI32(1 * 60)).toString(),
      );
      assert.fieldEquals('TokenCandle', nextCandleEntityId, 'volume', '0');

      const candleEntityTenMinutesId = `TokenCandle-${MockDebtTokenAddress.toHexString()}-10-${event.block.timestamp.toString().toString()}`;
      assert.fieldEquals('TokenCandle', candleEntityTenMinutesId, 'timestamp', event.block.timestamp.toString());
      assert.fieldEquals(
        'TokenCandle',
        candleEntityTenMinutesId,
        'volume',
        oneEther.times(BigInt.fromI32(10)).toString(),
      );
    });
  });
});
