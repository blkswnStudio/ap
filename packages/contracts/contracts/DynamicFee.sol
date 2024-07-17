// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import './Interfaces/IDynamicFee.sol';

contract DynamicFee is IDynamicFee {
  function calcDynamicSwapFee(uint val) external pure returns (uint fee) {
    if (val < 0.02e18) return 0.0002e18;
    if (val < 0.03e18) return 0.0002e18 + ((val - 0.02e18) * (0.0004e18 - 0.0002e18)) / (0.03e18 - 0.02e18);
    if (val < 0.04e18) return 0.0004e18 + ((val - 0.03e18) * (0.0008e18 - 0.0004e18)) / (0.04e18 - 0.03e18);
    if (val < 0.05e18) return 0.0008e18 + ((val - 0.04e18) * (0.002e18 - 0.0008e18)) / (0.05e18 - 0.04e18);
    if (val < 0.06e18) return 0.002e18 + ((val - 0.05e18) * (0.004e18 - 0.002e18)) / (0.06e18 - 0.05e18);
    if (val < 0.07e18) return 0.004e18 + ((val - 0.06e18) * (0.008e18 - 0.004e18)) / (0.07e18 - 0.06e18);
    if (val < 0.08e18) return 0.008e18 + ((val - 0.07e18) * (0.010e18 - 0.008e18)) / (0.08e18 - 0.07e18);
    if (val < 0.09e18) return 0.010e18 + ((val - 0.08e18) * (0.014e18 - 0.010e18)) / (0.09e18 - 0.08e18);
    if (val < 0.1e18) return 0.014e18 + ((val - 0.09e18) * (0.016e18 - 0.014e18)) / (0.10e18 - 0.09e18);
    return 0.016e18;
  }
}
