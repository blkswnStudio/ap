// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import './IBBase.sol';
import './IDebtToken.sol';

interface IGovSubsidy is IBBase {
  error InvalidRewardDistribution();

  event GovSubsidyInitialized(address _stabilityPoolManager, address _reservePool, address _swapOperations);

  function updateRewardDistribution(
    uint _relativeStabilityPoolManager,
    uint _relativeReservePool,
    uint _relativeSwapOperations
  ) external;

  function distribute() external;
}
