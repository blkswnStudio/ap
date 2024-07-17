import {
  CollTokenAdded as CollTokenAddedEvent,
  CollTokenSupportedCollateralRatioSet as CollTokenSupportedCollateralRatioSetEvent,
  DebtTokenAdded as DebtTokenAddedEvent,
  TokenManager,
} from '../generated/TokenManager/TokenManager';
import { DebtTokenTemplate, ERC20Template } from '../generated/templates';
import { handleCreateUpdateCollateralTokenMeta } from './entities/collateral-token-meta-entity';
import { handleCreateUpdateDebtTokenMeta } from './entities/debt-token-meta-entity';
import { handleUpdateSystemInfo_govToken, handleUpdateSystemInfo_stableCoin } from './entities/system-info-entity';
import { handleCreateToken } from './entities/token-entity';

export function handleCollTokenAdded(event: CollTokenAddedEvent): void {
  ERC20Template.create(event.params._tokenAddress);

  if (event.params._isGovToken) {
    handleUpdateSystemInfo_govToken(event, event.params._tokenAddress);
  }

  handleCreateToken(event, event.params._tokenAddress, false, event.params._oracleId);
  handleCreateUpdateCollateralTokenMeta(
    event,
    event.params._tokenAddress,
    null,
    event.params._supportedCollateralRatio,
  );
}

export function handleCollTokenSupportedCollateralRatioSet(event: CollTokenSupportedCollateralRatioSetEvent): void {
  handleCreateUpdateCollateralTokenMeta(
    event,
    event.params._collTokenAddress,
    null,
    event.params._supportedCollateralRatio,
  );
}

export function handleDebtTokenAdded(event: DebtTokenAddedEvent): void {
  DebtTokenTemplate.create(event.params._debtTokenAddress);
  const debtTokenManagerContract = TokenManager.bind(event.address);

  const stableCoin = debtTokenManagerContract.getStableCoin();
  if (event.params._debtTokenAddress == stableCoin) {
    handleUpdateSystemInfo_stableCoin(event, stableCoin);
  }

  handleCreateToken(event, event.params._debtTokenAddress, true, event.params._oracleId);
  handleCreateUpdateDebtTokenMeta(event, event.params._debtTokenAddress);
}
