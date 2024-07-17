// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import './Dependencies/LiquityBase.sol';
import './Dependencies/CheckContract.sol';
import './Interfaces/IReservePool.sol';
import './Interfaces/IPriceFeed.sol';
import './Interfaces/ITokenManager.sol';
import './Interfaces/IStoragePool.sol';

contract ReservePool is LiquityBase, Ownable(msg.sender), CheckContract, IReservePool {
  using SafeERC20 for IERC20;

  string public constant NAME = 'ReservePool';

  ITokenManager public tokenManager;
  IPriceFeed public priceFeed;
  IStoragePool public storagePool;
  address public liquidationOperationsAddress;

  uint public relativeStableCap; // percentage of total issued stable coins
  uint public govReserveCap;

  bool public initialized;

  function setAddresses(
    address _tokenManager,
    address _priceFeed,
    address _liquidationOperations,
    address _storagePool,
    uint _relativeStableCap
  ) external onlyOwner {
    if (initialized) revert AlreadyInitialized();
    initialized = true;

    checkContract(_tokenManager);
    checkContract(_priceFeed);
    checkContract(_liquidationOperations);
    checkContract(_storagePool);

    priceFeed = IPriceFeed(_priceFeed);
    tokenManager = ITokenManager(_tokenManager);
    storagePool = IStoragePool(_storagePool);
    liquidationOperationsAddress = _liquidationOperations;

    relativeStableCap = _relativeStableCap;

    emit ReservePoolInitialized(_tokenManager, _priceFeed, _liquidationOperations, _storagePool);
    emit ReserveCapChanged(_relativeStableCap, govReserveCap);
  }

  function setRelativeStableCap(uint _relativeStableCap) external onlyOwner {
    relativeStableCap = _relativeStableCap;
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

  function withdrawValue(
    PriceCache memory priceCache,
    uint withdrawAmountInUSD
  ) external returns (uint usedGov, uint usedStable, uint usedUSDSum) {
    _requireCallerIsLiquidationOps();

    IERC20 stableDebtToken = tokenManager.getStableCoin();
    IERC20 govToken = IERC20(tokenManager.getGovTokenAddress());
    TokenPrice memory govTokenPrice = priceFeed.getTokenPrice(priceCache, address(govToken));

    usedGov = priceFeed.getAmountFromUSDValue(govTokenPrice, withdrawAmountInUSD);
    usedGov = Math.min(usedGov, govToken.balanceOf(address(this)));

    uint usedGovInUSD = priceFeed.getUSDValue(govTokenPrice, usedGov);
    usedStable = withdrawAmountInUSD - usedGovInUSD;
    if (usedStable > 0) usedStable = Math.min(usedStable, stableDebtToken.balanceOf(address(this)));

    // transfer the token to the active storage pool, will be moved to the default pool at the end of the liquidation
    IStoragePool _storagePool = storagePool;
    if (usedGov > 0) {
      govToken.safeTransfer(address(_storagePool), usedGov);
      _storagePool.addValue(address(govToken), true, PoolType.Active, usedGov);
    }
    if (usedStable > 0) {
      stableDebtToken.safeTransfer(address(_storagePool), usedStable);
      _storagePool.addValue(address(stableDebtToken), true, PoolType.Active, usedStable);
    }

    emit WithdrewReserves(usedGov, usedStable);
    return (usedGov, usedStable, usedGovInUSD + usedStable);
  }

  function _requireCallerIsLiquidationOps() internal view {
    if (msg.sender != liquidationOperationsAddress) revert NotFromSPM();
  }
}
