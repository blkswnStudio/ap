// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './Dependencies/LiquityBase.sol';
import './Dependencies/CheckContract.sol';
import './Dependencies/TrustlessPermit.sol';
import './Interfaces/IBorrowerOperations.sol';
import './Interfaces/ITroveManager.sol';
import './Interfaces/IDebtToken.sol';
import './Interfaces/ITokenManager.sol';
import './Interfaces/IStoragePool.sol';
import './Interfaces/IPriceFeed.sol';
import './Interfaces/IBBase.sol';
import './Interfaces/ISortedTroves.sol';
import './Interfaces/ICollSurplusPool.sol';

contract BorrowerOperations is LiquityBase, Ownable(msg.sender), CheckContract, IBorrowerOperations {
  using SafeERC20 for IERC20;

  string public constant NAME = 'BorrowerOperations';

  // --- Connected contract declarations ---

  ITroveManager public troveManager;
  ITokenManager public tokenManager;
  IStoragePool public storagePool;
  IPriceFeed public priceFeed;
  ISortedTroves public sortedTroves;
  ICollSurplusPool public collSurplusPool;
  address public swapOperations;

  /* --- Variable container structs  ---

    Used to hold, return and assign variables inside a function, in order to avoid the error:
    "CompilerError: Stack too deep". */

  struct LocalVariables_openTrove {
    PriceCache priceCache;
    //
    TokenAmount[] colls;
    DebtTokenAmount[] debts;
    uint compositeDebtInUSD;
    uint compositeCollInUSD;
    uint ICR;
    uint IMCR;
    uint arrayIndex;
    //
    bool isInRecoveryMode;
    uint TCR;
    uint entireSystemColl;
    uint entireSystemDebt;
  }

  struct LocalVariables_adjustTrove {
    PriceCache priceCache;
    //
    TokenAmount[] colls;
    DebtTokenAmount[] debts;
    DebtTokenAmount stableCoinEntry;
    //
    uint oldCompositeDebtInUSD;
    uint oldCompositeCollInUSD;
    uint oldICR;
    //
    uint newCompositeDebtInUSD;
    uint newCompositeCollInUSD;
    uint newRedeemableCollInUSD;
    uint newICR;
    uint newIMCR;
    uint remainingStableDebt;
    //
    bool isInRecoveryMode;
    uint entireSystemColl;
    uint entireSystemDebt;
  }

  struct LocalVariables_closeTrove {
    PriceCache priceCache;
    //
    bool isInRecoveryMode;
    uint newTCR;
    uint entireSystemColl;
    uint entireSystemDebt;
  }

  struct ContractsCache {
    ITroveManager troveManager;
    IStoragePool storagePool;
    ITokenManager tokenManager;
    IPriceFeed priceFeed;
  }

  // --- Dependency setters ---

  function setAddresses(
    address _troveManagerAddress,
    address _storagePoolAddress,
    address _priceFeedAddress,
    address _tokenManagerAddress,
    address _swapOperationsAddress,
    address _sortedTrovesAddress,
    address _collSurplusPoolAddress
  ) external onlyOwner {
    checkContract(_troveManagerAddress);
    checkContract(_storagePoolAddress);
    checkContract(_priceFeedAddress);
    checkContract(_tokenManagerAddress);
    checkContract(_swapOperationsAddress);
    checkContract(_sortedTrovesAddress);
    checkContract(_collSurplusPoolAddress);

    troveManager = ITroveManager(_troveManagerAddress);
    storagePool = IStoragePool(_storagePoolAddress);
    priceFeed = IPriceFeed(_priceFeedAddress);
    tokenManager = ITokenManager(_tokenManagerAddress);
    swapOperations = _swapOperationsAddress;
    sortedTroves = ISortedTroves(_sortedTrovesAddress);
    collSurplusPool = ICollSurplusPool(_collSurplusPoolAddress);

    emit BorrowerOperationsInitialized(
      _troveManagerAddress,
      _storagePoolAddress,
      _priceFeedAddress,
      _tokenManagerAddress,
      _swapOperationsAddress,
      _sortedTrovesAddress,
      _collSurplusPoolAddress
    );

    renounceOwnership();
  }

  // --- Borrower Trove Operations ---

  function openTrove(TokenAmount[] memory _colls, bytes[] memory _priceUpdateData) public payable override {
    _openTrove(msg.sender, _colls, _priceUpdateData);
  }

  function openTroveWithPermit(
    TokenAmount[] memory _colls,
    bytes[] memory _priceUpdateData,
    uint deadline,
    uint8[] memory v,
    bytes32[] memory r,
    bytes32[] memory s
  ) external payable {
    for (uint i = 0; i < _colls.length; i++)
      TrustlessPermit.trustlessPermit(
        _colls[i].tokenAddress,
        msg.sender,
        address(this),
        _colls[i].amount,
        deadline,
        v[i],
        r[i],
        s[i]
      );

    openTrove(_colls, _priceUpdateData);
  }

  function _openTrove(address borrower, TokenAmount[] memory _colls, bytes[] memory _priceUpdateData) internal {
    ContractsCache memory contractsCache = ContractsCache(troveManager, storagePool, tokenManager, priceFeed);
    _requireTroveIsNotActive(contractsCache.troveManager, borrower);

    // update prices and build price cache
    LocalVariables_openTrove memory vars;
    contractsCache.priceFeed.updatePythPrices{ value: msg.value }(_priceUpdateData);
    vars.priceCache = contractsCache.priceFeed.buildPriceCache(true);

    // check recovery mode
    (vars.isInRecoveryMode, , vars.entireSystemColl, vars.entireSystemDebt) = contractsCache
      .storagePool
      .checkRecoveryMode(vars.priceCache);

    vars.compositeDebtInUSD = 0;
    vars.colls = _colls;
    (vars.compositeCollInUSD, ) = _getCompositeColl(
      contractsCache.tokenManager,
      contractsCache.priceFeed,
      vars.priceCache,
      vars.colls
    );

    // check if the trove has enough coll
    if (vars.compositeCollInUSD < MIN_TROVE_COLL_USD) revert TroveBelowMinCollateral();

    // ICR is > IMCR anyway, because of 0 debt
    // new trove will always be positive for the system (because of 0 debt), therefore no TCR checks
    vars.ICR = LiquityMath._computeCR(vars.compositeCollInUSD, vars.compositeDebtInUSD);
    vars.IMCR = _calculateIMCR(vars);

    // Set the trove struct's properties
    contractsCache.troveManager.setTroveStatus(borrower, 1); // active
    contractsCache.troveManager.increaseTroveColl(borrower, vars.colls);
    contractsCache.troveManager.updateTroveRewardSnapshots(vars.priceCache, borrower);
    contractsCache.troveManager.updateStakeAndTotalStakes(vars.priceCache, borrower);

    // just adding the trove to the general list, but not the sorted one, cause no redeemable stable debt yet
    vars.arrayIndex = contractsCache.troveManager.addTroveOwnerToArray(borrower);

    // Move the coll to the active pool
    for (uint i = 0; i < vars.colls.length; i++) {
      TokenAmount memory collTokenAmount = vars.colls[i];
      _poolAddColl(
        borrower,
        contractsCache.storagePool,
        collTokenAmount.tokenAddress,
        collTokenAmount.amount,
        PoolType.Active
      );
    }

    emit TroveCreated(borrower, _colls);
  }

  // Send collateral to a trove
  function addColl(
    TokenAmount[] memory _colls,
    address _upperHint,
    address _lowerHint,
    bytes[] memory _priceUpdateData
  ) public payable override {
    address borrower = msg.sender;
    (ContractsCache memory contractsCache, LocalVariables_adjustTrove memory vars) = _prepareTroveAdjustment(
      borrower,
      _priceUpdateData,
      false
    );

    // revert debt token deposit (as coll) if a secondary price is used (off-market)
    // stable token is excluded from that exception
    _requirePrimaryPriceSourcesForDebtToken(contractsCache, vars.priceCache, _colls);

    (uint addedColl, uint addedRedeemableColl) = _getCompositeColl(
      contractsCache.tokenManager,
      contractsCache.priceFeed,
      vars.priceCache,
      _colls
    );
    vars.newCompositeCollInUSD += addedColl;
    vars.newRedeemableCollInUSD += addedRedeemableColl;
    vars.newIMCR = _calculateIMCR(vars, _colls, true);
    contractsCache.troveManager.increaseTroveColl(borrower, _colls);

    _finaliseTrove(false, false, contractsCache, vars, borrower, _upperHint, _lowerHint);

    // transfer the coll to the active pool
    for (uint i = 0; i < _colls.length; i++) {
      TokenAmount memory collTokenAmount = _colls[i];
      _poolAddColl(
        borrower,
        contractsCache.storagePool,
        collTokenAmount.tokenAddress,
        collTokenAmount.amount,
        PoolType.Active
      );
    }
  }

  function addCollWithPermit(
    TokenAmount[] memory _colls,
    uint deadline,
    uint8[] memory v,
    bytes32[] memory r,
    bytes32[] memory s,
    address _upperHint,
    address _lowerHint,
    bytes[] memory _priceUpdateData
  ) external payable {
    for (uint i = 0; i < _colls.length; i++)
      TrustlessPermit.trustlessPermit(
        _colls[i].tokenAddress,
        msg.sender,
        address(this),
        _colls[i].amount,
        deadline,
        v[i],
        r[i],
        s[i]
      );

    addColl(_colls, _upperHint, _lowerHint, _priceUpdateData);
  }

  // Withdraw collateral from a trove
  function withdrawColl(
    TokenAmount[] memory _colls,
    address _upperHint,
    address _lowerHint,
    bytes[] memory _priceUpdateData
  ) external payable override {
    address borrower = msg.sender;
    (ContractsCache memory contractsCache, LocalVariables_adjustTrove memory vars) = _prepareTroveAdjustment(
      borrower,
      _priceUpdateData,
      false
    );

    // revert debt token withdrawal (as coll) if a secondary price is used (off-market)
    // stable token is excluded from that exception
    _requirePrimaryPriceSourcesForDebtToken(contractsCache, vars.priceCache, _colls);

    (uint removedColl, uint removedRedeemableColl) = _getCompositeColl(
      contractsCache.tokenManager,
      contractsCache.priceFeed,
      vars.priceCache,
      _colls
    );
    if (removedColl > vars.newCompositeCollInUSD) revert WithdrawAmount_gt_Coll();
    vars.newCompositeCollInUSD -= removedColl;

    // revert if the trove has less than the minimum collateral
    if (vars.newCompositeCollInUSD < MIN_TROVE_COLL_USD) revert TroveBelowMinCollateral();

    vars.newRedeemableCollInUSD -= removedRedeemableColl;
    vars.newIMCR = _calculateIMCR(vars, _colls, false);
    contractsCache.troveManager.decreaseTroveColl(borrower, _colls);

    // checking is the trove has enough coll for the withdrawal
    for (uint i = 0; i < _colls.length; i++) {
      TokenAmount memory collTokenAmount = _colls[i];
      TokenAmount memory existingColl;
      for (uint ii = 0; ii < vars.colls.length; ii++) {
        if (vars.colls[ii].tokenAddress != collTokenAmount.tokenAddress) continue;
        existingColl = vars.colls[ii];
        break;
      }
      assert(existingColl.amount >= collTokenAmount.amount);
    }

    _finaliseTrove(true, false, contractsCache, vars, borrower, _upperHint, _lowerHint);

    // transfer the coll from the active pool to the borrower
    for (uint i = 0; i < _colls.length; i++) {
      TokenAmount memory collTokenAmount = _colls[i];
      _poolSubtractColl(
        borrower,
        contractsCache.storagePool,
        collTokenAmount.tokenAddress,
        collTokenAmount.amount,
        PoolType.Active
      );
    }
  }

  function _requirePrimaryPriceSourcesForDebtToken(
    ContractsCache memory contractsCache,
    PriceCache memory _priceCache,
    TokenAmount[] memory _colls
  ) internal view {
    for (uint i = 0; i < _colls.length; i++) {
      address collTokenAddress = _colls[i].tokenAddress;
      if (!contractsCache.tokenManager.isDebtToken(collTokenAddress)) continue;

      TokenPrice memory tokenPrice = contractsCache.priceFeed.getTokenPrice(_priceCache, collTokenAddress);
      if (!tokenPrice.isPrimary) revert UntrustedOraclesDebtTokenDeposit(); // the stable token is always isPrimary=true and therefore also off-market depositable
    }
  }

  function increaseStableDebt(
    uint _stableAmount,
    MintMeta memory _meta,
    bytes[] memory _priceUpdateData
  ) external payable {
    address borrower = msg.sender;

    (ContractsCache memory contractsCache, LocalVariables_adjustTrove memory vars) = _prepareTroveAdjustment(
      borrower,
      _priceUpdateData,
      false // execute pyth price update
    );

    // amount for stable
    TokenAmount[] memory debts = new TokenAmount[](1);
    debts[0] = TokenAmount({ tokenAddress: address(tokenManager.getStableCoin()), amount: _stableAmount });

    _increaseDebt(contractsCache, vars, borrower, borrower, debts, _meta);
  }

  function increaseDebt(
    address _borrower,
    address _to,
    TokenAmount[] memory _debts,
    MintMeta memory _meta
  ) external payable override {
    _requireCallerIsSwapOperations();

    (ContractsCache memory contractsCache, LocalVariables_adjustTrove memory vars) = _prepareTroveAdjustment(
      _borrower,
      new bytes[](0),
      true //will be called by swap operations, which handled the price update already
    );

    _increaseDebt(contractsCache, vars, _borrower, _to, _debts, _meta);
  }

  // increasing debt of a trove
  function _increaseDebt(
    ContractsCache memory contractsCache,
    LocalVariables_adjustTrove memory vars,
    address _borrower,
    address _to,
    TokenAmount[] memory _debts,
    MintMeta memory _meta
  ) internal {
    _requireValidMaxFeePercentage(contractsCache.troveManager, _meta.maxFeePercentage, vars.isInRecoveryMode);
    for (uint i = 0; i < _debts.length; i++) _requireNonZeroDebtChange(_debts[i].amount);

    // revert minting if the oracle is untrusted
    // the stable token is always isPrimary=true and therefore also off-market mintable
    if (!contractsCache.troveManager.enableMintingOnClosedHours())
      for (uint i = 0; i < _debts.length; i++) {
        TokenPrice memory tokenPrice = contractsCache.priceFeed.getTokenPrice(vars.priceCache, _debts[i].tokenAddress);
        if (!tokenPrice.isPrimary) revert UntrustedOraclesMintingIsFrozen();
      }

    // revert if more then 10% of the borrowers collateral consists of debt tokens, it should not be possible to mint new debt
    // the stable token is excluded from that exception, it will remain mintable
    (uint debtTokenAsCollRatio, uint govTokenAsCollRatio) = _calcCollRatios(contractsCache, vars);
    if (debtTokenAsCollRatio > contractsCache.troveManager.maxDebtsAsCollateral()) revert UsedTooMuchDebtAsCollateral();

    (DebtTokenAmount[] memory debtsToAdd, DebtTokenAmount memory stableCoinAmount) = _getDebtTokenAmounts(
      contractsCache.tokenManager,
      _debts,
      true
    );

    // adding the borrowing fee to the net debt
    if (!vars.isInRecoveryMode)
      _addBorrowingFees(
        contractsCache,
        vars.priceCache,
        _borrower,
        debtsToAdd,
        stableCoinAmount,
        _meta.maxFeePercentage,
        govTokenAsCollRatio
      );

    vars.newCompositeDebtInUSD += _getCompositeDebt(contractsCache.priceFeed, vars.priceCache, debtsToAdd);
    vars.newIMCR = _calculateIMCR(vars);
    contractsCache.troveManager.increaseTroveDebt(_borrower, debtsToAdd);

    // mint the debt tokens and update the storage pool
    for (uint i = 0; i < debtsToAdd.length; i++) {
      DebtTokenAmount memory debtTokenAmount = debtsToAdd[i];
      _poolAddDebt(
        _to,
        contractsCache.storagePool,
        debtTokenAmount.debtToken,
        debtTokenAmount.netDebt,
        debtTokenAmount.borrowingFee
      );
    }

    vars.remainingStableDebt += stableCoinAmount.netDebt; // added stable debt (including all fees)
    _finaliseTrove(false, true, contractsCache, vars, _borrower, _meta.upperHint, _meta.lowerHint);
  }

  function _calcCollRatios(
    ContractsCache memory contractsCache,
    LocalVariables_adjustTrove memory vars
  ) internal view returns (uint debtTokenAsCollRatio, uint uintGovTokenAsCollRatio) {
    uint debtTokensUsedAsCollInUSD = 0;
    for (uint i = 0; i < vars.colls.length; i++) {
      TokenAmount memory collTokenAmount = vars.colls[i];
      if (
        contractsCache.tokenManager.isDebtToken(collTokenAmount.tokenAddress) &&
        collTokenAmount.tokenAddress != address(contractsCache.tokenManager.getStableCoin()) // exclude stable coin from the ratio
      )
        debtTokensUsedAsCollInUSD += contractsCache.priceFeed.getUSDValue(
          vars.priceCache,
          collTokenAmount.tokenAddress,
          collTokenAmount.amount
        );
      else if (collTokenAmount.tokenAddress == contractsCache.tokenManager.govTokenAddress())
        uintGovTokenAsCollRatio =
          (contractsCache.priceFeed.getUSDValue(vars.priceCache, collTokenAmount.tokenAddress, collTokenAmount.amount) *
            DECIMAL_PRECISION) /
          vars.oldCompositeCollInUSD;
    }

    debtTokenAsCollRatio = (debtTokensUsedAsCollInUSD * DECIMAL_PRECISION) / vars.oldCompositeCollInUSD;
  }

  // repay debt of a trove
  function repayDebt(
    TokenAmount[] memory _debts,
    address _upperHint,
    address _lowerHint,
    bytes[] memory _priceUpdateData
  ) external payable override {
    address borrower = msg.sender;

    (ContractsCache memory contractsCache, LocalVariables_adjustTrove memory vars) = _prepareTroveAdjustment(
      borrower,
      _priceUpdateData,
      false
    );
    (DebtTokenAmount[] memory debtsToRemove, DebtTokenAmount memory stableCoinEntry) = _handleRepayStates(
      contractsCache,
      vars,
      borrower,
      _debts
    );

    vars.remainingStableDebt -= stableCoinEntry.netDebt;
    _finaliseTrove(false, false, contractsCache, vars, borrower, _upperHint, _lowerHint);

    for (uint i = 0; i < debtsToRemove.length; i++) {
      DebtTokenAmount memory debtTokenAmount = debtsToRemove[i];
      _poolRepayDebt(
        borrower,
        contractsCache.storagePool,
        debtTokenAmount.debtToken,
        debtTokenAmount.netDebt // it is not possible to repay the gasComp, this happens only when the trove is closed
      );
    }
  }

  // repay debt of a trove directly from swap ops after pool liquidity removal (burning)
  // the debt tokens are directly burned from the swap ops
  function repayDebtFromPoolBurn(
    address borrower,
    TokenAmount[] memory _debts,
    address _upperHint,
    address _lowerHint
  ) external override {
    _requireCallerIsSwapOperations();

    bytes[] memory emptyUpdateData;
    (ContractsCache memory contractsCache, LocalVariables_adjustTrove memory vars) = _prepareTroveAdjustment(
      borrower,
      emptyUpdateData, // pool burn already updated price cache
      true
    );
    (DebtTokenAmount[] memory debtsToRemove, DebtTokenAmount memory stableCoinEntry) = _handleRepayStates(
      contractsCache,
      vars,
      borrower,
      _debts
    );

    vars.remainingStableDebt -= stableCoinEntry.netDebt;
    _finaliseTrove(false, false, contractsCache, vars, borrower, _upperHint, _lowerHint);

    for (uint i = 0; i < debtsToRemove.length; i++) {
      DebtTokenAmount memory debtTokenAmount = debtsToRemove[i];
      contractsCache.storagePool.subtractValue(
        address(debtTokenAmount.debtToken),
        false,
        PoolType.Active,
        debtTokenAmount.netDebt
      );
    }
  }

  function _handleRepayStates(
    ContractsCache memory contractsCache,
    LocalVariables_adjustTrove memory vars,
    address borrower,
    TokenAmount[] memory _debts
  ) internal returns (DebtTokenAmount[] memory debtsToRemove, DebtTokenAmount memory stableCoinEntry) {
    (debtsToRemove, stableCoinEntry) = _getDebtTokenAmounts(contractsCache.tokenManager, _debts, false);

    for (uint i = 0; i < debtsToRemove.length; i++) {
      DebtTokenAmount memory debtTokenAmount = debtsToRemove[i];
      address debtTokenAddress = address(debtTokenAmount.debtToken);

      // check zero amount
      if (debtTokenAmount.netDebt == 0) revert ZeroDebtRepay();

      // checking if the trove has enough debt for the repayment (gas comp needs to remain)
      DebtTokenAmount memory existingDebt;
      for (uint ii = 0; ii < vars.debts.length; ii++) {
        if (address(vars.debts[ii].debtToken) != debtTokenAddress) continue;
        existingDebt = vars.debts[ii];
        break;
      }
      _requireAtLeastMinNetDebt(existingDebt.netDebt, debtTokenAmount.netDebt);
    }

    vars.newCompositeDebtInUSD -= _getCompositeDebt(contractsCache.priceFeed, vars.priceCache, debtsToRemove);
    vars.newIMCR = _calculateIMCR(vars);
    contractsCache.troveManager.decreaseTroveDebt(borrower, debtsToRemove);

    return (debtsToRemove, stableCoinEntry);
  }

  function closeTrove(bytes[] memory _priceUpdateData) external payable override {
    address borrower = msg.sender;
    (ContractsCache memory contractsCache, LocalVariables_adjustTrove memory vars) = _prepareTroveAdjustment(
      borrower,
      _priceUpdateData,
      false
    );

    _requireNotInRecoveryMode(vars.isInRecoveryMode);

    uint newTCR = _getNewTCRFromTroveChange(
      vars.oldCompositeCollInUSD,
      false,
      vars.oldCompositeDebtInUSD,
      false,
      vars.entireSystemColl,
      vars.entireSystemDebt
    );
    _requireNewTCRisAboveCCR(newTCR);

    contractsCache.troveManager.removeStake(vars.priceCache, borrower);
    contractsCache.troveManager.closeTroveByProtocol(vars.priceCache, borrower, Status.closedByOwner);

    // repay any open debts
    for (uint i = 0; i < vars.debts.length; i++) {
      DebtTokenAmount memory debtTokenAmount = vars.debts[i];
      if (debtTokenAmount.netDebt == 0) continue;

      _poolRepayDebt(borrower, contractsCache.storagePool, debtTokenAmount.debtToken, debtTokenAmount.netDebt);
    }

    // Send the collateral back to the user
    for (uint i = 0; i < vars.colls.length; i++) {
      TokenAmount memory collTokenAmount = vars.colls[i];

      _poolSubtractColl(
        borrower,
        contractsCache.storagePool,
        collTokenAmount.tokenAddress,
        collTokenAmount.amount,
        PoolType.Active
      );
    }
  }

  /**
   * Claim remaining collateral from a redemption or from a liquidation with ICR > MCR in Recovery Mode
   */
  function claimCollateral() external override {
    collSurplusPool.claimColl(msg.sender);
  }

  // --- Helper functions ---

  function _calculateIMCR(
    LocalVariables_adjustTrove memory vars,
    TokenAmount[] memory _colls,
    bool _addColls
  ) internal view returns (uint IMCR) {
    uint maxDebtInUSD;
    for (uint i = 0; i < vars.priceCache.collPrices.length; i++) {
      TokenPrice memory tokenPriceEntry = vars.priceCache.collPrices[i];

      uint collAmount = vars.colls[i].amount;
      for (uint ii = 0; ii < _colls.length; ii++) {
        if (tokenPriceEntry.tokenAddress != _colls[ii].tokenAddress) continue;

        if (_addColls) collAmount += _colls[ii].amount;
        else collAmount -= _colls[ii].amount;
        break;
      }

      maxDebtInUSD += LiquityMath._computeMaxDebtValue(
        priceFeed.getUSDValue(tokenPriceEntry, collAmount),
        tokenPriceEntry.supportedCollateralRatio
      );
    }

    return LiquityMath._computeIMCR(maxDebtInUSD, vars.newCompositeCollInUSD);
  }

  function _calculateIMCR(LocalVariables_adjustTrove memory vars) internal view returns (uint IMCR) {
    uint maxDebtInUSD;
    for (uint i = 0; i < vars.priceCache.collPrices.length; i++) {
      TokenPrice memory tokenPriceEntry = vars.priceCache.collPrices[i];

      maxDebtInUSD += LiquityMath._computeMaxDebtValue(
        priceFeed.getUSDValue(tokenPriceEntry, vars.colls[i].amount),
        tokenPriceEntry.supportedCollateralRatio
      );
    }

    return LiquityMath._computeIMCR(maxDebtInUSD, vars.newCompositeCollInUSD);
  }

  function _calculateIMCR(LocalVariables_openTrove memory vars) internal view returns (uint IMCR) {
    uint maxDebtInUSD;
    for (uint i = 0; i < vars.colls.length; i++) {
      TokenPrice memory tokenPriceEntry = priceFeed.getTokenPrice(vars.priceCache, vars.colls[i].tokenAddress);

      maxDebtInUSD += LiquityMath._computeMaxDebtValue(
        priceFeed.getUSDValue(tokenPriceEntry, vars.colls[i].amount),
        tokenPriceEntry.supportedCollateralRatio
      );
    }

    return LiquityMath._computeIMCR(maxDebtInUSD, vars.compositeCollInUSD);
  }

  function _prepareTroveAdjustment(
    address _borrower,
    bytes[] memory _priceUpdateData,
    bool _skipPriceUpdate
  ) internal returns (ContractsCache memory contractsCache, LocalVariables_adjustTrove memory vars) {
    contractsCache = ContractsCache(troveManager, storagePool, tokenManager, priceFeed);

    // update prices and build price cache (if no skip, because already updated)
    if (!_skipPriceUpdate) contractsCache.priceFeed.updatePythPrices{ value: msg.value }(_priceUpdateData);
    vars.priceCache = contractsCache.priceFeed.buildPriceCache(true);

    // check recovery mode
    (vars.isInRecoveryMode, , vars.entireSystemColl, vars.entireSystemDebt) = contractsCache
      .storagePool
      .checkRecoveryMode(vars.priceCache);

    _requireTroveIsActive(contractsCache.troveManager, _borrower);
    contractsCache.troveManager.applyPendingRewards(_borrower, vars.priceCache); // from redistributions

    // fetching old/current debts and colls including prices + calc ICR
    (vars.debts, vars.stableCoinEntry) = _getDebtTokenAmounts(
      contractsCache.tokenManager,
      contractsCache.troveManager.getTroveDebt(_borrower),
      true
    );
    vars.remainingStableDebt = vars.stableCoinEntry.netDebt;
    vars.oldCompositeDebtInUSD = _getCompositeDebt(contractsCache.priceFeed, vars.priceCache, vars.debts);
    vars.newCompositeDebtInUSD = vars.oldCompositeDebtInUSD;

    vars.colls = contractsCache.troveManager.getTroveColl(_borrower);
    (vars.oldCompositeCollInUSD, vars.newRedeemableCollInUSD) = _getCompositeColl(
      contractsCache.tokenManager,
      contractsCache.priceFeed,
      vars.priceCache,
      vars.colls
    );
    vars.newCompositeCollInUSD = vars.oldCompositeCollInUSD;

    vars.oldICR = LiquityMath._computeCR(vars.oldCompositeCollInUSD, vars.oldCompositeDebtInUSD);
    return (contractsCache, vars);
  }

  function _finaliseTrove(
    bool _isCollWithdrawal,
    bool _isDebtIncrease,
    ContractsCache memory contractsCache,
    LocalVariables_adjustTrove memory vars,
    address _borrower,
    address _upperHint,
    address _lowerHint
  ) internal {
    // calculate the new ICR
    vars.newICR = LiquityMath._computeCR(vars.newCompositeCollInUSD, vars.newCompositeDebtInUSD);

    // Check the adjustment satisfies all conditions for the current system mode
    _requireValidAdjustmentInCurrentMode(_isCollWithdrawal, _isDebtIncrease, vars);

    // update troves stake
    contractsCache.troveManager.updateStakeAndTotalStakes(vars.priceCache, _borrower);

    // update the troves list position
    sortedTroves.update(
      _borrower,
      vars.newICR,
      vars.remainingStableDebt,
      vars.newRedeemableCollInUSD,
      _upperHint,
      _lowerHint
    );
  }

  function _getNewTCRFromTroveChange(
    uint _collChange,
    bool _isCollIncrease,
    uint _debtChange,
    bool _isDebtIncrease,
    uint entireSystemColl,
    uint entireSystemDebt
  ) internal pure returns (uint) {
    uint totalColl = _isCollIncrease ? entireSystemColl + _collChange : entireSystemColl - _collChange;
    uint totalDebt = _isDebtIncrease ? entireSystemDebt + _debtChange : entireSystemDebt - _debtChange;

    uint newTCR = LiquityMath._computeCR(totalColl, totalDebt);
    return newTCR;
  }

  function _addBorrowingFees(
    ContractsCache memory _contractsCache,
    PriceCache memory _priceCache,
    address _borrower,
    DebtTokenAmount[] memory _debts,
    DebtTokenAmount memory _stableCoinAmount,
    uint _maxFeePercentage,
    uint govTokenAsCollRatio
  ) internal {
    _contractsCache.troveManager.decayStableCoinBaseRateFromBorrowing(_stableCoinAmount.netDebt); // decay the baseRate state variable

    TokenPrice memory stableCoinPrice = _contractsCache.priceFeed.getTokenPrice(
      _priceCache,
      address(_stableCoinAmount.debtToken)
    );
    uint compositeDebtInUSD = _getCompositeDebt(_contractsCache.priceFeed, _priceCache, _debts);
    uint stableCoinDebtInUSD = priceFeed.getUSDValue(stableCoinPrice, _stableCoinAmount.netDebt);

    uint borrowingFee = _contractsCache.troveManager.getBorrowingFee(
      compositeDebtInUSD - stableCoinDebtInUSD,
      false,
      govTokenAsCollRatio
    ) + _contractsCache.troveManager.getBorrowingFee(stableCoinDebtInUSD, true, govTokenAsCollRatio);
    _requireUserAcceptsFee(borrowingFee, compositeDebtInUSD, _maxFeePercentage);

    // update troves debts
    borrowingFee = _contractsCache.priceFeed.getAmountFromUSDValue(stableCoinPrice, borrowingFee);
    _stableCoinAmount.netDebt += borrowingFee;
    _stableCoinAmount.borrowingFee += borrowingFee;

    // transfer the borrowing fee to the gov/reserve
    _contractsCache.troveManager.payBorrowingFee(_borrower, borrowingFee);
  }

  function _poolAddColl(
    address _borrower,
    IStoragePool _pool,
    address _collAddress,
    uint _amount,
    PoolType _poolType
  ) internal {
    _pool.addValue(_collAddress, true, _poolType, _amount);
    IERC20(_collAddress).safeTransferFrom(_borrower, address(_pool), _amount);
  }

  function _poolSubtractColl(
    address _borrower,
    IStoragePool _pool,
    address _collAddress,
    uint _amount,
    PoolType _poolType
  ) internal {
    _pool.withdrawalValue(_borrower, _collAddress, true, _poolType, _amount);
  }

  function _poolAddDebt(
    address _tokenRecipient,
    IStoragePool _storagePool,
    IDebtToken _debtToken,
    uint _netDebtIncrease,
    uint _borrowingFee
  ) internal {
    _storagePool.addValue(address(_debtToken), false, PoolType.Active, _netDebtIncrease);

    // payout issued debt to the recipient
    uint mintAmount = _netDebtIncrease - _borrowingFee;
    if (mintAmount > 0) _debtToken.mint(_tokenRecipient, mintAmount);
  }

  function _poolRepayDebt(
    address _borrower,
    IStoragePool _storagePool,
    IDebtToken _debtToken,
    uint _repayAmount
  ) internal {
    _requireSufficientDebtBalance(_debtToken, _borrower, _repayAmount);
    _storagePool.subtractValue(address(_debtToken), false, PoolType.Active, _repayAmount);
    _debtToken.burn(_borrower, _repayAmount);
  }

  // --- 'Require' wrapper functions ---

  function _requireCallerIsSwapOperations() internal view {
    if (msg.sender != swapOperations) revert NotFromSwapOps();
  }

  function _requireCallerIsBorrower(address _borrower) internal view {
    if (msg.sender != _borrower) revert NotBorrower();
  }

  function _requireTroveIsActive(ITroveManager _troveManager, address _borrower) internal view {
    uint status = _troveManager.getTroveStatus(_borrower);
    if (status != 1) revert TroveClosedOrNotExist();
  }

  function _requireNotInRecoveryMode(bool _isInRecoveryMode) internal pure {
    if (_isInRecoveryMode) revert NotAllowedInRecoveryMode();
  }

  function _requireTroveIsNotActive(ITroveManager _troveManager, address _borrower) internal view {
    uint status = _troveManager.getTroveStatus(_borrower);
    if (status == 1) revert ActiveTrove();
  }

  function _requireSufficientDebtBalance(IDebtToken _debtToken, address _borrower, uint _debtRepayment) internal view {
    if (_debtToken.balanceOf(_borrower) < _debtRepayment) revert InsufficientDebtToRepay();
  }

  // adds stableCoin debt including gas compensation if not already included
  function _getDebtTokenAmounts(
    ITokenManager _dTokenManager,
    TokenAmount[] memory _debts,
    bool addStableEntry
  ) internal view returns (DebtTokenAmount[] memory debtTokenAmounts, DebtTokenAmount memory stableCoinEntry) {
    bool stableCoinIncluded = false;
    if (addStableEntry) {
      address stableCoinAddress = address(_dTokenManager.getStableCoin());
      for (uint i = 0; i < _debts.length; i++) {
        if (_debts[i].tokenAddress != stableCoinAddress) continue;

        stableCoinIncluded = true;
        break;
      }
    }

    if (stableCoinIncluded || !addStableEntry) debtTokenAmounts = new DebtTokenAmount[](_debts.length);
    else debtTokenAmounts = new DebtTokenAmount[](_debts.length + 1);

    for (uint i = 0; i < _debts.length; i++) {
      IDebtToken debtToken = _dTokenManager.getDebtToken(_debts[i].tokenAddress);
      debtTokenAmounts[i] = DebtTokenAmount(debtToken, _debts[i].amount, 0);

      if (stableCoinIncluded && debtToken.isStableCoin()) stableCoinEntry = debtTokenAmounts[i];
    }

    if (!stableCoinIncluded && addStableEntry) {
      IDebtToken debtToken = _dTokenManager.getStableCoin();
      debtTokenAmounts[_debts.length] = DebtTokenAmount(debtToken, 0, 0);
      stableCoinEntry = debtTokenAmounts[_debts.length];
    }

    return (debtTokenAmounts, stableCoinEntry);
  }

  function _requireNonZeroDebtChange(uint _change) internal pure {
    if (_change == 0) revert ZeroDebtChange();
  }

  function _requireValidAdjustmentInCurrentMode(
    bool _isCollWithdrawal,
    bool _isDebtIncrease,
    LocalVariables_adjustTrove memory _vars
  ) internal pure {
    if (_vars.isInRecoveryMode) {
      // BorrowerOps: Collateral withdrawal not permitted Recovery Mode
      //      * - collateral top-up
      //      * - debt repayment
      //      * - debt increase, as long as the new ICR is above MCR

      if (_isCollWithdrawal) revert CollWithdrawPermittedInRM();
      if (_isDebtIncrease) {
        _requireICRisAboveCCR(_vars.newICR);
        _requireICRisAboveIMCR(_vars.newICR, _vars.newIMCR);
      }
    } else {
      // if Normal Mode
      //      * - The new ICR is above MCR
      //      * - The adjustment won't pull the TCR below CCR

      // check if the individual minimum collateral ratio is met (based on the used coll types)
      if (_isCollWithdrawal || _isDebtIncrease) _requireICRisAboveIMCR(_vars.newICR, _vars.newIMCR);

      uint collChange = _vars.newCompositeCollInUSD > _vars.oldCompositeCollInUSD
        ? _vars.newCompositeCollInUSD - _vars.oldCompositeCollInUSD
        : _vars.oldCompositeCollInUSD - _vars.newCompositeCollInUSD;
      uint debtChange = _vars.newCompositeDebtInUSD > _vars.oldCompositeDebtInUSD
        ? _vars.newCompositeDebtInUSD - _vars.oldCompositeDebtInUSD
        : _vars.oldCompositeDebtInUSD - _vars.newCompositeDebtInUSD;
      uint newTCR = _getNewTCRFromTroveChange(
        collChange,
        !_isCollWithdrawal,
        debtChange,
        _isDebtIncrease,
        _vars.entireSystemColl,
        _vars.entireSystemDebt
      );
      _requireNewTCRisAboveCCR(newTCR);
    }
  }

  function _requireICRisAboveIMCR(uint _newICR, uint _newIMCR) internal pure {
    // BorrowerOps: An operation that would result in ICR < IMCR is not permitted
    if (_newIMCR == 0 || _newICR < _newIMCR) revert ICR_lt_MCR();
  }

  function _requireICRisAboveCCR(uint _newICR) internal pure {
    // BorrowerOps: Operation must leave trove with ICR >= CCR
    if (_newICR < CCR) revert ICR_lt_CCR();
  }

  function _requireNewICRisAboveOldICR(uint _newICR, uint _oldICR) internal pure {
    // BorrowerOps: Cannot decrease your Trove's ICR in Recovery Mode
    if (_newICR < _oldICR) revert ICRDecreasedInRM();
  }

  function _requireNewTCRisAboveCCR(uint _newTCR) internal pure {
    // BorrowerOps: An operation that would result in TCR < CCR is not permitted
    if (_newTCR < CCR) revert TCR_lt_CCR();
  }

  function _requireAtLeastMinNetDebt(uint _netDebt, uint _repayment) internal pure {
    if (_netDebt < _repayment) revert Repaid_gt_CurrentDebt();
  }

  function _requireValidMaxFeePercentage(
    ITroveManager _troveManager,
    uint _maxFeePercentage,
    bool _isInRecoveryMode
  ) internal view {
    if (_isInRecoveryMode) {
      if (_maxFeePercentage > MAX_BORROWING_FEE) revert MaxFee_gt_100_InRM();
    } else {
      if (_maxFeePercentage < _troveManager.borrowingFeeFloor() || _maxFeePercentage > MAX_BORROWING_FEE)
        revert MaxFee_out_Range();
    }
  }

  // --- ICR and TCR getters ---

  // Returns the composite debt (drawn debt + gas compensation) of a trove, for the purpose of ICR calculation
  function _getCompositeDebt(
    IPriceFeed _priceFeed,
    PriceCache memory _priceCache,
    DebtTokenAmount[] memory _debts
  ) internal view returns (uint debtInUSD) {
    for (uint i = 0; i < _debts.length; i++) {
      uint amount = _debts[i].netDebt;
      if (amount == 0) continue;
      debtInUSD += _priceFeed.getUSDValue(_priceCache, address(_debts[i].debtToken), amount);
    }

    return debtInUSD;
  }

  function _getCompositeColl(
    ITokenManager _tokenManager,
    IPriceFeed _priceFeed,
    PriceCache memory _priceCache,
    TokenAmount[] memory _colls
  ) internal view returns (uint collInUSD, uint redeemableCollInUSD) {
    for (uint i = 0; i < _colls.length; i++) {
      uint amount = _colls[i].amount;
      if (amount == 0) continue;

      uint amountInUSD = _priceFeed.getUSDValue(_priceCache, _colls[i].tokenAddress, amount);
      collInUSD += amountInUSD;
      if (!_tokenManager.isDebtToken(_colls[i].tokenAddress)) redeemableCollInUSD += amountInUSD;
    }

    return (collInUSD, redeemableCollInUSD);
  }
}
