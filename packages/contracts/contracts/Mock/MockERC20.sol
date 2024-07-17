// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol';
import './IMockERC20.sol';

contract MockERC20 is ERC20Permit, IMockERC20 {
  uint8 private _decimals;

  constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) ERC20Permit(name) {
    _decimals = decimals_;
  }

  function decimals() public view override returns (uint8) {
    return _decimals;
  }

  function unprotectedMint(address _account, uint256 _amount) external override {
    _mint(_account, _amount);
  }

  function unprotectedBurn(address _account, uint256 _amount) external override {
    _burn(_account, _amount);
  }

  function burn(uint256 _amount) external override {
    _burn(msg.sender, _amount);
  }

  function unprotectedMintApprove(address _account, uint256 _amount, address _spender) external override {
    _mint(_account, _amount);
    _approve(_account, _spender, _amount);
  }
}
