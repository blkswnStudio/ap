import { Address } from '@graphprotocol/graph-ts';
import {
  ReservePool,
  ReservePoolInitialized as ReservePoolInitializedEvent,
  WithdrewReserves as WithdrewReservesEvent,
} from '../generated/ReservePool/ReservePool';
import { SystemInfo } from '../generated/schema';
import { DebtToken } from '../generated/templates/DebtTokenTemplate/DebtToken';
import {
  handleCreateUpdateCollateralTokenMeta,
  handleUpdateCollateralTokenMeta_totalReserve30dAverage,
} from './entities/collateral-token-meta-entity';
import {
  handleCreateUpdateDebtTokenMeta,
  handleUpdateDebtTokenMeta_totalReserve30dAverage,
} from './entities/debt-token-meta-entity';
import { handleCreateReservePoolUSDHistoryChunk } from './entities/reserve-pool-USD-history-chunk-entity';
import { handleUpdateSystemInfo_reservePool } from './entities/system-info-entity';

export function handleReservePoolInitialized(event: ReservePoolInitializedEvent): void {
  handleUpdateSystemInfo_reservePool(event, event.address);
}

export function handleWithdrewReserves(event: WithdrewReservesEvent): void {
  const systemInfo = SystemInfo.load(`SystemInfo`)!;
  const stableCoin = Address.fromBytes(systemInfo.stableCoin);
  const govToken = Address.fromBytes(systemInfo.govToken);
  const reservePoolAddress = Address.fromBytes(systemInfo.reservePool);

  const totalReserveStable = DebtToken.bind(stableCoin).balanceOf(reservePoolAddress);
  handleCreateUpdateDebtTokenMeta(event, stableCoin, totalReserveStable);
  handleUpdateDebtTokenMeta_totalReserve30dAverage(event, stableCoin, totalReserveStable);

  const totalReserveGov = ReservePool.bind(reservePoolAddress).govReserveCap();
  handleCreateUpdateCollateralTokenMeta(event, govToken, totalReserveGov);
  handleUpdateCollateralTokenMeta_totalReserve30dAverage(event, govToken, totalReserveGov);

  handleCreateReservePoolUSDHistoryChunk(event, totalReserveGov, totalReserveStable);
}
