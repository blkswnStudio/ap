// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

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
  uint public override maxDebtsAsCollateral = 0.1e18; // 10%
  uint public override borrowingFeeFloor = 0.005e18; // 0.5%
  uint public override borrowingFeeGovDiscountFrom = 0.2e18; // 20%
  uint public override borrowingFeeGovDiscount = 0.5e18; // 50%
  uint public override borrowingInterestRate = 0; // 0% annual
  bool public override enableLiquidation = true; // Is Liquidation enabled or frozen
  bool public override enableRedeeming = true; // Is Redeeming enabled or frozen
  bool public override enableMintingOnClosedHours = false; // Is minting enabled on closed hours

  // Store the necessary data for a trove
  struct Trove {
    Status status;
    uint128 arrayIndex;
    //
    mapping(IDebtToken => uint) debts;
    uint appliedInterestAt;
    //
    mapping(address => uint) colls; // [collTokenAddress] -> coll amount
    mapping(address => uint) stakes; // [collTokenAddress] -> stake
  }
  mapping(address => Trove) public Troves;

  // Array of all active trove addresses - used to to compute an approximate hint off-chain, for the sorted list insertion
  address[] public TroveOwners;

  // in token amount (not usd)
  mapping(address => uint) public totalStakes; // [collTokenAddress] => total system stake, relative to the coll token
  mapping(address => uint) public totalStakesSnapshot; // [collTokenAddress] => system stake, taken immediately after the latest liquidation
  mapping(address => uint) public totalCollateralSnapshots; // [collTokenAddress] => system collateral snapshot, its != the stake snapshot, because liquidation fees are already paid out / reduced

  // L_Tokens track the sums of accumulated liquidation rewards per unit staked. During its lifetime, each stake earns:
  // A gain of ( stake * [L_TOKEN[T] - L_TOKEN[T](0)] )
  // Where L_TOKEN[T](0) are snapshots of token T for the active Trove taken at the instant the stake was made
  mapping(address => mapping(address => mapping(bool => uint))) public liquidatedTokensPerStake; // [stakeToken][token][isColl] -> liquidated/redistributed amount per stake of the coll token
  mapping(address => mapping(address => mapping(address => mapping(bool => uint))))
    public liquidatedTokensPerStakeSnapshot; // [borrower][stakeToken][token][isColl]

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

  function setEnableLiquidation(bool _enable) external onlyOwner {
    enableLiquidation = _enable;
    emit SetEnableLiquidation(enableLiquidation);
  }

  function setEnableRedeeming(bool _enable) external onlyOwner {
    enableRedeeming = _enable;
    emit SetEnableRedeeming(enableRedeeming);
  }

  function setEnableMintingOnClosedHours(bool _enable) external onlyOwner {
    enableMintingOnClosedHours = _enable;
    emit SetEnableMintingOnClosedHours(enableMintingOnClosedHours);
  }

  function setBorrowingFeeFloor(uint _borrowingFeeFloor) external onlyOwner {
    if (_borrowingFeeFloor > 0.25e18) revert InvalidParameter(); // capped that 25%
    borrowingFeeFloor = _borrowingFeeFloor;
    emit SetBorrowingFeeFloor(borrowingFeeFloor);
  }

  function setBorrowingFeeGovDiscount(
    uint _borrowingFeeGovDiscountFrom,
    uint _borrowingFeeGovDiscount
  ) external onlyOwner {
    if (_borrowingFeeGovDiscountFrom > DECIMAL_PRECISION || _borrowingFeeGovDiscount > DECIMAL_PRECISION)
      revert InvalidParameter();
    borrowingFeeGovDiscountFrom = _borrowingFeeGovDiscountFrom;
    borrowingFeeGovDiscount = _borrowingFeeGovDiscount;
    emit SetBorrowingFeeGovDiscount(borrowingFeeGovDiscountFrom, _borrowingFeeGovDiscount);
  }

  function setBorrowingInterestRate(uint _borrowingInterestRate) external onlyOwner {
    if (_borrowingInterestRate > DECIMAL_PRECISION) revert InvalidParameter();
    borrowingInterestRate = _borrowingInterestRate;
    emit SetBorrowingInterestRate(borrowingInterestRate);
  }

  function setMaxDebtsAsCollateral(uint _maxDebtsAsCollateral) external onlyOwner {
    if (_maxDebtsAsCollateral > DECIMAL_PRECISION) revert InvalidParameter();
    maxDebtsAsCollateral = _maxDebtsAsCollateral;
    emit SetMaxDebtsAsCollateral(maxDebtsAsCollateral);
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
   * collateral stakes
   *
   **/

  // Update borrower's stake based on their latest collateral value
  function updateStakeAndTotalStakes(PriceCache memory _priceCache, address _borrower) external override {
    _requireCallerIsBorrowerOpsOrRedemptionOpsOrLiquidationOps();
    _updateStakeAndTotalStakes(_priceCache, _borrower);
  }

  function _updateStakeAndTotalStakes(PriceCache memory _priceCache, address _borrower) internal {
    TokenAmount[] memory totalStakesCopy = new TokenAmount[](_priceCache.collPrices.length);
    for (uint i = 0; i < _priceCache.collPrices.length; i++) {
      address stakeToken = _priceCache.collPrices[i].tokenAddress;

      uint newBorrowerCollStake;
      uint borrowersCollAmount = Troves[_borrower].colls[stakeToken];

      uint totalCollateralSnapshot = totalCollateralSnapshots[stakeToken];
      if (totalCollateralSnapshot == 0) newBorrowerCollStake = borrowersCollAmount;
      else {
        uint stakedSnapshot = totalStakesSnapshot[stakeToken];
        if (stakedSnapshot > 0) newBorrowerCollStake = (borrowersCollAmount * stakedSnapshot) / totalCollateralSnapshot;
        else newBorrowerCollStake = (borrowersCollAmount * DECIMAL_PRECISION) / totalCollateralSnapshot;
      }

      uint oldBorrowerStake = Troves[_borrower].stakes[stakeToken];
      uint newTotalStake = totalStakes[stakeToken] - oldBorrowerStake + newBorrowerCollStake;
      totalStakes[stakeToken] = newTotalStake;
      totalStakesCopy[i] = TokenAmount(stakeToken, newTotalStake);
      Troves[_borrower].stakes[stakeToken] = newBorrowerCollStake;
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
    _requireCallerIsBorrowerOpsOrRedemptionOpsOrLiquidationOps();

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

    // calc total stake ratios in usd
    uint totalStakeInUSD;
    uint[] memory stakesInUSD = new uint[](_priceCache.collPrices.length);
    for (uint i = 0; i < _priceCache.collPrices.length; i++) {
      address stakeToken = _priceCache.collPrices[i].tokenAddress;
      uint stake = totalStakes[stakeToken];
      if (stake == 0) continue;

      uint stakeInUSD = priceFeed.getUSDValue(_priceCache, stakeToken, stake);
      stakesInUSD[i] = stakeInUSD;
      totalStakeInUSD += stakeInUSD;
    }

    // distribute the rewards over the different coll stakes relative to their system percentage
    for (uint i = 0; i < _priceCache.collPrices.length; i++) {
      uint stakeUSD = stakesInUSD[i];
      if (stakeUSD == 0) continue;

      address stakeToken = _priceCache.collPrices[i].tokenAddress;
      uint stake = totalStakes[stakeToken];

      uint stakeTokenPercentage = (stakeUSD * DECIMAL_PRECISION) / totalStakeInUSD;
      for (uint ii = 0; ii < toRedistribute.length; ii++) {
        CAmount memory entry = toRedistribute[ii];
        if (entry.amount == 0) continue;

        uint stakeTokenAmount = (entry.amount * stakeTokenPercentage) / DECIMAL_PRECISION;
        liquidatedTokensPerStake[stakeToken][entry.tokenAddress][entry.isColl] +=
          (stakeTokenAmount * DECIMAL_PRECISION) /
          stake;
      }
    }

    // move the tokens from active to default pool
    IStoragePool _storagePool = storagePool;
    for (uint i = 0; i < toRedistribute.length; i++) {
      CAmount memory entry = toRedistribute[i];
      if (entry.amount != 0)
        _storagePool.transferBetweenTypes(
          entry.tokenAddress,
          entry.isColl,
          PoolType.Active,
          PoolType.Default,
          entry.amount
        );
    }
  }

  function getTroveStakes(address _borrower, address _collToken) external view override returns (uint) {
    return Troves[_borrower].stakes[_collToken];
  }

  function applyPendingRewards(address _borrower, PriceCache memory _priceCache) external override {
    _requireCallerIsBorrowerOpsOrRedemptionOpsOrLiquidationOps();

    Trove storage _trove = Troves[_borrower];
    if (_trove.status != Status.active) revert InvalidTrove();

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
    CAmount[] memory pendingRewards = _getPendingRewards(_priceCache, _borrower, true, true);
    for (uint i = 0; i < pendingRewards.length; i++) {
      CAmount memory entry = pendingRewards[i];
      if (entry.amount == 0) continue;

      if (entry.isColl) _trove.colls[entry.tokenAddress] += entry.amount;
      else _trove.debts[IDebtToken(entry.tokenAddress)] += entry.amount;

      storagePool.transferBetweenTypes(
        entry.tokenAddress,
        entry.isColl,
        PoolType.Default,
        PoolType.Active,
        entry.amount
      );
    }

    emit TroveAppliedRewards(_borrower, pendingRewards);
    _updateTroveRewardSnapshots(_priceCache, _borrower);
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
    for (uint i = 0; i < _priceCache.debtPrices.length; i++) {
      uint debtTokenAmount = _trove.debts[IDebtToken(_priceCache.debtPrices[i].tokenAddress)];
      if (debtTokenAmount == 0) continue;

      stableInterest += (((_priceFeed.getUSDValue(
        _priceCache,
        _priceCache.debtPrices[i].tokenAddress,
        debtTokenAmount
      ) * borrowingInterestRate) * timePassed) /
        DECIMAL_PRECISION /
        SECONDS_PER_YEAR);
    }

    return stableInterest;
  }

  function getPendingRewards(
    address borrower,
    bool includeColls,
    bool includeDebts
  ) external view override returns (CAmount[] memory) {
    return _getPendingRewards(priceFeed.buildPriceCache(false), borrower, includeColls, includeDebts);
  }

  function _getPendingRewards(
    PriceCache memory _priceCache,
    address _borrower,
    bool includeColls,
    bool includeDebts
  ) internal view returns (CAmount[] memory pendingRewards) {
    // seed empty array
    pendingRewards = new CAmount[](
      (includeColls ? _priceCache.collPrices.length : 0) + (includeDebts ? _priceCache.debtPrices.length : 0)
    );
    if (includeColls)
      for (uint i = 0; i < _priceCache.collPrices.length; i++)
        pendingRewards[i] = CAmount(_priceCache.collPrices[i].tokenAddress, true, 0);
    if (includeDebts)
      for (uint i = 0; i < _priceCache.debtPrices.length; i++)
        pendingRewards[i + (includeColls ? _priceCache.collPrices.length : 0)] = CAmount(
          _priceCache.debtPrices[i].tokenAddress,
          false,
          0
        );

    // load pending rewards based on trove stakes
    Trove storage trove = Troves[_borrower];
    for (uint i = 0; i < _priceCache.collPrices.length; i++) {
      address stakeToken = _priceCache.collPrices[i].tokenAddress;
      uint trovesCollStake = trove.stakes[stakeToken];
      if (trovesCollStake == 0) continue;

      if (includeColls)
        for (uint ii = 0; ii < _priceCache.collPrices.length; ii++) {
          address collToken = _priceCache.collPrices[ii].tokenAddress;
          uint pendingReward = _getPendingReward(_borrower, stakeToken, trovesCollStake, collToken, true);
          if (pendingReward != 0) pendingRewards[ii].amount += pendingReward;
        }

      if (includeDebts)
        for (uint ii = 0; ii < _priceCache.debtPrices.length; ii++) {
          address debtToken = _priceCache.debtPrices[ii].tokenAddress;
          uint pendingReward = _getPendingReward(_borrower, stakeToken, trovesCollStake, debtToken, false);
          if (pendingReward != 0)
            pendingRewards[ii + (includeColls ? _priceCache.collPrices.length : 0)].amount += pendingReward;
        }
    }

    return pendingRewards;
  }

  function _getPendingReward(
    address borrower,
    address stakeToken,
    uint stake,
    address rewardToken,
    bool isColl
  ) internal view returns (uint pendingReward) {
    uint snapshotValue = liquidatedTokensPerStakeSnapshot[borrower][stakeToken][rewardToken][isColl];
    uint rewardsPerStake = liquidatedTokensPerStake[stakeToken][rewardToken][isColl] - snapshotValue;
    if (rewardsPerStake == 0) return 0;
    return (stake * rewardsPerStake) / DECIMAL_PRECISION;
  }

  // using new price cache, client support function
  function getPendingBorrowingInterests(address _borrower) external view override returns (uint) {
    return _calculatePendingBorrowingInterest(priceFeed.buildPriceCache(false), Troves[_borrower]);
  }

  // Update borrower's snapshots to reflect the current values
  function updateTroveRewardSnapshots(PriceCache memory _priceCache, address _borrower) external override {
    _requireCallerIsBorrowerOpsOrRedemptionOpsOrLiquidationOps();
    _updateTroveRewardSnapshots(_priceCache, _borrower);
  }

  function _updateTroveRewardSnapshots(PriceCache memory _priceCache, address _borrower) internal {
    Trove storage _trove = Troves[_borrower];

    // initialising troves applied interests, only relevant after trove opening
    if (_trove.appliedInterestAt == 0) _trove.appliedInterestAt = block.timestamp;

    // updating the reward snapshots
    for (uint i = 0; i < _priceCache.collPrices.length; i++) {
      address stakeToken = _priceCache.collPrices[i].tokenAddress;

      for (uint ii = 0; ii < _priceCache.collPrices.length; ii++) {
        address snapToken = _priceCache.collPrices[ii].tokenAddress;
        liquidatedTokensPerStakeSnapshot[_borrower][stakeToken][snapToken][true] = liquidatedTokensPerStake[stakeToken][
          snapToken
        ][true];
      }

      for (uint ii = 0; ii < _priceCache.debtPrices.length; ii++) {
        address snapToken = _priceCache.debtPrices[ii].tokenAddress;
        liquidatedTokensPerStakeSnapshot[_borrower][stakeToken][snapToken][false] = liquidatedTokensPerStake[
          stakeToken
        ][snapToken][false];
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
    for (uint i = 0; i < _collTokenAmounts.length; i++) {
      if (_collTokenAmounts[i].amount == 0) continue;

      address tokenAddress = _collTokenAmounts[i].tokenAddress;
      trove.colls[tokenAddress] += _collTokenAmounts[i].amount;
    }

    emit TroveCollChanged(_borrower, _collTokenAmounts, true);
  }

  function decreaseTroveColl(address _borrower, TokenAmount[] memory _collTokenAmounts) external override {
    _requireCallerIsBorrowerOpsOrRedemptionOpsOrLiquidationOps();

    Trove storage trove = Troves[_borrower];
    for (uint i = 0; i < _collTokenAmounts.length; i++) {
      address tokenAddress = _collTokenAmounts[i].tokenAddress;
      trove.colls[tokenAddress] -= _collTokenAmounts[i].amount;
    }

    emit TroveCollChanged(_borrower, _collTokenAmounts, false);
  }

  function increaseTroveDebt(address _borrower, DebtTokenAmount[] memory _debtTokenAmounts) external override {
    _requireCallerIsBorrowerOpsOrRedemptionOpsOrLiquidationOps();

    Trove storage trove = Troves[_borrower];
    for (uint i = 0; i < _debtTokenAmounts.length; i++) {
      if (_debtTokenAmounts[i].netDebt == 0) continue;
      trove.debts[_debtTokenAmounts[i].debtToken] += _debtTokenAmounts[i].netDebt;
    }

    emit TroveDebtChanged(_borrower, _debtTokenAmounts, true);
  }

  function decreaseTroveDebt(address _borrower, DebtTokenAmount[] memory _debtTokenAmounts) external override {
    _requireCallerIsBorrowerOpsOrRedemptionOpsOrLiquidationOps();

    Trove storage trove = Troves[_borrower];
    for (uint i = 0; i < _debtTokenAmounts.length; i++) {
      trove.debts[_debtTokenAmounts[i].debtToken] -= _debtTokenAmounts[i].netDebt;
    }

    emit TroveDebtChanged(_borrower, _debtTokenAmounts, false);
  }

  /**
   *
   * trove debt + coll getters
   *
   **/

  function getEntireDebtAndColl(
    PriceCache memory _priceCache,
    address _borrower
  ) external view override returns (RAmount[] memory amounts, uint debtTokenLength) {
    Trove storage trove = Troves[_borrower];

    CAmount[] memory pendingRewards = _getPendingRewards(_priceCache, _borrower, true, true);
    amounts = new RAmount[](pendingRewards.length);
    for (uint i = 0; i < pendingRewards.length; i++) {
      CAmount memory entry = pendingRewards[i];

      bool isStableCoin = !entry.isColl && IDebtToken(entry.tokenAddress).isStableCoin();
      amounts[i] = RAmount(
        entry.tokenAddress,
        entry.isColl,
        entry.isColl ? trove.colls[entry.tokenAddress] : trove.debts[IDebtToken(entry.tokenAddress)],
        entry.amount,
        isStableCoin ? _calculatePendingBorrowingInterest(_priceCache, trove) : 0,
        0,
        0,
        0,
        0
      );
    }

    return (amounts, _priceCache.debtPrices.length);
  }

  function getTroveDebt(address _borrower) public view override returns (TokenAmount[] memory) {
    Trove storage trove = Troves[_borrower];
    if (trove.status != Status.active) return new TokenAmount[](0);

    address[] memory debtTokens = tokenManager.getDebtTokenAddresses();
    TokenAmount[] memory debts = new TokenAmount[](debtTokens.length);
    for (uint i = 0; i < debtTokens.length; i++)
      debts[i] = TokenAmount(debtTokens[i], trove.debts[IDebtToken(debtTokens[i])]);

    return debts;
  }

  function getTroveRepayableDebtAsSwapPair(
    address _borrower,
    address _debtTokenB // token A is always the stable coin
  ) external view override returns (uint amountA, uint amountB) {
    Trove storage trove = Troves[_borrower];
    if (trove.status != Status.active) return (0, 0);

    IDebtToken stableCoin = tokenManager.getStableCoin();
    amountA = trove.debts[stableCoin];

    bool isBDebtToken = tokenManager.isDebtToken(_debtTokenB);
    amountB = isBDebtToken ? trove.debts[IDebtToken(_debtTokenB)] : 0;

    address[] memory collTokens = tokenManager.getCollTokenAddresses();
    for (uint i = 0; i < collTokens.length; i++) {
      address stakeToken = collTokens[i];
      uint trovesCollStake = trove.stakes[stakeToken];
      if (trovesCollStake == 0) continue;

      amountA += _getPendingReward(_borrower, stakeToken, trovesCollStake, address(stableCoin), false);
      if (isBDebtToken) amountB += _getPendingReward(_borrower, stakeToken, trovesCollStake, _debtTokenB, false);
    }

    return (amountA, amountB);
  }

  function getTroveRepayableDebts(address _borrower) external view override returns (TokenAmount[] memory debts) {
    return _getTroveRepayableDebts(priceFeed.buildPriceCache(false), _borrower);
  }

  function getTroveRepayableDebts(
    PriceCache memory _priceCache,
    address _borrower
  ) external view override returns (TokenAmount[] memory debts) {
    return _getTroveRepayableDebts(_priceCache, _borrower);
  }

  function _getTroveRepayableDebts(
    PriceCache memory _priceCache,
    address _borrower
  ) internal view returns (TokenAmount[] memory debts) {
    Trove storage trove = Troves[_borrower];
    if (trove.status != Status.active) return new TokenAmount[](0);

    CAmount[] memory pendingRewards = _getPendingRewards(_priceCache, _borrower, false, true);
    debts = new TokenAmount[](pendingRewards.length);
    for (uint i = 0; i < pendingRewards.length; i++) {
      IDebtToken debtToken = IDebtToken(pendingRewards[i].tokenAddress);
      debts[i] = TokenAmount(pendingRewards[i].tokenAddress, trove.debts[debtToken] + pendingRewards[i].amount);

      // calculate borrowing interest (stable coin only)
      if (debtToken.isStableCoin()) debts[i].amount += _calculatePendingBorrowingInterest(_priceCache, trove);
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

  function getTroveWithdrawableColls(address _borrower) external view override returns (TokenAmount[] memory colls) {
    return _getTroveWithdrawableColls(priceFeed.buildPriceCache(false), _borrower);
  }

  function getTroveWithdrawableColls(
    PriceCache memory _priceCache,
    address _borrower
  ) external view override returns (TokenAmount[] memory colls) {
    return _getTroveWithdrawableColls(_priceCache, _borrower);
  }

  function _getTroveWithdrawableColls(
    PriceCache memory _priceCache,
    address _borrower
  ) internal view returns (TokenAmount[] memory colls) {
    Trove storage trove = Troves[_borrower];
    if (trove.status != Status.active) return new TokenAmount[](0);

    CAmount[] memory pendingRewards = _getPendingRewards(_priceCache, _borrower, true, false);
    colls = new TokenAmount[](pendingRewards.length);
    for (uint i = 0; i < pendingRewards.length; i++)
      colls[i] = TokenAmount(
        pendingRewards[i].tokenAddress,
        trove.colls[pendingRewards[i].tokenAddress] + pendingRewards[i].amount
      );

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
    for (uint i = 0; i < _priceCache.debtPrices.length; i++) {
      IDebtToken a = IDebtToken(_priceCache.debtPrices[i].tokenAddress);
      trove.debts[a] = 0;
    }

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

  function getBorrowingRate(bool isStableCoin, uint govTokenAsCollRatio) public view override returns (uint) {
    return _calcBorrowingRate(isStableCoin ? stableCoinBaseRate : 0, govTokenAsCollRatio);
  }

  function getBorrowingRateWithDecay(bool isStableCoin, uint govTokenAsCollRatio) public view override returns (uint) {
    return _calcBorrowingRate(isStableCoin ? calcDecayedStableCoinBaseRate() : 0, govTokenAsCollRatio);
  }

  function _calcBorrowingRate(uint _additionalRate, uint govTokenAsCollRatio) internal view returns (uint) {
    uint rate = LiquityMath._min(borrowingFeeFloor + _additionalRate, MAX_BORROWING_FEE);
    if (govTokenAsCollRatio > borrowingFeeGovDiscountFrom) rate = (rate * borrowingFeeGovDiscount) / DECIMAL_PRECISION;

    return rate;
  }

  function getBorrowingFee(
    uint _debtValue,
    bool isStableCoin,
    uint govTokenAsCollRatio
  ) external view override returns (uint) {
    return _calcBorrowingFee(getBorrowingRate(isStableCoin, govTokenAsCollRatio), _debtValue);
  }

  function getBorrowingFeeWithDecay(
    uint _debtValue,
    bool isStableCoin,
    uint govTokenAsCollRatio
  ) external view override returns (uint) {
    return _calcBorrowingFee(getBorrowingRateWithDecay(isStableCoin, govTokenAsCollRatio), _debtValue);
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
      lastFeeOperationTime += _minutesPassedSinceLastFeeOp() * 1 minutes;
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

  function _requireCallerIsLiquidationOps() internal view {
    if (msg.sender != liquidationOperationsAddress) revert NotFromBorrowerOrRedemptionOps();
  }
}
