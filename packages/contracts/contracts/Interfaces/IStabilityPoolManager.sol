// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import './IBBase.sol';

interface IStabilityPoolManager is IBBase {
  // --- Events ---

  event StabilityPoolManagerInitiated(
    address liquidationOperationsAddress,
    address storgePoolAddress,
    address reservePoolAddress,
    address tokenManagerAddress,
    address priceFeedAddress
  );
  event StabilityPoolAdded(address stabilityPoolAddress);

  // --- Custom Errors ---
  error NotFromLiquidationOps();
  error NotFromReservePool();
  error PoolNotExist();
  error PoolExist();
  error Unauthorized();

  // --- Functions ---
  function getStabilityPool(IDebtToken _debtToken) external view returns (IStabilityPool);

  function getRemainingStability(PriceCache memory _priceCache) external view returns (RemainingStability[] memory);

  function getTotalDeposits() external view returns (TokenAmount[] memory deposits);

  function getTotalDeposit(address _debtTokenAddress) external view returns (uint amount);

  function getDepositorDeposits(address _depositor) external view returns (TokenAmount[] memory deposits);

  function getDepositorDeposit(address _depositor, address _debtTokenAddress) external view returns (uint amount);

  function getCompoundedDeposits() external view returns (TokenAmount[] memory deposits);

  function getDepositorCompoundedDeposit(
    address _depositor,
    address _debtTokenAddress
  ) external view returns (uint amount);

  function getDepositorCompoundedDeposits(address _depositor) external view returns (TokenAmount[] memory deposits);

  function getDepositorCollGains(address _depositor) external view returns (TokenAmount[] memory collGains);

  function provideStability(TokenAmount[] memory _debts) external;

  function withdrawStability(TokenAmount[] memory _debts) external;

  function withdrawGains() external;

  function offset(PriceCache memory _priceCache, RemainingStability[] memory _toOffset) external;

  function addStabilityPool(IDebtToken _debtToken) external;
}
