// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import './ISwapPair.sol';

interface IStakingOperations {
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
  event EmergencyWithdraw(address indexed user, ISwapPair indexed pid);
  event Claim(address indexed user, ISwapPair indexed pid, uint amount);
  event AdditionalRewardsPerSecondChanged(
    ISwapPair indexed pid,
    address indexed token,
    uint rewardsPerSecond,
    bool vesting
  );
  event SetRedistributeAddress(address target);
  event StakingOperationsInitialized(address swapOperations, address tokenManager, address vesting);

  // --- View functions ---

  function balanceOf(ISwapPair _pid, address _user) external view returns (uint);

  // --- User functions ---

  function harvest(bool _instantClaim) external;

  function claim(bool _harvestPending, bool _instantClaim) external;

  function depositFor(ISwapPair _pid, address _user, uint _amount) external;

  function withdrawFor(ISwapPair _pid, address _user, uint _amount) external;

  // --- Admin Functions ---

  function setEarlyClaimBurnAddress(address _target) external;

  function setRewardsPerSecond(ISwapPair _pid, address _token, uint _rewardsPerSecond, bool _vesting) external;

  function setPool(ISwapPair _pid) external;

  function emergencyWithdrawRewardToken(address _token, address _target) external;
}
