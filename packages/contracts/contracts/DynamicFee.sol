// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import './Interfaces/IDynamicFee.sol';

contract DynamicFee is IDynamicFee {
  function calcDynamicSwapFee(uint val) external pure returns (uint fee) {
    if (val < 0.02e18) return 0.0003e18;
    if (val < 0.03e18) return 0.0003e18 + ((val - 0.02e18) * (0.0006e18 - 0.0003e18)) / (0.03e18 - 0.02e18);
    if (val < 0.04e18) return 0.0006e18 + ((val - 0.03e18) * (0.001e18 - 0.0006e18)) / (0.04e18 - 0.03e18);
    if (val < 0.05e18) return 0.001e18 + ((val - 0.04e18) * (0.003e18 - 0.001e18)) / (0.05e18 - 0.04e18);
    if (val < 0.06e18) return 0.003e18 + ((val - 0.05e18) * (0.005e18 - 0.003e18)) / (0.06e18 - 0.05e18);
    if (val < 0.07e18) return 0.005e18 + ((val - 0.06e18) * (0.010e18 - 0.005e18)) / (0.07e18 - 0.06e18);
    if (val < 0.08e18) return 0.01e18 + ((val - 0.07e18) * (0.014e18 - 0.010e18)) / (0.08e18 - 0.07e18);
    if (val < 0.09e18) return 0.014e18 + ((val - 0.08e18) * (0.022e18 - 0.014e18)) / (0.09e18 - 0.08e18);
    if (val < 0.1e18) return 0.022e18 + ((val - 0.09e18) * (0.040e18 - 0.022e18)) / (0.10e18 - 0.09e18);
    return 0.040e18;
  }
}
