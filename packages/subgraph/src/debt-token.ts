import { Transfer as TransferEvent } from '../generated/templates/DebtTokenTemplate/DebtToken';
import {
  handleCreateUpdateDebtTokenMeta,
  handleUpdateDebtTokenMeta_totalSupplyUSD30dAverage,
} from './entities/debt-token-meta-entity';

export function handleTransfer(event: TransferEvent): void {
  // Because totalSupplyUSD has changed on mint and burn
  handleCreateUpdateDebtTokenMeta(event, event.address);
  handleUpdateDebtTokenMeta_totalSupplyUSD30dAverage(event, event.address);
}
