import { Address, BigInt } from '@graphprotocol/graph-ts';
import { SystemInfo } from '../generated/schema';

export const oneEther = BigInt.fromI64(1000000000000000000);
export const secondsToYear = BigInt.fromI64(60 * 60 * 24 * 365);

// FIXME: Exchange for sensible defaults
const PriceFeedDemo = Address.fromString('0xb7f8bc63bbcad18155201308c8f3540b07f84f5e');
// const StoragePoolDemo = Address.fromString('0xa513E6E4b8f2a923D98304ec87F64353C4D5C853');
// FIXME: This was set to the default lokal deployment address. Maybe because the storage pool was deployed on the same block
const StoragePoolDemo = Address.fromString('0x0fC26941200010034Df51C78F6142604a3788F49');
const StableDemo = Address.fromString('0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1');
const ReservePoolDemo = Address.fromString('0x8A791620dd6260079BF849Dc5567aDC3F2FdC318');
const GovTokenDemo = Address.fromString('0x9A9f2CCfdE556A7E9Ff0848998Aa4a0CFD8863AE');
const StakingOperationsDemo = Address.fromString('0x9A676e781A523b5d0C0e43731313A708CB607508');
const TokenManagerDemo = Address.fromString('0x9A676e781A523b5d0C0e43731313A708CB607508');

export function initializeSystemInfo(): SystemInfo {
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
    systemInfo.tokenManager = TokenManagerDemo;
  }
  return systemInfo;
}

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
