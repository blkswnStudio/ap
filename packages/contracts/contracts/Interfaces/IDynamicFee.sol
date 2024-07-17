// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

interface IDynamicFee {
  function calcDynamicSwapFee(uint val) external view returns (uint fee);
}
