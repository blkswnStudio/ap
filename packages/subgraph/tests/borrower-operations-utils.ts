import { Address, ethereum } from '@graphprotocol/graph-ts';
import { newMockEvent } from 'matchstick-as';
import { TroveCreated } from '../generated/BorrowerOperations/BorrowerOperations';

export function createTroveCreatedEvent(_borrower: Address, _colls: Array<ethereum.Tuple>): TroveCreated {
  let troveCreatedEvent = changetype<TroveCreated>(newMockEvent());

  troveCreatedEvent.parameters = new Array();

  troveCreatedEvent.parameters.push(new ethereum.EventParam('_borrower', ethereum.Value.fromAddress(_borrower)));
  troveCreatedEvent.parameters.push(new ethereum.EventParam('_colls', ethereum.Value.fromTupleArray(_colls)));

  return troveCreatedEvent;
}
