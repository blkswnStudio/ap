import { Address, BigInt, ethereum, log } from '@graphprotocol/graph-ts';
import { StoragePool } from '../../generated/StoragePool/StoragePool';
import { SystemInfo, TotalValueLockedUSDHistoryChunk } from '../../generated/schema';

const chunkSize = BigInt.fromI32(24 * 60 * 60); // 24 hours in seconds

export function handleCreateTotalValueLockedUSDHistoryChunk(event: ethereum.Event): void {
  const systemInfo = SystemInfo.load(`SystemInfo`)!;

  const currentIndex = systemInfo.totalValueLockedUSDHistoryIndex;

  let lastChunk = TotalValueLockedUSDHistoryChunk.load(`TotalValueLockedUSDHistoryChunk-${currentIndex.toString()}`);

  const storagePoolContract = StoragePool.bind(Address.fromBytes(systemInfo.storagePool));
  const try_systemTVL = storagePoolContract.try_checkRecoveryMode1();

  if (try_systemTVL.reverted) {
    log.warning('REVERTED handleCreateTotalValueLockedUSDHistoryChunk: {}, {}', [
      try_systemTVL.reverted.toString(),
      event.block.number.toString(),
    ]);
  }

  const systemTVL = try_systemTVL.reverted ? BigInt.fromI32(0) : try_systemTVL.value.getEntireSystemColl();

  if (lastChunk === null) {
    lastChunk = new TotalValueLockedUSDHistoryChunk(`TotalValueLockedUSDHistoryChunk-0`);
    lastChunk.timestamp = event.block.timestamp;
    lastChunk.size = chunkSize.toI32();
    lastChunk.value = systemTVL;
    lastChunk.save();
  } else {
    // check if last chunk is older that 1d
    if (lastChunk.timestamp.plus(chunkSize) < event.block.timestamp) {
      // FIXME: We disregard that we have to fill up complete chunk in between because the size is 24h

      // create new chunk and update index
      const newChunk = new TotalValueLockedUSDHistoryChunk(`TotalValueLockedUSDHistoryChunk-${currentIndex + 1}`);
      systemInfo.totalValueLockedUSDHistoryIndex = currentIndex + 1;
      systemInfo.save();

      newChunk.timestamp = lastChunk.timestamp.plus(chunkSize);
      newChunk.size = chunkSize.toI32();
      newChunk.value = systemTVL;
      newChunk.save();
    } else if (lastChunk.value < systemTVL) {
      // update tvl

      lastChunk.value = systemTVL;
      lastChunk.save();
    }
  }
}
