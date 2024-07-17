// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

import './Dependencies/CheckContract.sol';
import './Interfaces/IStakingOperations.sol';
import './Interfaces/ISwapOperations.sol';
import './Interfaces/ITokenManager.sol';
import './Interfaces/ISwapPair.sol';

contract StakingOperations is IStakingOperations, CheckContract, Ownable(msg.sender) {
  // --- Libs ---

  using SafeERC20 for IERC20;

  // --- Constants ---

  string public constant NAME = 'StakingOperations';
  uint public constant REWARD_DECIMALS = 1e30;

  // --- Attributes ---

  ISwapOperations public swapOperations;
  ITokenManager public tokenManager;

  uint public rewardsPerSecond;
  ISwapPair[] public pools;
  mapping(address => uint) public unclaimedReward;
  mapping(ISwapPair => PoolInfo) public poolInfo;
  mapping(ISwapPair => mapping(address => UserInfo)) public userInfo;
  uint public totalAllocPoint = 0;
  uint public startTime;

  // --- Create ---

  constructor() {
    startTime = block.timestamp;
  }

  // --- Dependency setters ---

  function setAddresses(address _swapOperationsAddress, address _tokenManager) external onlyOwner {
    checkContract(_swapOperationsAddress);
    checkContract(_tokenManager);

    swapOperations = ISwapOperations(_swapOperationsAddress);
    tokenManager = ITokenManager(_tokenManager);

    emit StakingOperationsInitialized(_swapOperationsAddress, _tokenManager);
    renounceOwnership();
  }

  // --- Config functions ---

  function setRewardsPerSecond(uint _rewardsPerSecond) external override {
    // check
    requireCallerIsTokenManager();

    // update
    massUpdatePools();

    // set
    rewardsPerSecond = _rewardsPerSecond;
  }

  function setPool(ISwapPair _pid, uint _allocPoint) external override {
    // check
    requireValidToken(_pid);
    requireCallerIsTokenManagerOrSwapOperations();

    // update
    massUpdatePools();

    // cache
    PoolInfo storage pool = poolInfo[_pid];

    // check add pool
    if (pool.lastRewardTime == 0) {
      pool.lastRewardTime = block.timestamp > startTime ? block.timestamp : startTime;
      pools.push(_pid);
      emit AddPool(_pid);
    }

    // config pool
    uint prevAllocPoint = pool.allocPoint;
    totalAllocPoint = (totalAllocPoint - prevAllocPoint) + _allocPoint;
    pool.allocPoint = _allocPoint;
    emit ConfigPool(_pid, pool.allocPoint, totalAllocPoint);

    // update if required
    if (prevAllocPoint != _allocPoint) updatePool(_pid);
  }

  // --- View functions ---

  function balanceOf(ISwapPair _pid, address _user) external view returns (uint) {
    return userInfo[_pid][_user].amount;
  }

  function poolLength() external view returns (uint) {
    return pools.length;
  }

  function pendingReward(ISwapPair _pid, address _user) external view returns (uint) {
    PoolInfo storage pool = poolInfo[_pid];
    UserInfo storage user = userInfo[_pid][_user];
    uint accRewardPerShare = pool.accRewardPerShare;
    uint tokenSupply = _pid.balanceOf(address(this));
    if (block.timestamp > pool.lastRewardTime && tokenSupply != 0 && totalAllocPoint != 0) {
      uint multiplier = block.timestamp - pool.lastRewardTime;
      uint reward = (multiplier * rewardsPerSecond * pool.allocPoint) / totalAllocPoint;
      accRewardPerShare += (reward * REWARD_DECIMALS) / tokenSupply;
    }
    return ((user.amount * accRewardPerShare) / REWARD_DECIMALS) - user.rewardDebt;
  }

  // --- User functions ---

  function claim(ISwapPair _pid) external override {
    requireValidPool(_pid);
    _claim(_pid, msg.sender);
  }

  function batchClaim(ISwapPair[] memory _pids) external override {
    uint length = _pids.length;
    for (uint n = 0; n < length; n++) {
      requireValidPool(_pids[n]);
      _claim(_pids[n], msg.sender);
    }
  }

  function _claim(ISwapPair _pid, address _user) internal {
    PoolInfo storage pool = poolInfo[_pid];
    UserInfo storage user = userInfo[_pid][_user];

    // update pool
    updatePool(_pid);

    // get reward
    if (user.amount > 0) {
      uint pending = ((user.amount * pool.accRewardPerShare) / REWARD_DECIMALS) - user.rewardDebt;
      if (pending > 0) {
        safeRewardTransfer(_user, pending);
        emit Claim(_user, _pid, pending);
      }
    }
  }

  function depositFor(ISwapPair _pid, address _user, uint _amount) external override {
    PoolInfo storage pool = poolInfo[_pid];
    UserInfo storage user = userInfo[_pid][_user];

    // check
    requireCallerIsSwapPair();
    requireValidPool(_pid);
    if (_amount == 0) revert DepositZero();

    // claim
    _claim(_pid, _user);

    // deposit
    user.amount += _amount;
    user.rewardDebt = (user.amount * pool.accRewardPerShare) / REWARD_DECIMALS;
    emit Deposit(msg.sender, _pid, _amount);
  }

  function withdrawFor(ISwapPair _pid, address _user, uint _amount) external override {
    PoolInfo storage pool = poolInfo[_pid];
    UserInfo storage user = userInfo[_pid][_user];

    // check
    requireCallerIsSwapPair();
    requireValidPool(_pid);
    if (user.amount < _amount) revert InsufficientDeposit();

    // claim
    _claim(_pid, _user);

    // withdraw
    user.amount -= _amount;
    user.rewardDebt = (user.amount * pool.accRewardPerShare) / REWARD_DECIMALS;
    emit Withdraw(_user, _pid, _amount);
  }

  // --- Helpers ---

  function requireValidToken(ISwapPair _pid) internal view {
    if (!swapOperations.isPair(address(_pid))) revert InvalidStakingToken();
  }

  function requireValidPool(ISwapPair _pid) internal view {
    if (poolInfo[_pid].lastRewardTime == 0) revert InvalidPool(_pid);
  }

  function requireCallerIsSwapPair() internal view {
    if (!swapOperations.isPair(msg.sender)) revert CallerIsNotSwapPair();
  }

  function requireCallerIsTokenManager() internal view {
    if (msg.sender != address(tokenManager)) revert CallerIsNotTokenManager();
  }

  function requireCallerIsTokenManagerOrSwapOperations() internal view {
    if (msg.sender != address(swapOperations) && msg.sender != address(tokenManager))
      revert CallerIsNotTokenManagerOrSwapOperations();
  }

  function massUpdatePools() public {
    uint length = pools.length;
    for (uint n = 0; n < length; n++) {
      updatePool(pools[n]);
    }
  }

  function updatePool(ISwapPair _pid) public {
    PoolInfo storage pool = poolInfo[_pid];

    // check
    if (block.timestamp <= pool.lastRewardTime) return;

    // update
    uint tokenSupply = _pid.balanceOf(address(this));
    if (tokenSupply == 0 || totalAllocPoint == 0) {
      pool.lastRewardTime = block.timestamp;
      return;
    }
    uint multiplier = block.timestamp - pool.lastRewardTime;
    uint reward = (multiplier * rewardsPerSecond * pool.allocPoint) / totalAllocPoint;
    pool.accRewardPerShare += (reward * REWARD_DECIMALS) / tokenSupply;
    pool.lastRewardTime = block.timestamp;
  }

  function safeRewardTransfer(address _to, uint _amount) internal {
    // check unclaimable
    IERC20 rewardToken = IERC20(tokenManager.getGovTokenAddress());
    uint claimable = _amount + unclaimedReward[_to];
    uint unclaimable = 0;
    uint rewardBalance = rewardToken.balanceOf(address(this));
    if (claimable > rewardBalance) {
      unclaimable = claimable - rewardBalance;
      claimable = rewardBalance;
    }
    unclaimedReward[_to] = unclaimable;

    // transfer
    if (claimable > 0) rewardToken.safeTransfer(_to, claimable);
  }
}
