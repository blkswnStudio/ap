// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

interface IBalancerV2Vault {
  function getPoolTokens(
    bytes32 poolId
  ) external view returns (address[] memory tokens, uint[] memory balances, uint lastChangeBlock);
}
