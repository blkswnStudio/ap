import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { newMockEvent } from 'matchstick-as';
import { PaidBorrowingFee, TroveCollChanged } from '../generated/TroveManager/TroveManager';
import { oneEther } from '../src/entities/token-candle-entity';
import { MockTroveManagerAddress, MockUserAddress } from './utils';

export function createCollChangedEvent(_borrower: Address, _collTokenAddresses: Address[]): TroveCollChanged {
  let collChangedEvent = changetype<TroveCollChanged>(newMockEvent());
  collChangedEvent.address = MockTroveManagerAddress;

  collChangedEvent.parameters = new Array();

  collChangedEvent.parameters.push(new ethereum.EventParam('_borrower', ethereum.Value.fromAddress(_borrower)));
  collChangedEvent.parameters.push(
    new ethereum.EventParam('_collTokenAddresses', ethereum.Value.fromAddressArray(_collTokenAddresses)),
  );

  return collChangedEvent;
}

export function createPaidBorrowingFeeEvent(
  _borrower: Address = MockUserAddress,
  _reserve: BigInt = oneEther,
  _gov: BigInt = oneEther,
): PaidBorrowingFee {
  let paidBorrowingFeeEvent = changetype<PaidBorrowingFee>(newMockEvent());

  paidBorrowingFeeEvent.address = MockTroveManagerAddress;

  paidBorrowingFeeEvent.parameters = new Array();

  paidBorrowingFeeEvent.parameters.push(new ethereum.EventParam('_borrower', ethereum.Value.fromAddress(_borrower)));
  paidBorrowingFeeEvent.parameters.push(
    new ethereum.EventParam('_reserve', ethereum.Value.fromUnsignedBigInt(_reserve)),
  );
  paidBorrowingFeeEvent.parameters.push(new ethereum.EventParam('_gov', ethereum.Value.fromUnsignedBigInt(_gov)));

  return paidBorrowingFeeEvent;
}
