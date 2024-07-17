// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import '../Dependencies/IBalancerV2Vault.sol';

contract MockBalancerV2Vault is IBalancerV2Vault {
  struct PoolInfo {
    address[] tokens;
    uint[] balances;
    uint lastChange;
  }

  mapping(bytes32 => PoolInfo) public poolInfo;

  function initPool(bytes32 _poolId, address[] memory _tokens) external {
    PoolInfo storage info = poolInfo[_poolId];
    require(info.lastChange == 0, 'Pool already exists');

    info.tokens = _tokens;
    info.balances = new uint[](_tokens.length);
    info.lastChange = block.timestamp;
  }

  function mockBalances(bytes32 _poolId, uint[] memory _balances) external {
    PoolInfo storage info = poolInfo[_poolId];
    require(info.lastChange != 0, 'Pool doesnt exists');
    require(info.tokens.length == _balances.length, 'Invalid length');

    for (uint n = 0; n < _balances.length; n++) {
      info.balances[n] = _balances[n];
    }
    info.lastChange = block.timestamp;
  }

  function getPoolTokens(
    bytes32 _poolId
  ) external view override returns (address[] memory tokens, uint[] memory balances, uint lastChangeBlock) {
    PoolInfo memory info = poolInfo[_poolId];

    tokens = info.tokens;
    balances = info.balances;
    lastChangeBlock = info.lastChange;

    return (tokens, balances, lastChangeBlock);
  }
}
