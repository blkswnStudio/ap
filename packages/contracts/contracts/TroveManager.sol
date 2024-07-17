// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import './Dependencies/LiquityBase.sol';
import './Dependencies/CheckContract.sol';
import './Interfaces/ITroveManager.sol';
import './Interfaces/IDebtToken.sol';
import './Interfaces/IPriceFeed.sol';
import './Interfaces/IStoragePool.sol';
import './Interfaces/IBBase.sol';
import './Interfaces/ISortedTroves.sol';
import './Interfaces/IBase.sol';
import './Interfaces/IReservePool.sol';

contract TroveManager is LiquityBase, Ownable(msg.sender), CheckContract, ITroveManager {
  string public constant NAME = 'TroveManager';

  // --- Connected contract declarations ---

  address public borrowerOperationsAddress;
  address public redemptionOperationsAddress;
  address public liquidationOperationsAddress;
  IReservePool public reservePool;
  IStoragePool public storagePool;
  IPriceFeed public priceFeed;
  ISortedTroves public sortedTroves;
  ITokenManager public tokenManager;

  // --- Data structures ---

  bool private initialized;

  /*
   * Half-life of 12h. 12h = 720 min
   * (1/2) = d^720 => d = (1/2)^(1/720)
   */
  uint public constant MINUTE_DECAY_FACTOR = 999037758833783000;
  uint public constant SECONDS_PER_YEAR = 31536000; // = 60 * 60 * 24 * 365

  /*
   * BETA: 18 digit decimal. Parameter by which to divide the redeemed fraction, in order to calc the new base rate from a redemption.
   * Corresponds to (1 / ALPHA) in the white paper.
   */
  uint public constant BETA = 2;

  uint public stableCoinBaseRate;
  uint public lastFeeOperationTime; // The timestamp of the latest fee operation (redemption or new dToken issuance)
  uint public override borrowingFeeFloor = 0.005e18; // 0.5%
  uint public override borrowingInterestRate = 0; // 0% annual
  bool public override enableLiquidationAndRedeeming = true; // Is Liquidation and Redeeming enabled or frozen

  // Store the necessary data for a trove
  struct Trove {
    Status status;
    uint128 arrayIndex;
    //
    IDebtToken[] debtTokens; // we keep track of the debt tokens used by the borrower, to avoid iterating over all system debt tokens on common operations (as a gas saving)
    mapping(address => bool) debtsRegistered;
    mapping(IDebtToken => uint) debts;
    uint appliedInterestAt;
    //
    mapping(address => uint) colls; // [collTokenAddress] -> coll amount
    mapping(address => uint) stakes; // [collTokenAddress] -> stake
  }
  mapping(address => Trove) public Troves;

  // Array of all active trove addresses - used to to compute an approximate hint off-chain, for the sorted list insertion
  address[] public TroveOwners;

  // stakes gets stored relative to the coll token, total stake needs to be calculated on runtime using token prices
  // in token amount (not usd)
  mapping(address => uint) public totalStakes; // [collTokenAddress] => total system stake, relative to the coll token
  mapping(address => uint) public totalStakesSnapshot; // [collTokenAddress] => system stake, taken immediately after the latest liquidation
  mapping(address => uint) public totalCollateralSnapshots; // [collTokenAddress] => system collateral snapshot, its != the stake snapshot, because liquidation fees are already paid out / reduced

  // L_Tokens track the sums of accumulated liquidation rewards per unit staked. During its lifetime, each stake earns:
  // A gain of ( stake * [L_TOKEN[T] - L_TOKEN[T](0)] )
  // Where L_TOKEN[T](0) are snapshots of token T for the active Trove taken at the instant the stake was made
  mapping(address => uint) public liquidatedCollTokensPerStake; // [collToken] -> liquidated/redistributed amount per stake
  mapping(address => mapping(address => uint)) public liquidatedDebtTokensPerStake; // [collToken][debtToken] -> liquidated/redistributed amount per stake of the coll token
  mapping(address => mapping(address => uint)) public collRewardSnapshots; // [user][collToken] -> value, snapshot amount
  mapping(address => mapping(address => mapping(address => uint))) public debtRewardSnapshots; // [user][collToken][debtToken] -> value, snapshot amount

  // --- Dependency setter ---

  function setAddresses(
    address _borrowerOperationsAddress,
    address _redemptionOperationsAddress,
    address _liquidationOperationsAddress,
    address _storagePoolAddress,
    address _priceFeedAddress,
    address _sortedTrovesAddress,
    address _tokenManagerAddress,
    address _reservePoolAddress
  ) external onlyOwner {
    if (initialized) revert AlreadyInitialized();
    initialized = true;

    checkContract(_borrowerOperationsAddress);
    checkContract(_redemptionOperationsAddress);
    checkContract(_liquidationOperationsAddress);
    checkContract(_storagePoolAddress);
    checkContract(_priceFeedAddress);
    checkContract(_sortedTrovesAddress);
    checkContract(_tokenManagerAddress);
    checkContract(_reservePoolAddress);

    borrowerOperationsAddress = _borrowerOperationsAddress;
    redemptionOperationsAddress = _redemptionOperationsAddress;
    liquidationOperationsAddress = _liquidationOperationsAddress;
    storagePool = IStoragePool(_storagePoolAddress);
    priceFeed = IPriceFeed(_priceFeedAddress);
    sortedTroves = ISortedTroves(_sortedTrovesAddress);
    tokenManager = ITokenManager(_tokenManagerAddress);
    reservePool = IReservePool(_reservePoolAddress);

    emit TroveManagerInitialized(
      _borrowerOperationsAddress,
      _redemptionOperationsAddress,
      _liquidationOperationsAddress,
      _storagePoolAddress,
      _priceFeedAddress,
      _sortedTrovesAddress,
      _tokenManagerAddress,
      _reservePoolAddress
    );
  }

  function setEnableLiquidationAndRedeeming(bool _enable) external onlyOwner {
    enableLiquidationAndRedeeming = _enable;
    emit SetEnableLiquidationAndRedeeming(enableLiquidationAndRedeeming);
  }

  function setBorrowingFeeFloor(uint _borrowingFeeFloor) external onlyOwner {
    if (_borrowingFeeFloor > DECIMAL_PRECISION) revert InvalidParameter();
    borrowingFeeFloor = _borrowingFeeFloor;
    emit SetBorrowingFeeFloor(borrowingFeeFloor);
  }

  function setBorrowingInterestRate(uint _borrowingInterestRate) external onlyOwner {
    if (_borrowingInterestRate > DECIMAL_PRECISION) revert InvalidParameter();
    borrowingInterestRate = _borrowingInterestRate;
    emit SetBorrowingInterestRate(borrowingInterestRate);
  }

  /**
   *
   * troves status
   *
   **/

  function getTroveOwnersCount() external view override returns (uint) {
    return TroveOwners.length;
  }

  function getTroveOwners() external view returns (address[] memory) {
    return TroveOwners;
  }

  function getTroveStatus(address _borrower) external view override returns (uint) {
    return uint(Troves[_borrower].status);
  }

  function isTroveActive(address _borrower) external view override returns (bool) {
    return Troves[_borrower].status == Status.active;
  }

  function setTroveStatus(address _borrower, uint _num) external override {
    _requireCallerIsBorrowerOpsOrRedemptionOpsOrLiquidationOps();
    Troves[_borrower].status = Status(_num);
  }

  /**
   *
   * collateral ratios
   *
   **/

  function getCurrentTrovesUSDValues(
    PriceCache memory _priceCache,
    address _borrower
  ) external view override returns (uint IMCR, uint currentCollInUSD, uint currentDebtInUSD) {
    Trove storage _trove = Troves[_borrower];

    // loading debt amounts from storage
    uint[] memory debtAmounts = new uint[](_trove.debtTokens.length);
    uint stableCoinIndex;
    for (uint i = 0; i < _trove.debtTokens.length; i++) {
      IDebtToken debtToken = _trove.debtTokens[i];
      debtAmounts[i] = _trove.debts[debtToken];
      if (debtToken.isStableCoin()) stableCoinIndex = i;
    }

    // loading coll tokens and adding pending rewards
    uint maxDebtInUSD;
    for (uint i = 0; i < _priceCache.collPrices.length; i++) {
      address collToken = _priceCache.collPrices[i].tokenAddress;

      uint pendingRewards = _getPendingCollReward(_borrower, collToken);
      uint collInUSD = priceFeed.getUSDValue(_priceCache, collToken, _trove.colls[collToken] + pendingRewards);
      currentCollInUSD += collInUSD;
      maxDebtInUSD += LiquityMath._computeMaxDebtValue(collInUSD, _priceCache.collPrices[i].supportedCollateralRatio);

      for (uint ii = 0; ii < _trove.debtTokens.length; ii++) {
        pendingRewards = _getPendingDebtReward(_borrower, collToken, address(_trove.debtTokens[ii]));
        debtAmounts[ii] += pendingRewards;
      }
    }

    // adding borrowing interests
    uint stableInterest = _calculatePendingBorrowingInterest(_priceCache, _trove);
    if (stableInterest != 0) debtAmounts[stableCoinIndex] += stableInterest;

    // calculate the current debt in USD
    for (uint i = 0; i < _trove.debtTokens.length; i++)
      currentDebtInUSD += priceFeed.getUSDValue(_priceCache, address(_trove.debtTokens[i]), debtAmounts[i]);

    IMCR = LiquityMath._computeIMCR(maxDebtInUSD, currentCollInUSD);
    return (IMCR, currentCollInUSD, currentDebtInUSD);
  }

  /**
   *
   * collateral stakes
   *
   **/

  // Update borrower's stake based on their latest collateral value
  function updateStakeAndTotalStakes(PriceCache memory _priceCache, address _borrower) external override {
    _requireCallerIsBorrowerOpsOrRedemptionOpsOrLiquidationOps();

    TokenAmount[] memory totalStakesCopy = new TokenAmount[](_priceCache.collPrices.length);
    for (uint i = 0; i < _priceCache.collPrices.length; i++) {
      address _collAddress = _priceCache.collPrices[i].tokenAddress;

      uint newBorrowerCollStake;
      uint borrowersCollAmount = Troves[_borrower].colls[_collAddress];

      uint totalCollateralSnapshot = totalCollateralSnapshots[_collAddress];
      if (totalCollateralSnapshot == 0) newBorrowerCollStake = borrowersCollAmount;
      else {
        /*
         * The following assert() holds true because:
         * - The system always contains >= 1 trove
         * - When we close or liquidate a trove, we redistribute the pending rewards, so if all troves were closed/liquidated,
         * rewards would’ve been emptied and totalCollateralSnapshot would be zero too.
         */
        uint stakedSnapshot = totalStakesSnapshot[_collAddress];
        assert(stakedSnapshot > 0);
        newBorrowerCollStake = (borrowersCollAmount * stakedSnapshot) / totalCollateralSnapshot;
      }

      uint oldBorrowerStake = Troves[_borrower].stakes[_collAddress];
      uint newTotalStake = totalStakes[_collAddress] - oldBorrowerStake + newBorrowerCollStake;
      totalStakes[_collAddress] = newTotalStake;
      totalStakesCopy[i] = TokenAmount(_collAddress, newTotalStake);
      Troves[_borrower].stakes[_collAddress] = newBorrowerCollStake;
    }

    emit TotalStakesUpdated(totalStakesCopy);
  }

  // Remove borrower's stake from the totalStakes sum, and set their stake to 0
  function removeStake(PriceCache memory _priceCache, address _borrower) external override {
    _requireCallerIsBorrowerOpsOrRedemptionOpsOrLiquidationOps();

    for (uint i = 0; i < _priceCache.collPrices.length; i++) {
      address tokenAddress = _priceCache.collPrices[i].tokenAddress;

      totalStakes[tokenAddress] -= Troves[_borrower].stakes[tokenAddress];
      Troves[_borrower].stakes[tokenAddress] = 0;
    }
  }

  /*
   * Updates snapshots of system total stakes and total collateral, excluding a given collateral remainder from the calculation.
   * Used in a liquidation sequence.
   */
  function updateSystemSnapshots_excludeCollRemainder(TokenAmount[] memory totalCollGasCompensation) external override {
    TokenAmount[] memory _totalStakesSnapshot = new TokenAmount[](totalCollGasCompensation.length);
    TokenAmount[] memory _totalCollateralSnapshots = new TokenAmount[](totalCollGasCompensation.length);

    // totalCollGasCompensation array included every available coll in the system, even if there is 0 gas compensation
    for (uint i = 0; i < totalCollGasCompensation.length; i++) {
      address tokenAddress = totalCollGasCompensation[i].tokenAddress;

      uint totalStake = totalStakes[tokenAddress];
      totalStakesSnapshot[tokenAddress] = totalStake;
      _totalStakesSnapshot[i] = TokenAmount(tokenAddress, totalStake);

      uint totalCollateralSnapshot = storagePool.getValue(tokenAddress, true, PoolType.Active) +
        storagePool.getValue(tokenAddress, true, PoolType.Default) -
        totalCollGasCompensation[i].amount;
      totalCollateralSnapshots[tokenAddress] = totalCollateralSnapshot;
      _totalCollateralSnapshots[i] = TokenAmount(tokenAddress, totalCollateralSnapshot);
    }

    emit SystemSnapshotsUpdated(_totalStakesSnapshot, _totalCollateralSnapshots);
  }

  /**
   *
   * redistribution
   *
   **/

  function redistributeDebtAndColl(PriceCache memory _priceCache, CAmount[] memory toRedistribute) external override {
    _requireCallerIsBorrowerOpsOrRedemptionOpsOrLiquidationOps();

    // sum up all coll usd values
    uint totalRedistributedCollInUsd;
    uint[] memory collCacheInUSD = new uint[](toRedistribute.length);
    for (uint i = 0; i < toRedistribute.length; i++) {
      CAmount memory collEntry = toRedistribute[i];
      if (!collEntry.isColl || collEntry.amount == 0) continue;

      uint collInUSD = priceFeed.getUSDValue(_priceCache, collEntry.tokenAddress, collEntry.amount);
      collCacheInUSD[i] = collInUSD;
      totalRedistributedCollInUsd += collInUSD;
    }

    // iterate over the coll entries and process the debt relative to the coll percentage
    uint[] memory debtsToDefaultPool = new uint[](toRedistribute.length);
    for (uint i = 0; i < toRedistribute.length; i++) {
      CAmount memory collEntry = toRedistribute[i];
      if (!collEntry.isColl || collEntry.amount == 0) continue;

      // patch the liquidated coll tokens
      uint collTotalStake = totalStakes[collEntry.tokenAddress];
      PoolType targetPool;
      if (collTotalStake == 0) {
        // the last trove with that coll type was liquidated/close, moving the assets into a claimable (unassigned) pool
        targetPool = PoolType.Unassigned;
      } else {
        targetPool = PoolType.Default;
        liquidatedCollTokensPerStake[collEntry.tokenAddress] += (collEntry.amount * DECIMAL_PRECISION) / collTotalStake;

        // iterate over the debt entries and store the rewards
        uint collPercentage = (collCacheInUSD[i] * DECIMAL_PRECISION) / totalRedistributedCollInUsd;
        for (uint ii = 0; ii < toRedistribute.length; ii++) {
          CAmount memory debtEntry = toRedistribute[ii];
          if (debtEntry.isColl || debtEntry.amount == 0) continue;

          debtsToDefaultPool[ii] += (debtEntry.amount * collPercentage) / DECIMAL_PRECISION;
          liquidatedDebtTokensPerStake[collEntry.tokenAddress][debtEntry.tokenAddress] +=
            (debtEntry.amount * collPercentage) /
            collTotalStake;
        }
      }

      // moving the coll tokens from the active pool to the target pool (default or unassigned)
      storagePool.transferBetweenTypes(collEntry.tokenAddress, true, PoolType.Active, targetPool, collEntry.amount);
    }

    // moving the debts from the active pool to the target pool (default or unassigned)
    for (uint i = 0; i < toRedistribute.length; i++) {
      CAmount memory debtEntry = toRedistribute[i];
      if (debtEntry.isColl || debtEntry.amount == 0) continue;

      uint debtToDefaultPool = debtsToDefaultPool[i];
      if (debtToDefaultPool != 0)
        storagePool.transferBetweenTypes(
          debtEntry.tokenAddress,
          false,
          PoolType.Active,
          PoolType.Default,
          debtToDefaultPool
        );

      uint debtToUnassignedPool = debtEntry.amount - debtToDefaultPool;
      if (debtToUnassignedPool != 0)
        storagePool.transferBetweenTypes(
          debtEntry.tokenAddress,
          false,
          PoolType.Active,
          PoolType.Unassigned,
          debtToUnassignedPool
        );
    }
  }

  function getTroveStakes(address _borrower, address _collToken) external view override returns (uint) {
    return Troves[_borrower].stakes[_collToken];
  }

  function applyPendingRewards(address _borrower, PriceCache memory _priceCache) external override {
    _requireCallerIsBorrowerOpsOrRedemptionOpsOrLiquidationOps();
    _requireTroveIsActive(_borrower);

    address[] memory collTokens = tokenManager.getCollTokenAddresses();
    Trove storage _trove = Troves[_borrower];
    IDebtToken[] memory troveDebtTokens = _trove.debtTokens;
    uint[] memory pendingDebtRewards = new uint[](troveDebtTokens.length); // used to sum up the pending debt rewards of the different coll tokens
    CAmount[] memory appliedRewards = new CAmount[](collTokens.length + troveDebtTokens.length); // just used for the event logging

    // apply debt borrowing interests
    uint stableInterest = _calculatePendingBorrowingInterest(_priceCache, _trove);
    if (stableInterest != 0) {
      IDebtToken stableCoin = tokenManager.getStableCoin();
      _trove.debts[stableCoin] += stableInterest;
      storagePool.addValue(address(stableCoin), false, PoolType.Active, stableInterest);
      _payBorrowingFee(_borrower, stableInterest);
      emit TroveAppliedInterests(_borrower, stableInterest);
    }
    _trove.appliedInterestAt = block.timestamp;

    // apply coll pendingRewards and sum up debt pendingRewards across all coll token
    for (uint i = 0; i < collTokens.length; i++) {
      address collAddress = collTokens[i];

      uint pendingRewards = _getPendingCollReward(_borrower, collAddress);
      appliedRewards[i] = CAmount(collAddress, true, pendingRewards);
      if (pendingRewards == 0) continue;

      _trove.colls[collAddress] += pendingRewards;
      storagePool.transferBetweenTypes(collAddress, true, PoolType.Default, PoolType.Active, pendingRewards);

      // extract debt pendingRewards for this coll token
      for (uint ii = 0; ii < pendingDebtRewards.length; ii++)
        pendingDebtRewards[ii] += _getPendingDebtReward(_borrower, collAddress, address(troveDebtTokens[ii]));
    }

    // apply summed up debt pendingRewards
    for (uint i = 0; i < troveDebtTokens.length; i++) {
      if (pendingDebtRewards[i] == 0) continue;

      IDebtToken token = troveDebtTokens[i];
      address tokenAddress = address(token);

      _trove.debts[token] += pendingDebtRewards[i];
      storagePool.transferBetweenTypes(tokenAddress, false, PoolType.Default, PoolType.Active, pendingDebtRewards[i]);
      appliedRewards[collTokens.length + i] = CAmount(tokenAddress, false, pendingDebtRewards[i]);
    }

    emit TroveAppliedRewards(_borrower, appliedRewards);
    _updateTroveRewardSnapshots(_borrower);
  }

  function _calculatePendingBorrowingInterest(
    PriceCache memory _priceCache,
    Trove storage _trove
  ) internal view returns (uint) {
    if (borrowingInterestRate == 0) return 0;

    uint timePassed = block.timestamp - _trove.appliedInterestAt;
    if (timePassed == 0) return 0;

    IPriceFeed _priceFeed = priceFeed;
    uint stableInterest;
    for (uint i = 0; i < _trove.debtTokens.length; i++) {
      IDebtToken debtToken = _trove.debtTokens[i];

      uint debtTokenAmount = _trove.debts[debtToken];
      if (debtTokenAmount == 0) continue;

      stableInterest +=
        (((_priceFeed.getUSDValue(_priceCache, address(debtToken), debtTokenAmount) * borrowingInterestRate) /
          DECIMAL_PRECISION) * timePassed) /
        SECONDS_PER_YEAR;
    }

    return stableInterest;
  }

  function getPendingRewards(
    address _borrower,
    address _tokenAddress,
    bool isColl
  ) external view override returns (uint) {
    if (isColl) return _getPendingCollReward(_borrower, _tokenAddress);

    uint pendingRewards;
    address[] memory collTokens = tokenManager.getCollTokenAddresses();
    for (uint i = 0; i < collTokens.length; i++)
      pendingRewards += _getPendingDebtReward(_borrower, collTokens[i], _tokenAddress);

    return pendingRewards;
  }

  // using new price cache, client support function
  function getPendingBorrowingInterests(address _borrower) external view override returns (uint) {
    return _calculatePendingBorrowingInterest(priceFeed.buildPriceCache(), Troves[_borrower]);
  }

  function _getPendingCollReward(address _borrower, address _collAddress) internal view returns (uint pendingReward) {
    uint snapshotValue = collRewardSnapshots[_borrower][_collAddress];
    uint rewardsPerStake = liquidatedCollTokensPerStake[_collAddress] - snapshotValue;
    if (rewardsPerStake == 0 || Troves[_borrower].status != Status.active) return 0;

    uint trovesCollStake = Troves[_borrower].stakes[_collAddress];
    pendingReward = (trovesCollStake * rewardsPerStake) / DECIMAL_PRECISION;
  }

  function _getPendingDebtReward(
    address _borrower,
    address _collAddress,
    address _debtAddress
  ) internal view returns (uint pendingReward) {
    Trove storage _trove = Troves[_borrower];
    if (_trove.status != Status.active) return 0;

    // pending redistribution rewards
    uint snapshotValue = debtRewardSnapshots[_borrower][_collAddress][_debtAddress];
    uint rewardsPerStake = liquidatedDebtTokensPerStake[_collAddress][_debtAddress] - snapshotValue;
    if (rewardsPerStake == 0) return 0;

    uint trovesCollStake = _trove.stakes[_collAddress];
    return (trovesCollStake * rewardsPerStake) / DECIMAL_PRECISION;
  }

  // Update borrower's snapshots to reflect the current values
  function updateTroveRewardSnapshots(address _borrower) external override {
    _requireCallerIsBorrowerOpsOrRedemptionOpsOrLiquidationOps();
    return _updateTroveRewardSnapshots(_borrower);
  }

  function _updateTroveRewardSnapshots(address _borrower) internal {
    Trove storage _trove = Troves[_borrower];

    // initialising troves applied interests, only relevant after trove opening
    if (_trove.appliedInterestAt == 0) _trove.appliedInterestAt = block.timestamp;

    // updating the reward snapshots
    address[] memory collTokens = tokenManager.getCollTokenAddresses();
    for (uint i = 0; i < collTokens.length; i++) {
      address collToken = collTokens[i];

      uint snapshot = liquidatedCollTokensPerStake[collToken];
      collRewardSnapshots[_borrower][collToken] = snapshot;

      for (uint ii = 0; ii < _trove.debtTokens.length; ii++) {
        address debtToken = address(_trove.debtTokens[ii]);

        uint debtSnapshot = liquidatedDebtTokensPerStake[collToken][debtToken];
        debtRewardSnapshots[_borrower][collToken][debtToken] = debtSnapshot;
      }
    }
  }

  /**
   *
   * collateral and debt setters
   *
   **/

  function increaseTroveColl(address _borrower, TokenAmount[] memory _collTokenAmounts) external override {
    _requireCallerIsBorrowerOpsOrRedemptionOpsOrLiquidationOps();

    Trove storage trove = Troves[_borrower];
    address[] memory collTokenAddresses = new address[](_collTokenAmounts.length);
    for (uint i = 0; i < _collTokenAmounts.length; i++) {
      if (_collTokenAmounts[i].amount == 0) continue;

      address tokenAddress = _collTokenAmounts[i].tokenAddress;
      trove.colls[tokenAddress] += _collTokenAmounts[i].amount;
      collTokenAddresses[i] = tokenAddress;
    }

    emit TroveCollChanged(_borrower, collTokenAddresses);
  }

  function decreaseTroveColl(address _borrower, TokenAmount[] memory _collTokenAmounts) external override {
    _requireCallerIsBorrowerOpsOrRedemptionOpsOrLiquidationOps();

    Trove storage trove = Troves[_borrower];
    address[] memory collTokenAddresses = new address[](_collTokenAmounts.length);

    for (uint i = 0; i < _collTokenAmounts.length; i++) {
      address tokenAddress = _collTokenAmounts[i].tokenAddress;
      trove.colls[tokenAddress] -= _collTokenAmounts[i].amount;
      collTokenAddresses[i] = tokenAddress;
    }

    emit TroveCollChanged(_borrower, collTokenAddresses);
  }

  function increaseTroveDebt(address _borrower, DebtTokenAmount[] memory _debtTokenAmounts) external override {
    _requireCallerIsBorrowerOpsOrRedemptionOpsOrLiquidationOps();

    Trove storage trove = Troves[_borrower];
    for (uint i = 0; i < _debtTokenAmounts.length; i++) {
      if (_debtTokenAmounts[i].netDebt == 0) continue;
      IDebtToken debtToken = _debtTokenAmounts[i].debtToken;

      trove.debts[debtToken] += _debtTokenAmounts[i].netDebt;
      if (!trove.debtsRegistered[address(debtToken)]) {
        trove.debtsRegistered[address(debtToken)] = true;
        trove.debtTokens.push(debtToken);
      }
    }
  }

  function decreaseTroveDebt(address _borrower, DebtTokenAmount[] memory _debtTokenAmounts) external override {
    _requireCallerIsBorrowerOpsOrRedemptionOpsOrLiquidationOps();

    Trove storage trove = Troves[_borrower];
    for (uint i = 0; i < _debtTokenAmounts.length; i++) {
      trove.debts[_debtTokenAmounts[i].debtToken] -= _debtTokenAmounts[i].netDebt;
    }
  }

  /**
   *
   * trove debt + coll getters
   *
   **/

  // Return the Troves entire debt and coll,
  // including pending rewards from redistributions and borrowing interests.
  // used for liquidations to check on ICR without the need of applying the rewards
  function getEntireDebtAndColl(
    PriceCache memory _priceCache,
    address _borrower
  )
    external
    view
    override
    returns (
      RAmount[] memory amounts,
      uint IMCR,
      uint troveCollInUSD,
      uint troveDebtInUSD,
      uint troveDebtInUSDWithoutGasCompensation
    )
  {
    Trove storage trove = Troves[_borrower];
    amounts = new RAmount[](trove.debtTokens.length + _priceCache.collPrices.length);

    // initialize empty debt tokens and find the stable entry
    uint stableCoinIndex;
    for (uint i = 0; i < trove.debtTokens.length; i++) {
      IDebtToken debtToken = trove.debtTokens[i];

      if (debtToken.isStableCoin()) stableCoinIndex = i;
      amounts[i] = RAmount(address(debtToken), false, trove.debts[debtToken], 0, 0, 0, 0, 0, 0, 0);
    }

    // adding borrowing interests
    amounts[stableCoinIndex].pendingInterest = _calculatePendingBorrowingInterest(_priceCache, trove);

    // initialize empty coll tokens
    for (uint i = 0; i < _priceCache.collPrices.length; i++) {
      address collToken = _priceCache.collPrices[i].tokenAddress;
      amounts[i + trove.debtTokens.length] = RAmount(
        collToken,
        true,
        trove.colls[collToken],
        _getPendingCollReward(_borrower, collToken),
        0,
        0,
        0,
        0,
        0,
        0
      );

      // adding the pending rewards to the debt tokens, per coll token
      for (uint ii = 0; ii < trove.debtTokens.length; ii++)
        amounts[ii].pendingReward += _getPendingDebtReward(_borrower, collToken, address(trove.debtTokens[ii]));
    }

    // adding missing amount meta data
    uint maxDebtInUSD;
    for (uint i = 0; i < amounts.length; i++) {
      RAmount memory amountEntry = amounts[i];

      uint totalAmount = amountEntry.amount + amountEntry.pendingReward + amountEntry.pendingInterest;
      uint inUSD = priceFeed.getUSDValue(_priceCache, amountEntry.tokenAddress, totalAmount);

      if (amountEntry.isColl) {
        amountEntry.gasCompensation = _getCollGasCompensation(totalAmount);
        amountEntry.toLiquidate = totalAmount - amountEntry.gasCompensation;
        troveCollInUSD += inUSD;
        maxDebtInUSD += LiquityMath._computeMaxDebtValue(
          inUSD,
          _priceCache.collPrices[i - trove.debtTokens.length].supportedCollateralRatio
        );
      } else {
        if (i == stableCoinIndex) {
          // stable coin gas compensation should not be liquidated, it will be paid out as reward for the liquidator
          amountEntry.toLiquidate = totalAmount - STABLE_COIN_GAS_COMPENSATION;
          troveDebtInUSDWithoutGasCompensation += priceFeed.getUSDValue(
            _priceCache,
            amountEntry.tokenAddress,
            amountEntry.toLiquidate
          );
        } else {
          amountEntry.toLiquidate = totalAmount;
          troveDebtInUSDWithoutGasCompensation += inUSD;
        }

        troveDebtInUSD += inUSD;
      }
    }

    IMCR = LiquityMath._computeIMCR(maxDebtInUSD, troveCollInUSD);
    return (amounts, IMCR, troveCollInUSD, troveDebtInUSD, troveDebtInUSDWithoutGasCompensation);
  }

  function getTroveDebt(address _borrower) public view override returns (TokenAmount[] memory) {
    Trove storage trove = Troves[_borrower];
    if (trove.status != Status.active) return new TokenAmount[](0);

    TokenAmount[] memory debts = new TokenAmount[](trove.debtTokens.length);
    for (uint i = 0; i < debts.length; i++)
      debts[i] = TokenAmount(address(trove.debtTokens[i]), trove.debts[trove.debtTokens[i]]);

    return debts;
  }

  function getTroveRepayableDebt(
    address _borrower,
    address _debtTokenAddress,
    bool _includingStableCoinGasCompensation,
    bool _includingPendingInterest
  ) external view override returns (uint amount) {
    Trove storage trove = Troves[_borrower];
    if (trove.status != Status.active) return 0;

    // calculate the pending reward
    uint debt = trove.debts[IDebtToken(_debtTokenAddress)];
    address[] memory collTokens = tokenManager.getCollTokenAddresses();
    for (uint i = 0; i < collTokens.length; i++)
      debt += _getPendingDebtReward(_borrower, collTokens[i], _debtTokenAddress);

    bool isStableCoin = IDebtToken(_debtTokenAddress).isStableCoin();
    if (isStableCoin) {
      // calculate borrowing interest (stable coin only)
      if (_includingPendingInterest) debt += _calculatePendingBorrowingInterest(priceFeed.buildPriceCache(), trove);

      // add the gas comp
      if (!_includingStableCoinGasCompensation) debt -= STABLE_COIN_GAS_COMPENSATION;
    }

    return debt;
  }

  function getTroveRepayableDebts(
    address _borrower,
    bool _includingStableCoinGasCompensation
  ) external view override returns (TokenAmount[] memory debts) {
    return _getTroveRepayableDebts(priceFeed.buildPriceCache(), _borrower, _includingStableCoinGasCompensation);
  }

  function getTroveRepayableDebts(
    PriceCache memory _priceCache,
    address _borrower,
    bool _includingStableCoinGasCompensation
  ) external view override returns (TokenAmount[] memory debts) {
    return _getTroveRepayableDebts(_priceCache, _borrower, _includingStableCoinGasCompensation);
  }

  function _getTroveRepayableDebts(
    PriceCache memory _priceCache,
    address _borrower,
    bool _includingStableCoinGasCompensation
  ) internal view returns (TokenAmount[] memory debts) {
    Trove storage trove = Troves[_borrower];
    if (trove.status != Status.active) return new TokenAmount[](0);

    debts = new TokenAmount[](trove.debtTokens.length);
    for (uint i = 0; i < debts.length; i++) {
      IDebtToken debtToken = trove.debtTokens[i];

      debts[i] = TokenAmount(address(debtToken), trove.debts[debtToken]);

      bool isStableCoin = debtToken.isStableCoin();
      if (isStableCoin) {
        // include gas comp
        if (!_includingStableCoinGasCompensation) debts[i].amount -= STABLE_COIN_GAS_COMPENSATION;

        // calculate borrowing interest (stable coin only)
        uint stableInterest = _calculatePendingBorrowingInterest(_priceCache, trove);
        debts[i].amount += stableInterest;
      }
    }

    // adding the pending rewards
    address[] memory collTokens = tokenManager.getCollTokenAddresses();
    for (uint i = 0; i < collTokens.length; i++) {
      for (uint ii = 0; ii < debts.length; ii++)
        debts[ii].amount += _getPendingDebtReward(_borrower, collTokens[i], address(trove.debtTokens[ii]));
    }

    return debts;
  }

  function getTroveColl(address _borrower) public view override returns (TokenAmount[] memory colls) {
    Trove storage trove = Troves[_borrower];
    if (trove.status != Status.active) return new TokenAmount[](0);

    address[] memory collTokens = tokenManager.getCollTokenAddresses();
    colls = new TokenAmount[](collTokens.length);
    for (uint i = 0; i < colls.length; i++) colls[i] = TokenAmount(collTokens[i], trove.colls[collTokens[i]]);

    return colls;
  }

  function getTroveWithdrawableColl(
    address _borrower,
    address _collTokenAddress
  ) external view override returns (uint amount) {
    Trove storage trove = Troves[_borrower];
    if (trove.status != Status.active) return 0;

    return trove.colls[_collTokenAddress] + _getPendingCollReward(_borrower, _collTokenAddress);
  }

  function getTroveWithdrawableColls(address _borrower) external view override returns (TokenAmount[] memory colls) {
    colls = getTroveColl(_borrower);
    for (uint i = 0; i < colls.length; i++) colls[i].amount += _getPendingCollReward(_borrower, colls[i].tokenAddress);
    return colls;
  }

  /**
   *
   * trove opening + closing
   *
   **/

  // Push the owner's address to the Trove owners list, and record the corresponding array index on the Trove struct
  /* Max array size is 2**128 - 1, i.e. ~3e30 troves. 3e30 LUSD dwarfs the value of all wealth in the world ( which is < 1e15 USD). */
  function addTroveOwnerToArray(address _borrower) external override returns (uint128 index) {
    _requireCallerIsBorrowerOpsOrRedemptionOpsOrLiquidationOps();

    // Push the Troveowner to the array
    TroveOwners.push(_borrower);

    // Record the index of the new Troveowner on their Trove struct
    index = uint128(TroveOwners.length - 1);
    Troves[_borrower].arrayIndex = index;

    return index;
  }

  function closeTroveByProtocol(
    PriceCache memory _priceCache,
    address _borrower,
    Status closedStatus
  ) external override {
    _requireCallerIsBorrowerOpsOrRedemptionOpsOrLiquidationOps();

    assert(closedStatus != Status.nonExistent && closedStatus != Status.active);

    uint numOfOwners = TroveOwners.length;
    if (numOfOwners <= 1) revert OnlyOneTrove();

    Trove storage trove = Troves[_borrower];
    trove.status = closedStatus;
    for (uint i = 0; i < trove.debtTokens.length; i++) {
      IDebtToken a = trove.debtTokens[i];
      trove.debts[a] = 0;
      trove.debtsRegistered[address(a)] = false;
    }
    delete trove.debtTokens;

    for (uint i = 0; i < _priceCache.collPrices.length; i++) trove.colls[_priceCache.collPrices[i].tokenAddress] = 0;
    for (uint i = 0; i < _priceCache.collPrices.length; i++) trove.stakes[_priceCache.collPrices[i].tokenAddress] = 0;

    _removeTroveOwner(_borrower, numOfOwners);
    sortedTroves.remove(_borrower);
    emit TroveClosed(_borrower, closedStatus);
  }

  /*
   * Remove a Trove owner from the TroveOwners array, not preserving array order. Removing owner 'B' does the following:
   * [A B C D E] => [A E C D], and updates E's Trove struct to point to its new array index.
   */
  function _removeTroveOwner(address _borrower, uint _length) internal {
    Status troveStatus = Troves[_borrower].status;
    // It’s set in caller function `_closeTrove`
    assert(troveStatus != Status.nonExistent && troveStatus != Status.active);

    uint128 index = Troves[_borrower].arrayIndex;
    assert(index <= _length - 1);

    address addressToMove = TroveOwners[_length - 1];
    TroveOwners[index] = addressToMove;
    Troves[addressToMove].arrayIndex = index;
    emit TroveIndexUpdated(addressToMove, index);

    TroveOwners.pop();
  }

  /**
   *
   * Helper
   *
   **/

  function getStableCoinBaseRate() external view override returns (uint) {
    return stableCoinBaseRate;
  }

  function getBorrowingRate(bool isStableCoin) public view override returns (uint) {
    if (!isStableCoin) return borrowingFeeFloor;
    return _calcBorrowingRate(stableCoinBaseRate);
  }

  function getBorrowingRateWithDecay(bool isStableCoin) public view override returns (uint) {
    if (!isStableCoin) return borrowingFeeFloor;
    return _calcBorrowingRate(calcDecayedStableCoinBaseRate());
  }

  function _calcBorrowingRate(uint _stableCoinBaseRate) internal view returns (uint) {
    return LiquityMath._min(borrowingFeeFloor + _stableCoinBaseRate, borrowingFeeFloor);
  }

  function getBorrowingFee(uint _debtValue, bool isStableCoin) external view override returns (uint) {
    return _calcBorrowingFee(getBorrowingRate(isStableCoin), _debtValue);
  }

  function getBorrowingFeeWithDecay(uint _debtValue, bool isStableCoin) external view override returns (uint) {
    return _calcBorrowingFee(getBorrowingRateWithDecay(isStableCoin), _debtValue);
  }

  function _calcBorrowingFee(uint _borrowingRate, uint _debtValue) internal pure returns (uint) {
    return (_borrowingRate * _debtValue) / DECIMAL_PRECISION;
  }

  // Updates the stableCoinBaseRate state variable based on time elapsed since the last redemption or stable borrowing operation.
  function decayStableCoinBaseRateFromBorrowing(uint borrowedStable) external override {
    _requireCallerIsBorrowerOpsOrRedemptionOpsOrLiquidationOps();

    if (borrowedStable == 0) return; // only decay the stableCoinBaseRate if stable was borrowed (not stocks)

    uint decayedStableCoinBaseRate = calcDecayedStableCoinBaseRate();
    assert(decayedStableCoinBaseRate <= DECIMAL_PRECISION); // The stableCoinBaseRate can decay to 0
    _updateLastFeeOpTime(decayedStableCoinBaseRate);
  }

  function payBorrowingFee(address _borrower, uint _borrowingFee) external override {
    _requireCallerIsBorrowerOpsOrRedemptionOpsOrLiquidationOps();
    _payBorrowingFee(_borrower, _borrowingFee);
  }

  function _payBorrowingFee(address _borrower, uint _borrowingFee) internal {
    if (_borrowingFee == 0) return;

    uint reserveTransfer = LiquityMath._min(_borrowingFee, reservePool.stableAmountUntilCap());
    uint govStakingPayout = _borrowingFee - reserveTransfer;

    IDebtToken stableCoin = tokenManager.getStableCoin();
    if (reserveTransfer > 0) stableCoin.mint(address(reservePool), reserveTransfer);
    if (govStakingPayout > 0) stableCoin.mint(tokenManager.govPayoutAddress(), govStakingPayout);
    emit PaidBorrowingFee(_borrower, reserveTransfer, govStakingPayout);
  }

  /*
   * This function has two impacts on the stableCoinBaseRate state variable:
   * 1) decays the stableCoinBaseRate based on time passed since last redemption or stable coin borrowing operation.
   * then,
   * 2) increases the stableCoinBaseRate based on the amount redeemed, as a proportion of total supply
   */
  function updateStableCoinBaseRateFromRedemption(
    uint _totalRedeemedStable,
    uint _totalStableCoinSupply
  ) external override {
    _requireCallerIsBorrowerOpsOrRedemptionOpsOrLiquidationOps();

    uint decayedStableCoinBaseRate = calcDecayedStableCoinBaseRate();
    uint redeemedStableFraction = (_totalRedeemedStable * DECIMAL_PRECISION) / _totalStableCoinSupply;

    uint newStableCoinBaseRate = LiquityMath._min(
      decayedStableCoinBaseRate + (redeemedStableFraction / BETA),
      DECIMAL_PRECISION
    ); // cap stableCoinBaseRate at a maximum of 100%
    assert(newStableCoinBaseRate > 0); // Base rate is always non-zero after redemption
    _updateLastFeeOpTime(newStableCoinBaseRate);
  }

  // Update the last fee operation time only if time passed >= decay interval. This prevents base rate griefing.
  function _updateLastFeeOpTime(uint newStableCoinBaseRate) internal {
    stableCoinBaseRate = newStableCoinBaseRate; // Update the StableCoinBaseRate state variable
    emit StableCoinBaseRateUpdated(newStableCoinBaseRate);

    uint timePassed = block.timestamp - lastFeeOperationTime;
    if (timePassed >= 1 minutes) {
      lastFeeOperationTime = block.timestamp;
      emit LastFeeOpTimeUpdated(block.timestamp);
    }
  }

  function calcDecayedStableCoinBaseRate() public view override returns (uint) {
    uint minutesPassed = _minutesPassedSinceLastFeeOp();
    uint decayFactor = LiquityMath._decPow(MINUTE_DECAY_FACTOR, minutesPassed);

    return (stableCoinBaseRate * decayFactor) / DECIMAL_PRECISION;
  }

  function _minutesPassedSinceLastFeeOp() internal view returns (uint) {
    return (block.timestamp - lastFeeOperationTime) / 1 minutes;
  }

  function _requireCallerIsBorrowerOpsOrRedemptionOpsOrLiquidationOps() internal view {
    if (
      msg.sender != borrowerOperationsAddress &&
      msg.sender != redemptionOperationsAddress &&
      msg.sender != liquidationOperationsAddress
    ) revert NotFromBorrowerOrRedemptionOps();
  }

  function _requireTroveIsActive(address _borrower) internal view {
    if (Troves[_borrower].status != Status.active) revert InvalidTrove();
  }
}
