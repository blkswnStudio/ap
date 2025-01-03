// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import './ISwapPair.sol';

interface IStakingOperations {
  // --- Structs ---

  struct UserInfo {
    uint amount;
    uint rewardDebt;
  }

  struct PoolInfo {
    uint allocPoint;
    uint lastRewardTime;
    uint accRewardPerShare;
  }

  // --- Error ---

  error InvalidStakingToken();
  error InvalidPool(ISwapPair pid);
  error InsufficientDeposit();
  error DepositZero();
  error CallerIsNotSwapPair();
  error CallerIsNotTokenManager();
  error CallerIsNotTokenManagerOrSwapOperations();
  error CantVestAsStillVested();

  // --- Events ---

  event AddPool(ISwapPair indexed pid);
  event ConfigPool(ISwapPair indexed pid, uint allocPoint, uint totalAllocPoint);
  event Deposit(address indexed user, ISwapPair indexed pid, uint amount);
  event Withdraw(address indexed user, ISwapPair indexed pid, uint amount);
  event Claim(address indexed user, ISwapPair indexed pid, uint amount);
  event RewardsPerSecondChanged(uint rewardsPerSecond);
  event SetRedistributeAddress(address target);
  event StakingOperationsInitialized(address swapOperations, address tokenManager, address vesting);

  // --- Config functions ---

  function setRedistributeAddress(address _target) external;

  function setRewardsPerSecond(uint _rewardsPerSecond) external;

  function setPool(ISwapPair _pid, uint _allocPoint) external;

  // --- View functions ---

  function rewardToken() external view returns (IERC20);

  function balanceOf(ISwapPair _pid, address _user) external view returns (uint);

  function pendingReward(ISwapPair _pid, address _user) external view returns (uint);

  // --- User functions ---

  function harvest(bool _instantClaim) external;

  function claim(ISwapPair _pid, bool _harvestPending, bool _instantClaim) external;

  function batchClaim(ISwapPair[] memory _pids, bool _harvestPending, bool _instantClaim) external;

  function depositFor(ISwapPair _pid, address _user, uint _amount) external;

  function withdrawFor(ISwapPair _pid, address _user, uint _amount) external;
}
