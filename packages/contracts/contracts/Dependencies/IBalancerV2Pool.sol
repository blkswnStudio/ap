// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import './IBalancerV2Vault.sol';

interface IBalancerV2Pool {
  function getVault() external view returns (IBalancerV2Vault);

  function getNormalizedWeights() external view returns (uint[] memory);

  function getPoolId() external view returns (bytes32);

  function getActualSupply() external view returns (uint256);

  function decimals() external view returns (uint8);
}
