// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import '../BorrowerOperations.sol';
import './IMockERC20.sol';

/* Tester contract inherits from TroveManager, and provides external functions 
for testing the parent's internal functions. */

contract MockBorrowerOperations is BorrowerOperations {
  function createTestingTrove(
    address _borrower,
    TokenAmount[] memory _colls,
    TokenAmount[] memory _debts,
    bytes[] memory _priceUpdateData
  ) external {
    for (uint i = 0; i < _colls.length; i++) {
      IMockERC20 token = IMockERC20(_colls[i].tokenAddress);
      token.unprotectedMintApprove(_borrower, _colls[i].amount, address(this));
    }

    _openTrove(_borrower, _colls, _priceUpdateData);
    _increaseDebt(_borrower, _borrower, _debts, MintMeta(address(0), address(0), MAX_BORROWING_FEE), _priceUpdateData);
  }

  function increaseDebts(
    TokenAmount[] memory _debts,
    MintMeta memory _meta,
    bytes[] memory _priceUpdateData
  ) external payable {
    // separate minting is allowed for better testing
    // _requireCallerIsSwapOperations();

    // prod borrowerOps would skip the price updates on _increaseDebt() because it already gets handled in the swapOps
    priceFeed.updatePythPrices{ value: msg.value }(_priceUpdateData);

    _increaseDebt(msg.sender, msg.sender, _debts, _meta, _priceUpdateData);
  }

  // Payable fallback function

  // STORAGE POOL TESTER PROXIES
  function testStoragePool_addValue(address _tokenAddress, bool _isColl, PoolType _poolType, uint _amount) external {
    storagePool.addValue(_tokenAddress, _isColl, _poolType, _amount);
  }

  function testStoragePool_subtractValue(
    address _tokenAddress,
    bool _isColl,
    PoolType _poolType,
    uint _amount
  ) external {
    storagePool.subtractValue(_tokenAddress, _isColl, _poolType, _amount);
  }

  function testStoragePool_transferBetweenTypes(
    address _tokenAddress,
    bool _isColl,
    PoolType _fromType,
    PoolType _toType,
    uint _amount
  ) external {
    storagePool.transferBetweenTypes(_tokenAddress, _isColl, _fromType, _toType, _amount);
  }

  function testStoragePool_withdrawalValue(
    address _receiver,
    address _tokenAddress,
    bool _isColl,
    PoolType _poolType,
    uint _amount
  ) external {
    storagePool.withdrawalValue(_receiver, _tokenAddress, _isColl, _poolType, _amount);
  }

  // DEBTTOKEN TESTER PROXIES

  function testDebtToken_mint(address _account, uint256 _amount, IDebtToken _debtToken) external {
    _debtToken.mint(_account, _amount);
  }

  function testDebtToken_burn(address _account, uint256 _amount, IDebtToken _debtToken) external {
    _debtToken.burn(_account, _amount);
  }

  // TROVE MANAGER TESTER PROXIES

  function testTroveManager_increaseTroveDebt(address _borrower, DebtTokenAmount[] memory _debtTokenAmounts) external {
    troveManager.increaseTroveDebt(_borrower, _debtTokenAmounts);
  }

  function testTroveManager_setTroveStatus(address _borrower, uint _num) external {
    troveManager.setTroveStatus(_borrower, _num);
  }

  function testTroveManager_closeTrove(PriceCache memory _priceCache, address _borrower) external {
    troveManager.closeTroveByProtocol(_priceCache, _borrower, Status.closedByOwner);
  }
}