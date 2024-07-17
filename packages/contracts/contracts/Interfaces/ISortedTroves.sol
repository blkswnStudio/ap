// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface ISortedTroves {
  // --- Errors ---

  error SizeCantBeZero();
  error ListIsFull();
  error ListAlreadyContainsNode();
  error ListDoesNotContainNode();
  error IdCantBeZero();
  error CRNotPositive();
  error CallerNotBrOrTrContract();

  // --- Events ---

  event SortedTrovesInitialised(
    address _troveManagerAddress,
    address _borrowerOperationsAddress,
    address _redemptionOperationsAddress
  );
  event NodeAdded(address _id, uint _CR);
  event NodeRemoved(address _id);

  // --- Functions ---

  function update(address _id, uint256 _newCR, uint _redeemableDebt, address _prevId, address _nextId) external;

  function remove(address _id) external;

  function contains(address _id) external view returns (bool);

  function isEmpty() external view returns (bool);

  function getSize() external view returns (uint256);

  function getFirst() external view returns (address);

  function getLast() external view returns (address);

  function getNext(address _id) external view returns (address);

  function getPrev(address _id) external view returns (address);

  function getByIndex(uint _index) external view returns (address);

  function getUsedCR(address _id) external view returns (uint);

  function validInsertPosition(uint256 _CR, address _prevId, address _nextId) external view returns (bool);

  function findInsertPosition(uint256 _CR, address _prevId, address _nextId) external view returns (address, address);
}
