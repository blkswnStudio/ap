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

import './StakingVestingOperations.sol';

contract StakingOperations is IStakingOperations, CheckContract, Ownable(msg.sender) {
  using SafeERC20 for IERC20;

  // --- Constants ---

  string public constant NAME = 'StakingOperations';
  uint public constant REWARD_DECIMALS = 1e30;
  uint256 public constant PERCENT = 100e2;
  uint256 public constant BURN_SHARE = PERCENT / 2;

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

  mapping(address => uint256) public pendingHarvest;
  uint256 public vestingTime = 30 days;
  address public redistributeAddress = address(0);
  StakingVestingOperations public vesting;

  // --- Create ---

  constructor() {
    startTime = block.timestamp;
  }

  // --- Dependency setters ---

  function setAddresses(address _swapOperationsAddress, address _tokenManager, address _vesting) external onlyOwner {
    checkContract(_swapOperationsAddress);
    checkContract(_tokenManager);
    CheckContract(_vesting);

    swapOperations = ISwapOperations(_swapOperationsAddress);
    tokenManager = ITokenManager(_tokenManager);
    vesting = StakingVestingOperations(_vesting);

    emit StakingOperationsInitialized(_swapOperationsAddress, _tokenManager, _vesting);
    renounceOwnership();
  }

  // --- Config functions ---

  function setRedistributeAddress(address _target) external override {
    // check
    requireCallerIsTokenManager();

    // set
    redistributeAddress = _target;
    vesting.setRedistributeAddress(_target);
    emit SetRedistributeAddress(_target);
  }

  function setRewardsPerSecond(uint _rewardsPerSecond) external override {
    // check
    requireCallerIsTokenManager();

    // update
    massUpdatePools();

    // set
    rewardsPerSecond = _rewardsPerSecond;
    emit RewardsPerSecondChanged(rewardsPerSecond);
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
    if (prevAllocPoint != _allocPoint) _updatePool(_pid, 0);
  }

  // --- View functions ---

  function rewardToken() public view returns (IERC20) {
    return IERC20(tokenManager.getGovTokenAddress());
  }

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

  function harvest(bool _instantClaim) external {
    _harvest(msg.sender, _instantClaim);
  }

  /// @notice Harvests funds in pendingHarvest, by either collect+burn or vesting them.
  /// If there are not enough rewards or rewards is still vested, it will be stored for later harvest
  function _harvest(address _user, bool _instantClaim) private {
    // try to claim vested
    claimVested(_user);

    // vest or payout
    if (_instantClaim) instantClaimPending(_user);
    else vestPending(_user);
  }

  /// @notice See the remarks of _claim. It is also possible to directly harvest after claim
  function claim(ISwapPair _pid, bool _harvestPending, bool _instantClaim) external override {
    requireValidPool(_pid);

    // try to claim vested
    claimVested(msg.sender);

    // claim pool
    _claim(_pid, msg.sender, 0);

    // set reward debt
    userInfo[_pid][msg.sender].rewardDebt =
      (userInfo[_pid][msg.sender].amount * poolInfo[_pid].accRewardPerShare) /
      REWARD_DECIMALS;

    if (_harvestPending) _harvest(msg.sender, _instantClaim);
  }

  /// @notice See the remarks of _claim. It is also possible to directly harvest after claim
  function batchClaim(ISwapPair[] memory _pids, bool _harvestPending, bool _instantClaim) external override {
    // claim pools
    ISwapPair pid;
    uint length = _pids.length;
    for (uint n = 0; n < length; n++) {
      pid = _pids[n];
      requireValidPool(pid);
      _claim(pid, msg.sender, 0);

      // set reward debt
      userInfo[pid][msg.sender].rewardDebt =
        (userInfo[pid][msg.sender].amount * poolInfo[pid].accRewardPerShare) /
        REWARD_DECIMALS;
    }

    if (_harvestPending) _harvest(msg.sender, _instantClaim);
  }

  /// @notice The pending rewards from a user of a certain pool,
  /// will be aggregated in pendingHarvest and can then be harvested afterwards.
  /// This is done, so that a single pool doesnt directly vest or harvest + burn, to save gas
  /// and not block vesting with small amounts
  function _claim(ISwapPair _pid, address _user, uint _addedBalance) private {
    PoolInfo storage pool = poolInfo[_pid];
    UserInfo storage user = userInfo[_pid][_user];

    // update pool
    _updatePool(_pid, _addedBalance);

    // get reward
    if (user.amount > 0) {
      uint pendingPayout = ((user.amount * pool.accRewardPerShare) / REWARD_DECIMALS) - user.rewardDebt;
      pendingHarvest[_user] += pendingPayout;
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
    _claim(_pid, _user, _amount);

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
    _claim(_pid, _user, 0);

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
      _updatePool(pools[n], 0);
    }
  }

  function updatePool(ISwapPair _pid) external {
    _updatePool(_pid, 0);
  }

  function _updatePool(ISwapPair _pid, uint _addedBalance) private {
    PoolInfo storage pool = poolInfo[_pid];

    // check
    if (block.timestamp <= pool.lastRewardTime) return;

    // update
    uint tokenSupply = _pid.balanceOf(address(this)) - _addedBalance;
    if (tokenSupply == 0 || totalAllocPoint == 0) {
      pool.lastRewardTime = block.timestamp;
      return;
    }
    uint multiplier = block.timestamp - pool.lastRewardTime;
    uint reward = (multiplier * rewardsPerSecond * pool.allocPoint) / totalAllocPoint;
    pool.accRewardPerShare += (reward * REWARD_DECIMALS) / tokenSupply;
    pool.lastRewardTime = block.timestamp;
  }

  function getTransferableAmount(address _to, uint _amount) internal returns (uint) {
    // check unclaimable
    uint claimable = _amount + unclaimedReward[_to];
    uint unclaimable = 0;
    uint rewardBalance = rewardToken().balanceOf(address(this));
    if (claimable > rewardBalance) {
      unclaimable = claimable - rewardBalance;
      claimable = rewardBalance;
    }
    unclaimedReward[_to] = unclaimable;

    return claimable;
  }

  // --- Claim Helpers ---

  function instantClaimPending(address _user) private {
    uint payout = getTransferableAmount(_user, pendingHarvest[_user]);
    pendingHarvest[_user] = 0; // reset

    // check payout > 0
    if (payout == 0) return;

    // get total burn amount
    uint256 pendingBurn = (payout * BURN_SHARE) / PERCENT;
    burnOrRedistributeRewardToken(pendingBurn);

    // get pending payout and transfer to user
    uint256 pendingPayout = payout - pendingBurn;
    if (pendingPayout > 0) rewardToken().safeTransfer(_user, pendingPayout);
  }

  function burnOrRedistributeRewardToken(uint256 _amount) internal virtual {
    if (_amount == 0) return;

    if (redistributeAddress != address(0)) {
      // transfer rewards to specified address
      rewardToken().safeTransfer(redistributeAddress, _amount);
    } else {
      // burn rewards
      RewardERC20(address(rewardToken())).burn(_amount);
    }
  }

  function vestPending(address _user) private {
    uint payout = getTransferableAmount(_user, pendingHarvest[_user]);
    pendingHarvest[_user] = 0; // reset

    // check payout > 0
    if (payout == 0) return;

    // check remaining time = 0
    IERC20 rt = rewardToken();
    (uint r, , , ) = vesting.checkVesting(address(rt), _user);
    if (r != 0) revert CantVestAsStillVested(); // let it in pending

    // approve
    rt.approve(address(vesting), payout);

    // deposit into vesting
    vesting.deposit(address(rt), _user, payout, vestingTime);
  }

  function claimVested(address _user) private {
    // check remaining time = 0 and amount > 0
    IERC20 rt = rewardToken();
    (uint r, uint a, , ) = vesting.checkVesting(address(rt), _user);
    if (r == 0 && a > 0) vesting.claimForUser(address(rt), _user, false);
  }
}
