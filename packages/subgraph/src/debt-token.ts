import { Transfer as TransferEvent } from '../generated/templates/DebtTokenTemplate/DebtToken';
import {
  handleCreateUpdateDebtTokenMeta,
  handleUpdateDebtTokenMeta_totalSupplyUSD30dAverage,
} from './entities/debt-token-meta-entity';

import { handleUpdateTradingUserPosition_onTransfer } from './entities/trading-user-stats';

export function handleTransfer(event: TransferEvent): void {
  // Because totalSupplyUSD has changed on mint and burn
  handleCreateUpdateDebtTokenMeta(event, event.address);
  handleUpdateDebtTokenMeta_totalSupplyUSD30dAverage(event, event.address);
  handleUpdateTradingUserPosition_onTransfer(
    event,
    event.address,
    event.params.from,
    event.params.to,
    event.params.value,
  );
}
