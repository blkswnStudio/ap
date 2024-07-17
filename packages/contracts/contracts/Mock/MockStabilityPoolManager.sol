// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import '../StabilityPoolManager.sol';

contract MockStabilityPoolManager is StabilityPoolManager {
  // DEBTTOKEN TESTER PROXIES
  function testDebtToken_sendToPool(
    address _sender,
    address _poolAddress,
    uint256 _amount,
    IDebtToken _debtToken
  ) external {
    _debtToken.sendToPool(_sender, _poolAddress, _amount);
  }
}
