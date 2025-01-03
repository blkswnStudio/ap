// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface IDynamicFee {
  function calcDynamicSwapFee(uint val) external view returns (uint fee);
}
