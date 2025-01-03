import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { createMockedFunction, newMockEvent } from 'matchstick-as';
import { PriceFeedInitialized } from '../generated/PriceFeed/PriceFeed';
import { oneEther } from '../src/entities/token-candle-entity';
import { MockDebtTokenAddress, MockPriceFeedAddress } from './utils';

export const mockPriceFeed_getUSDValue = (
  tokenAddress: Address = MockDebtTokenAddress,
  amount: BigInt = oneEther,
): void => {
  createMockedFunction(MockPriceFeedAddress, 'getUSDValue', 'getUSDValue(address,uint256):(uint256)')
    .withArgs([ethereum.Value.fromAddress(tokenAddress), ethereum.Value.fromUnsignedBigInt(amount)])
    .returns([ethereum.Value.fromSignedBigInt(oneEther.times(amount).div(oneEther))]);
};

export const mockPriceFeed_getUSDValue_withPrice = (
  tokenAddress: Address = MockDebtTokenAddress,
  amount: BigInt = oneEther,
  price: BigInt = oneEther,
): void => {
  createMockedFunction(MockPriceFeedAddress, 'getUSDValue', 'getUSDValue(address,uint256):(uint256)')
    .withArgs([ethereum.Value.fromAddress(tokenAddress), ethereum.Value.fromUnsignedBigInt(amount)])
    .returns([ethereum.Value.fromSignedBigInt(price.times(amount).div(oneEther))]);
};

export const mockPriceFeed_getPrice = (
  tokenAddress: Address = MockDebtTokenAddress,
  value: BigInt = oneEther,
): void => {
  createMockedFunction(MockPriceFeedAddress, 'getPrice', 'getPrice(address):(uint256,bool,bool)')
    .withArgs([ethereum.Value.fromAddress(tokenAddress)])
    // This is how you mock an object value
    .returns([
      ethereum.Value.fromUnsignedBigInt(value),
      ethereum.Value.fromBoolean(true),
      ethereum.Value.fromBoolean(false),
    ]);
};

export function createPriceFeedInitializedEvent(
  tellorCallerAddress: Address,
  tokenManagerAddress: Address,
): PriceFeedInitialized {
  let priceFeedInitializedEvent = changetype<PriceFeedInitialized>(newMockEvent());

  priceFeedInitializedEvent.address = MockDebtTokenAddress;

  priceFeedInitializedEvent.parameters = new Array();

  priceFeedInitializedEvent.parameters.push(
    new ethereum.EventParam('tellorCallerAddress', ethereum.Value.fromAddress(tellorCallerAddress)),
  );
  priceFeedInitializedEvent.parameters.push(
    new ethereum.EventParam('tokenManagerAddress', ethereum.Value.fromAddress(tokenManagerAddress)),
  );

  return priceFeedInitializedEvent;
}
