// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './Dependencies/CheckContract.sol';
import './Dependencies/LiquityBase.sol';
import './Interfaces/IStoragePool.sol';
import './Interfaces/IPriceFeed.sol';
import './Interfaces/IStabilityPoolManager.sol';

/*
 * The Active Pool holds the collateral and debt (but not the token itself) for all active troves.
 *
 * When a trove is liquidated, it's coll and debt are transferred from the Active Pool, to either the
 * Stability Pool, the Default Pool, or both, depending on the liquidation conditions.
 *
 */
contract StoragePool is LiquityBase, Ownable(msg.sender), CheckContract, IStoragePool {
  string public constant NAME = 'StoragePool';

  address public borrowerOperationsAddress;
  address public troveManagerAddress;
  address public redemptionOperationsAddress;
  address public liquidationOperationsAddress;
  address public stabilityPoolManagerAddress;
  IPriceFeed public priceFeed;

  struct PoolEntry {
    address tokenAddress;
    uint256 totalAmount;
    mapping(PoolType => uint256) poolTypes;
    bool exists;
  }
  mapping(address => mapping(bool => PoolEntry)) internal poolEntries; // [tokenAddress][isColl] => PoolEntry

  // --- Contract setters ---

  function setAddresses(
    address _borrowerOperationsAddress,
    address _troveManagerAddress,
    address _redemptionOperationsAddress,
    address _liquidationOperationsAddress,
    address _stabilityPoolManagerAddress,
    address _priceFeedAddress
  ) external onlyOwner {
    checkContract(_borrowerOperationsAddress);
    checkContract(_troveManagerAddress);
    checkContract(_redemptionOperationsAddress);
    checkContract(_liquidationOperationsAddress);
    checkContract(_stabilityPoolManagerAddress);
    checkContract(_priceFeedAddress);

    borrowerOperationsAddress = _borrowerOperationsAddress;
    troveManagerAddress = _troveManagerAddress;
    redemptionOperationsAddress = _redemptionOperationsAddress;
    liquidationOperationsAddress = _liquidationOperationsAddress;
    stabilityPoolManagerAddress = _stabilityPoolManagerAddress;
    priceFeed = IPriceFeed(_priceFeedAddress);

    emit StoragePoolInitialized(
      _borrowerOperationsAddress,
      _troveManagerAddress,
      _redemptionOperationsAddress,
      _liquidationOperationsAddress,
      _stabilityPoolManagerAddress,
      _priceFeedAddress
    );
    renounceOwnership();
  }

  // --- Getters for public variables. Required by IPool interface ---

  function getValue(address _tokenAddress, bool _isColl, PoolType _poolType) external view override returns (uint) {
    return poolEntries[_tokenAddress][_isColl].poolTypes[_poolType];
  }

  // --- Pool functionality ---

  function addValue(address _tokenAddress, bool _isColl, PoolType _poolType, uint _amount) external override {
    _requireCallerIsProtocol();

    PoolEntry storage entry = poolEntries[_tokenAddress][_isColl];
    if (!entry.exists) {
      poolEntries[_tokenAddress][_isColl].exists = true;
      poolEntries[_tokenAddress][_isColl].tokenAddress = _tokenAddress;
    }

    entry.poolTypes[_poolType] += _amount;
    entry.totalAmount += _amount;
    emit StoragePoolValueUpdated(_tokenAddress, _isColl, _poolType, entry.poolTypes[_poolType]);
  }

  function subtractValue(address _tokenAddress, bool _isColl, PoolType _poolType, uint _amount) external override {
    _requireCallerIsProtocol();
    _subtractValue(_tokenAddress, _isColl, _poolType, _amount);
  }

  function withdrawalValue(
    address _receiver,
    address _tokenAddress,
    bool _isColl,
    PoolType _poolType,
    uint _amount
  ) external override {
    _requireCallerIsProtocol();
    if (_amount == 0) return;
    _subtractValue(_tokenAddress, _isColl, _poolType, _amount);
    IERC20(_tokenAddress).transfer(_receiver, _amount);
  }

  function _subtractValue(address _tokenAddress, bool _isColl, PoolType _poolType, uint _amount) internal {
    PoolEntry storage entry = poolEntries[_tokenAddress][_isColl];
    if (!entry.exists) revert PoolEntryDoesntExist();

    entry.poolTypes[_poolType] -= _amount;
    entry.totalAmount -= _amount;
    emit StoragePoolValueUpdated(_tokenAddress, _isColl, _poolType, entry.poolTypes[_poolType]);
  }

  function transferBetweenTypes(
    address _tokenAddress,
    bool _isColl,
    PoolType _fromType,
    PoolType _toType,
    uint _amount
  ) external override {
    _requireCallerIsProtocol();
    if (_amount == 0) return;

    PoolEntry storage entry = poolEntries[_tokenAddress][_isColl];
    if (!entry.exists) revert PoolEntryDoesntExist();

    entry.poolTypes[_fromType] -= _amount;
    emit StoragePoolValueUpdated(_tokenAddress, _isColl, _fromType, entry.poolTypes[_fromType]);

    entry.poolTypes[_toType] += _amount;
    emit StoragePoolValueUpdated(_tokenAddress, _isColl, _toType, entry.poolTypes[_toType]);
  }

  function getEntireSystemColl(PriceCache memory _priceCache) public view returns (uint entireSystemColl) {
    IPriceFeed priceFeedCached = priceFeed;
    for (uint i = 0; i < _priceCache.collPrices.length; i++) {
      TokenPrice memory tokenPrice = _priceCache.collPrices[i];

      entireSystemColl += priceFeedCached.getUSDValue(
        tokenPrice,
        poolEntries[tokenPrice.tokenAddress][true].totalAmount
      );
    }

    return entireSystemColl;
  }

  function getEntireSystemDebt(PriceCache memory _priceCache) public view returns (uint entireSystemDebt) {
    IPriceFeed priceFeedCached = priceFeed;
    for (uint i = 0; i < _priceCache.debtPrices.length; i++) {
      TokenPrice memory tokenPrice = _priceCache.debtPrices[i];
      entireSystemDebt += priceFeedCached.getUSDValue(
        tokenPrice,
        poolEntries[tokenPrice.tokenAddress][false].totalAmount
      );
    }

    return entireSystemDebt;
  }

  function getTokenTotalAmount(address _tokenAddress, bool _isColl) external view override returns (uint) {
    return poolEntries[_tokenAddress][_isColl].totalAmount;
  }

  function checkRecoveryMode()
    external
    view
    returns (bool isInRecoveryMode, uint TCR, uint entireSystemColl, uint entireSystemDebt)
  {
    PriceCache memory priceCache = priceFeed.buildPriceCache();
    return _checkRecoveryMode(priceCache);
  }

  function checkRecoveryMode(
    PriceCache memory _priceCache
  ) external view returns (bool isInRecoveryMode, uint TCR, uint entireSystemColl, uint entireSystemDebt) {
    return _checkRecoveryMode(_priceCache);
  }

  function _checkRecoveryMode(
    PriceCache memory _priceCache
  ) internal view returns (bool isInRecoveryMode, uint TCR, uint entireSystemColl, uint entireSystemDebt) {
    entireSystemColl = getEntireSystemColl(_priceCache);
    entireSystemDebt = getEntireSystemDebt(_priceCache);
    TCR = LiquityMath._computeCR(entireSystemColl, entireSystemDebt);
    isInRecoveryMode = TCR < CCR;
  }

  // --- 'require' functions ---

  function _requireCallerIsProtocol() internal view {
    if (
      msg.sender != borrowerOperationsAddress &&
      msg.sender != troveManagerAddress &&
      msg.sender != stabilityPoolManagerAddress &&
      msg.sender != redemptionOperationsAddress &&
      msg.sender != liquidationOperationsAddress
    ) revert NotFromBOorTroveMorSP();
  }
}
