// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

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
import './Interfaces/IStabilityPoolManager.sol';
import './Interfaces/ICollSurplusPool.sol';

contract LiquidationOperations is LiquityBase, Ownable(msg.sender), CheckContract, ILiquidationOperations {
  string public constant NAME = 'LiquidationOperations';

  // --- Connected contract declarations ---

  ITroveManager public troveManager;
  IStoragePool public storagePool;
  IPriceFeed public priceFeed;
  ITokenManager public tokenManager;
  IStabilityPoolManager public stabilityPoolManager;
  ICollSurplusPool public collSurplusPool;

  // --- Data structures ---

  struct LocalVariables_OuterLiquidationFunction {
    PriceCache priceCache;
    //
    RemainingStability[] remainingStabilities;
    CAmount[] tokensToRedistribute;
    TokenAmount[] collSurplus;
    //
    uint totalStableCoinGasCompensation; // paid out to the liquidator
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
    uint troveDebtInUSDWithoutGasCompensation;
    uint troveCollInUSD;
  }

  // --- Dependency setter ---

  function setAddresses(
    address _troveManagerAddress,
    address _storagePoolAddress,
    address _priceFeedAddress,
    address _tokenManagerAddress,
    address _stabilityPoolManagerAddress,
    address _collSurplusPoolAddress
  ) external onlyOwner {
    checkContract(_troveManagerAddress);
    checkContract(_storagePoolAddress);
    checkContract(_priceFeedAddress);
    checkContract(_tokenManagerAddress);
    checkContract(_stabilityPoolManagerAddress);
    checkContract(_collSurplusPoolAddress);

    troveManager = ITroveManager(_troveManagerAddress);
    storagePool = IStoragePool(_storagePoolAddress);
    priceFeed = IPriceFeed(_priceFeedAddress);
    tokenManager = ITokenManager(_tokenManagerAddress);
    stabilityPoolManager = IStabilityPoolManager(_stabilityPoolManagerAddress);
    collSurplusPool = ICollSurplusPool(_collSurplusPoolAddress);

    emit LiquidationOperationsInitialized(
      _troveManagerAddress,
      _storagePoolAddress,
      _priceFeedAddress,
      _tokenManagerAddress,
      _stabilityPoolManagerAddress,
      _collSurplusPoolAddress
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
    if (!troveManager.enableLiquidationAndRedeeming()) revert LiquidationDisabled();
    if (_troveArray.length == 0) revert EmptyArray();

    LocalVariables_OuterLiquidationFunction memory vars;

    // update prices and build price cache
    priceFeed.updatePythPrices{ value: msg.value }(_priceUpdateData);
    vars.priceCache = priceFeed.buildPriceCache();

    (vars.isRecoveryMode, vars.TCR, vars.entireSystemCollInUSD, vars.entireSystemDebtInUSD) = storagePool
      .checkRecoveryMode(vars.priceCache);
    vars.remainingStabilities = stabilityPoolManager.getRemainingStability(vars.priceCache);
    _initializeEmptyTokensToRedistribute(vars); // all set to 0 (nothing to redistribute)

    bool atLeastOneTroveLiquidated = false;
    for (uint i = 0; i < _troveArray.length; i++) {
      address trove = _troveArray[i];
      if (!troveManager.isTroveActive(trove)) continue; // Skip non-active troves
      if (troveManager.getTroveOwnersCount() <= 1) continue; // don't liquidate if last trove

      bool liquidated = _executeTroveLiquidation(vars, trove);
      if (liquidated && !atLeastOneTroveLiquidated) atLeastOneTroveLiquidated = true;
    }
    if (!atLeastOneTroveLiquidated) revert NoLiquidatableTrove();

    // move tokens into the stability pools
    stabilityPoolManager.offset(vars.priceCache, vars.remainingStabilities);

    // and redistribute the rest (which could not be handled by the stability pool)
    troveManager.redistributeDebtAndColl(vars.priceCache, vars.tokensToRedistribute);

    // move tokens from active pool into the collSurplus, in case there was a capped liquidation
    for (uint i = 0; i < vars.collSurplus.length; i++) {
      if (vars.collSurplus[i].amount == 0) continue;

      storagePool.withdrawalValue(
        address(collSurplusPool),
        vars.collSurplus[i].tokenAddress,
        true,
        PoolType.Active,
        vars.collSurplus[i].amount
      );
    }

    // Update system snapshots
    troveManager.updateSystemSnapshots_excludeCollRemainder(vars.totalCollGasCompensation);

    // Send gas compensation to caller
    _sendGasCompensation(msg.sender, vars.totalStableCoinGasCompensation, vars.totalCollGasCompensation);

    // liquidation event
    _emitLiquidationSummaryEvent(vars);
  }

  function _initializeEmptyTokensToRedistribute(LocalVariables_OuterLiquidationFunction memory vars) internal pure {
    vars.tokensToRedistribute = new CAmount[](vars.priceCache.collPrices.length + vars.priceCache.debtPrices.length);
    vars.totalCollGasCompensation = new TokenAmount[](vars.priceCache.collPrices.length);
    vars.collSurplus = new TokenAmount[](vars.priceCache.collPrices.length);

    for (uint i = 0; i < vars.priceCache.collPrices.length; i++) {
      address collTokenAddress = vars.priceCache.collPrices[i].tokenAddress;
      vars.tokensToRedistribute[i] = CAmount(collTokenAddress, true, 0);
      vars.totalCollGasCompensation[i] = TokenAmount(collTokenAddress, 0);
      vars.collSurplus[i] = TokenAmount(collTokenAddress, 0);
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
    (
      vars.troveAmountsIncludingRewards,
      vars.IMCR,
      vars.troveCollInUSD,
      vars.troveDebtInUSD,
      vars.troveDebtInUSDWithoutGasCompensation
    ) = troveManager.getEntireDebtAndColl(outerVars.priceCache, trove);
    vars.ICR = LiquityMath._computeCR(vars.troveCollInUSD, vars.troveDebtInUSD);

    // ICR > TCR, skipping liquidation, no matter what mode
    if (vars.ICR > outerVars.TCR) return false;

    // ICR >= IMCR in normal mode, skipping liquidation
    if (vars.ICR >= vars.IMCR && !outerVars.isRecoveryMode) return false;

    // applying pending rewards and borrowing interests
    _movePendingTroveRewardsAndInterestsToActivePool(vars.troveAmountsIncludingRewards);
    troveManager.removeStake(outerVars.priceCache, trove);

    if (vars.ICR >= vars.IMCR) {
      // capped trove liquidation (at IMCR (1.1 normally) * the total debts value)
      // remaining collateral will stay in the trove
      _capLiquidatableColl(
        outerVars.priceCache,
        vars.IMCR,
        vars.troveCollInUSD,
        vars.troveDebtInUSDWithoutGasCompensation,
        vars.troveAmountsIncludingRewards
      );

      _debtOffset(
        outerVars.priceCache,
        vars.troveDebtInUSDWithoutGasCompensation,
        vars.troveAmountsIncludingRewards,
        outerVars.remainingStabilities
      );

      // patch the collSurplus claim, tokens will be transferred in the outer scope
      collSurplusPool.accountSurplus(trove, vars.troveAmountsIncludingRewards);
    } else
      _debtOffset( // full trove liquidation
        outerVars.priceCache,
        vars.troveDebtInUSDWithoutGasCompensation,
        vars.troveAmountsIncludingRewards,
        outerVars.remainingStabilities
      );

    troveManager.closeTroveByProtocol(
      outerVars.priceCache,
      trove,
      outerVars.isRecoveryMode ? Status.closedByLiquidationInRecoveryMode : Status.closedByLiquidationInNormalMode
    );
    _mergeCollGasAndSurplusCompensation(
      vars.troveAmountsIncludingRewards,
      outerVars.totalCollGasCompensation,
      outerVars.collSurplus
    );
    _mergeTokensToRedistribute(vars.troveAmountsIncludingRewards, outerVars.tokensToRedistribute);
    outerVars.totalStableCoinGasCompensation += STABLE_COIN_GAS_COMPENSATION;

    // updating TCR
    for (uint a = 0; a < vars.troveAmountsIncludingRewards.length; a++) {
      RAmount memory rAmount = vars.troveAmountsIncludingRewards[a];

      uint offsetUSD = priceFeed.getUSDValue(outerVars.priceCache, rAmount.tokenAddress, rAmount.toOffset);
      if (rAmount.isColl) outerVars.entireSystemCollInUSD -= offsetUSD;
      else outerVars.entireSystemDebtInUSD -= offsetUSD;

      outerVars.entireSystemCollInUSD -= priceFeed.getUSDValue(
        outerVars.priceCache,
        rAmount.tokenAddress,
        rAmount.gasCompensation
      );
    }
    outerVars.TCR = LiquityMath._computeCR(outerVars.entireSystemCollInUSD, outerVars.entireSystemDebtInUSD);
    outerVars.isRecoveryMode = outerVars.TCR < CCR;

    return true;
  }

  // adding up the coll gas compensation
  function _mergeCollGasAndSurplusCompensation(
    RAmount[] memory troveAmountsIncludingRewards,
    TokenAmount[] memory totalCollGasCompensation,
    TokenAmount[] memory totalCollSurplus
  ) internal pure {
    for (uint i = 0; i < troveAmountsIncludingRewards.length; i++) {
      RAmount memory rAmount = troveAmountsIncludingRewards[i];
      if (!rAmount.isColl) continue;

      if (rAmount.gasCompensation > 0)
        for (uint ib = 0; ib < totalCollGasCompensation.length; ib++) {
          if (totalCollGasCompensation[ib].tokenAddress != rAmount.tokenAddress) continue;
          totalCollGasCompensation[ib].amount += rAmount.gasCompensation;
          break;
        }

      if (rAmount.collSurplus > 0)
        for (uint ib = 0; ib < totalCollSurplus.length; ib++) {
          if (totalCollSurplus[ib].tokenAddress != rAmount.tokenAddress) continue;
          totalCollSurplus[ib].amount += rAmount.collSurplus;
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
  function _movePendingTroveRewardsAndInterestsToActivePool(RAmount[] memory _troveAmountsIncludingRewards) internal {
    for (uint i = 0; i < _troveAmountsIncludingRewards.length; i++) {
      RAmount memory rAmount = _troveAmountsIncludingRewards[i];

      if (rAmount.pendingReward != 0)
        storagePool.transferBetweenTypes(
          rAmount.tokenAddress,
          rAmount.isColl,
          PoolType.Default,
          PoolType.Active,
          rAmount.pendingReward
        );
      if (rAmount.pendingInterest != 0)
        storagePool.addValue(rAmount.tokenAddress, rAmount.isColl, PoolType.Active, rAmount.pendingInterest);
    }
  }

  // Get its offset coll/debt and gas comp.
  function _capLiquidatableColl(
    PriceCache memory priceCache,
    uint IMCR,
    uint troveCollInUSD,
    uint troveDebtInUSDWithoutGasCompensation,
    RAmount[] memory troveAmountsIncludingRewards
  ) internal view {
    // capping the to be liquidated collateral to IMCR (normally 1.1) * the total debts value
    uint cappedTroveDebtInUSD = (troveDebtInUSDWithoutGasCompensation * IMCR) / DECIMAL_PRECISION; // total debt * IMCR
    for (uint i = 0; i < troveAmountsIncludingRewards.length; i++) {
      RAmount memory rAmount = troveAmountsIncludingRewards[i];
      if (!rAmount.isColl) continue; // coll will be handled later in the debts loop

      uint collToLiquidateInUSD = priceFeed.getUSDValue(priceCache, rAmount.tokenAddress, rAmount.toLiquidate);
      uint collToLiquidateInUSDCapped = (collToLiquidateInUSD * cappedTroveDebtInUSD) / troveCollInUSD;
      uint collToLiquidate = priceFeed.getAmountFromUSDValue(
        priceCache,
        rAmount.tokenAddress,
        collToLiquidateInUSDCapped
      );
      if (collToLiquidate > rAmount.toLiquidate) collToLiquidate = rAmount.toLiquidate; // in case of IMCR > ICR, but the trove still gets liquidated because ICR < TCR in recovery mode

      rAmount.collSurplus = rAmount.toLiquidate - collToLiquidate;
      rAmount.toLiquidate = collToLiquidate;
      rAmount.toRedistribute = collToLiquidate; // by default the entire coll needs to be redistributed
    }
  }

  function _debtOffset(
    PriceCache memory priceCache,
    uint troveDebtInUSDWithoutGasCompensation,
    RAmount[] memory troveAmountsIncludingRewards,
    RemainingStability[] memory remainingStabilities
  ) internal view {
    // by default the entire coll needs to be redistributed
    for (uint i = 0; i < troveAmountsIncludingRewards.length; i++) {
      RAmount memory rAmount = troveAmountsIncludingRewards[i];
      if (rAmount.isColl) rAmount.toRedistribute = rAmount.toLiquidate;
    }

    // checking if some debt can be offset by the matching stability pool
    for (uint i = 0; i < troveAmountsIncludingRewards.length; i++) {
      RAmount memory rAmountDebt = troveAmountsIncludingRewards[i];
      if (rAmountDebt.isColl) continue; // coll will be handled by the debts loop

      // find the right remainingStability entry for the current debt token
      RemainingStability memory remainingStability;
      for (uint ii = 0; ii < remainingStabilities.length; ii++) {
        if (remainingStabilities[ii].tokenAddress == rAmountDebt.tokenAddress) {
          remainingStability = remainingStabilities[ii];
          break;
        }
      }

      // trying to hand the debt over to the stability pool
      if (remainingStability.remaining > 0) {
        rAmountDebt.toOffset = LiquityMath._min(rAmountDebt.toLiquidate, remainingStability.remaining);
        remainingStability.debtToOffset += rAmountDebt.toOffset;
        remainingStability.remaining -= rAmountDebt.toOffset;

        uint offsetPercentage = (priceFeed.getUSDValue(priceCache, rAmountDebt.tokenAddress, rAmountDebt.toOffset) *
          DECIMAL_PRECISION) / troveDebtInUSDWithoutGasCompensation; // relative to the troves total debt

        // moving the offsetPercentage of each coll into the stable pool
        for (uint ii = 0; ii < troveAmountsIncludingRewards.length; ii++) {
          RAmount memory rAmountColl = troveAmountsIncludingRewards[ii];
          if (!rAmountColl.isColl) continue; // debt already handled one step above

          rAmountColl.toOffset = (rAmountColl.toLiquidate * offsetPercentage) / DECIMAL_PRECISION;
          rAmountColl.toRedistribute -= rAmountColl.toOffset;

          // find the right collGained entry and add the value
          for (uint iii = 0; iii < remainingStability.collGained.length; iii++) {
            if (remainingStability.collGained[iii].tokenAddress != rAmountColl.tokenAddress) continue;

            remainingStability.collGained[iii].amount += rAmountColl.toOffset;
            break;
          }
        }
      }

      // remaining debt needs to be redistributed
      rAmountDebt.toRedistribute = rAmountDebt.toLiquidate - rAmountDebt.toOffset;
    }
  }

  function _sendGasCompensation(
    address _liquidator,
    uint _stableCoinGasCompensation,
    TokenAmount[] memory _collGasCompensation
  ) internal {
    // stable payout
    if (_stableCoinGasCompensation != 0) {
      IDebtToken stableCoin = tokenManager.getStableCoin();
      storagePool.withdrawalValue(
        _liquidator,
        address(stableCoin),
        false,
        PoolType.GasCompensation,
        _stableCoinGasCompensation
      );
    }

    // coll payout
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
        vars.tokensToRedistribute[i].amount // works because of the initialisation of the array (first debts, then colls)
      );
    }

    TokenAmount[] memory liquidatedDebt = new TokenAmount[](vars.remainingStabilities.length);
    for (uint i = 0; i < vars.remainingStabilities.length; i++) {
      RemainingStability memory remainingStability = vars.remainingStabilities[i];

      uint redistributed = vars.tokensToRedistribute[vars.priceCache.collPrices.length + i].amount; // has the same token order in the array
      liquidatedDebt[i] = TokenAmount(remainingStability.tokenAddress, remainingStability.debtToOffset + redistributed);

      for (uint ii = 0; ii < vars.priceCache.collPrices.length; ii++)
        liquidatedColl[ii].amount += remainingStability.collGained[ii].amount;
    }

    emit LiquidationSummary(
      liquidatedDebt,
      liquidatedColl,
      vars.totalStableCoinGasCompensation,
      vars.totalCollGasCompensation
    );
  }
}
