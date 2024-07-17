// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import '@openzeppelin/contracts/access/Ownable.sol';
import './Dependencies/CheckContract.sol';
import './Interfaces/IStabilityPoolManager.sol';
import './Interfaces/IReservePool.sol';
import './Interfaces/ISwapOperations.sol';
import './Interfaces/IGovSubsidy.sol';
import './Dependencies/LiquityBase.sol';

contract GovSubsidy is LiquityBase, Ownable(msg.sender), CheckContract, IGovSubsidy {
  string public constant NAME = 'GovSubsidy';

  IStabilityPoolManager public stabilityPoolManager;
  IReservePool public reservePool;
  ISwapOperations public swapOperations;

  // 100% in total (DECIMAL_PRECISION)
  uint public relativeStabilityPoolManager;
  uint public relativeReservePool;
  uint public relativeSwapOperations;

  function setAddresses(
    address _stabilityPoolManager,
    address _reservePool,
    address _swapOperations
  ) external onlyOwner {
    checkContract(_stabilityPoolManager);
    checkContract(_reservePool);
    checkContract(_swapOperations);

    stabilityPoolManager = IStabilityPoolManager(_stabilityPoolManager);
    reservePool = IReservePool(_reservePool);
    swapOperations = ISwapOperations(_swapOperations);

    emit GovSubsidyInitialized(_stabilityPoolManager, _reservePool, _swapOperations);
  }

  function updateRewardDistribution(
    uint _relativeStabilityPoolManager,
    uint _relativeReservePool,
    uint _relativeSwapOperations
  ) external onlyOwner {
    if (_relativeStabilityPoolManager + _relativeReservePool + _relativeSwapOperations != DECIMAL_PRECISION)
      revert InvalidRewardDistribution();
    relativeStabilityPoolManager = _relativeStabilityPoolManager;
    relativeReservePool = _relativeReservePool;
    relativeSwapOperations = _relativeSwapOperations;
  }

  function distribute() external {
    // todo distribute gov token based on the configured distribution
  }
}
