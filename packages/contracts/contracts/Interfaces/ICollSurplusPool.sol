// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import './IBase.sol';

interface ICollSurplusPool is IBase {
  // --- Events ---

  event CollSurplusPoolInitialized(address _liquidationOperationsAddress, address _borrowerOperationsAddress);
  event CollBalanceUpdated(address indexed _account, TokenAmount[] _collSurplus);
  event CollClaimed(address _to);

  error NotFromProtocol();

  // --- Contract setters ---

  function getCollateral(address _account) external view returns (TokenAmount[] memory);

  function accountSurplus(address _account, RAmount[] memory _collSurplus) external;

  function claimColl(address _account) external;
}
