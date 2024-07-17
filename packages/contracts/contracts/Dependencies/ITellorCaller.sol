// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface ITellorCaller {
  function getTellorCurrentValue(uint256 _requestId, bool _fetchPreviousValue) external view returns (uint256, uint256);
}
