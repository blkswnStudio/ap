// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface RewardERC20 is IERC20 {
  function burn(uint256 value) external;
}

interface IStakingVestingOperations {
  struct VestingInfo {
    uint256 end;
    uint256 duration;
    uint256 amount;
  }

  /* ========== ERRORS ========== */

  error CallerNotStakingOps();
  error DepositNotFromUserOrStaking();
  error ClaimNotFromUserOrStaking();
  error VestingTooShort();
  error VestingTooLong();
  error StillVested();
  error ZeroAmount();
  error InsufficientBalance();
  error InsufficientClaimable();

  /* ========== EVENTS ========== */

  event Deposit(address indexed token, address indexed user, uint256 amount, uint256 end);
  event Claim(address indexed token, address indexed user, uint256 amount, uint256 burn);
  event SetRedistributeAddress(address target);
  event StakingVestingOperationsInitialized(address stakingOperations);

  /* ========== CONFIG FUNCTIONS ========== */

  function setRedistributeAddress(address _target) external;

  /* ========== VIEW FUNCTIONS ========== */

  function checkVesting(
    address _token,
    address _user
  ) external view returns (uint256 remainingTime, uint256 amount, uint claimable, uint burned);

  /* ========== MUTATIVE FUNCTIONS ========== */

  function deposit(address _token, address _user, uint256 _amount, uint256 _time) external;

  function claimForUser(address _token, address _user, bool _earlyClaim) external;
}
