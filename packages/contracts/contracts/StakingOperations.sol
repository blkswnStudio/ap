// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

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
  uint public constant PERCENT = 100e2;
  uint public constant BURN_SHARE = PERCENT / 2;
  uint256 public constant vestingTime = 30 days;

  uint public startTime; // set in constructor
  address public earlyClaimBurnAddress = address(0); // address to send rewards to, if vesting gets skipped

  // --- Attributes ---

  ISwapOperations public swapOperations;
  ITokenManager public tokenManager;
  StakingVestingOperations public vesting;

  ISwapPair[] public pools;
  mapping(ISwapPair => PoolInfo) public poolInfo;
  struct PoolInfo {
    uint lastAppliedAt;
    address[] rewardTokens;
    mapping(address => RewardInfo) rewards;
  }
  struct RewardInfo {
    address token;
    bool vesting;
    uint rewardsPerSecond;
    uint accRewardPerShare;
  }

  address[] public vestingTokens;
  mapping(address => bool) public isVestingToken;

  mapping(ISwapPair => mapping(address => UserInfo)) public userInfo; // pid => user => UserInfo
  struct UserInfo {
    uint balance; // lp token balance, aka staking share
    mapping(address => uint) rewardSnapshots; // token => reward
  }
  mapping(address => mapping(address => uint256)) public pendingHarvest; // user => token => amount (funds waiting to be transferred into vesting)

  // --- Create ---

  constructor() {
    startTime = block.timestamp;
  }

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

  // --- View functions ---

  function getUsersRewardSnapshot(ISwapPair _pid, address _user, address _reward) external view returns (uint) {
    return userInfo[_pid][_user].rewardSnapshots[_reward];
  }

  function getRewardInfo(ISwapPair _pid, address _reward) external view returns (RewardInfo memory) {
    return poolInfo[_pid].rewards[_reward];
  }

  function balanceOf(ISwapPair _pid, address _user) external view returns (uint) {
    return userInfo[_pid][_user].balance;
  }

  function poolLength() external view returns (uint) {
    return pools.length;
  }

  function pendingReward(ISwapPair _pid, address _token, address _user) external view returns (uint) {
    PoolInfo storage pool = poolInfo[_pid];
    RewardInfo storage rewardInfo = pool.rewards[_token];

    uint accRewardPerShare = rewardInfo.accRewardPerShare;
    uint tokenSupply = _pid.balanceOf(address(this));
    if (block.timestamp > pool.lastAppliedAt) {
      uint multiplier = block.timestamp - pool.lastAppliedAt;
      uint reward = (multiplier * rewardInfo.rewardsPerSecond);
      accRewardPerShare += (reward * REWARD_DECIMALS) / tokenSupply;
    }

    UserInfo storage user = userInfo[_pid][_user];
    return ((user.balance * accRewardPerShare) / REWARD_DECIMALS) - user.rewardSnapshots[_token];
  }

  // --- deposit / withdrawal functions ---

  function depositFor(ISwapPair _pid, address _user, uint _amount) external override {
    PoolInfo storage pool = poolInfo[_pid];
    UserInfo storage user = userInfo[_pid][_user];

    requireCallerIsSwapPair();
    requireValidPool(_pid);
    if (_amount == 0) revert DepositZero();

    _claimPendingRewards(_pid, _user, _amount, 0);
    emit Deposit(_user, _pid, _amount);
  }

  function withdrawFor(ISwapPair _pid, address _user, uint _amount) external override {
    PoolInfo storage pool = poolInfo[_pid];
    UserInfo storage user = userInfo[_pid][_user];

    requireCallerIsSwapPair();
    requireValidPool(_pid);
    if (user.balance < _amount) revert InsufficientDeposit();

    _claimPendingRewards(_pid, _user, 0, _amount);
    emit Withdraw(_user, _pid, _amount);
  }

  // --- Harvest ---

  function harvest(bool _instantClaim) external {
    _harvestTokenForVesting(msg.sender, _instantClaim);
  }

  /// @notice Harvests funds in pendingHarvest, by either collect+burn or vesting them.
  /// If there are not enough rewards or rewards is still vested, it will be stored for later harvest
  function _harvestTokenForVesting(address _user, bool _instantClaim) private {
    for (uint n = 0; n < vestingTokens.length; n++) {
      address token = vestingTokens[n];

      // try to claim vested
      _claimVested(_user, token);

      uint payout = _getTransferableRewardAmount(token, pendingHarvest[_user][token]);
      pendingHarvest[_user][token] = 0; // reset
      if (payout == 0) continue;

      if (_instantClaim) {
        // instant payout with burn
        uint256 pendingBurn = (payout * BURN_SHARE) / PERCENT;
        if (pendingBurn > 0) {
          if (earlyClaimBurnAddress != address(0))
            IERC20(token).safeTransfer(earlyClaimBurnAddress, pendingBurn); // transfer rewards to specified address
          else RewardERC20(token).burn(pendingBurn); // burn rewards amount;
        }

        // get pending payout and transfer to user
        uint256 pendingPayout = payout - pendingBurn;
        if (pendingPayout > 0) IERC20(token).safeTransfer(_user, pendingPayout);
      } else {
        // start vesting
        (uint r, , , ) = vesting.checkVesting(token, _user);
        if (r != 0) revert CantVestAsStillVested(); // let it in pending

        // deposit into vesting
        IERC20(token).approve(address(vesting), payout);
        vesting.deposit(token, _user, payout, vestingTime);
      }
    }
  }

  function claim(bool _harvestPending, bool _instantClaim) external override {
    address user = msg.sender;

    for (uint n = 0; n < vestingTokens.length; n++) _claimVested(user, vestingTokens[n]);
    for (uint n = 0; n < pools.length; n++) _claimPendingRewards(pools[n], user, 0, 0);
    if (_harvestPending) _harvestTokenForVesting(user, _instantClaim);
  }

  /// @notice The pending rewards from a user of a certain pool,
  /// will be aggregated in pendingHarvest and can then be harvested afterwards.
  /// This is done, so that a single pool doesnt directly vest or harvest + burn, to save gas
  /// and not block vesting with small amounts
  function _claimPendingRewards(ISwapPair _pid, address _user, uint _addedBalance, uint _removedBalance) private {
    PoolInfo storage pool = poolInfo[_pid];
    UserInfo storage user = userInfo[_pid][_user];

    // update pool pending rewards
    _poolApplyPendingRewards(_pid, _addedBalance);

    // payout pending rewards (or put them into pendingHarvest to be vested)
    if (user.balance > 0)
      for (uint n = 0; n < pool.rewardTokens.length; n++) {
        address token = pool.rewardTokens[n];
        RewardInfo storage rewardInfo = pool.rewards[token];

        // get reward
        uint pendingPayout = ((user.balance * rewardInfo.accRewardPerShare) / REWARD_DECIMALS) -
          user.rewardSnapshots[token];
        if (pendingPayout == 0) continue;

        // payout
        uint pay = _getTransferableRewardAmount(token, pendingPayout);
        if (rewardInfo.vesting) pendingHarvest[_user][token] += pendingPayout;
        else if (pay > 0) IERC20(token).safeTransfer(_user, pay);
      }

    // updating users balance
    if (_addedBalance > 0) user.balance += _addedBalance;
    if (_removedBalance > 0) user.balance -= _removedBalance;

    // update users claimed rewards snapshots
    for (uint n = 0; n < pool.rewardTokens.length; n++) {
      address token = pool.rewardTokens[n];
      user.rewardSnapshots[token] = (user.balance * pool.rewards[token].accRewardPerShare) / REWARD_DECIMALS;
    }
  }

  function _claimVested(address _user, address _token) internal {
    (uint r, uint a, , ) = vesting.checkVesting(_token, _user);
    if (r == 0 && a > 0) vesting.claimForUser(_token, _user, false);
  }

  // --- Admin Functions ---

  function setPool(ISwapPair _pid) external override {
    // check
    requireValidLPToken(_pid);
    requireCallerIsSwapOps();

    // cache
    PoolInfo storage pool = poolInfo[_pid];

    // check add pool
    if (pool.lastAppliedAt == 0) {
      pool.lastAppliedAt = block.timestamp > startTime ? block.timestamp : startTime;
      pools.push(_pid);
      emit AddPool(_pid);
    }

    _poolApplyPendingRewards(_pid, 0);
  }

  function setRewardsPerSecond(
    ISwapPair _pid,
    address _token,
    uint _rewardsPerSecond,
    bool _vesting
  ) external override {
    // check
    requireCallerIsTokenManager();
    requireValidPool(_pid);

    // check that the rewards per second do not run into an overflow over the next 1000 years
    require((_rewardsPerSecond * (1000 * 365 * 24 * 60 * 60)) < 2 ** 256 - 1, 'Rewards per second too high');

    // cache
    PoolInfo storage pool = poolInfo[_pid];
    require(pool.lastAppliedAt > 0, 'Invalid pool');

    // update
    _poolApplyPendingRewards(_pid, 0);

    // add / update
    RewardInfo storage ar = pool.rewards[_token];
    if (ar.token == address(0)) {
      // add
      pool.rewardTokens.push(_token);
      pool.rewards[_token] = RewardInfo({
        token: _token,
        rewardsPerSecond: _rewardsPerSecond,
        accRewardPerShare: 0,
        vesting: _vesting
      });
    } else {
      // update
      ar.rewardsPerSecond = _rewardsPerSecond;
      ar.vesting = _vesting;
    }
    if (_vesting && !isVestingToken[ar.token]) {
      isVestingToken[ar.token] = true;
      vestingTokens.push(ar.token);
    }

    // set
    emit AdditionalRewardsPerSecondChanged(_pid, _token, _rewardsPerSecond, _vesting);
  }

  function setEarlyClaimBurnAddress(address _target) external override {
    requireCallerIsTokenManager(); // check

    earlyClaimBurnAddress = _target;
    vesting.setEarlyClaimBurnAddress(_target);
    emit SetRedistributeAddress(_target);
  }

  function emergencyWithdrawRewardToken(address _token, address _target) external override {
    requireCallerIsTokenManager(); // check
    require(!swapOperations.isPair(_token), 'Invalid token'); // if not LP

    IERC20(_token).safeTransfer(_target, IERC20(_token).balanceOf(address(this)));
  }

  // --- Helpers ---

  function _poolApplyPendingRewards(ISwapPair _pid, uint _addedBalance) internal {
    PoolInfo storage pool = poolInfo[_pid];
    if (block.timestamp <= pool.lastAppliedAt) return;

    uint tokenSupply = _pid.balanceOf(address(this)) - _addedBalance;
    if (tokenSupply == 0) return; //skip

    uint secondsSinceLastUpdate = block.timestamp - pool.lastAppliedAt;
    for (uint n = 0; n < pool.rewardTokens.length; n++) {
      RewardInfo storage additionalReward = pool.rewards[pool.rewardTokens[n]];

      uint reward = (secondsSinceLastUpdate * additionalReward.rewardsPerSecond);
      additionalReward.accRewardPerShare += (reward * REWARD_DECIMALS) / tokenSupply;
    }

    pool.lastAppliedAt = block.timestamp;
  }

  function _getTransferableRewardAmount(address _token, uint _amount) internal returns (uint) {
    uint rewardBalance = IERC20(_token).balanceOf(address(this));
    if (_amount > rewardBalance) return rewardBalance;
    return _amount;
  }

  // --- Requires ---

  function requireValidLPToken(ISwapPair _pid) internal view {
    if (!swapOperations.isPair(address(_pid))) revert InvalidStakingToken();
  }

  function requireValidPool(ISwapPair _pid) internal view {
    if (poolInfo[_pid].lastAppliedAt == 0) revert InvalidPool(_pid);
  }

  function requireCallerIsSwapOps() internal view {
    if (msg.sender != address(swapOperations)) revert CallerIsNotTokenManagerOrSwapOperations();
  }

  function requireCallerIsSwapPair() internal view {
    if (!swapOperations.isPair(msg.sender)) revert CallerIsNotSwapPair();
  }

  function requireCallerIsTokenManager() internal view {
    if (msg.sender != address(tokenManager)) revert CallerIsNotTokenManager();
  }
}
