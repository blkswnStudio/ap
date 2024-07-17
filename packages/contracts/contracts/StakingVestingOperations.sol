// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

import './Interfaces/IStakingVestingOperations.sol';

import './Dependencies/CheckContract.sol';

contract StakingVestingOperations is IStakingVestingOperations, CheckContract, Ownable(msg.sender) {
  using SafeERC20 for IERC20;

  /* ========== CONSTANTS ========== */

  uint256 public constant PERCENT = 100e2;
  uint256 public constant BURN_SHARE = PERCENT / 2;
  uint256 public constant MAX_VESTING_TIME = 180 days;

  mapping(address => mapping(address => VestingInfo)) public vestingInfo; // user => token => vesting
  mapping(address => address[]) public vestedTokens; // user => tokens

  address public earlyClaimBurnAddress = address(0);
  address public stakingOps;

  // --- Dependency setters ---

  function setAddresses(address _stakingOps) external onlyOwner {
    checkContract(_stakingOps);

    stakingOps = _stakingOps;

    emit StakingVestingOperationsInitialized(_stakingOps);
    renounceOwnership();
  }

  /* ========== CONFIG FUNCTIONS ========== */

  function setEarlyClaimBurnAddress(address _target) external override {
    if (msg.sender != stakingOps) revert CallerNotStakingOps();

    earlyClaimBurnAddress = _target;
    emit SetRedistributeAddress(_target);
  }

  /* ========== VIEW FUNCTIONS ========== */

  function checkVesting(
    address _token,
    address _user
  ) public view returns (uint256 remainingTime, uint256 amount, uint claimable, uint burned) {
    VestingInfo memory info = vestingInfo[_user][_token];

    if (info.end > block.timestamp) remainingTime = info.end - block.timestamp;
    amount = info.amount;

    uint passedTime = info.duration - remainingTime;
    if (passedTime > 0) {
      uint unvested = (amount * passedTime) / info.duration;
      uint vested = amount - unvested;
      burned = (vested * BURN_SHARE) / PERCENT;
      claimable = unvested + (vested - burned);
    }

    return (remainingTime, amount, claimable, burned);
  }

  function getUserVestedTokensLength(address _user) external view returns (uint256) {
    return vestedTokens[_user].length;
  }

  function getUserVestedTokens(address _user) external view returns (address[] memory) {
    return vestedTokens[_user];
  }

  /* ========== MUTATIVE FUNCTIONS ========== */

  function deposit(address _token, address _user, uint256 _amount, uint256 _time) external {
    // cache
    VestingInfo storage info = vestingInfo[_user][_token];

    // check
    if (msg.sender != _user && msg.sender != stakingOps) revert DepositNotFromUserOrStaking(); // this prevents malicious deposit of small amounts for long periods for other users
    if (_time == 0) revert VestingTooShort();
    if (_time > MAX_VESTING_TIME) revert VestingTooLong();
    if (info.end > block.timestamp) revert StillVested();
    if (_amount == 0) revert ZeroAmount();

    // claim
    if (info.amount > 0) _claimForUser(_token, _user, false);

    // transfer tokens
    IERC20(_token).safeTransferFrom(stakingOps, address(this), _amount);

    // deposit
    info.end = block.timestamp + _time;
    info.amount = _amount;
    info.duration = _time;

    // index
    vestedTokens[_user].push(_token);
  }

  function claim(address _token, bool _earlyClaim) external {
    _claimForUser(_token, msg.sender, _earlyClaim);
  }

  function claimForUser(address _token, address _user, bool _earlyClaim) public override {
    if (msg.sender != _user && msg.sender != stakingOps) revert ClaimNotFromUserOrStaking();
    _claimForUser(_token, _user, _earlyClaim);
  }

  function _claimForUser(address _token, address _user, bool _earlyClaim) private {
    VestingInfo storage info = vestingInfo[_user][_token];

    // check
    if (!_earlyClaim && info.end > block.timestamp) revert StillVested();
    if (info.amount == 0) revert InsufficientBalance();

    // get amount
    (, , uint256 claimable, uint256 burn) = checkVesting(_token, _user);
    if (claimable == 0) revert InsufficientClaimable();

    // burn
    burnOrRedistributeRewardToken(IERC20(_token), burn);

    // payout
    IERC20(_token).safeTransfer(_user, claimable);
    info.end = 0;
    info.amount = 0;

    // remove indexed
    address[] storage idx = vestedTokens[_user];
    for (uint256 n = 0; n < idx.length; n++) {
      if (idx[n] == _token) {
        idx[n] = idx[idx.length - 1];
        idx.pop();
        break;
      }
    }

    emit Claim(_token, _user, claimable, burn);
  }

  function burnOrRedistributeRewardToken(IERC20 _token, uint256 _amount) private {
    if (_amount == 0) return;

    if (earlyClaimBurnAddress != address(0)) {
      // transfer rewards to specified address
      _token.safeTransfer(earlyClaimBurnAddress, _amount);
    } else {
      // burn rewards
      RewardERC20(address(_token)).burn(_amount);
    }
  }
}
