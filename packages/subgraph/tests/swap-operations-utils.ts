import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { newMockEvent } from 'matchstick-as';
import { PairCreated } from '../generated/SwapOperations/SwapOperations';
import { oneEther } from '../src/entities/token-candle-entity';

export function createPairCreatedEvent(
  token0: Address,
  token1: Address,
  pair: Address,
  param3: BigInt = oneEther,
): PairCreated {
  let pairCreatedEvent = changetype<PairCreated>(newMockEvent());

  pairCreatedEvent.address = pair;

  pairCreatedEvent.parameters = new Array();

  pairCreatedEvent.parameters.push(new ethereum.EventParam('token0', ethereum.Value.fromAddress(token0)));
  pairCreatedEvent.parameters.push(new ethereum.EventParam('token1', ethereum.Value.fromAddress(token1)));
  pairCreatedEvent.parameters.push(new ethereum.EventParam('pair', ethereum.Value.fromAddress(pair)));
  pairCreatedEvent.parameters.push(new ethereum.EventParam('param3', ethereum.Value.fromSignedBigInt(param3)));

  return pairCreatedEvent;
}
