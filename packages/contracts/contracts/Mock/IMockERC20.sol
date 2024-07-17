// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IMockERC20 is IERC20 {
  function unprotectedMint(address _account, uint256 _amount) external;

  function unprotectedBurn(address _account, uint256 _amount) external;

  function unprotectedMintApprove(address _account, uint256 _amount, address _spender) external;

  function burn(uint256 _amount) external;
}
