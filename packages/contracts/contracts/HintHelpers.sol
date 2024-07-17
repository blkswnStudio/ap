// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import '@openzeppelin/contracts/access/Ownable.sol';
import './Interfaces/ITroveManager.sol';
import './Interfaces/ISortedTroves.sol';
import './Dependencies/LiquityBase.sol';
import './Dependencies/CheckContract.sol';
import './Interfaces/IRedemptionOperations.sol';
import { IHintHelpers } from './Interfaces/IHintHelpers.sol';

contract HintHelpers is IHintHelpers, LiquityBase, Ownable(msg.sender), CheckContract {
  string public constant NAME = 'HintHelpers';

  ISortedTroves public sortedTroves;
  ITroveManager public troveManager;
  IRedemptionOperations public redemptionOperations;
  IPriceFeed public priceFeed;

  // --- Dependency setters ---

  function setAddresses(
    address _sortedTrovesAddress,
    address _troveManagerAddress,
    address _redemptionOperations,
    address _priceFeedAddress
  ) external onlyOwner {
    checkContract(_sortedTrovesAddress);
    checkContract(_troveManagerAddress);
    checkContract(_redemptionOperations);
    checkContract(_priceFeedAddress);

    sortedTroves = ISortedTroves(_sortedTrovesAddress);
    troveManager = ITroveManager(_troveManagerAddress);
    redemptionOperations = IRedemptionOperations(_redemptionOperations);
    priceFeed = IPriceFeed(_priceFeedAddress);

    emit HintHelpersInitialized(_sortedTrovesAddress, _troveManagerAddress, _redemptionOperations, _priceFeedAddress);
    renounceOwnership();
  }

  //   Return the current collateral ratio (ICR) of a given Trove. Takes a trove's pending coll and debt rewards from redistributions into account.
  function getCurrentICR(
    address _borrower
  ) external view override returns (uint ICR, uint IMCR, uint currentDebtInUSD) {
    PriceCache memory priceCache = priceFeed.buildPriceCache();
    return _getCurrentICR(priceCache, _borrower);
  }

  function getCurrentICR(
    PriceCache memory _priceCache,
    address _borrower
  ) external view override returns (uint ICR, uint IMCR, uint currentDebtInUSD) {
    return _getCurrentICR(_priceCache, _borrower);
  }

  function _getCurrentICR(
    PriceCache memory _priceCache,
    address _borrower
  ) internal view returns (uint ICR, uint IMCR, uint currentDebtInUSD) {
    uint currentCollInUSD;
    (IMCR, currentCollInUSD, currentDebtInUSD) = troveManager.getCurrentTrovesUSDValues(_priceCache, _borrower);
    ICR = LiquityMath._computeCR(currentCollInUSD, currentDebtInUSD);

    return (ICR, IMCR, currentDebtInUSD);
  }

  function getICRIncludingPatch(
    address _borrower,
    TokenAmount[] memory addedColl,
    TokenAmount[] memory removedColl,
    TokenAmount[] memory addedDebt,
    TokenAmount[] memory removedDebt
  ) external view override returns (uint ICR) {
    if (!troveManager.isTroveActive(_borrower)) return 0;

    PriceCache memory priceCache = priceFeed.buildPriceCache();
    (, uint currentCollInUSD, uint currentDebtInUSD) = troveManager.getCurrentTrovesUSDValues(priceCache, _borrower);

    currentCollInUSD += _getCompositeUSD(priceCache, addedColl);
    uint removedCollInUSD = _getCompositeUSD(priceCache, removedColl);
    if (currentCollInUSD < removedCollInUSD) currentCollInUSD = 0;
    else currentCollInUSD -= _getCompositeUSD(priceCache, removedColl);

    currentDebtInUSD += _getCompositeUSD(priceCache, addedDebt);
    uint removedDebtInUSD = _getCompositeUSD(priceCache, removedDebt);
    if (currentDebtInUSD < removedDebtInUSD) currentDebtInUSD = 0;
    else currentDebtInUSD -= _getCompositeUSD(priceCache, removedDebt);

    return LiquityMath._computeCR(currentCollInUSD, currentDebtInUSD);
  }

  function _getCompositeUSD(
    PriceCache memory _priceCache,
    TokenAmount[] memory _amounts
  ) internal view returns (uint inUSD) {
    for (uint i = 0; i < _amounts.length; i++)
      inUSD += priceFeed.getUSDValue(_priceCache, _amounts[i].tokenAddress, _amounts[i].amount);
    return inUSD;
  }

  // --- Functions ---

  /* getApproxHint() - return address of a Trove that is, on average, (length / numTrials) positions away in the
    sortedTroves list from the correct insert position of the Trove to be inserted.

    Note: The output address is worst-case O(n) positions away from the correct insert position, however, the function
    is probabilistic. Input can be tuned to guarantee results to a high degree of confidence, e.g:

    Submitting numTrials = k * sqrt(length), with k = 15 makes it very, very likely that the ouput address will
    be <= sqrt(length) positions away from the correct insert position.
    */
  function getApproxHint(
    uint _CR,
    uint _numTrials,
    uint _inputRandomSeed
  ) public view override returns (address hintAddress, uint diff, uint latestRandomSeed) {
    uint arrayLength = sortedTroves.getSize();
    if (arrayLength == 0) return (address(0), 0, _inputRandomSeed);

    hintAddress = sortedTroves.getLast();
    diff = LiquityMath._getAbsoluteDifference(_CR, sortedTroves.getUsedCR(hintAddress));
    latestRandomSeed = _inputRandomSeed;

    uint i = 1;
    while (i < _numTrials) {
      latestRandomSeed = uint(keccak256(abi.encodePacked(latestRandomSeed)));

      uint arrayIndex = latestRandomSeed % arrayLength;
      address currentAddress = sortedTroves.getByIndex(arrayIndex);

      // check if abs(current - CR) > abs(closest - CR), and update closest if current is closer
      uint currentDiff = LiquityMath._getAbsoluteDifference(_CR, sortedTroves.getUsedCR(currentAddress));
      if (currentDiff < diff) {
        diff = currentDiff;
        hintAddress = currentAddress;
      }

      i++;
    }
  }

  function getRedemptionIterationHints(
    uint _amountToRedeem,
    uint _numTrails,
    uint _inputRandomSeed
  ) external view override returns (RedeemIteration[] memory) {
    uint iteration = 0;
    RedeemIteration[] memory iterations = new RedeemIteration[](100);
    RedeemIteration memory lastIteration;

    while (_amountToRedeem > 0) {
      address trove = lastIteration.trove != address(0)
        ? sortedTroves.getPrev(lastIteration.trove)
        : sortedTroves.getLast();
      if (trove == address(0)) break;

      SingleRedemptionVariables memory simulatedRedemption = redemptionOperations.calculateTroveRedemption(
        trove,
        _amountToRedeem,
        true
      );
      _amountToRedeem -= simulatedRedemption.stableCoinLot;

      address approxHint;
      (approxHint, , _inputRandomSeed) = getApproxHint(simulatedRedemption.resultingCR, _numTrails, _inputRandomSeed);
      (address upperHint, address lowerHint) = sortedTroves.findInsertPosition(
        simulatedRedemption.resultingCR,
        approxHint,
        approxHint
      );

      lastIteration = RedeemIteration(trove, upperHint, lowerHint, simulatedRedemption.resultingCR);
      iterations[iteration] = lastIteration;
      iteration++;
    }

    RedeemIteration[] memory result = new RedeemIteration[](iteration);
    for (uint i = 0; i < iteration; i++) result[i] = iterations[i];
    return result;
  }
}
