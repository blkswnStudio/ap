import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { newMockEvent } from 'matchstick-as';
import { Transfer } from '../generated/templates/ERC20Template/ERC20';
import { MockCollToken_OTHER_Address } from './utils';

// TODO: Remove me later. This is how to log in AssemblyScript
// import { Address, BigInt, Bytes, ethereum, log } from '@graphprotocol/graph-ts';
// log.info('My value is: {}', [newProvidedStablitySinceLastCollClaim!.toString()]);

export function createTransferEvent(
  from: Address,
  to: Address,
  value: BigInt,
  address: Address = MockCollToken_OTHER_Address,
): Transfer {
  let transferEvent = changetype<Transfer>(newMockEvent());

  transferEvent.address = address;

  transferEvent.parameters = new Array();

  transferEvent.parameters.push(new ethereum.EventParam('from', ethereum.Value.fromAddress(from)));
  transferEvent.parameters.push(new ethereum.EventParam('to', ethereum.Value.fromAddress(to)));
  transferEvent.parameters.push(new ethereum.EventParam('value', ethereum.Value.fromSignedBigInt(value)));

  return transferEvent;
}
