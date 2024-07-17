// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import './IDebtToken.sol';
import './IBBase.sol';
import './IPriceFeed.sol';
import './ITokenManager.sol';

// Common interface for the Trove Manager.
interface ITroveManager is IBBase {
  // --- Events ---

  event TroveManagerInitialized(
    address _borrowerOperationsAddress,
    address _redemptionOperationsAddress,
    address _liquidationOperationsAddress,
    address _storagePoolAddress,
    address _priceFeedAddress,
    address _sortedTrovesAddress,
    address _tokenManagerAddress,
    address _reservePoolAddress
  );

  event SetEnableRedeeming(bool enable);
  event SetEnableLiquidation(bool enable);
  event SetEnableMintingOnClosedHours(bool enable);
  event SetBorrowingFeeFloor(uint _borrowingFeeFloor);
  event SetBorrowingFeeGovDiscount(uint discountFrom, uint discount);
  event SetMaxDebtsAsCollateral(uint _maxDebtsAsCollateral);
  event SetBorrowingInterestRate(uint _borrowingInterestRate);
  event TroveAppliedRewards(address _borrower, CAmount[] _appliedRewards);
  event TroveAppliedInterests(address _borrower, uint _appliedInterests);
  event TroveClosed(address _borrower, Status _closingState);
  event TroveCappedLiquidated(address _borrower, TokenAmount[] _collSurplus);
  event TroveIndexUpdated(address _borrower, uint _newIndex);
  event TroveCollChanged(address _borrower, TokenAmount[] _collTokenAmounts, bool _increase);
  event TroveDebtChanged(address _borrower, DebtTokenAmount[] _debtTokenAmounts, bool _increase);
  event PaidBorrowingFee(address indexed _borrower, uint _reserve, uint _gov);
  event StableCoinBaseRateUpdated(uint _baseRate);
  event LastFeeOpTimeUpdated(uint _lastFeeOpTime);
  event TotalStakesUpdated(TokenAmount[] _totalStakes);
  event SystemSnapshotsUpdated(TokenAmount[] _totalStakesSnapshot, TokenAmount[] _totalCollateralSnapshot);

  // --- Errors ---

  error NotFromBorrowerOrRedemptionOps();
  error InvalidTrove();
  error OnlyOneTrove();
  error InvalidParameter();

  // --- Functions ---

  function enableMintingOnClosedHours() external view returns (bool);

  function enableLiquidation() external view returns (bool);

  function enableRedeeming() external view returns (bool);

  function maxDebtsAsCollateral() external view returns (uint);

  function borrowingFeeFloor() external view returns (uint);

  function borrowingFeeGovDiscountFrom() external view returns (uint);

  function borrowingFeeGovDiscount() external view returns (uint);

  function setEnableLiquidation(bool _enable) external;

  function setEnableRedeeming(bool _enable) external;

  function setEnableMintingOnClosedHours(bool _enable) external;

  function setBorrowingFeeFloor(uint _borrowingFeeFloor) external;

  function setBorrowingFeeGovDiscount(uint _borrowingFeeGovDiscountFrom, uint _borrowingFeeGovDiscount) external;

  function setMaxDebtsAsCollateral(uint _maxDebtsAsCollateral) external;

  function borrowingInterestRate() external view returns (uint);

  function setBorrowingInterestRate(uint _borrowingInterestRate) external;

  function getTroveOwnersCount() external view returns (uint);

  function getTroveStatus(address _borrower) external view returns (uint);

  function isTroveActive(address _borrower) external view returns (bool);

  function setTroveStatus(address _borrower, uint num) external;

  //

  function updateStakeAndTotalStakes(PriceCache memory _priceCache, address _borrower) external;

  function removeStake(PriceCache memory _priceCache, address _borrower) external;

  function updateSystemSnapshots_excludeCollRemainder(TokenAmount[] memory totalCollGasCompensation) external;

  function getTroveStakes(address _borrower, address _collToken) external view returns (uint);

  //

  function redistributeDebtAndColl(PriceCache memory _priceCache, CAmount[] memory toRedistribute) external;

  function getPendingBorrowingInterests(address _borrower) external view returns (uint);

  function getPendingRewards(
    address borrower,
    bool includeColls,
    bool includeDebts
  ) external view returns (CAmount[] memory);

  function applyPendingRewards(address _borrower, PriceCache memory _priceCache) external;

  function updateTroveRewardSnapshots(PriceCache memory _priceCache, address _borrower) external;

  //

  function increaseTroveColl(address _borrower, TokenAmount[] memory _collTokenAmounts) external;

  function decreaseTroveColl(address _borrower, TokenAmount[] memory _collTokenAmounts) external;

  function increaseTroveDebt(address _borrower, DebtTokenAmount[] memory _debtTokenAmounts) external;

  function decreaseTroveDebt(address _borrower, DebtTokenAmount[] memory _debtTokenAmounts) external;

  //

  function getEntireDebtAndColl(
    PriceCache memory _priceCache,
    address _borrower
  ) external view returns (RAmount[] memory amounts, uint debtTokenLength);

  function getTroveDebt(address _borrower) external view returns (TokenAmount[] memory);

  function getTroveRepayableDebtAsSwapPair(
    address _borrower,
    address _debtTokenB
  ) external view returns (uint amountA, uint amountB);

  function getTroveRepayableDebts(address _borrower) external view returns (TokenAmount[] memory debts);

  function getTroveRepayableDebts(
    PriceCache memory _priceCache,
    address _borrower
  ) external view returns (TokenAmount[] memory debts);

  function getTroveColl(address _borrower) external view returns (TokenAmount[] memory);

  function getTroveWithdrawableColls(address _borrower) external view returns (TokenAmount[] memory colls);

  function getTroveWithdrawableColls(
    PriceCache memory _priceCache,
    address _borrower
  ) external view returns (TokenAmount[] memory colls);

  //

  function addTroveOwnerToArray(address _borrower) external returns (uint128 index);

  function closeTroveByProtocol(PriceCache memory _priceCache, address _borrower, Status closedStatus) external;

  //

  function getStableCoinBaseRate() external view returns (uint);

  function getBorrowingRate(bool isStableCoin, uint govTokenAsCollRatio) external view returns (uint);

  function getBorrowingRateWithDecay(bool isStableCoin, uint govTokenAsCollRatio) external view returns (uint);

  function getBorrowingFee(uint debt, bool isStableCoin, uint govTokenAsCollRatio) external view returns (uint);

  function getBorrowingFeeWithDecay(
    uint debt,
    bool isStableCoin,
    uint govTokenAsCollRatio
  ) external view returns (uint);

  function decayStableCoinBaseRateFromBorrowing(uint borrowedStable) external;

  function updateStableCoinBaseRateFromRedemption(uint _totalRedeemedStable, uint _totalStableCoinSupply) external;

  function calcDecayedStableCoinBaseRate() external view returns (uint);

  function payBorrowingFee(address _borrower, uint _borrowingFee) external;
}
