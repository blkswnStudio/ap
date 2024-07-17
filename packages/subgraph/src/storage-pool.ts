import {
  StoragePoolInitialized as StoragePoolInitializedEvent,
  StoragePoolValueUpdated as StoragePoolValueUpdatedEvent,
} from '../generated/StoragePool/StoragePool';
import { handleUpdateSystemInfo_storagePool } from './entities/system-info-entity';
import { handleCreateTotalValueLockedUSDHistoryChunk } from './entities/total-value-locked-USD-history-chunk-entity';
import { handleCreateTotalValueMintedUSDHistoryChunk } from './entities/total-value-minted-USD-history-chunk-entity';

export function handleStoragePoolInitialized(event: StoragePoolInitializedEvent): void {
  handleUpdateSystemInfo_storagePool(event, event.address);
}

export function handleStoragePoolValueUpdated(event: StoragePoolValueUpdatedEvent): void {
  // TODO: Could be optimized for tokenAddress if need be.
  handleCreateTotalValueMintedUSDHistoryChunk(event);
  handleCreateTotalValueLockedUSDHistoryChunk(event);
}
