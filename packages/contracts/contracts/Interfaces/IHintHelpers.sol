// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import './IBase.sol';

interface IHintHelpers is IBase {
  event HintHelpersInitialized(
    address _sortedTrovesAddress,
    address _troveManagerAddress,
    address _redemptionOperations,
    address _priceFeedAddress
  );

  function getCurrentICR(address _borrower) external view returns (uint ICR, uint IMCR, uint currentDebtInUSD);

  function getCurrentICR(
    PriceCache memory _priceCache,
    address _borrower
  ) external view returns (uint ICR, uint IMCR, uint currentDebtInUSD);

  function getICRIncludingPatch(
    address _borrower,
    TokenAmount[] memory addedColl,
    TokenAmount[] memory removedColl,
    TokenAmount[] memory addedDebt,
    TokenAmount[] memory removedDebt
  ) external view returns (uint ICR);

  function getApproxHint(
    uint _CR,
    uint _numTrials,
    uint _inputRandomSeed
  ) external view returns (address hintAddress, uint diff, uint latestRandomSeed);

  function getRedemptionIterationHints(
    uint _amountToRedeem,
    uint _numTrails,
    uint _inputRandomSeed
  ) external view returns (RedeemIteration[] memory);
}
