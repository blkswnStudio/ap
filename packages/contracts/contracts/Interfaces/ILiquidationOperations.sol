// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import './IDebtToken.sol';
import './IBBase.sol';
import './IPriceFeed.sol';
import './ITokenManager.sol';

interface ILiquidationOperations is IBBase {
  // --- Events ---

  event LiquidationOperationsInitialized(
    address _troveManager,
    address _storgePool,
    address _priceFeed,
    address _tokenManager,
    address _stabilityPoolManager,
    address _collSurplusPool
  );

  event LiquidationSummary(
    TokenAmount[] liquidatedDebt,
    TokenAmount[] liquidatedColl,
    uint totalStableCoinGasCompensation,
    TokenAmount[] totalCollGasCompensation
  );

  // --- Errors ---

  error LiquidationDisabled();
  error NoLiquidatableTrove();
  error EmptyArray();

  // --- Functions ---

  function liquidate(address _borrower, bytes[] memory _priceUpdateData) external payable;

  function batchLiquidateTroves(address[] calldata _troveArray, bytes[] memory _priceUpdateData) external payable;
}
