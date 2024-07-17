import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts';
import { createMockedFunction, newMockEvent } from 'matchstick-as';
import { StoragePoolInitialized, StoragePoolValueUpdated } from '../generated/StoragePool/StoragePool';
import { oneEther } from '../src/entities/token-candle-entity';
import { MockDebtTokenAddress, MockStoragePoolAddress } from './utils';

export const mockStoragePool_getTokenTotalAmount = (
  tokenAddress: Address = MockDebtTokenAddress,
  value: BigInt = oneEther,
): void => {
  createMockedFunction(MockStoragePoolAddress, 'getTokenTotalAmount', 'getTokenTotalAmount(address,bool):(uint256)')
    .withArgs([ethereum.Value.fromAddress(tokenAddress), ethereum.Value.fromBoolean(true)])
    .returns([ethereum.Value.fromSignedBigInt(value)]);
};
export const mockStoragePool_checkRecoveryMode = (
  isInRecoveryMode: boolean = false,
  TCR: BigInt = oneEther,
  entireSystemColl: BigInt = oneEther.times(BigInt.fromI32(2)),
  entireSystemDebt: BigInt = oneEther,
): void => {
  createMockedFunction(
    MockStoragePoolAddress,
    'checkRecoveryMode',
    'checkRecoveryMode():(bool,uint256,uint256,uint256)',
  )
    .withArgs([])

    // bool isInRecoveryMode, uint TCR, uint entireSystemColl, uint entireSystemDebt
    .returns([
      ethereum.Value.fromBoolean(isInRecoveryMode),
      ethereum.Value.fromSignedBigInt(TCR),
      ethereum.Value.fromSignedBigInt(entireSystemColl),
      ethereum.Value.fromSignedBigInt(entireSystemDebt),
    ]);
};

export function createStoragePoolInitializedEvent(
  _borrowerOperationsAddress: Address,
  _troveManagerAddress: Address,
  _redemptionOperationsAddress: Address,
  _stabilityPoolManagerAddress: Address,
  _priceFeedAddress: Address,
): StoragePoolInitialized {
  let storagePoolInitializedEvent = changetype<StoragePoolInitialized>(newMockEvent());

  storagePoolInitializedEvent.address = MockDebtTokenAddress;

  storagePoolInitializedEvent.parameters = new Array();

  storagePoolInitializedEvent.parameters.push(
    new ethereum.EventParam('_borrowerOperationsAddress', ethereum.Value.fromAddress(_borrowerOperationsAddress)),
  );
  storagePoolInitializedEvent.parameters.push(
    new ethereum.EventParam('_troveManagerAddress', ethereum.Value.fromAddress(_troveManagerAddress)),
  );
  storagePoolInitializedEvent.parameters.push(
    new ethereum.EventParam('_redemptionOperationsAddress', ethereum.Value.fromAddress(_redemptionOperationsAddress)),
  );
  storagePoolInitializedEvent.parameters.push(
    new ethereum.EventParam('_stabilityPoolManagerAddress', ethereum.Value.fromAddress(_stabilityPoolManagerAddress)),
  );
  storagePoolInitializedEvent.parameters.push(
    new ethereum.EventParam('_priceFeedAddress', ethereum.Value.fromAddress(_priceFeedAddress)),
  );

  return storagePoolInitializedEvent;
}

export function createStoragePoolValueUpdatedEvent(
  _tokenAddress: Address,
  _isColl: boolean,
  _poolType: i32,
  _updatedAmount: BigInt,
): StoragePoolValueUpdated {
  let storagePoolValueUpdatedEvent = changetype<StoragePoolValueUpdated>(newMockEvent());

  storagePoolValueUpdatedEvent.address = MockStoragePoolAddress;

  storagePoolValueUpdatedEvent.parameters = new Array();

  storagePoolValueUpdatedEvent.parameters.push(
    new ethereum.EventParam('_tokenAddress', ethereum.Value.fromAddress(_tokenAddress)),
  );
  storagePoolValueUpdatedEvent.parameters.push(new ethereum.EventParam('_isColl', ethereum.Value.fromBoolean(_isColl)));
  storagePoolValueUpdatedEvent.parameters.push(
    new ethereum.EventParam('_poolType', ethereum.Value.fromSignedBigInt(BigInt.fromI32(_poolType))),
  );
  storagePoolValueUpdatedEvent.parameters.push(
    new ethereum.EventParam('_updatedAmount', ethereum.Value.fromSignedBigInt(_updatedAmount)),
  );

  return storagePoolValueUpdatedEvent;
}
