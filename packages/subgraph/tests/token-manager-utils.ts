import { Address, BigInt, Bytes, ethereum } from '@graphprotocol/graph-ts';
import { createMockedFunction, newMockEvent } from 'matchstick-as';
import {
  CollTokenAdded,
  CollTokenSupportedCollateralRatioSet,
  DebtTokenAdded,
} from '../generated/TokenManager/TokenManager';
import { MockDebtToken_STABLE_Address, MockTokenManagerAddress } from './utils';

export const mockTokenManager_getStableCoin = (address: Address = MockDebtToken_STABLE_Address): void => {
  createMockedFunction(MockTokenManagerAddress, 'getStableCoin', 'getStableCoin():(address)').returns([
    ethereum.Value.fromAddress(address),
  ]);
};

export const mockTokenManager_isDebtToken = (
  address: Address = MockDebtToken_STABLE_Address,
  isDebtToken: boolean = true,
): void => {
  createMockedFunction(MockTokenManagerAddress, 'isDebtToken', 'isDebtToken(address):(bool)')
    .withArgs([ethereum.Value.fromAddress(address)])
    .returns([ethereum.Value.fromBoolean(isDebtToken)]);
};

export function createCollTokenAddedEvent(
  _tokenAddress: Address,
  _supportedCollateralRatio: BigInt,
  _isGovToken: boolean,
  _oracleId: Bytes,
): CollTokenAdded {
  let collTokenAddedEvent = changetype<CollTokenAdded>(newMockEvent());

  collTokenAddedEvent.address = MockTokenManagerAddress;

  collTokenAddedEvent.parameters = new Array();

  collTokenAddedEvent.parameters.push(
    new ethereum.EventParam('_tokenAddress', ethereum.Value.fromAddress(_tokenAddress)),
  );
  collTokenAddedEvent.parameters.push(
    new ethereum.EventParam('_supportedCollateralRatio', ethereum.Value.fromSignedBigInt(_supportedCollateralRatio)),
  );
  collTokenAddedEvent.parameters.push(new ethereum.EventParam('_isGovToken', ethereum.Value.fromBoolean(_isGovToken)));
  collTokenAddedEvent.parameters.push(new ethereum.EventParam('_oracleId', ethereum.Value.fromBytes(_oracleId)));

  return collTokenAddedEvent;
}

export function createCollTokenSupportedCollateralRatioSetEvent(
  _collTokenAddress: Address,
  _supportedCollateralRatio: BigInt,
): CollTokenSupportedCollateralRatioSet {
  let collTokenSupportedCollateralRatioSetEvent = changetype<CollTokenSupportedCollateralRatioSet>(newMockEvent());

  collTokenSupportedCollateralRatioSetEvent.address = MockTokenManagerAddress;

  collTokenSupportedCollateralRatioSetEvent.parameters = new Array();

  collTokenSupportedCollateralRatioSetEvent.parameters.push(
    new ethereum.EventParam('_collTokenAddress', ethereum.Value.fromAddress(_collTokenAddress)),
  );
  collTokenSupportedCollateralRatioSetEvent.parameters.push(
    new ethereum.EventParam('_supportedCollateralRatio', ethereum.Value.fromSignedBigInt(_supportedCollateralRatio)),
  );

  return collTokenSupportedCollateralRatioSetEvent;
}

export function createDebtTokenAddedEvent(_debtTokenAddress: Address, _oracleId: Bytes): DebtTokenAdded {
  let debtTokenAddedEvent = changetype<DebtTokenAdded>(newMockEvent());

  debtTokenAddedEvent.address = MockTokenManagerAddress;

  debtTokenAddedEvent.parameters = new Array();

  debtTokenAddedEvent.parameters.push(
    new ethereum.EventParam('_debtTokenAddress', ethereum.Value.fromAddress(_debtTokenAddress)),
  );
  debtTokenAddedEvent.parameters.push(new ethereum.EventParam('_oracleId', ethereum.Value.fromBytes(_oracleId)));

  return debtTokenAddedEvent;
}
