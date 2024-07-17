// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import './Dependencies/CheckContract.sol';
import './Interfaces/ICollSurplusPool.sol';
import './Dependencies/LiquityBase.sol';

contract CollSurplusPool is LiquityBase, Ownable(msg.sender), CheckContract, ICollSurplusPool {
  string public constant NAME = 'CollSurplusPool';

  address public liquidationOperationsAddress;
  address public borrowerOperationsAddress;

  mapping(address => TokenAmount[]) internal balances; // Collateral surplus claimable by trove owners

  // --- Contract setters ---

  function setAddresses(address _liquidationOperationsAddress, address _borrowerOperationsAddress) external onlyOwner {
    checkContract(_borrowerOperationsAddress);
    checkContract(_liquidationOperationsAddress);

    borrowerOperationsAddress = _borrowerOperationsAddress;
    liquidationOperationsAddress = _liquidationOperationsAddress;

    emit CollSurplusPoolInitialized(_liquidationOperationsAddress, _borrowerOperationsAddress);

    renounceOwnership();
  }

  function getCollateral(address _account) external view override returns (TokenAmount[] memory) {
    return balances[_account];
  }

  // --- Pool functionality ---

  function accountSurplus(address _account, RAmount[] memory _collSurplus) external override {
    _requireCallerIsProtocol();

    TokenAmount[] storage accountBalances = balances[_account];
    for (uint i = 0; i < _collSurplus.length; i++) {
      RAmount memory rAmount = _collSurplus[i];
      if (rAmount.collSurplus == 0) continue;

      bool inserted = false;
      for (uint a = 0; a < accountBalances.length; a++) {
        if (accountBalances[a].tokenAddress != rAmount.tokenAddress) continue;

        accountBalances[a].amount += rAmount.collSurplus;
        inserted = true;
        break;
      }

      if (!inserted) accountBalances.push(TokenAmount(rAmount.tokenAddress, rAmount.collSurplus));
    }

    emit CollBalanceUpdated(_account, accountBalances);
  }

  function claimColl(address _account) external override {
    _requireCallerIsProtocol();

    TokenAmount[] memory accountBalances = balances[_account];
    for (uint i = 0; i < accountBalances.length; i++) {
      TokenAmount memory tokenEntry = accountBalances[i];
      if (tokenEntry.amount == 0) continue;
      IERC20(tokenEntry.tokenAddress).transfer(_account, tokenEntry.amount);
    }

    delete balances[_account];
    emit CollClaimed(_account);
  }

  // --- 'require' functions ---

  function _requireCallerIsProtocol() internal view {
    if (msg.sender != liquidationOperationsAddress && msg.sender != borrowerOperationsAddress) revert NotFromProtocol();
  }
}
