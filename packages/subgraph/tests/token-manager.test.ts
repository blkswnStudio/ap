import { BigInt } from '@graphprotocol/graph-ts';
import { assert, beforeEach, test } from 'matchstick-as';
import { afterEach, clearStore, describe } from 'matchstick-as/assembly/index';
import { oneEther } from '../src/entities/token-candle-entity';
import {
  handleCollTokenAdded,
  handleCollTokenSupportedCollateralRatioSet,
  handleDebtTokenAdded,
} from '../src/token-manager';
import {
  mockDebtToken_decimals,
  mockDebtToken_symbol,
  mockDebtToken_totalSupply,
  mockToken_balanceOf,
} from './debt-token-utils';
import { mockPriceFeed_getPrice } from './price-feed-utils';
import { mockReservePool_govReserveCap } from './reserve-pool-utils';
import { mockStabilityPoolManager_getStabilityPool } from './stability-pool-manager-utils';
import { mockStabilityPool_getTotalDeposit } from './stability-pool-utils';
import { mockStoragePool_getTokenTotalAmount } from './storage-pool-utils';
import {
  createCollTokenAddedEvent,
  createCollTokenSupportedCollateralRatioSetEvent,
  createDebtTokenAddedEvent,
  mockTokenManager_getStableCoin,
} from './token-manager-utils';
import {
  MockCollToken_GOV_Address,
  MockDebtTokenAddress,
  MockDebtToken_STABLE_Address,
  MockOracleId,
  MockReservePoolAddress,
  initSystemInfo,
  initToken,
} from './utils';

describe('handleCollTokenAdded()', () => {
  beforeEach(() => {
    initSystemInfo();

    mockDebtToken_symbol();
    mockReservePool_govReserveCap();
    mockStoragePool_getTokenTotalAmount();
    mockStoragePool_getTokenTotalAmount(MockCollToken_GOV_Address);
    mockPriceFeed_getPrice();
    mockDebtToken_decimals();
    mockDebtToken_decimals(MockCollToken_GOV_Address);
  });

  afterEach(() => {
    clearStore();
  });

  test('handleUpdateSystemInfo_govToken: is called successfully', () => {
    // Use any token so that systemInfo can be checked
    const event = createCollTokenAddedEvent(MockDebtTokenAddress, oneEther, true, MockOracleId);

    handleCollTokenAdded(event);

    const entityId = `SystemInfo`;
    assert.entityCount('SystemInfo', 1);
    assert.fieldEquals('SystemInfo', entityId, 'govToken', MockDebtTokenAddress.toHexString());
  });

  test('handleCreateToken: is called successfully', () => {
    const event = createCollTokenAddedEvent(MockDebtTokenAddress, oneEther, true, MockOracleId);

    handleCollTokenAdded(event);

    const entityId = MockDebtTokenAddress;
    assert.entityCount('Token', 1);
    assert.fieldEquals('Token', entityId.toHexString(), 'address', MockDebtTokenAddress.toHexString());
    assert.fieldEquals('Token', entityId.toHexString(), 'symbol', 'JUSD');
    assert.fieldEquals('Token', entityId.toHexString(), 'createdAt', event.block.timestamp.toString());
    assert.fieldEquals('Token', entityId.toHexString(), 'isPoolToken', true.toString());
  });

  test('handleCreateUpdateCollateralTokenMeta: is called successfully', () => {
    mockDebtToken_symbol(MockCollToken_GOV_Address, 'GOV');
    mockStoragePool_getTokenTotalAmount(MockCollToken_GOV_Address);
    mockPriceFeed_getPrice(MockCollToken_GOV_Address);
    mockDebtToken_decimals(MockCollToken_GOV_Address);

    const event = createCollTokenAddedEvent(MockCollToken_GOV_Address, oneEther, true, MockOracleId);

    handleCollTokenAdded(event);

    const entityId = `CollateralTokenMeta-${MockCollToken_GOV_Address.toHexString()}`;
    assert.entityCount('CollateralTokenMeta', 1);
    assert.fieldEquals('CollateralTokenMeta', entityId, 'token', MockCollToken_GOV_Address.toHexString());
    assert.fieldEquals('CollateralTokenMeta', entityId, 'timestamp', event.block.timestamp.toString());
    assert.fieldEquals('CollateralTokenMeta', entityId, 'totalValueLockedUSD', oneEther.toString());
    assert.fieldEquals('CollateralTokenMeta', entityId, 'supportedCollateralRatio', oneEther.toString());
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
});

describe('handleCollTokenSupportedCollateralRatioSet()', () => {
  beforeEach(() => {
    initSystemInfo();

    mockDebtToken_symbol();
    mockReservePool_govReserveCap();
    mockStoragePool_getTokenTotalAmount(MockDebtTokenAddress);
    mockPriceFeed_getPrice();
    mockDebtToken_decimals(MockCollToken_GOV_Address);
  });

  afterEach(() => {
    clearStore();
  });

  test('handleCreateUpdateCollateralTokenMeta: is called successfully', () => {
    initToken(MockCollToken_GOV_Address);

    mockDebtToken_symbol(MockCollToken_GOV_Address, 'GOV');
    mockStoragePool_getTokenTotalAmount(MockCollToken_GOV_Address);
    mockPriceFeed_getPrice(MockCollToken_GOV_Address);

    const event = createCollTokenSupportedCollateralRatioSetEvent(
      MockCollToken_GOV_Address,
      oneEther.times(BigInt.fromI32(2)),
    );

    handleCollTokenSupportedCollateralRatioSet(event);

    const entityId = `CollateralTokenMeta-${MockCollToken_GOV_Address.toHexString()}`;
    assert.entityCount('CollateralTokenMeta', 1);
    assert.fieldEquals('CollateralTokenMeta', entityId, 'token', MockCollToken_GOV_Address.toHexString());
    assert.fieldEquals('CollateralTokenMeta', entityId, 'timestamp', event.block.timestamp.toString());
    assert.fieldEquals('CollateralTokenMeta', entityId, 'totalValueLockedUSD', oneEther.toString());
    assert.fieldEquals(
      'CollateralTokenMeta',
      entityId,
      'supportedCollateralRatio',
      oneEther.times(BigInt.fromI32(2)).toString(),
    );
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
});

describe('handleDebtTokenAdded()', () => {
  beforeEach(() => {
    initSystemInfo();

    mockTokenManager_getStableCoin();
    mockDebtToken_totalSupply();
    mockToken_balanceOf();
    mockStabilityPoolManager_getStabilityPool();
    mockStabilityPool_getTotalDeposit();
    mockDebtToken_decimals();
  });

  afterEach(() => {
    clearStore();
  });

  test('handleUpdateSystemInfo_stableCoin: is called successfully', () => {
    // Use any token so that systemInfo can be checked
    const event = createDebtTokenAddedEvent(MockDebtTokenAddress, MockOracleId);

    mockTokenManager_getStableCoin(MockDebtTokenAddress);
    handleDebtTokenAdded(event);

    const entityId = `SystemInfo`;
    assert.entityCount('SystemInfo', 1);
    assert.fieldEquals('SystemInfo', entityId, 'stableCoin', MockDebtTokenAddress.toHexString());
  });

  test('handleCreateToken: is called successfully', () => {
    const event = createDebtTokenAddedEvent(MockDebtTokenAddress, MockOracleId);

    handleDebtTokenAdded(event);

    const entityId = MockDebtTokenAddress;
    assert.entityCount('Token', 1);
    assert.fieldEquals('Token', entityId.toHexString(), 'address', MockDebtTokenAddress.toHexString());
    assert.fieldEquals('Token', entityId.toHexString(), 'symbol', 'JUSD');
    assert.fieldEquals('Token', entityId.toHexString(), 'createdAt', event.block.timestamp.toString());
    assert.fieldEquals('Token', entityId.toHexString(), 'isPoolToken', true.toString());
  });

  test('handleCreateUpdateDebtTokenMeta: is called successfully for generic DebtToken', () => {
    const event = createDebtTokenAddedEvent(MockDebtTokenAddress, MockOracleId);

    handleDebtTokenAdded(event);

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

  test('handleCreateUpdateDebtTokenMeta: is called successfully for STABLE', () => {
    mockDebtToken_symbol(MockDebtToken_STABLE_Address);
    mockDebtToken_totalSupply(MockDebtToken_STABLE_Address);
    mockPriceFeed_getPrice(MockDebtToken_STABLE_Address);
    mockToken_balanceOf(MockDebtToken_STABLE_Address, MockReservePoolAddress);
    mockStabilityPoolManager_getStabilityPool(MockDebtToken_STABLE_Address);
    mockDebtToken_decimals(MockDebtToken_STABLE_Address);

    const event = createDebtTokenAddedEvent(MockDebtToken_STABLE_Address, MockOracleId);

    handleDebtTokenAdded(event);

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
