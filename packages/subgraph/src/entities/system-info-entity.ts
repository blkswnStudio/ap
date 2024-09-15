import { Address, ethereum } from '@graphprotocol/graph-ts';
import { SystemInfo } from '../../generated/schema';

// FIXME: Exchange for sensible defaults
const PriceFeedDemo = Address.fromString('0xb7f8bc63bbcad18155201308c8f3540b07f84f5e');
const StoragePoolDemo = Address.fromString('0xa513e6e4b8f2a923d98304ec87f64353c4d5c853');
const StableDemo = Address.fromString('0xc3e53f4d16ae77db1c982e75a937b9f60fe63690');
const ReservePoolDemo = Address.fromString('0x8A791620dd6260079BF849Dc5567aDC3F2FdC318');
const GovTokenDemo = Address.fromString('0xe6e340d132b5f46d1e472debcd681b2abc16e57e');
const StabilityPoolManagerDemo = Address.fromString('0x0165878a594ca255338adfa4d48449f69242eb8f');
const StakingOperationsDemo = Address.fromString('0x0165878a594ca255338adfa4d48449f69242eb8f');

export const handleUpdateSystemInfo_stableCoin = (event: ethereum.Event, stableCoin: Address): void => {
  let systemInfo = SystemInfo.load(`SystemInfo`);

  if (systemInfo === null) {
    systemInfo = new SystemInfo(`SystemInfo`);
    systemInfo.storagePool = StoragePoolDemo;
    systemInfo.priceFeed = PriceFeedDemo;
    systemInfo.reservePool = ReservePoolDemo;
    systemInfo.stakingOps = StakingOperationsDemo;
    systemInfo.totalValueLockedUSDHistoryIndex = 0;
    systemInfo.totalValueMintedUSDHistoryIndex = 0;
    systemInfo.reservePoolUSDHistoryIndex = 0;
    systemInfo.govToken = GovTokenDemo;
    systemInfo.stabilityPoolManager = StabilityPoolManagerDemo;
  }

  systemInfo.timestamp = event.block.timestamp;
  systemInfo.stableCoin = stableCoin;

  systemInfo.save();
};

export const handleUpdateSystemInfo_govToken = (event: ethereum.Event, govToken: Address): void => {
  let systemInfo = SystemInfo.load(`SystemInfo`);

  if (systemInfo === null) {
    systemInfo = new SystemInfo(`SystemInfo`);
    systemInfo.storagePool = StoragePoolDemo;
    systemInfo.priceFeed = PriceFeedDemo;
    systemInfo.reservePool = ReservePoolDemo;
    systemInfo.stakingOps = StakingOperationsDemo;
    systemInfo.totalValueLockedUSDHistoryIndex = 0;
    systemInfo.totalValueMintedUSDHistoryIndex = 0;
    systemInfo.reservePoolUSDHistoryIndex = 0;
    systemInfo.stableCoin = StableDemo;
    systemInfo.stabilityPoolManager = StabilityPoolManagerDemo;
  }

  systemInfo.timestamp = event.block.timestamp;
  systemInfo.govToken = govToken;

  systemInfo.save();
};

export const handleUpdateSystemInfo_storagePool = (event: ethereum.Event, storagePool: Address): void => {
  let systemInfo = SystemInfo.load(`SystemInfo`);

  if (systemInfo === null) {
    systemInfo = new SystemInfo(`SystemInfo`);
    systemInfo.stableCoin = StableDemo;
    systemInfo.priceFeed = PriceFeedDemo;
    systemInfo.reservePool = ReservePoolDemo;
    systemInfo.stakingOps = StakingOperationsDemo;
    systemInfo.totalValueLockedUSDHistoryIndex = 0;
    systemInfo.totalValueMintedUSDHistoryIndex = 0;
    systemInfo.reservePoolUSDHistoryIndex = 0;
    systemInfo.govToken = GovTokenDemo;
    systemInfo.stabilityPoolManager = StabilityPoolManagerDemo;
  }

  systemInfo.timestamp = event.block.timestamp;
  systemInfo.storagePool = storagePool;

  systemInfo.save();
};

export const handleUpdateSystemInfo_priceFeed = (event: ethereum.Event, priceFeed: Address): void => {
  let systemInfo = SystemInfo.load(`SystemInfo`);

  if (systemInfo === null) {
    systemInfo = new SystemInfo(`SystemInfo`);
    systemInfo.stableCoin = StableDemo;
    systemInfo.storagePool = StoragePoolDemo;
    systemInfo.reservePool = ReservePoolDemo;
    systemInfo.stakingOps = StakingOperationsDemo;
    systemInfo.totalValueLockedUSDHistoryIndex = 0;
    systemInfo.totalValueMintedUSDHistoryIndex = 0;
    systemInfo.reservePoolUSDHistoryIndex = 0;
    systemInfo.govToken = GovTokenDemo;
    systemInfo.stabilityPoolManager = StabilityPoolManagerDemo;
  }

  systemInfo.timestamp = event.block.timestamp;
  systemInfo.priceFeed = priceFeed;

  systemInfo.save();
};

export const handleUpdateSystemInfo_stakingOps = (event: ethereum.Event, stakingOps: Address): void => {
  let systemInfo = SystemInfo.load(`SystemInfo`);

  if (systemInfo === null) {
    systemInfo = new SystemInfo(`SystemInfo`);
    systemInfo.stableCoin = StableDemo;
    systemInfo.storagePool = StoragePoolDemo;
    systemInfo.reservePool = ReservePoolDemo;
    systemInfo.totalValueLockedUSDHistoryIndex = 0;
    systemInfo.totalValueMintedUSDHistoryIndex = 0;
    systemInfo.reservePoolUSDHistoryIndex = 0;
    systemInfo.govToken = GovTokenDemo;
    systemInfo.priceFeed = PriceFeedDemo;
    systemInfo.stabilityPoolManager = StabilityPoolManagerDemo;
  }

  systemInfo.stakingOps = stakingOps;
  systemInfo.timestamp = event.block.timestamp;

  systemInfo.save();
};

export const handleUpdateSystemInfo_reservePool = (event: ethereum.Event, reservePool: Address): void => {
  let systemInfo = SystemInfo.load(`SystemInfo`);

  if (systemInfo === null) {
    systemInfo = new SystemInfo(`SystemInfo`);
    systemInfo.stableCoin = StableDemo;
    systemInfo.storagePool = StoragePoolDemo;
    systemInfo.priceFeed = PriceFeedDemo;
    systemInfo.stakingOps = StakingOperationsDemo;
    systemInfo.totalValueLockedUSDHistoryIndex = 0;
    systemInfo.totalValueMintedUSDHistoryIndex = 0;
    systemInfo.reservePoolUSDHistoryIndex = 0;
    systemInfo.govToken = GovTokenDemo;
    systemInfo.stabilityPoolManager = StabilityPoolManagerDemo;
  }

  systemInfo.timestamp = event.block.timestamp;
  systemInfo.reservePool = reservePool;

  systemInfo.save();
};

export const handleUpdateSystemInfo_stabilityPoolManager = (
  event: ethereum.Event,
  stabilityPoolManager: Address,
): void => {
  let systemInfo = SystemInfo.load(`SystemInfo`);

  if (systemInfo === null) {
    systemInfo = new SystemInfo(`SystemInfo`);
    systemInfo.stableCoin = StableDemo;
    systemInfo.storagePool = StoragePoolDemo;
    systemInfo.priceFeed = PriceFeedDemo;
    systemInfo.reservePool = ReservePoolDemo;
    systemInfo.stakingOps = StakingOperationsDemo;
    systemInfo.totalValueLockedUSDHistoryIndex = 0;
    systemInfo.totalValueMintedUSDHistoryIndex = 0;
    systemInfo.reservePoolUSDHistoryIndex = 0;
    systemInfo.govToken = GovTokenDemo;
  }

  systemInfo.timestamp = event.block.timestamp;
  systemInfo.stabilityPoolManager = stabilityPoolManager;

  systemInfo.save();
};
