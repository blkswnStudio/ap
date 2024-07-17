import { assert, beforeEach, test } from 'matchstick-as';
import { afterEach, clearStore, describe } from 'matchstick-as/assembly/index';
import { oneEther } from '../src/entities/token-candle-entity';
import { handlePairCreated } from '../src/swap-operations';
import { mockPriceFeed_getPrice } from './price-feed-utils';
import { createPairCreatedEvent } from './swap-operations-utils';
import { mockSwapPair_getReserves, mockSwapPair_totalSupply } from './swap-pair-utils';
import {
  MockCollToken_GOV_Address,
  MockDebtTokenAddress,
  MockDebtToken_STABLE_Address,
  MockSwapPair_STABLE_GOV_Address,
  MockSwapPair_STABLE_MockDebtToken_Address,
  initSystemInfo,
  initToken,
} from './utils';

describe('handlePairCreated()', () => {
  beforeEach(() => {
    initSystemInfo();
    initToken();

    mockSwapPair_getReserves();
    mockSwapPair_totalSupply();
    mockPriceFeed_getPrice();
  });

  afterEach(() => {
    clearStore();
  });

  test('handleCreateUpdatePool: create generic STABLE DebtToken SwapPair with reserves', () => {
    const event = createPairCreatedEvent(
      MockDebtToken_STABLE_Address,
      MockDebtTokenAddress,
      MockSwapPair_STABLE_MockDebtToken_Address,
    );

    handlePairCreated(event);

    const entityId = `Pool-${MockDebtToken_STABLE_Address.toHexString()}-${MockDebtTokenAddress.toHexString()}`;

    assert.entityCount('Pool', 1);
    assert.fieldEquals('Pool', entityId, 'address', MockSwapPair_STABLE_MockDebtToken_Address.toHexString());
    // TODO: Might want to change this ID
    assert.fieldEquals(
      'Pool',
      entityId,
      'liquidity',
      `[${MockDebtToken_STABLE_Address.concat(MockDebtTokenAddress).toHexString()}, ${MockDebtTokenAddress.concat(MockDebtToken_STABLE_Address).toHexString()}]`,
    );
    assert.fieldEquals('Pool', entityId, 'liquidityDepositAPY', '0');
    // TODO: Might want to change this ID
    assert.fieldEquals(
      'Pool',
      entityId,
      'volume30dUSD',
      `PoolVolume30d-${MockSwapPair_STABLE_MockDebtToken_Address.toHexString()}`,
    );
    // TODO: Might want to change this ID
    assert.fieldEquals(
      'Pool',
      entityId,
      'volume30dUSD30dAgo',
      `PoolVolume30dAgo-${MockSwapPair_STABLE_MockDebtToken_Address.toHexString()}`,
    );
    assert.fieldEquals('Pool', entityId, 'totalSupply', oneEther.toString());
  });

  test('handleCreateUpdatePool: create generic STABLE CollToken SwapPair with reserves', () => {
    mockSwapPair_getReserves(MockSwapPair_STABLE_GOV_Address);
    mockSwapPair_totalSupply(MockSwapPair_STABLE_GOV_Address);
    mockPriceFeed_getPrice(MockCollToken_GOV_Address);

    const event = createPairCreatedEvent(
      MockDebtToken_STABLE_Address,
      MockCollToken_GOV_Address,
      MockSwapPair_STABLE_GOV_Address,
    );

    handlePairCreated(event);

    const entityId = `Pool-${MockDebtToken_STABLE_Address.toHexString()}-${MockCollToken_GOV_Address.toHexString()}`;

    assert.entityCount('Pool', 1);
    assert.fieldEquals('Pool', entityId, 'address', MockSwapPair_STABLE_GOV_Address.toHexString());
    assert.fieldEquals(
      'Pool',
      entityId,
      'liquidity',
      `[${MockDebtToken_STABLE_Address.concat(MockCollToken_GOV_Address).toHexString()}, ${MockCollToken_GOV_Address.concat(MockDebtToken_STABLE_Address).toHexString()}]`,
    );
    assert.fieldEquals('Pool', entityId, 'liquidityDepositAPY', '0');
    assert.fieldEquals(
      'Pool',
      entityId,
      'volume30dUSD',
      `PoolVolume30d-${MockSwapPair_STABLE_GOV_Address.toHexString()}`,
    );
    assert.fieldEquals(
      'Pool',
      entityId,
      'volume30dUSD30dAgo',
      `PoolVolume30dAgo-${MockSwapPair_STABLE_GOV_Address.toHexString()}`,
    );
    assert.fieldEquals('Pool', entityId, 'totalSupply', oneEther.toString());
  });

  test('handleCreateTokenCandleSingleton: create candle for generic DebtToken', () => {
    const event = createPairCreatedEvent(
      MockDebtToken_STABLE_Address,
      MockDebtTokenAddress,
      MockSwapPair_STABLE_MockDebtToken_Address,
    );

    handlePairCreated(event);

    assert.entityCount('TokenCandleSingleton', 6);

    const entityId = `TokenCandleSingleton-${MockDebtTokenAddress.toHexString()}-1`;

    assert.fieldEquals('TokenCandleSingleton', entityId, 'token', MockDebtTokenAddress.toHexString());
    assert.fieldEquals('TokenCandleSingleton', entityId, 'timestamp', event.block.timestamp.toString());
    assert.fieldEquals('TokenCandleSingleton', entityId, 'open', oneEther.toString());
    assert.fieldEquals('TokenCandleSingleton', entityId, 'high', oneEther.toString());
    assert.fieldEquals('TokenCandleSingleton', entityId, 'low', oneEther.toString());
    assert.fieldEquals('TokenCandleSingleton', entityId, 'close', oneEther.toString());
    assert.fieldEquals('TokenCandleSingleton', entityId, 'volume', '0');
    assert.fieldEquals('TokenCandleSingleton', entityId, 'candleSize', '1');
  });
  test('handleCreateTokenCandleSingleton: create candle for GOV CollateralToken', () => {
    mockSwapPair_getReserves(MockSwapPair_STABLE_GOV_Address);
    mockSwapPair_totalSupply(MockSwapPair_STABLE_GOV_Address);
    mockPriceFeed_getPrice(MockCollToken_GOV_Address);

    const event = createPairCreatedEvent(
      MockDebtToken_STABLE_Address,
      MockCollToken_GOV_Address,
      MockSwapPair_STABLE_GOV_Address,
    );

    handlePairCreated(event);

    assert.entityCount('TokenCandleSingleton', 6);

    const entityId = `TokenCandleSingleton-${MockCollToken_GOV_Address.toHexString()}-1`;

    assert.fieldEquals('TokenCandleSingleton', entityId, 'token', MockCollToken_GOV_Address.toHexString());
    assert.fieldEquals('TokenCandleSingleton', entityId, 'timestamp', event.block.timestamp.toString());
    assert.fieldEquals('TokenCandleSingleton', entityId, 'open', oneEther.toString());
    assert.fieldEquals('TokenCandleSingleton', entityId, 'high', oneEther.toString());
    assert.fieldEquals('TokenCandleSingleton', entityId, 'low', oneEther.toString());
    assert.fieldEquals('TokenCandleSingleton', entityId, 'close', oneEther.toString());
    assert.fieldEquals('TokenCandleSingleton', entityId, 'volume', '0');
    assert.fieldEquals('TokenCandleSingleton', entityId, 'candleSize', '1');
  });
});
