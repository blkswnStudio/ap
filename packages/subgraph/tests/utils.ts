import { Bytes } from '@graphprotocol/graph-ts';
import { Address as EventAddress } from '@graphprotocol/graph-ts/common/numbers';
import { newMockEvent } from 'matchstick-as';
import { SystemInfo, Token } from '../generated/schema';

export const ZeroAddress = EventAddress.fromString('0x0000000000000000000000000000000000000000');
export const MockDebtTokenAddress = EventAddress.fromString('0x0000000000000000000000000000000000000100');
export const MockDebtToken_STABLE_Address = EventAddress.fromString('0x0000000000000000000000000000000000000101');
export const MockCollToken_GOV_Address = EventAddress.fromString('0x0000000000000000000000000000000000000102');
export const MockCollToken_OTHER_Address = EventAddress.fromString('0x0000000000000000000000000000000000000103');
export const MockStabilityPoolManagerAddress = EventAddress.fromString('0x0000000000000000000000000000000000000200');
export const MockStabilityPoolAddress = EventAddress.fromString('0x0000000000000000000000000000000000000300');
export const MockSwapPair_STABLE_MockDebtToken_Address = EventAddress.fromString(
  '0x0000000000000000000000000000000000001000',
);
export const MockSwapPair_STABLE_GOV_Address = EventAddress.fromString('0x0000000000000000000000000000000000002000');
export const MockTroveManagerAddress = EventAddress.fromString('0x0000000000000000000000000000000000000400');
export const MockCollateralToken1Address = EventAddress.fromString('0x0000000000000000000000000000000000000500');
export const MockCollateralToken2Address = EventAddress.fromString('0x0000000000000000000000000000000000000501');
export const MockPriceFeedAddress = EventAddress.fromString('0x0000000000000000000000000000000000000600');
export const MockStoragePoolAddress = EventAddress.fromString('0x0000000000000000000000000000000000000700');
export const MockReservePoolAddress = EventAddress.fromString('0x0000000000000000000000000000000000000800');
export const MockSwapOperationsAddress = EventAddress.fromString('0x0000000000000000000000000000000000000900');
export const MockTokenManagerAddress = EventAddress.fromString('0x0000000000000000000000000000000000001000');
export const MockStakingOperationsAddress = EventAddress.fromString('0x0000000000000000000000000000000000001100');

export const MockUserAddress = EventAddress.fromString('0x1000000000000000000000000000000000000000');
export const MockSecondUserAddress = EventAddress.fromString('0x2000000000000000000000000000000000000000');
export const MockOracleId = Bytes.fromHexString('0x0100000000000000000000000000000000000000');

export const initSystemInfo = (): void => {
  const systemInfo = new SystemInfo('SystemInfo');
  systemInfo.storagePool = MockStoragePoolAddress;
  systemInfo.priceFeed = MockPriceFeedAddress;
  systemInfo.reservePool = MockReservePoolAddress;
  systemInfo.stableCoin = MockDebtToken_STABLE_Address;
  systemInfo.stakingOps = MockStakingOperationsAddress;
  systemInfo.totalValueLockedUSDHistoryIndex = 0;
  systemInfo.totalValueMintedUSDHistoryIndex = 0;
  systemInfo.reservePoolUSDHistoryIndex = 0;
  systemInfo.govToken = MockCollToken_GOV_Address;
  systemInfo.tokenManager = MockTokenManagerAddress;

  const now = newMockEvent().block.timestamp;

  systemInfo.timestamp = now;

  systemInfo.save();
};

export const initToken = (address: EventAddress = MockDebtTokenAddress): void => {
  const token = new Token(address);
  token.address = address.toHexString();
  token.symbol = 'AAA';
  token.isPoolToken = true;
  token.oracleId = MockOracleId;
  token.decimals = 18;

  const now = newMockEvent().block.timestamp;

  token.createdAt = now;
  token.save();
};
