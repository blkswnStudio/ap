import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { createMockedFunction, newMockEvent } from 'matchstick-as';
import { Transfer } from '../generated/templates/DebtTokenTemplate/DebtToken';
import { oneEther } from '../src/entities/token-candle-entity';
import { MockDebtTokenAddress, MockReservePoolAddress, MockStabilityPoolManagerAddress } from './utils';

// TODO: Remove me later. This is how to log in AssemblyScript
// import { Address, BigInt, Bytes, ethereum, log } from '@graphprotocol/graph-ts';
// log.info('My value is: {}', [newProvidedStablitySinceLastCollClaim!.toString()]);

export const mockDebtToken_stabilityPoolManagerAddress = (): void => {
  createMockedFunction(
    MockDebtTokenAddress,
    'stabilityPoolManagerAddress',
    'stabilityPoolManagerAddress():(address)',
  ).returns([ethereum.Value.fromAddress(MockStabilityPoolManagerAddress)]);
};
export const mockDebtToken_totalSupply = (
  tokenAddress: Address = MockDebtTokenAddress,
  amount: BigInt = oneEther.times(BigInt.fromI32(100)),
): void => {
  createMockedFunction(tokenAddress, 'totalSupply', 'totalSupply():(uint256)').returns([
    ethereum.Value.fromSignedBigInt(amount),
  ]);
};
export const mockDebtToken_symbol = (address: Address = MockDebtTokenAddress, symbol: string = 'JUSD'): void => {
  createMockedFunction(address, 'symbol', 'symbol():(string)').returns([ethereum.Value.fromString(symbol)]);
};
export const mockDebtToken_decimals = (address: Address = MockDebtTokenAddress): void => {
  createMockedFunction(address, 'decimals', 'decimals():(uint8)').returns([ethereum.Value.fromI32(18)]);
};
export const mockToken_balanceOf = (
  tokenAddress: Address = MockDebtTokenAddress,
  owner: Address = MockReservePoolAddress,
  value: BigInt = oneEther,
): void => {
  createMockedFunction(tokenAddress, 'balanceOf', 'balanceOf(address):(uint256)')
    .withArgs([ethereum.Value.fromAddress(owner)])
    .returns([ethereum.Value.fromUnsignedBigInt(value)]);
};

export function createTransferEvent(
  from: Address,
  to: Address,
  value: BigInt,
  address: Address = MockDebtTokenAddress,
): Transfer {
  let transferEvent = changetype<Transfer>(newMockEvent());

  transferEvent.address = address;

  transferEvent.parameters = new Array();

  transferEvent.parameters.push(new ethereum.EventParam('from', ethereum.Value.fromAddress(from)));
  transferEvent.parameters.push(new ethereum.EventParam('to', ethereum.Value.fromAddress(to)));
  transferEvent.parameters.push(new ethereum.EventParam('value', ethereum.Value.fromSignedBigInt(value)));

  return transferEvent;
}
