import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { createMockedFunction, newMockEvent } from 'matchstick-as';
import { ReserveCapChanged, ReservePoolInitialized, WithdrewReserves } from '../generated/ReservePool/ReservePool';
import { oneEther } from '../src/entities/token-candle-entity';
import { MockDebtTokenAddress, MockReservePoolAddress } from './utils';

export const mockReservePool_govReserveCap = (amount: BigInt = oneEther): void => {
  createMockedFunction(MockReservePoolAddress, 'govReserveCap', 'govReserveCap():(uint256)').returns([
    ethereum.Value.fromSignedBigInt(amount),
  ]);
};

export function createReserveCapChangedEvent(newReserveCap: BigInt, newGovReserveCap: BigInt): ReserveCapChanged {
  let reserveCapChangedEvent = changetype<ReserveCapChanged>(newMockEvent());

  reserveCapChangedEvent.address = MockReservePoolAddress;

  reserveCapChangedEvent.parameters = new Array();

  reserveCapChangedEvent.parameters.push(
    new ethereum.EventParam('newReserveCap', ethereum.Value.fromSignedBigInt(newReserveCap)),
  );
  reserveCapChangedEvent.parameters.push(
    new ethereum.EventParam('newGovReserveCap', ethereum.Value.fromSignedBigInt(newGovReserveCap)),
  );

  return reserveCapChangedEvent;
}

export function createReservePoolInitializedEvent(
  _stabilityPoolManager: Address,
  _priceFeed: Address,
  _stableDebtTokenAddress: Address,
  _govTokenAddress: Address,
): ReservePoolInitialized {
  let reservePoolInitializedEvent = changetype<ReservePoolInitialized>(newMockEvent());

  reservePoolInitializedEvent.address = MockDebtTokenAddress;

  reservePoolInitializedEvent.parameters = new Array();

  reservePoolInitializedEvent.parameters.push(
    new ethereum.EventParam('_stabilityPoolManager', ethereum.Value.fromAddress(_stabilityPoolManager)),
  );
  reservePoolInitializedEvent.parameters.push(
    new ethereum.EventParam('_priceFeed', ethereum.Value.fromAddress(_priceFeed)),
  );
  reservePoolInitializedEvent.parameters.push(
    new ethereum.EventParam('_stableDebtTokenAddress', ethereum.Value.fromAddress(_stableDebtTokenAddress)),
  );
  reservePoolInitializedEvent.parameters.push(
    new ethereum.EventParam('_govTokenAddress', ethereum.Value.fromAddress(_govTokenAddress)),
  );

  return reservePoolInitializedEvent;
}

export function createWithdrewReservesEvent(
  stableAmount: BigInt = oneEther,
  govAmount: BigInt = oneEther,
): WithdrewReserves {
  let withdrewReservesEvent = changetype<WithdrewReserves>(newMockEvent());

  withdrewReservesEvent.address = MockReservePoolAddress;

  withdrewReservesEvent.parameters = new Array();

  withdrewReservesEvent.parameters.push(
    new ethereum.EventParam('govAmount', ethereum.Value.fromSignedBigInt(govAmount)),
  );
  withdrewReservesEvent.parameters.push(
    new ethereum.EventParam('stableAmount', ethereum.Value.fromSignedBigInt(stableAmount)),
  );

  return withdrewReservesEvent;
}
