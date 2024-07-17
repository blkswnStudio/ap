import { Address } from '@graphprotocol/graph-ts';
import { ReservePool } from '../generated/ReservePool/ReservePool';
import {
  PaidBorrowingFee as PaidBorrowingFeeEvent,
  TroveCollChanged as TroveCollChangedEvent,
} from '../generated/TroveManager/TroveManager';
import { SystemInfo } from '../generated/schema';
import { DebtToken } from '../generated/templates/DebtTokenTemplate/DebtToken';
import {
  handleCreateUpdateCollateralTokenMeta,
  handleUpdateCollateralTokenMeta_totalReserve30dAverage,
  handleUpdateCollateralTokenMeta_totalValueLockedUSD30dAverage,
} from './entities/collateral-token-meta-entity';
import {
  handleCreateUpdateDebtTokenMeta,
  handleUpdateDebtTokenMeta_totalReserve30dAverage,
} from './entities/debt-token-meta-entity';
import { handleCreateReservePoolUSDHistoryChunk } from './entities/reserve-pool-USD-history-chunk-entity';
// import { log } from '@graphprotocol/graph-ts';
import { ZERO_ADDRESS } from './utils';

export function handleCollChanged(event: TroveCollChangedEvent): void {
  for (let i = 0; i < event.params._collTokenAmounts.length; i++) {
    const tokenAddress = event.params._collTokenAmounts[i].tokenAddress;
    // TODO: Loop over troves from the troveManager to get totalValueLockedUSD for any single collToken
    if (tokenAddress.toHexString() != ZERO_ADDRESS) {
      handleCreateUpdateCollateralTokenMeta(event, tokenAddress);
      handleUpdateCollateralTokenMeta_totalValueLockedUSD30dAverage(event, tokenAddress);
    }
  }
}

export function handlePaidBorrowingFee(event: PaidBorrowingFeeEvent): void {
  const systemInfo = SystemInfo.load(`SystemInfo`)!;
  const stableCoin = Address.fromBytes(systemInfo.stableCoin);
  const govToken = Address.fromBytes(systemInfo.govToken);
  const reservePoolAddress = Address.fromBytes(systemInfo.reservePool);

  const totalReserveStable = DebtToken.bind(stableCoin).balanceOf(reservePoolAddress);
  handleCreateUpdateDebtTokenMeta(event, stableCoin);
  handleUpdateDebtTokenMeta_totalReserve30dAverage(event, stableCoin, totalReserveStable);

  const totalReserveGov = ReservePool.bind(reservePoolAddress).govReserveCap();
  handleCreateUpdateCollateralTokenMeta(event, govToken, totalReserveGov);
  handleUpdateCollateralTokenMeta_totalReserve30dAverage(event, govToken, totalReserveGov);

  handleCreateReservePoolUSDHistoryChunk(event, totalReserveGov, totalReserveStable);
}
