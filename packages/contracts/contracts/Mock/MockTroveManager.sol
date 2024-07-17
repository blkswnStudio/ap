// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import '../TroveManager.sol';

/* Tester contract inherits from TroveManager, and provides external functions 
for testing the parent's internal functions. */

contract MockTroveManager is TroveManager {
  function computeICR(uint _coll, uint _debt) external pure returns (uint) {
    return LiquityMath._computeCR(_coll, _debt);
  }

  function getCollGasCompensation(uint _coll) external pure returns (uint) {
    return _getCollGasCompensation(_coll);
  }

  function setLastFeeOpTimeToNow() external {
    lastFeeOperationTime = block.timestamp;
  }

  function setBaseRate(uint _baseRate) external {
    stableCoinBaseRate = _baseRate;
  }
}
