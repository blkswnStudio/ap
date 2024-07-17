// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '../StakingOperations.sol';
import './MockERC20.sol';

/* Tester contract inherits from StakingOperations, and provides external functions 
for testing the parent's internal functions. */

contract MockStakingOperations is StakingOperations {
  using SafeERC20 for IERC20;

  function untrustedHarvestAll() external {
    for (uint n = 0; n < vestingTokens.length; n++) {
      address t = vestingTokens[n];

      uint payout = _getTransferableRewardAmount(t, pendingHarvest[msg.sender][t]);
      pendingHarvest[msg.sender][t] = 0; // reset

      if (payout > 0) IERC20(t).safeTransfer(msg.sender, payout);
    }
  }
}
