import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { createMockedFunction, newMockEvent } from 'matchstick-as';
import {
  StabilityGainsWithdrawn,
  StabilityOffset,
  StabilityPoolInitialized,
  StabilityProvided,
  StabilityWithdrawn,
} from '../generated/templates/StabilityPoolTemplate/StabilityPool';
import { oneEther } from '../src/entities/token-candle-entity';
import {
  MockDebtTokenAddress,
  MockStabilityPoolAddress,
  MockStabilityPoolManagerAddress,
  MockUserAddress,
} from './utils';

export const mockStabilityPool_depositToken = (): void => {
  createMockedFunction(MockStabilityPoolAddress, 'depositToken', 'depositToken():(address)').returns([
    ethereum.Value.fromAddress(MockDebtTokenAddress),
  ]);
};
export const mockStabilityPool_getTotalDeposit = (): void => {
  createMockedFunction(MockStabilityPoolAddress, 'getTotalDeposit', 'getTotalDeposit():(uint256)').returns([
    ethereum.Value.fromSignedBigInt(oneEther.times(BigInt.fromI32(10))),
  ]);
};
export const mockStabilityPool_stabilityPoolManagerAddress = (): void => {
  createMockedFunction(
    MockStabilityPoolAddress,
    'stabilityPoolManagerAddress',
    'stabilityPoolManagerAddress():(address)',
  ).returns([ethereum.Value.fromAddress(MockStabilityPoolManagerAddress)]);
};
export const mockStabilityPool_deposits = (): void => {
  createMockedFunction(MockStabilityPoolAddress, 'deposits', 'deposits(address):(uint256)')
    .withArgs([ethereum.Value.fromAddress(MockUserAddress)])
    .returns([ethereum.Value.fromSignedBigInt(oneEther.times(BigInt.fromI32(10)))]);
};
export const mockStabilityPool_getCompoundedDebtDeposit = (): void => {
  createMockedFunction(
    MockStabilityPoolAddress,
    'getCompoundedDebtDeposit',
    'getCompoundedDebtDeposit(address):(uint256)',
  )
    .withArgs([ethereum.Value.fromAddress(MockUserAddress)])
    .returns([ethereum.Value.fromSignedBigInt(oneEther)]);
};

// EVENTS

export function createStabilityGainsWithdrawnEvent(
  user: Address,
  depositLost: BigInt,
  gainsWithdrawn: Array<ethereum.Tuple>,
): StabilityGainsWithdrawn {
  let stabilityGainsWithdrawnEvent = changetype<StabilityGainsWithdrawn>(newMockEvent());
  stabilityGainsWithdrawnEvent.address = MockStabilityPoolAddress;

  stabilityGainsWithdrawnEvent.parameters = new Array();

  stabilityGainsWithdrawnEvent.parameters.push(new ethereum.EventParam('user', ethereum.Value.fromAddress(user)));
  stabilityGainsWithdrawnEvent.parameters.push(
    new ethereum.EventParam('depositLost', ethereum.Value.fromSignedBigInt(depositLost)),
  );
  stabilityGainsWithdrawnEvent.parameters.push(
    new ethereum.EventParam('gainsWithdrawn', ethereum.Value.fromTupleArray(gainsWithdrawn)),
  );

  return stabilityGainsWithdrawnEvent;
}

export function createStabilityOffsetEvent(removedDeposit: BigInt, addedGains: Array<ethereum.Tuple>): StabilityOffset {
  let stabilityOffsetEvent = changetype<StabilityOffset>(newMockEvent());

  stabilityOffsetEvent.address = MockStabilityPoolAddress;
  stabilityOffsetEvent.parameters = new Array();

  stabilityOffsetEvent.parameters.push(
    new ethereum.EventParam('removedDeposit', ethereum.Value.fromSignedBigInt(removedDeposit)),
  );
  stabilityOffsetEvent.parameters.push(
    new ethereum.EventParam('addedGains', ethereum.Value.fromTupleArray(addedGains)),
  );

  return stabilityOffsetEvent;
}

export function createStabilityPoolInitializedEvent(
  stabilityPoolManagerAddress: Address,
  troveManagerAddress: Address,
  storagePoolAddress: Address,
  priceFeedAddress: Address,
  depositTokenAddress: Address,
): StabilityPoolInitialized {
  let stabilityPoolInitializedEvent = changetype<StabilityPoolInitialized>(newMockEvent());

  stabilityPoolInitializedEvent.parameters = new Array();

  stabilityPoolInitializedEvent.parameters.push(
    new ethereum.EventParam('stabilityPoolManagerAddress', ethereum.Value.fromAddress(stabilityPoolManagerAddress)),
  );
  stabilityPoolInitializedEvent.parameters.push(
    new ethereum.EventParam('troveManagerAddress', ethereum.Value.fromAddress(troveManagerAddress)),
  );
  stabilityPoolInitializedEvent.parameters.push(
    new ethereum.EventParam('storagePoolAddress', ethereum.Value.fromAddress(storagePoolAddress)),
  );
  stabilityPoolInitializedEvent.parameters.push(
    new ethereum.EventParam('priceFeedAddress', ethereum.Value.fromAddress(priceFeedAddress)),
  );
  stabilityPoolInitializedEvent.parameters.push(
    new ethereum.EventParam('depositTokenAddress', ethereum.Value.fromAddress(depositTokenAddress)),
  );

  return stabilityPoolInitializedEvent;
}

export function createStabilityProvidedEvent(user: Address, amount: BigInt): StabilityProvided {
  let stabilityProvidedEvent = changetype<StabilityProvided>(newMockEvent());

  stabilityProvidedEvent.address = MockStabilityPoolAddress;
  stabilityProvidedEvent.parameters = new Array();

  stabilityProvidedEvent.parameters.push(new ethereum.EventParam('user', ethereum.Value.fromAddress(user)));
  stabilityProvidedEvent.parameters.push(new ethereum.EventParam('amount', ethereum.Value.fromSignedBigInt(amount)));

  return stabilityProvidedEvent;
}

export function createStabilityWithdrawnEvent(user: Address, amount: BigInt): StabilityWithdrawn {
  let stabilityWithdrawnEvent = changetype<StabilityWithdrawn>(newMockEvent());

  stabilityWithdrawnEvent.address = MockStabilityPoolAddress;
  stabilityWithdrawnEvent.parameters = new Array();

  stabilityWithdrawnEvent.parameters.push(new ethereum.EventParam('user', ethereum.Value.fromAddress(user)));
  stabilityWithdrawnEvent.parameters.push(new ethereum.EventParam('amount', ethereum.Value.fromSignedBigInt(amount)));

  return stabilityWithdrawnEvent;
}
