// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '../StakingOperations.sol';
import './MockERC20.sol';

/* Tester contract inherits from StakingOperations, and provides external functions 
for testing the parent's internal functions. */

contract MockStakingOperations is StakingOperations {
  using SafeERC20 for IERC20;

  function untrustedHarvestAll() external {
    uint payout = getTransferableAmount(msg.sender, pendingHarvest[msg.sender]);
    pendingHarvest[msg.sender] = 0; // reset

    if (payout > 0) rewardToken().safeTransfer(msg.sender, payout);
  }

  function burnOrRedistributeRewardToken(uint256 _amount) internal override {
    if (_amount == 0) return;

    if (redistributeAddress != address(0)) {
      // transfer rewards to specified address
      rewardToken().safeTransfer(redistributeAddress, _amount);
    } else {
      // burn rewards
      MockERC20(address(rewardToken())).unprotectedBurn(address(this), _amount);
    }
  }
}
