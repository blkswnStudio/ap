// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import './Dependencies/LiquityBase.sol';
import './Dependencies/CheckContract.sol';
import './Interfaces/IStabilityPool.sol';
import './Interfaces/IDebtToken.sol';
import './Interfaces/ITokenManager.sol';
import './Interfaces/IPriceFeed.sol';
import './Interfaces/IStoragePool.sol';
import './Interfaces/IBBase.sol';
import './Interfaces/IRedemptionOperations.sol';
import './Interfaces/ITroveManager.sol';
import './Interfaces/ISortedTroves.sol';
import './Interfaces/IHintHelpers.sol';

contract RedemptionOperations is LiquityBase, Ownable(msg.sender), CheckContract, IRedemptionOperations {
  string public constant NAME = 'RedemptionOperations';

  // --- Connected contract declarations ---

  ITroveManager public troveManager;
  ITokenManager public tokenManager;
  IStoragePool public storagePool;
  IPriceFeed public priceFeed;
  ISortedTroves public sortedTroves;
  IHintHelpers public hintHelpers;

  // --- Data structures ---

  struct RedemptionVariables {
    PriceCache priceCache;
    //
    RedemptionCollAmount[] totalCollDrawn;
    //
    uint totalStableSupplyAtStart;
    uint totalRedeemedStable;
  }

  // --- Dependency setter ---

  function setAddresses(
    address _troveManagerAddress,
    address _storagePoolAddress,
    address _priceFeedAddress,
    address _tokenManagerAddress,
    address _sortedTrovesAddress,
    address _hintHelpersAddress
  ) external onlyOwner {
    checkContract(_troveManagerAddress);
    checkContract(_storagePoolAddress);
    checkContract(_priceFeedAddress);
    checkContract(_tokenManagerAddress);
    checkContract(_sortedTrovesAddress);
    checkContract(_hintHelpersAddress);

    troveManager = ITroveManager(_troveManagerAddress);
    storagePool = IStoragePool(_storagePoolAddress);
    priceFeed = IPriceFeed(_priceFeedAddress);
    tokenManager = ITokenManager(_tokenManagerAddress);
    sortedTroves = ISortedTroves(_sortedTrovesAddress);
    hintHelpers = IHintHelpers(_hintHelpersAddress);

    emit RedemptionOperationsInitialized(
      _troveManagerAddress,
      _storagePoolAddress,
      _priceFeedAddress,
      _tokenManagerAddress,
      _sortedTrovesAddress,
      _hintHelpersAddress
    );

    renounceOwnership();
  }

  function redeemCollateral(
    uint _stableCoinAmount,
    RedeemIteration[] memory _iterations,
    uint _maxFeePercentage,
    bytes[] memory _priceUpdateData
  ) external payable override {
    if (!troveManager.enableLiquidationAndRedeeming()) revert RedeptionDisabled();
    IDebtToken stableCoin = tokenManager.getStableCoin();

    // update prices and build price cache
    RedemptionVariables memory vars;
    priceFeed.updatePythPrices{ value: msg.value }(_priceUpdateData);
    vars.priceCache = priceFeed.buildPriceCache();
    vars.totalStableSupplyAtStart =
      storagePool.getValue(address(stableCoin), false, PoolType.Active) +
      storagePool.getValue(address(stableCoin), false, PoolType.Default);

    if (_stableCoinAmount == 0) revert ZeroAmount();
    if (_maxFeePercentage < REDEMPTION_FEE_FLOOR || _maxFeePercentage > DECIMAL_PRECISION)
      revert InvalidMaxFeePercent();
    if (_stableCoinAmount > stableCoin.balanceOf(msg.sender)) revert ExceedDebtBalance();

    (, uint TCR, , ) = storagePool.checkRecoveryMode(vars.priceCache);
    if (TCR < MCR) revert LessThanMCR();

    // Confirm redeemer's balance is less than total stable coin supply
    assert(stableCoin.balanceOf(msg.sender) <= vars.totalStableSupplyAtStart);

    // seed drawn coll
    vars.totalCollDrawn = new RedemptionCollAmount[](vars.priceCache.collPrices.length);
    for (uint i = 0; i < vars.totalCollDrawn.length; i++)
      vars.totalCollDrawn[i].collToken = vars.priceCache.collPrices[i].tokenAddress;

    for (uint i = 0; i < _iterations.length; i++) {
      RedeemIteration memory iteration = _iterations[i];
      checkValidRedemptionHint(vars.priceCache, iteration.trove);
      troveManager.applyPendingRewards(iteration.trove, vars.priceCache);
      SingleRedemptionVariables memory troveRedemption = _calculateTroveRedemption(
        vars.priceCache,
        iteration.trove,
        _stableCoinAmount - vars.totalRedeemedStable,
        false // without pending rewards, because they got applied above
      );

      // resulting CR differs from the expected CR, we bail in that case, because all following iterations will consume too much gas by searching for a updated hints
      // allowing 1% deviation, because of time based borrowing interests
      if (troveRedemption.resultingCR > iteration.expectedCR) {
        if ((troveRedemption.resultingCR * DECIMAL_PRECISION) / iteration.expectedCR > 1.01e18) break;
      } else {
        if ((iteration.expectedCR * DECIMAL_PRECISION) / troveRedemption.resultingCR > 1.01e18) break;
      }

      // updating the troves stable debt
      DebtTokenAmount[] memory debtDecrease = new DebtTokenAmount[](1);
      debtDecrease[0] = DebtTokenAmount(tokenManager.getStableCoin(), troveRedemption.stableCoinLot, 0);
      troveManager.decreaseTroveDebt(iteration.trove, debtDecrease);

      // updating the troves stable coll
      troveManager.decreaseTroveColl(iteration.trove, troveRedemption.collLots);
      troveManager.updateStakeAndTotalStakes(vars.priceCache, iteration.trove);

      // update the troves position in the sorted list
      // in case the trove was fully redeemed, it will be removed from the list
      sortedTroves.update(
        iteration.trove,
        troveRedemption.resultingCR,
        troveRedemption.stableCoinEntry.amount - troveRedemption.stableCoinLot - STABLE_COIN_GAS_COMPENSATION, // amount which is still redeemable from that trove (after the current one...)
        iteration.upperHint,
        iteration.lowerHint
      );
      emit RedeemedFromTrove(iteration.trove, troveRedemption.stableCoinLot, troveRedemption.collLots);

      // sum up redeemed stable and drawn collateral
      vars.totalRedeemedStable += troveRedemption.stableCoinLot;
      for (uint a = 0; a < troveRedemption.collLots.length; a++) {
        for (uint b = 0; b < vars.totalCollDrawn.length; b++) {
          if (troveRedemption.collLots[a].tokenAddress != vars.totalCollDrawn[b].collToken) continue;

          vars.totalCollDrawn[b].drawn += troveRedemption.collLots[a].amount;
          break;
        }
      }

      // we have redeemed enough
      if (_stableCoinAmount - vars.totalRedeemedStable == 0) break;
    }

    if (vars.totalRedeemedStable == 0) revert NoRedeems();

    // Decay the baseRate due to time passed, and then increase it according to the size of this redemption.
    // Use the saved total stable supply value, from before it was reduced by the redemption.
    troveManager.updateStableCoinBaseRateFromRedemption(vars.totalRedeemedStable, vars.totalStableSupplyAtStart);

    // Calculate the redemption fee
    for (uint i = 0; i < vars.totalCollDrawn.length; i++) {
      RedemptionCollAmount memory collEntry = vars.totalCollDrawn[i];

      collEntry.redemptionFee = _getRedemptionFee(collEntry.drawn);
      collEntry.sendToRedeemer = collEntry.drawn - collEntry.redemptionFee;

      _requireUserAcceptsFee(collEntry.redemptionFee, collEntry.drawn, _maxFeePercentage);
    }

    // Burn the total stable coin that is cancelled with debt, and send the redeemed coll to msg.sender
    storagePool.subtractValue(address(stableCoin), false, PoolType.Active, vars.totalRedeemedStable);
    stableCoin.burn(msg.sender, vars.totalRedeemedStable);

    // transfer the drawn collateral to the redeemer
    for (uint i = 0; i < vars.totalCollDrawn.length; i++) {
      RedemptionCollAmount memory collEntry = vars.totalCollDrawn[i];
      if (collEntry.sendToRedeemer == 0) continue;

      storagePool.withdrawalValue(msg.sender, collEntry.collToken, true, PoolType.Active, collEntry.sendToRedeemer);
      storagePool.withdrawalValue(
        tokenManager.govPayoutAddress(),
        collEntry.collToken,
        true,
        PoolType.Active,
        collEntry.redemptionFee
      );
    }

    emit SuccessfulRedemption(_stableCoinAmount, vars.totalRedeemedStable, vars.totalCollDrawn);
  }

  function checkValidRedemptionHint(PriceCache memory _priceCache, address _redemptionHint) internal view {
    if (!troveManager.isTroveActive(_redemptionHint)) revert HintUnknown();

    // is case the sorted troves list is empty, all troves which minted stable are either redeemed or liquidated
    // the remaining stable is now in "pending rewards" of non listed troves
    if (sortedTroves.isEmpty()) return;

    (uint hintCR, uint hintIMCR, ) = hintHelpers.getCurrentICR(_priceCache, _redemptionHint);
    if (hintCR < hintIMCR) revert HintBelowMCR(); // should be liquidated, not redeemed from
    if (!sortedTroves.contains(_redemptionHint)) revert InvalidRedemptionHint();

    address nextTrove = sortedTroves.getNext(_redemptionHint);
    (uint nextTroveCR, uint nextTroveMCR, ) = hintHelpers.getCurrentICR(_priceCache, nextTrove);
    if (nextTrove != address(0) && nextTroveCR > nextTroveMCR) revert InvalidHintLowerCRExists();
  }

  function calculateTroveRedemption(
    address _borrower,
    uint _redeemMaxAmount,
    bool _includePendingRewards
  ) external view override returns (SingleRedemptionVariables memory vars) {
    PriceCache memory priceCache = priceFeed.buildPriceCache();
    return _calculateTroveRedemption(priceCache, _borrower, _redeemMaxAmount, _includePendingRewards);
  }

  function _calculateTroveRedemption(
    PriceCache memory _priceCache,
    address _borrower,
    uint _redeemMaxAmount,
    bool _includePendingRewards
  ) internal view returns (SingleRedemptionVariables memory vars) {
    address stableCoinAddress = address(tokenManager.getStableCoin());

    // stable coin debt should always exists because of the gas comp
    TokenAmount[] memory troveDebt = _includePendingRewards
      ? troveManager.getTroveRepayableDebts(_priceCache, _borrower, true) // with pending rewards
      : troveManager.getTroveDebt(_borrower); // without pending rewards
    if (troveDebt.length == 0) revert InvalidRedemptionHint();
    for (uint i = 0; i < troveDebt.length; i++) {
      TokenAmount memory debtEntry = troveDebt[i];

      if (debtEntry.tokenAddress == stableCoinAddress) vars.stableCoinEntry = debtEntry;
      vars.troveDebtInUSD += priceFeed.getUSDValue(_priceCache, debtEntry.tokenAddress, debtEntry.amount);
    }

    vars.collLots = _includePendingRewards
      ? troveManager.getTroveWithdrawableColls(_borrower)
      : troveManager.getTroveColl(_borrower);
    for (uint i = 0; i < vars.collLots.length; i++) {
      uint p = priceFeed.getUSDValue(_priceCache, vars.collLots[i].tokenAddress, vars.collLots[i].amount);
      vars.troveCollInUSD += p;
      if (!tokenManager.isDebtToken(vars.collLots[i].tokenAddress)) vars.redeemableTroveCollInUSD += p;
    }

    // Determine the remaining amount (lot) to be redeemed, capped by the entire debt of the Trove minus the liquidation reserve
    vars.stableCoinLot = LiquityMath._min(_redeemMaxAmount, vars.stableCoinEntry.amount - STABLE_COIN_GAS_COMPENSATION);

    // calculate the coll lot
    uint newCollInUSD = vars.troveCollInUSD;
    for (uint i = 0; i < vars.collLots.length; i++) {
      TokenAmount memory collEntry = vars.collLots[i];

      uint collEntryInUSD = priceFeed.getUSDValue(_priceCache, collEntry.tokenAddress, collEntry.amount);
      uint collToRedeemInUSD = tokenManager.isDebtToken(collEntry.tokenAddress)
        ? 0
        : (vars.stableCoinLot * collEntryInUSD) / vars.redeemableTroveCollInUSD;
      collEntry.amount = priceFeed.getAmountFromUSDValue(_priceCache, collEntry.tokenAddress, collToRedeemInUSD);
      newCollInUSD -= collToRedeemInUSD;
    }

    vars.resultingCR = LiquityMath._computeCR(newCollInUSD, vars.troveDebtInUSD - vars.stableCoinLot);
    return vars;
  }

  function getRedemptionRate() public view override returns (uint) {
    return _calcRedemptionRate(troveManager.getStableCoinBaseRate());
  }

  function getRedemptionRateWithDecay() public view override returns (uint) {
    return _calcRedemptionRate(troveManager.calcDecayedStableCoinBaseRate());
  }

  function _calcRedemptionRate(uint _baseRate) internal pure returns (uint) {
    return
      LiquityMath._min(
        REDEMPTION_FEE_FLOOR + _baseRate,
        DECIMAL_PRECISION // cap at a maximum of 100%
      );
  }

  function _getRedemptionFee(uint _collDrawn) internal view returns (uint) {
    return _calcRedemptionFee(getRedemptionRate(), _collDrawn);
  }

  function getRedemptionFeeWithDecay(uint _collDrawn) external view override returns (uint) {
    return _calcRedemptionFee(getRedemptionRateWithDecay(), _collDrawn);
  }

  function _calcRedemptionFee(uint _redemptionRate, uint _collDrawn) internal pure returns (uint) {
    if (_collDrawn == 0) return 0;

    uint redemptionFee = (_redemptionRate * _collDrawn) / DECIMAL_PRECISION;
    if (redemptionFee >= _collDrawn) revert TooHighRedeemFee(); // Fee would eat up all returned collateral
    return redemptionFee;
  }
}
