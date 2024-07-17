// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import './Dependencies/LiquityBase.sol';
import './Dependencies/CheckContract.sol';
import './Interfaces/IDebtToken.sol';
import './Interfaces/ITokenManager.sol';
import './Interfaces/IPriceFeed.sol';
import './Interfaces/IStoragePool.sol';
import './Interfaces/IBBase.sol';
import './Interfaces/IRedemptionOperations.sol';
import './Interfaces/ITroveManager.sol';
import './Interfaces/ILiquidationOperations.sol';
import './Interfaces/IReservePool.sol';
import './Interfaces/ICollSurplusPool.sol';

contract LiquidationOperations is LiquityBase, Ownable(msg.sender), CheckContract, ILiquidationOperations {
  string public constant NAME = 'LiquidationOperations';

  // --- Connected contract declarations ---

  ITroveManager public troveManager;
  IStoragePool public storagePool;
  IPriceFeed public priceFeed;
  ITokenManager public tokenManager;
  IReservePool public reservePool;
  ICollSurplusPool public collSurplusPool;

  // --- Data structures ---

  struct LocalVariables_OuterLiquidationFunction {
    PriceCache priceCache;
    //
    CAmount[] tokensToRedistribute;
    TokenAmount[] totalCollGasCompensation; // paid out to the liquidator
    //
    uint entireSystemCollInUSD;
    uint entireSystemDebtInUSD;
    uint TCR;
    bool isRecoveryMode;
  }

  struct LocalVariables_LiquidationSequence {
    uint ICR;
    uint IMCR;
    //
    RAmount[] troveAmountsIncludingRewards;
    uint troveDebtInUSD;
    uint troveCollInUSD;
  }

  // --- Dependency setter ---

  function setAddresses(
    address _troveManagerAddress,
    address _storagePoolAddress,
    address _priceFeedAddress,
    address _tokenManagerAddress,
    address _collSurplusPoolAddress,
    address _reservePoolAddress
  ) external onlyOwner {
    checkContract(_troveManagerAddress);
    checkContract(_storagePoolAddress);
    checkContract(_priceFeedAddress);
    checkContract(_tokenManagerAddress);
    checkContract(_collSurplusPoolAddress);
    checkContract(_reservePoolAddress);

    troveManager = ITroveManager(_troveManagerAddress);
    storagePool = IStoragePool(_storagePoolAddress);
    priceFeed = IPriceFeed(_priceFeedAddress);
    tokenManager = ITokenManager(_tokenManagerAddress);
    collSurplusPool = ICollSurplusPool(_collSurplusPoolAddress);
    reservePool = IReservePool(_reservePoolAddress);

    emit LiquidationOperationsInitialized(
      _troveManagerAddress,
      _storagePoolAddress,
      _priceFeedAddress,
      _tokenManagerAddress,
      _collSurplusPoolAddress,
      _reservePoolAddress
    );

    renounceOwnership();
  }

  // Single liquidation function. Closes the trove if its ICR is lower than the minimum collateral ratio.
  function liquidate(address _borrower, bytes[] memory _priceUpdateData) public payable override {
    address[] memory borrowers = new address[](1);
    borrowers[0] = _borrower;
    batchLiquidateTroves(borrowers, _priceUpdateData);
  }

  /*
   * Attempt to liquidate a custom list of troves provided by the caller.
   */
  function batchLiquidateTroves(address[] memory _troveArray, bytes[] memory _priceUpdateData) public payable override {
    if (!troveManager.enableLiquidation()) revert LiquidationDisabled();
    if (_troveArray.length == 0) revert EmptyArray();

    LocalVariables_OuterLiquidationFunction memory vars;

    // update prices and build price cache
    priceFeed.updatePythPrices{ value: msg.value }(_priceUpdateData);
    vars.priceCache = priceFeed.buildPriceCache(true);

    (vars.isRecoveryMode, vars.TCR, vars.entireSystemCollInUSD, vars.entireSystemDebtInUSD) = storagePool
      .checkRecoveryMode(vars.priceCache);
    _initializeEmptyTokensToRedistribute(vars); // all set to 0 (nothing to redistribute)

    bool atLeastOneTroveLiquidated = false;
    for (uint i = 0; i < _troveArray.length; i++) {
      address trove = _troveArray[i];
      if (!troveManager.isTroveActive(trove)) continue; // Skip non-active troves
      if (troveManager.getTroveOwnersCount() <= 1) break; // don't liquidate if last trove

      bool liquidated = _executeTroveLiquidation(vars, trove);
      if (liquidated && !atLeastOneTroveLiquidated) atLeastOneTroveLiquidated = true;
    }
    if (!atLeastOneTroveLiquidated) revert NoLiquidatableTrove();

    // redistribute the liquidated tokens
    troveManager.redistributeDebtAndColl(vars.priceCache, vars.tokensToRedistribute);

    // Update system snapshots
    troveManager.updateSystemSnapshots_excludeCollRemainder(vars.totalCollGasCompensation);

    // Send gas compensation to caller
    _sendGasCompensation(msg.sender, vars.totalCollGasCompensation);

    // liquidation event
    _emitLiquidationSummaryEvent(vars);
  }

  function _initializeEmptyTokensToRedistribute(LocalVariables_OuterLiquidationFunction memory vars) internal pure {
    vars.tokensToRedistribute = new CAmount[](vars.priceCache.collPrices.length + vars.priceCache.debtPrices.length);
    vars.totalCollGasCompensation = new TokenAmount[](vars.priceCache.collPrices.length);

    for (uint i = 0; i < vars.priceCache.collPrices.length; i++) {
      address collTokenAddress = vars.priceCache.collPrices[i].tokenAddress;
      vars.tokensToRedistribute[i] = CAmount(collTokenAddress, true, 0);
      vars.totalCollGasCompensation[i] = TokenAmount(collTokenAddress, 0);
    }

    for (uint i = 0; i < vars.priceCache.debtPrices.length; i++)
      vars.tokensToRedistribute[vars.priceCache.collPrices.length + i] = CAmount(
        vars.priceCache.debtPrices[i].tokenAddress,
        false,
        0
      );
  }

  function _executeTroveLiquidation(
    LocalVariables_OuterLiquidationFunction memory outerVars,
    address trove
  ) internal returns (bool liquidated) {
    LocalVariables_LiquidationSequence memory vars;
    uint debtTokenLength;
    (vars.troveAmountsIncludingRewards, debtTokenLength) = troveManager.getEntireDebtAndColl(
      outerVars.priceCache,
      trove
    );

    // adding missing amount meta data
    uint maxDebtInUSD;
    for (uint i = 0; i < vars.troveAmountsIncludingRewards.length; i++) {
      RAmount memory amountEntry = vars.troveAmountsIncludingRewards[i];

      uint totalAmount = amountEntry.amount + amountEntry.pendingReward + amountEntry.pendingInterest;
      uint inUSD = priceFeed.getUSDValue(outerVars.priceCache, amountEntry.tokenAddress, totalAmount);

      if (amountEntry.isColl) {
        amountEntry.gasCompensation = _getCollGasCompensation(totalAmount);
        amountEntry.toLiquidate = totalAmount - amountEntry.gasCompensation;
        vars.troveCollInUSD += inUSD;
        maxDebtInUSD += LiquityMath._computeMaxDebtValue(
          inUSD,
          outerVars.priceCache.collPrices[i].supportedCollateralRatio
        );
      } else {
        amountEntry.toLiquidate = totalAmount;
        vars.troveDebtInUSD += inUSD;
      }

      // by default 100% gets redistributed, will be less in case of a capped liquidation
      amountEntry.toRedistribute = amountEntry.toLiquidate;
    }

    vars.IMCR = LiquityMath._computeIMCR(maxDebtInUSD, vars.troveCollInUSD);
    vars.ICR = LiquityMath._computeCR(vars.troveCollInUSD, vars.troveDebtInUSD);

    // ICR > TCR, skipping liquidation, no matter what mode
    if (vars.ICR > outerVars.TCR) return false;

    // ICR >= IMCR in normal mode, skipping liquidation
    if (vars.ICR >= vars.IMCR && !outerVars.isRecoveryMode) return false;

    // applying pending rewards and borrowing interests
    _movePendingTroveRewardsAndInterestsToActivePool(trove, vars.troveAmountsIncludingRewards);
    troveManager.removeStake(outerVars.priceCache, trove);

    if (vars.ICR >= vars.IMCR) {
      // capped trove liquidation (at IMCR (1.1 normally) * the total debts value)
      // remaining collateral will be moved into the coll surplus pool
      // reduces the amount which gets redistributed
      _capLiquidatableColl(
        outerVars.priceCache,
        vars.IMCR,
        vars.troveCollInUSD,
        vars.troveDebtInUSD,
        vars.troveAmountsIncludingRewards
      );

      // patch the collSurplus claim, tokens will be transferred in the outer scope
      collSurplusPool.accountSurplus(trove, vars.troveAmountsIncludingRewards);
    } else {
      // include the reserve pool in case of a CR < 100% liquidation
      // not relevant for a capped liquidation because the CR is >= IMCR >100% anyway
      // updating the system coll for the TCR calculation, compensation by reserve pool gets added
      outerVars.entireSystemCollInUSD += _compensateLossViaReservePool(outerVars.priceCache, vars);
    }

    troveManager.closeTroveByProtocol(
      outerVars.priceCache,
      trove,
      outerVars.isRecoveryMode ? Status.closedByLiquidationInRecoveryMode : Status.closedByLiquidationInNormalMode
    );

    _mergeCollGasCompensation(vars.troveAmountsIncludingRewards, outerVars.totalCollGasCompensation);
    _mergeTokensToRedistribute(vars.troveAmountsIncludingRewards, outerVars.tokensToRedistribute);

    // updating TCR, changes because of paid out coll gas comp and coll surplus
    for (uint a = 0; a < vars.troveAmountsIncludingRewards.length; a++) {
      RAmount memory rAmount = vars.troveAmountsIncludingRewards[a];

      outerVars.entireSystemCollInUSD -= priceFeed.getUSDValue(
        outerVars.priceCache,
        rAmount.tokenAddress,
        rAmount.gasCompensation + rAmount.collSurplus
      );
    }
    outerVars.TCR = LiquityMath._computeCR(outerVars.entireSystemCollInUSD, outerVars.entireSystemDebtInUSD);
    outerVars.isRecoveryMode = outerVars.TCR < CCR;

    return true;
  }

  function _compensateLossViaReservePool(
    PriceCache memory _priceCache,
    LocalVariables_LiquidationSequence memory vars
  ) internal returns (uint usedUSDSum) {
    if (vars.troveDebtInUSD <= vars.troveCollInUSD) return 0;

    // paid out coll gas comp gets ignored it this calculation, it would be compensated by the reserve pool in case of a CR < 100% trove liquidation
    (uint usedGov, uint usedStable, uint _usedUSDSum) = reservePool.withdrawValue(
      _priceCache,
      vars.troveDebtInUSD - vars.troveCollInUSD
    );

    // adding the tokens to the redistribution on the collateral side
    address govTokenAddress = tokenManager.getGovTokenAddress();
    address stableCoinAddress = address(tokenManager.getStableCoin());
    for (uint i = 0; i < vars.troveAmountsIncludingRewards.length; i++) {
      RAmount memory amountEntry = vars.troveAmountsIncludingRewards[i];
      if (!amountEntry.isColl) break; // colls are first in the array

      if (usedGov > 0 && amountEntry.tokenAddress == govTokenAddress) amountEntry.toRedistribute += usedGov;
      else if (usedStable > 0 && amountEntry.tokenAddress == stableCoinAddress)
        amountEntry.toRedistribute += usedStable;
    }

    return _usedUSDSum;
  }

  // adding up the coll gas compensation
  function _mergeCollGasCompensation(
    RAmount[] memory troveAmountsIncludingRewards,
    TokenAmount[] memory totalCollGasCompensation
  ) internal pure {
    for (uint i = 0; i < troveAmountsIncludingRewards.length; i++) {
      RAmount memory rAmount = troveAmountsIncludingRewards[i];
      if (!rAmount.isColl || rAmount.gasCompensation == 0) continue;

      for (uint ib = 0; ib < totalCollGasCompensation.length; ib++) {
        if (totalCollGasCompensation[ib].tokenAddress != rAmount.tokenAddress) continue;
        totalCollGasCompensation[ib].amount += rAmount.gasCompensation;
        break;
      }
    }
  }

  // adding up the token to redistribute
  function _mergeTokensToRedistribute(
    RAmount[] memory troveAmountsIncludingRewards,
    CAmount[] memory tokensToRedistribute
  ) internal pure {
    for (uint i = 0; i < troveAmountsIncludingRewards.length; i++) {
      RAmount memory rAmount = troveAmountsIncludingRewards[i];
      if (rAmount.toRedistribute == 0) continue;

      for (uint ib = 0; ib < tokensToRedistribute.length; ib++) {
        if (
          tokensToRedistribute[ib].tokenAddress != rAmount.tokenAddress ||
          tokensToRedistribute[ib].isColl != rAmount.isColl
        ) continue;

        tokensToRedistribute[ib].amount += rAmount.toRedistribute;
        break;
      }
    }
  }

  // Move a Trove's pending debt and collateral rewards from distributions, from the Default Pool to the Active Pool
  function _movePendingTroveRewardsAndInterestsToActivePool(
    address _borrower,
    RAmount[] memory _troveAmountsIncludingRewards
  ) internal {
    for (uint i = 0; i < _troveAmountsIncludingRewards.length; i++) {
      RAmount memory rAmount = _troveAmountsIncludingRewards[i];

      if (rAmount.pendingReward > 0)
        storagePool.transferBetweenTypes(
          rAmount.tokenAddress,
          rAmount.isColl,
          PoolType.Default,
          PoolType.Active,
          rAmount.pendingReward
        );

      if (!rAmount.isColl && rAmount.pendingInterest > 0) {
        storagePool.addValue(rAmount.tokenAddress, rAmount.isColl, PoolType.Active, rAmount.pendingInterest);
        troveManager.payBorrowingFee(_borrower, rAmount.pendingInterest);
      }
    }
  }

  // Get its offset coll/debt and gas comp.
  function _capLiquidatableColl(
    PriceCache memory priceCache,
    uint IMCR,
    uint troveCollInUSD,
    uint troveDebtInUSD,
    RAmount[] memory troveAmountsIncludingRewards
  ) internal {
    IStoragePool _storagePool = storagePool;
    address collSurplusPoolAddress = address(collSurplusPool);

    // capping the to be liquidated collateral to IMCR (normally 1.1) * the total debts value
    uint cappedTroveDebtInUSD = (troveDebtInUSD * IMCR) / DECIMAL_PRECISION; // total debt * IMCR
    for (uint i = 0; i < troveAmountsIncludingRewards.length; i++) {
      RAmount memory rAmount = troveAmountsIncludingRewards[i];
      if (!rAmount.isColl) continue;

      uint collToLiquidateInUSD = priceFeed.getUSDValue(priceCache, rAmount.tokenAddress, rAmount.toLiquidate);
      uint collToLiquidateInUSDCapped = (collToLiquidateInUSD * cappedTroveDebtInUSD) / troveCollInUSD;
      uint collToLiquidate = priceFeed.getAmountFromUSDValue(
        priceCache,
        rAmount.tokenAddress,
        collToLiquidateInUSDCapped
      );
      if (collToLiquidate > rAmount.toLiquidate) collToLiquidate = rAmount.toLiquidate; // in case of ICR > IMCR, but the trove still gets liquidated because ICR < TCR in recovery mode

      rAmount.collSurplus = rAmount.toLiquidate - collToLiquidate;
      rAmount.toLiquidate = collToLiquidate;
      rAmount.toRedistribute = collToLiquidate; // by default the entire coll needs to be redistributed

      // moving the coll surplus out of the active pool
      if (rAmount.collSurplus > 0)
        _storagePool.withdrawalValue(
          collSurplusPoolAddress,
          rAmount.tokenAddress,
          true,
          PoolType.Active,
          rAmount.collSurplus
        );
    }
  }

  function _sendGasCompensation(address _liquidator, TokenAmount[] memory _collGasCompensation) internal {
    for (uint i = 0; i < _collGasCompensation.length; i++) {
      if (_collGasCompensation[i].amount == 0) continue;

      storagePool.withdrawalValue(
        _liquidator,
        _collGasCompensation[i].tokenAddress,
        true,
        PoolType.Active,
        _collGasCompensation[i].amount
      );
    }
  }

  function _emitLiquidationSummaryEvent(LocalVariables_OuterLiquidationFunction memory vars) internal {
    TokenAmount[] memory liquidatedColl = new TokenAmount[](vars.priceCache.collPrices.length);
    for (uint i = 0; i < vars.priceCache.collPrices.length; i++) {
      liquidatedColl[i] = TokenAmount(
        vars.priceCache.collPrices[i].tokenAddress,
        vars.tokensToRedistribute[i].amount // works because of the initialisation of the array (first colls, then debts)
      );
    }

    TokenAmount[] memory liquidatedDebt = new TokenAmount[](vars.priceCache.debtPrices.length);
    for (uint i = 0; i < vars.priceCache.debtPrices.length; i++)
      liquidatedDebt[i] = TokenAmount(
        vars.priceCache.debtPrices[i].tokenAddress,
        vars.tokensToRedistribute[vars.priceCache.collPrices.length + i].amount
      );

    emit LiquidationSummary(liquidatedDebt, liquidatedColl, vars.totalCollGasCompensation);
  }
}
