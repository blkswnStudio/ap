// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import '../Dependencies/IBalancerV2Vault.sol';
import '../Dependencies/IBalancerV2Pool.sol';

import './MockBalancerV2Vault.sol';

contract MockBalancerV2Pool is IBalancerV2Pool {
  MockBalancerV2Vault public immutable vault;
  uint[] public normalizedWeights;
  uint public totalSupply;
  uint8 public decimals = 18;

  constructor(MockBalancerV2Vault _vault, address[] memory tokens, uint[] memory weights) {
    require(tokens.length > 0, 'Invalid Length');
    require(tokens.length == weights.length, 'Length missmatch');

    // init
    vault = _vault;
    vault.initPool(getPoolId(), tokens);

    // weights
    uint total;
    for (uint n = 0; n < weights.length; n++) {
      total += weights[n];
    }
    require(total == 1 ether, 'Invalid weights');
    normalizedWeights = weights;
  }

  function mockBalances(address _token, uint _balance) external {
    (address[] memory tokens, uint[] memory balances, ) = vault.getPoolTokens(getPoolId());

    bool found;
    for (uint n = 0; n < tokens.length; n++) {
      if (tokens[n] == _token) {
        found = true;
        balances[n] = _balance;
        break;
      }
    }
    require(found, 'Not found');

    mockBalances(balances);
  }

  function mockTotalSupply(uint _supply) external {
    totalSupply = _supply;
  }

  function mockBalances(uint[] memory balances) public {
    vault.mockBalances(getPoolId(), balances);
  }

  function getVault() external view returns (IBalancerV2Vault) {
    return IBalancerV2Vault(address(vault));
  }

  function getNormalizedWeights() external view returns (uint[] memory) {
    return normalizedWeights;
  }

  function getPoolId() public view returns (bytes32) {
    return bytes32(uint(uint160(address(this))));
  }

  function getActualSupply() external view returns (uint256) {
    return totalSupply; // only a mock fallback...
  }
}
