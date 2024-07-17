// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import './IBase.sol';

interface IStoragePool is IBase {
  // --- Events ---

  event StoragePoolInitialized(
    address _borrowerOperationsAddress,
    address _troveManagerAddress,
    address _redemptionOperationsAddress,
    address _liquidationOperationsAddress,
    address _stabilityPoolManagerAddress,
    address _priceFeedAddress
  );
  event StoragePoolValueUpdated(address _tokenAddress, bool _isColl, PoolType _poolType, uint _updatedAmount);

  // --- Custom Errors ---

  error NotFromBOorTroveMorSP();
  error PoolEntryDoesntExist();

  // --- Functions ---

  function getValue(address _tokenAddress, bool _isColl, PoolType _poolType) external view returns (uint);

  function addValue(address _tokenAddress, bool _isColl, PoolType _poolType, uint _amount) external;

  function subtractValue(address _tokenAddress, bool _isColl, PoolType _poolType, uint _amount) external;

  function withdrawalValue(
    address _receiver,
    address _tokenAddress,
    bool _isColl,
    PoolType _poolType,
    uint _amount
  ) external;

  function transferBetweenTypes(
    address _tokenAddress,
    bool _isCool,
    PoolType _fromType,
    PoolType _toType,
    uint _amount
  ) external;

  function getEntireSystemColl(PriceCache memory _priceCache) external view returns (uint entireSystemColl);

  function getEntireSystemDebt(PriceCache memory _priceCache) external view returns (uint entireSystemDebt);

  function getTokenTotalAmount(address _tokenAddress, bool _isColl) external view returns (uint);

  function checkRecoveryMode()
    external
    view
    returns (bool isInRecoveryMode, uint TCR, uint entireSystemColl, uint entireSystemDebt);

  function checkRecoveryMode(
    PriceCache memory _priceCache
  ) external view returns (bool isInRecoveryMode, uint TCR, uint entireSystemColl, uint entireSystemDebt);
}
