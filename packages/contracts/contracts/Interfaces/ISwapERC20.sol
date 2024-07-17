// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface ISwapERC20 {
  error PermitExpired();
  error InvalidSignature();

  event Approval(address indexed owner, address indexed spender, uint value);
  event Transfer(address indexed from, address indexed to, uint value);

  function name() external pure returns (string memory);

  function symbol() external pure returns (string memory);

  function decimals() external pure returns (uint8);

  function totalSupply() external view returns (uint);

  function balanceOf(address owner) external view returns (uint);
}
