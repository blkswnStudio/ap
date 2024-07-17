import { Address, ethereum } from '@graphprotocol/graph-ts';
import { createMockedFunction, newMockEvent } from 'matchstick-as';
import {
  StabilityPoolAdded,
  StabilityPoolManagerInitiated,
} from '../generated/StabilityPoolManager/StabilityPoolManager';
import { MockDebtTokenAddress, MockStabilityPoolAddress, MockStabilityPoolManagerAddress } from './utils';

export const mockStabilityPoolManager_getStabilityPool = (tokenAddress: Address = MockDebtTokenAddress): void => {
  createMockedFunction(MockStabilityPoolManagerAddress, 'getStabilityPool', 'getStabilityPool(address):(address)')
    .withArgs([ethereum.Value.fromAddress(tokenAddress)])
    .returns([ethereum.Value.fromAddress(MockStabilityPoolAddress)]);
};

export function createStabilityPoolAddedEvent(stabilityPoolAddress: Address): StabilityPoolAdded {
  let stabilityPoolAddedEvent = changetype<StabilityPoolAdded>(newMockEvent());

  stabilityPoolAddedEvent.parameters = new Array();

  stabilityPoolAddedEvent.parameters.push(
    new ethereum.EventParam('stabilityPoolAddress', ethereum.Value.fromAddress(stabilityPoolAddress)),
  );

  return stabilityPoolAddedEvent;
}

export function createStabilityPoolManagerInitiatedEvent(
  troveManagerAddress: Address,
  storgePoolAddress: Address,
  debtTokenManagerAddress: Address,
  priceFeedAddress: Address,
): StabilityPoolManagerInitiated {
  let stabilityPoolManagerInitiatedEvent = changetype<StabilityPoolManagerInitiated>(newMockEvent());

  stabilityPoolManagerInitiatedEvent.address = MockDebtTokenAddress;

  stabilityPoolManagerInitiatedEvent.parameters = new Array();

  stabilityPoolManagerInitiatedEvent.parameters.push(
    new ethereum.EventParam('troveManagerAddress', ethereum.Value.fromAddress(troveManagerAddress)),
  );
  stabilityPoolManagerInitiatedEvent.parameters.push(
    new ethereum.EventParam('storgePoolAddress', ethereum.Value.fromAddress(storgePoolAddress)),
  );
  stabilityPoolManagerInitiatedEvent.parameters.push(
    new ethereum.EventParam('debtTokenManagerAddress', ethereum.Value.fromAddress(debtTokenManagerAddress)),
  );
  stabilityPoolManagerInitiatedEvent.parameters.push(
    new ethereum.EventParam('priceFeedAddress', ethereum.Value.fromAddress(priceFeedAddress)),
  );

  return stabilityPoolManagerInitiatedEvent;
}
