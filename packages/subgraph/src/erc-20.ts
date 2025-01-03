import { Address } from '@graphprotocol/graph-ts';
import { TokenManager } from '../generated/TokenManager/TokenManager';
import { SystemInfo } from '../generated/schema';
import { Transfer as TransferEvent } from '../generated/templates/ERC20Template/ERC20';
import { handleUpdateTradingUserPosition_onTransfer } from './entities/trading-user-stats';

export function handleTransfer(event: TransferEvent): void {
  const systemInfo = SystemInfo.load(`SystemInfo`)!;
  const tokenManager = TokenManager.bind(Address.fromBytes(systemInfo.tokenManager));

  // only call for non-debt tokens, as debt tokens will already be handled
  if (!tokenManager.isDebtToken(event.address))
    handleUpdateTradingUserPosition_onTransfer(
      event,
      event.address,
      event.params.from,
      event.params.to,
      event.params.value,
    );
}
