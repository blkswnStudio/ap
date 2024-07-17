// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import './Dependencies/LiquityBase.sol';
import './Dependencies/CheckContract.sol';
import './Interfaces/IReservePool.sol';
import './Interfaces/IStabilityPool.sol';
import './Interfaces/IStabilityPoolManager.sol';
import './Interfaces/IPriceFeed.sol';
import './Interfaces/ITokenManager.sol';

contract ReservePool is LiquityBase, Ownable(msg.sender), CheckContract, IReservePool {
  string public constant NAME = 'ReservePool';

  ITokenManager public tokenManager;
  IPriceFeed public priceFeed;
  address public stabilityPoolManagerAddress;

  uint public relativeStableCap; // percentage of total issued stable coins
  uint public govReserveCap;

  bool public initialized;

  function setAddresses(
    address _tokenManager,
    address _stabilityPoolManager,
    address _priceFeed,
    uint _relativeStableCap,
    uint _govReserveCap
  ) external onlyOwner {
    if (initialized) revert AlreadyInitialized();
    initialized = true;

    checkContract(_tokenManager);
    checkContract(_stabilityPoolManager);
    checkContract(_priceFeed);

    stabilityPoolManagerAddress = _stabilityPoolManager;
    priceFeed = IPriceFeed(_priceFeed);
    tokenManager = ITokenManager(_tokenManager);

    relativeStableCap = _relativeStableCap;
    govReserveCap = _govReserveCap;

    emit ReservePoolInitialized(_tokenManager, _stabilityPoolManager, _priceFeed);
    emit ReserveCapChanged(_relativeStableCap, govReserveCap);
  }

  function setRelativeStableCap(uint _relativeStableCap) external onlyOwner {
    relativeStableCap = _relativeStableCap;
    emit ReserveCapChanged(relativeStableCap, govReserveCap);
  }

  function setGovReserveCap(uint _govReserveCap) external onlyOwner {
    govReserveCap = _govReserveCap;
    emit ReserveCapChanged(relativeStableCap, govReserveCap);
  }

  function stableAmountUntilCap() external view returns (uint) {
    IDebtToken stableDebtToken = tokenManager.getStableCoin();

    uint totalStableSupply = stableDebtToken.totalSupply();
    uint capTarget = (totalStableSupply * relativeStableCap) / DECIMAL_PRECISION;
    uint stableBalance = stableDebtToken.balanceOf(address(this));

    if (stableBalance >= capTarget) return 0;
    return capTarget - stableBalance;
  }

  function isGovReserveCapReached() external view returns (bool) {
    IERC20 govToken = IERC20(tokenManager.getGovTokenAddress());
    return govToken.balanceOf(address(this)) >= govReserveCap;
  }

  /**
   * @notice Withdraw reserves to stability pool to repay possible loss when offset debts
   * @dev Try to withdraw with gov tokens first, when not enough then stablecoins.
   * @param stabilityPool Address of stability pool
   * @param withdrawAmountInUSD USD value of amounts to withdraw (same as stable debt token amount)
   * @return usedGov Gov token amount of withdrawn
   * @return usedStable Stable token amount of withdrawn
   */
  function withdrawValue(
    PriceCache memory priceCache,
    address stabilityPool,
    uint withdrawAmountInUSD
  ) external returns (uint usedGov, uint usedStable) {
    _requireCallerIsStabilityPoolManager();

    IDebtToken stableDebtToken = tokenManager.getStableCoin();
    IERC20 govToken = IERC20(tokenManager.getGovTokenAddress());
    TokenPrice memory govTokenPrice = priceFeed.getTokenPrice(priceCache, address(govToken));

    usedGov = priceFeed.getAmountFromUSDValue(govTokenPrice, withdrawAmountInUSD);
    usedGov = Math.min(usedGov, govToken.balanceOf(address(this)));
    govToken.transfer(stabilityPool, usedGov);

    usedStable = withdrawAmountInUSD - priceFeed.getUSDValue(govTokenPrice, usedGov);
    if (usedStable > 0) usedStable = Math.min(usedStable, stableDebtToken.balanceOf(address(this)));
    stableDebtToken.transfer(stabilityPool, usedStable);

    emit WithdrewReserves(usedGov, usedStable);
  }

  function _requireCallerIsStabilityPoolManager() internal view {
    if (msg.sender != stabilityPoolManagerAddress) revert NotFromSPM();
  }
}
