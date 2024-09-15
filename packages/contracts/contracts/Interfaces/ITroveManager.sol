// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import './IStabilityPool.sol';
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
  event SetBorrowingFeeFloor(uint _borrowingFeeFloor);
  event SetBorrowingInterestRate(uint _borrowingInterestRate);
  event TroveAppliedRewards(address _borrower, CAmount[] _appliedRewards);
  event TroveAppliedInterests(address _borrower, uint _appliedInterests);
  event TroveClosed(address _borrower, Status _closingState);
  event TroveIndexUpdated(address _borrower, uint _newIndex);
  event TroveCollChanged(address _borrower, address[] _collTokenAddresses);
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

  function enableLiquidation() external view returns (bool);

  function enableRedeeming() external view returns (bool);

  function borrowingFeeFloor() external view returns (uint);

  function setEnableLiquidation(bool _enable) external;

  function setEnableRedeeming(bool _enable) external;

  function setBorrowingFeeFloor(uint _borrowingFeeFloor) external;

  function borrowingInterestRate() external view returns (uint);

  function setBorrowingInterestRate(uint _borrowingInterestRate) external;

  function getTroveOwnersCount() external view returns (uint);

  function getTroveStatus(address _borrower) external view returns (uint);

  function isTroveActive(address _borrower) external view returns (bool);

  function setTroveStatus(address _borrower, uint num) external;

  function getCurrentTrovesUSDValues(
    PriceCache memory _priceCache,
    address _borrower
  ) external view returns (uint IMCR, uint currentCollInUSD, uint currentDebtInUSD);

  //

  function updateStakeAndTotalStakes(PriceCache memory _priceCache, address _borrower) external;

  function removeStake(PriceCache memory _priceCache, address _borrower) external;

  function updateSystemSnapshots_excludeCollRemainder(TokenAmount[] memory totalCollGasCompensation) external;

  function getTroveStakes(address _borrower, address _collToken) external view returns (uint);

  //

  function redistributeDebtAndColl(PriceCache memory _priceCache, CAmount[] memory toRedistribute) external;

  function getPendingRewards(address _borrower, address _tokenAddress, bool isColl) external view returns (uint);

  function getPendingBorrowingInterests(address _borrower) external view returns (uint);

  function applyPendingRewards(address _borrower, PriceCache memory _priceCache) external;

  function updateTroveRewardSnapshots(address _borrower) external;

  //

  function increaseTroveColl(address _borrower, TokenAmount[] memory _collTokenAmounts) external;

  function decreaseTroveColl(address _borrower, TokenAmount[] memory _collTokenAmounts) external;

  function increaseTroveDebt(address _borrower, DebtTokenAmount[] memory _debtTokenAmounts) external;

  function decreaseTroveDebt(address _borrower, DebtTokenAmount[] memory _debtTokenAmounts) external;

  //

  function getEntireDebtAndColl(
    PriceCache memory _priceCache,
    address _borrower
  ) external view returns (RAmount[] memory amounts, uint debtTokenLength, uint stableCoinIndex);

  function getTroveDebt(address _borrower) external view returns (TokenAmount[] memory);

  function getTroveRepayableDebt(
    address _borrower,
    address _debtTokenAddress,
    bool _includingStableCoinGasCompensation,
    bool _includingPendingInterest
  ) external view returns (uint amount);

  function getTroveRepayableDebts(
    address _borrower,
    bool _includingStableCoinGasCompensation
  ) external view returns (TokenAmount[] memory);

  function getTroveRepayableDebts(
    PriceCache memory _priceCache,
    address _borrower,
    bool _includingStableCoinGasCompensation
  ) external view returns (TokenAmount[] memory debts);

  function getTroveColl(address _borrower) external view returns (TokenAmount[] memory);

  function getTroveWithdrawableColl(address _borrower, address _collTokenAddress) external view returns (uint amount);

  function getTroveWithdrawableColls(address _borrower) external view returns (TokenAmount[] memory colls);

  //

  function addTroveOwnerToArray(address _borrower) external returns (uint128 index);

  function closeTroveByProtocol(PriceCache memory _priceCache, address _borrower, Status closedStatus) external;

  //

  function getStableCoinBaseRate() external view returns (uint);

  function getBorrowingRate(bool isStableCoin) external view returns (uint);

  function getBorrowingRateWithDecay(bool isStableCoin) external view returns (uint);

  function getBorrowingFee(uint debt, bool isStableCoin) external view returns (uint);

  function getBorrowingFeeWithDecay(uint debt, bool isStableCoin) external view returns (uint);

  function decayStableCoinBaseRateFromBorrowing(uint borrowedStable) external;

  function updateStableCoinBaseRateFromRedemption(uint _totalRedeemedStable, uint _totalStableCoinSupply) external;

  function calcDecayedStableCoinBaseRate() external view returns (uint);

  function payBorrowingFee(address _borrower, uint _borrowingFee) external;
}
