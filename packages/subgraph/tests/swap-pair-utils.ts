import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { createMockedFunction, newMockEvent } from 'matchstick-as';
import { Burn, Mint, Swap, Sync, Transfer } from '../generated/templates/SwapPairTemplate/SwapPair';
import { oneEther } from '../src/entities/token-candle-entity';
import { MockDebtTokenAddress, MockDebtToken_STABLE_Address, MockSwapPair_STABLE_MockDebtToken_Address } from './utils';

export const mockSwapPair_getReserves = (
  pair: Address = MockSwapPair_STABLE_MockDebtToken_Address,
  reserve0: BigInt = oneEther,
  reserve1: BigInt = oneEther,
  blockLastTimestamp: BigInt = BigInt.fromI32(1),
): void => {
  createMockedFunction(pair, 'getReserves', 'getReserves():(uint112,uint112,uint32)').returns([
    ethereum.Value.fromSignedBigInt(reserve0),
    ethereum.Value.fromSignedBigInt(reserve1),
    ethereum.Value.fromSignedBigInt(blockLastTimestamp),
  ]);
};
export const mockSwapPair_totalSupply = (
  pair: Address = MockSwapPair_STABLE_MockDebtToken_Address,
  value: BigInt = oneEther,
): void => {
  createMockedFunction(pair, 'totalSupply', 'totalSupply():(uint256)').returns([
    ethereum.Value.fromSignedBigInt(value),
  ]);
};
export const mockSwapPair_token0 = (
  pair: Address = MockSwapPair_STABLE_MockDebtToken_Address,
  token: Address = MockDebtToken_STABLE_Address,
): void => {
  createMockedFunction(pair, 'token0', 'token0():(address)').returns([ethereum.Value.fromAddress(token)]);
};
export const mockSwapPair_token1 = (
  pair: Address = MockSwapPair_STABLE_MockDebtToken_Address,
  token: Address = MockDebtTokenAddress,
): void => {
  createMockedFunction(pair, 'token1', 'token1():(address)').returns([ethereum.Value.fromAddress(token)]);
};

export function createBurnEvent(sender: Address, amount0: BigInt, amount1: BigInt, to: Address): Burn {
  let burnEvent = changetype<Burn>(newMockEvent());

  burnEvent.address = MockSwapPair_STABLE_MockDebtToken_Address;

  burnEvent.parameters = new Array();

  burnEvent.parameters.push(new ethereum.EventParam('sender', ethereum.Value.fromAddress(sender)));
  burnEvent.parameters.push(new ethereum.EventParam('amount0', ethereum.Value.fromSignedBigInt(amount0)));
  burnEvent.parameters.push(new ethereum.EventParam('amount1', ethereum.Value.fromSignedBigInt(amount1)));
  burnEvent.parameters.push(new ethereum.EventParam('to', ethereum.Value.fromAddress(to)));

  return burnEvent;
}

export function createMintEvent(sender: Address, amount0: BigInt, amount1: BigInt): Mint {
  let mintEvent = changetype<Mint>(newMockEvent());

  mintEvent.address = MockSwapPair_STABLE_MockDebtToken_Address;

  mintEvent.parameters = new Array();

  mintEvent.parameters.push(new ethereum.EventParam('sender', ethereum.Value.fromAddress(sender)));
  mintEvent.parameters.push(new ethereum.EventParam('amount0', ethereum.Value.fromSignedBigInt(amount0)));
  mintEvent.parameters.push(new ethereum.EventParam('amount1', ethereum.Value.fromSignedBigInt(amount1)));

  return mintEvent;
}

export function createSwapEvent(
  sender: Address,
  amount0In: BigInt,
  amount1In: BigInt,
  amount0Out: BigInt,
  amount1Out: BigInt,
  amount0InFee: BigInt,
  amount1InFee: BigInt,
  to: Address,
): Swap {
  let swapEvent = changetype<Swap>(newMockEvent());

  swapEvent.address = MockSwapPair_STABLE_MockDebtToken_Address;

  swapEvent.parameters = new Array();

  swapEvent.parameters.push(new ethereum.EventParam('sender', ethereum.Value.fromAddress(sender)));
  swapEvent.parameters.push(new ethereum.EventParam('amount0In', ethereum.Value.fromSignedBigInt(amount0In)));
  swapEvent.parameters.push(new ethereum.EventParam('amount1In', ethereum.Value.fromSignedBigInt(amount1In)));
  swapEvent.parameters.push(new ethereum.EventParam('amount0Out', ethereum.Value.fromSignedBigInt(amount0Out)));
  swapEvent.parameters.push(new ethereum.EventParam('amount1Out', ethereum.Value.fromSignedBigInt(amount1Out)));
  swapEvent.parameters.push(new ethereum.EventParam('amount0InFee', ethereum.Value.fromSignedBigInt(amount0InFee)));
  swapEvent.parameters.push(new ethereum.EventParam('amount1InFee', ethereum.Value.fromSignedBigInt(amount1InFee)));
  swapEvent.parameters.push(new ethereum.EventParam('to', ethereum.Value.fromAddress(to)));

  return swapEvent;
}

export function createSyncEvent(reserve0: BigInt, reserve1: BigInt): Sync {
  let syncEvent = changetype<Sync>(newMockEvent());

  syncEvent.address = MockSwapPair_STABLE_MockDebtToken_Address;

  syncEvent.parameters = new Array();

  syncEvent.parameters.push(new ethereum.EventParam('reserve0', ethereum.Value.fromSignedBigInt(reserve0)));
  syncEvent.parameters.push(new ethereum.EventParam('reserve1', ethereum.Value.fromSignedBigInt(reserve1)));

  return syncEvent;
}

export function createTransferEvent(from: Address, to: Address, value: BigInt): Transfer {
  let transferEvent = changetype<Transfer>(newMockEvent());

  transferEvent.address = MockSwapPair_STABLE_MockDebtToken_Address;

  transferEvent.parameters = new Array();

  transferEvent.parameters.push(new ethereum.EventParam('from', ethereum.Value.fromAddress(from)));
  transferEvent.parameters.push(new ethereum.EventParam('to', ethereum.Value.fromAddress(to)));
  transferEvent.parameters.push(new ethereum.EventParam('value', ethereum.Value.fromSignedBigInt(value)));

  return transferEvent;
}
