// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import './IBalancerV2Vault.sol';

interface IBalancerV2Pool {
  function getVault() external view returns (IBalancerV2Vault);

  function getNormalizedWeights() external view returns (uint[] memory);

  function getPoolId() external view returns (bytes32);
}
