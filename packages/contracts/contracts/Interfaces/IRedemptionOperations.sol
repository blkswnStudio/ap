// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import './IDebtToken.sol';
import './IBBase.sol';
import './IPriceFeed.sol';
import './ITokenManager.sol';

interface IRedemptionOperations is IBBase {
  // --- structs ---

  struct RedemptionCollAmount {
    address collToken;
    uint drawn;
    uint redemptionFee;
    uint sendToRedeemer;
  }

  // --- Events ---

  event RedemptionOperationsInitialized(
    address _troveManager,
    address _storgePool,
    address _priceFeed,
    address _tokenManager,
    address _sortedTrovesAddress,
    address _hintHelpers
  );
  event RedeemedFromTrove(address _borrower, uint stableAmount, TokenAmount[] _drawnCollAmounts);
  event SuccessfulRedemption(
    uint _attemptedStableAmount,
    uint _actualStableAmount,
    RedemptionCollAmount[] _collPayouts
  );

  // --- Errors ---

  error RedeptionDisabled();
  error ZeroAmount();
  error LessThanMinRedemption();
  error InvalidMaxFeePercent();
  error LessThanMCR();
  error ExceedDebtBalance();
  error NoRedeems();
  error GreaterThanTCR();
  error TooHighRedeemFee();
  error InvalidRedemptionHint();
  error HintUnknown();
  error HintBelowMCR();
  error InvalidHintLowerCRExists();

  // --- Functions ---

  function redeemCollateral(
    uint _stableCoinAmount,
    RedeemIteration[] memory _iterations,
    uint _maxFeePercentage,
    bytes[] memory _priceUpdateData
  ) external payable;

  function calculateTroveRedemption(
    address _borrower,
    uint _redeemMaxAmount,
    bool _includePendingRewards
  ) external view returns (SingleRedemptionVariables memory vars);

  function getRedemptionRate() external view returns (uint);

  function getRedemptionRateWithDecay() external view returns (uint);

  function getRedemptionFeeWithDecay(uint _ETHDrawn) external view returns (uint);
}
