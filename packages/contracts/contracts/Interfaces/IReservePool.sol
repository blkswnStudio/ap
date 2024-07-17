// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import './IBBase.sol';
import './IDebtToken.sol';

interface IReservePool is IBBase {
  error NotFromSPM();

  event ReservePoolInitialized(address _tokenManager, address _stabilityPoolManager, address _priceFeed);
  event ReserveCapChanged(uint newReserveCap, uint newGovReserveCap);
  event WithdrewReserves(uint govAmount, uint stableAmount);

  function setRelativeStableCap(uint _relativeStableCap) external;

  function stableAmountUntilCap() external view returns (uint);

  function isGovReserveCapReached() external view returns (bool);

  function withdrawValue(
    PriceCache memory priceCache,
    address stabilityPool,
    uint withdrawAmountInUSD
  ) external returns (uint usedGov, uint usedStable);
}
