import { Address, ethereum } from '@graphprotocol/graph-ts';
import { initializeSystemInfo } from '../utils';

export const handleUpdateSystemInfo_stableCoin = (event: ethereum.Event, stableCoin: Address): void => {
  let systemInfo = initializeSystemInfo();
  systemInfo.timestamp = event.block.timestamp;
  systemInfo.stableCoin = stableCoin;
  systemInfo.save();
};

export const handleUpdateSystemInfo_govToken = (event: ethereum.Event, govToken: Address): void => {
  let systemInfo = initializeSystemInfo();
  systemInfo.timestamp = event.block.timestamp;
  systemInfo.govToken = govToken;
  systemInfo.save();
};

export const handleUpdateSystemInfo_storagePool = (event: ethereum.Event, storagePool: Address): void => {
  let systemInfo = initializeSystemInfo();
  systemInfo.timestamp = event.block.timestamp;
  systemInfo.storagePool = storagePool;
  systemInfo.save();
};

export const handleUpdateSystemInfo_priceFeed = (event: ethereum.Event, priceFeed: Address): void => {
  let systemInfo = initializeSystemInfo();
  systemInfo.timestamp = event.block.timestamp;
  systemInfo.priceFeed = priceFeed;
  systemInfo.save();
};

export const handleUpdateSystemInfo_stakingOps = (event: ethereum.Event, stakingOps: Address): void => {
  let systemInfo = initializeSystemInfo();
  systemInfo.stakingOps = stakingOps;
  systemInfo.timestamp = event.block.timestamp;
  systemInfo.save();
};

export const handleUpdateSystemInfo_reservePool = (event: ethereum.Event, reservePool: Address): void => {
  let systemInfo = initializeSystemInfo();
  systemInfo.timestamp = event.block.timestamp;
  systemInfo.reservePool = reservePool;
  systemInfo.save();
};

export const handleUpdateSystemInfo_tokenManager = (event: ethereum.Event, tokenManager: Address): void => {
  let systemInfo = initializeSystemInfo();
  systemInfo.timestamp = event.block.timestamp;
  systemInfo.tokenManager = tokenManager;
  systemInfo.save();
};
