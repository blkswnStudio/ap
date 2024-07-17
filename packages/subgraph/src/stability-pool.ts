import { Address, BigInt } from '@graphprotocol/graph-ts';
import {
  StabilityGainsWithdrawn as StabilityGainsWithdrawnEvent,
  StabilityOffset as StabilityOffsetEvent,
  StabilityPool,
  StabilityProvided as StabilityProvidedEvent,
  StabilityWithdrawn as StabilityWithdrawnEvent,
} from '../generated/templates/StabilityPoolTemplate/StabilityPool';
import { handleCreateBorrowerHistory } from './entities/borrower-history-entity';
import {
  handleCreateUpdateDebtTokenMeta,
  handleUpdateDebtTokenMeta_stabilityDepositAPY,
} from './entities/debt-token-meta-entity';
// import { log } from '@graphprotocol/graph-ts';

export function handleStabilityGainsWithdrawn(event: StabilityGainsWithdrawnEvent): void {
  const stabilityPoolContract = StabilityPool.bind(event.address);
  const depositToken = stabilityPoolContract.depositToken();

  const collGainAddresses: Address[] = [];
  const collGainAmounts: BigInt[] = [];
  for (let i = 0; i < event.params.gainsWithdrawn.length; i++) {
    const address = event.params.gainsWithdrawn[i].tokenAddress;
    collGainAddresses.push(address);
    const amount = event.params.gainsWithdrawn[i].amount;
    collGainAmounts.push(amount);
  }

  handleCreateBorrowerHistory(
    event,
    event.address,
    event.params.user,
    'CLAIMED_REWARDS',
    [depositToken],
    [event.params.depositLost],
    collGainAddresses,
    collGainAmounts,
  );
}

export function handleStabilityOffset(event: StabilityOffsetEvent): void {
  const stabilityPoolContract = StabilityPool.bind(event.address);
  const depositToken = stabilityPoolContract.depositToken();
  // totalDepositedStability changed
  handleCreateUpdateDebtTokenMeta(event, depositToken);

  handleUpdateDebtTokenMeta_stabilityDepositAPY(
    event,
    depositToken,
    event.params.removedDeposit,
    event.params.addedGains,
  );
}

export function handleStabilityProvided(event: StabilityProvidedEvent): void {
  const stabilityPoolContract = StabilityPool.bind(event.address);
  const depositToken = stabilityPoolContract.depositToken();

  // totalDepositedStability changed
  handleCreateUpdateDebtTokenMeta(event, depositToken);
  handleCreateBorrowerHistory(
    event,
    event.address,
    event.params.user,
    'DEPOSITED',
    [],
    [],
    [depositToken],
    [event.params.amount],
  );
}

export function handleStabilityWithdrawn(event: StabilityWithdrawnEvent): void {
  const stabilityPoolContract = StabilityPool.bind(event.address);
  const depositToken = stabilityPoolContract.depositToken();

  // totalDepositedStability changed
  handleCreateUpdateDebtTokenMeta(event, depositToken);

  handleCreateBorrowerHistory(
    event,
    event.address,
    event.params.user,
    'WITHDRAWN',
    [depositToken],
    [event.params.amount],
    [],
    [],
  );
}
