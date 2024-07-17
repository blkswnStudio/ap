// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import './Interfaces/ISwapERC20.sol';

contract SwapERC20 is ISwapERC20 {
  string public name = 'jAsset LP';
  string public symbol = 'LP';
  uint8 public constant decimals = 18;
  uint public totalSupply;
  mapping(address => uint) public balanceOf;

  function _mint(address to, uint value) internal {
    totalSupply += value;
    balanceOf[to] += value;
    emit Transfer(address(0), to, value);
  }

  function _burn(address from, uint value) internal {
    balanceOf[from] -= value;
    totalSupply -= value;
    emit Transfer(from, address(0), value);
  }
}
