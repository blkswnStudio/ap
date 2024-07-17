// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import '@openzeppelin/contracts/access/Ownable.sol';
import './Dependencies/CheckContract.sol';
import './Interfaces/ISortedTroves.sol';
import './Interfaces/ITroveManager.sol';
import './Interfaces/IBorrowerOperations.sol';

contract SortedTroves is Ownable(msg.sender), CheckContract, ISortedTroves {
  string public constant NAME = 'SortedTroves';

  address public borrowerOperationsAddress;
  address public troveManagerAddress;
  address public redemptionOperationsAddress;

  struct Node {
    uint listIndex;
    bool exists;
    uint usedCR; // nodes CR when it was last used (inserted or reinserted into the list)
    address nextId; // Id of next node (smaller CR) in the list
    address prevId; // Id of previous node (larger CR) in the list
  }
  struct Data {
    address head; // Head of the list. Also the node in the list with the largest CR
    address tail; // Tail of the list. Also the node in the list with the smallest CR
    mapping(address => Node) nodes; // Track the corresponding ids for each node in the list
    address[] list; // List of ids in the list
  }
  Data public data;

  // --- Contract setters ---

  function setAddresses(
    address _troveManagerAddress,
    address _borrowerOperationsAddress,
    address _redemptionOperationsAddress
  ) external onlyOwner {
    checkContract(_troveManagerAddress);
    checkContract(_borrowerOperationsAddress);
    checkContract(_redemptionOperationsAddress);

    troveManagerAddress = _troveManagerAddress;
    borrowerOperationsAddress = _borrowerOperationsAddress;
    redemptionOperationsAddress = _redemptionOperationsAddress;

    emit SortedTrovesInitialised(_troveManagerAddress, _borrowerOperationsAddress, _redemptionOperationsAddress);
    renounceOwnership();
  }

  /*
   * @dev Re-insert the node at a new position, based on its new CR
   * @param _id Node's id
   * @param _newCR Node's new CR
   * @param _redeemableDebt Amount of stablecoin minted by the node
   * @param _prevId Id of previous node for the new insert position
   * @param _nextId Id of next node for the new insert position
   */
  function update(address _id, uint _CR, uint _redeemableDebt, address _prevId, address _nextId) external override {
    _requireCallerIsProtocol();
    _remove(_id);

    // only included troves which minted some stable into the list
    if (_redeemableDebt == 0) return;

    if (contains(_id)) revert ListAlreadyContainsNode();
    if (_id == address(0)) revert IdCantBeZero();
    if (_CR == 0) revert CRNotPositive();

    address prevId = _prevId;
    address nextId = _nextId;
    if (!_validInsertPosition(_CR, prevId, nextId)) {
      // Sender's hint was not a valid insert position
      // Use sender's hint to find a valid insert position
      (prevId, nextId) = _findInsertPosition(_CR, prevId, nextId);
    }

    if (prevId == address(0) && nextId == address(0)) {
      // Insert as head and tail
      data.head = _id;
      data.tail = _id;
    } else if (prevId == address(0)) {
      // Insert before `prevId` as the head
      data.nodes[_id].nextId = data.head;
      data.nodes[data.head].prevId = _id;
      data.head = _id;
    } else if (nextId == address(0)) {
      // Insert after `nextId` as the tail
      data.nodes[_id].prevId = data.tail;
      data.nodes[data.tail].nextId = _id;
      data.tail = _id;
    } else {
      // Insert at insert position between `prevId` and `nextId`
      data.nodes[_id].nextId = nextId;
      data.nodes[_id].prevId = prevId;
      data.nodes[prevId].nextId = _id;
      data.nodes[nextId].prevId = _id;
    }

    data.nodes[_id].exists = true;
    data.nodes[_id].usedCR = _CR;
    data.nodes[_id].listIndex = data.list.length;
    data.list.push(_id);

    emit NodeAdded(_id, _CR);
  }

  function remove(address _id) external override {
    _requireCallerIsProtocol();
    _remove(_id);
  }

  /*
   * @dev Remove a node from the list
   * @param _id Node's id
   */
  function _remove(address _id) internal {
    // List must contain the node
    if (!contains(_id)) return;

    if (data.list.length > 1) {
      // List contains more than a single node
      if (_id == data.head) {
        // The removed node is the head
        // Set head to next node
        data.head = data.nodes[_id].nextId;
        // Set prev pointer of new head to null
        data.nodes[data.head].prevId = address(0);
      } else if (_id == data.tail) {
        // The removed node is the tail
        // Set tail to previous node
        data.tail = data.nodes[_id].prevId;
        // Set next pointer of new tail to null
        data.nodes[data.tail].nextId = address(0);
      } else {
        // The removed node is neither the head nor the tail
        // Set next pointer of previous node to the next node
        data.nodes[data.nodes[_id].prevId].nextId = data.nodes[_id].nextId;
        // Set prev pointer of next node to the previous node
        data.nodes[data.nodes[_id].nextId].prevId = data.nodes[_id].prevId;
      }

      uint toRemoveIndex = data.nodes[_id].listIndex;
      if (toRemoveIndex < data.list.length) {
        data.list[toRemoveIndex] = data.list[data.list.length - 1];
        data.nodes[data.list[toRemoveIndex]].listIndex = toRemoveIndex;
      }
      data.list.pop();
    } else {
      // List contains a single node
      // Set the head and tail to null
      data.head = address(0);
      data.tail = address(0);
      data.list.pop();
    }

    delete data.nodes[_id];
    emit NodeRemoved(_id);
  }

  /*
   * @dev Check if a pair of nodes is a valid insertion point for a new node with the given CR
   * @param _CR Node's CR
   * @param _prevId Id of previous node for the insert position
   * @param _nextId Id of next node for the insert position
   */
  function validInsertPosition(uint _CR, address _prevId, address _nextId) external view override returns (bool) {
    return _validInsertPosition(_CR, _prevId, _nextId);
  }

  function _validInsertPosition(uint _CR, address _prevId, address _nextId) internal view returns (bool) {
    // `(null, null)` is a valid insert position if the list is empty
    if (_prevId == address(0) && _nextId == address(0)) return isEmpty();

    // `(null, _nextId)` is a valid insert position if `_nextId` is the head of the list
    uint nextCR = data.nodes[_nextId].usedCR;
    if (_prevId == address(0)) return data.head == _nextId && _CR >= nextCR;

    // `(_prevId, null)` is a valid insert position if `_prevId` is the tail of the list
    uint prevCR = data.nodes[_prevId].usedCR;
    if (_nextId == address(0)) return data.tail == _prevId && _CR <= prevCR;

    // `(_prevId, _nextId)` is a valid insert position if they are adjacent nodes and `_CR` falls between the two nodes' CRs
    return data.nodes[_prevId].nextId == _nextId && prevCR >= _CR && _CR >= nextCR;
  }

  /*
   * @dev Find the insert position for a new node with the given CR
   * @param _CR Node's CR
   * @param _prevId Id of previous node for the insert position
   * @param _nextId Id of next node for the insert position
   */
  function findInsertPosition(
    uint _CR,
    address _prevId,
    address _nextId
  ) external view override returns (address, address) {
    return _findInsertPosition(_CR, _prevId, _nextId);
  }

  function _findInsertPosition(uint _CR, address _prevId, address _nextId) internal view returns (address, address) {
    address prevId = _prevId;
    address nextId = _nextId;

    // `prevId` / `nextId` does not exist anymore or now has a smaller CR than the given CR
    if (prevId != address(0) && (!contains(prevId) || _CR > data.nodes[prevId].usedCR)) prevId = address(0);
    if (nextId != address(0) && (!contains(nextId) || _CR < data.nodes[nextId].usedCR)) nextId = address(0);

    // No hint - descend list starting from head
    if (prevId == address(0) && nextId == address(0)) return _descendList(_CR, data.head);

    // No `prevId` for hint - ascend list starting from `nextId`
    if (prevId == address(0)) return _ascendList(_CR, nextId);

    // No `nextId` for hint - descend list starting from `prevId`
    if (nextId == address(0)) return _descendList(_CR, prevId);

    // Descend list starting from `prevId`
    return _descendList(_CR, prevId);
  }

  /*
   * @dev Descend the list (larger CRs to smaller CRs) to find a valid insert position
   * @param _CR Node's CR
   * @param _startId Id of node to start descending the list from
   */
  function _descendList(uint _CR, address _startId) internal view returns (address, address) {
    // If `_startId` is the head, check if the insert position is before the head
    if (data.head == _startId && _CR >= data.nodes[_startId].usedCR) return (address(0), _startId);

    address prevId = _startId;
    address nextId = data.nodes[prevId].nextId;

    // Descend the list until we reach the end or until we find a valid insert position
    while (prevId != address(0) && !_validInsertPosition(_CR, prevId, nextId)) {
      prevId = data.nodes[prevId].nextId;
      nextId = data.nodes[prevId].nextId;
    }

    return (prevId, nextId);
  }

  /*
   * @dev Ascend the list (smaller CRs to larger CRs) to find a valid insert position
   * @param _CR Node's CR
   * @param _startId Id of node to start ascending the list from
   */
  function _ascendList(uint _CR, address _startId) internal view returns (address, address) {
    // If `_startId` is the tail, check if the insert position is after the tail
    if (data.tail == _startId && _CR <= data.nodes[_startId].usedCR) return (_startId, address(0));

    address nextId = _startId;
    address prevId = data.nodes[nextId].prevId;

    // Ascend the list until we reach the end or until we find a valid insertion point
    while (nextId != address(0) && !_validInsertPosition(_CR, prevId, nextId)) {
      nextId = data.nodes[nextId].prevId;
      prevId = data.nodes[nextId].prevId;
    }

    return (prevId, nextId);
  }

  // --- 'require' functions ---

  function _requireCallerIsProtocol() internal view {
    if (
      msg.sender != borrowerOperationsAddress &&
      msg.sender != troveManagerAddress &&
      msg.sender != redemptionOperationsAddress
    ) revert CallerNotBrOrTrContract();
  }

  // --- Getters ---

  /*
   * @dev Checks if the list contains a node
   */
  function contains(address _id) public view override returns (bool) {
    return data.nodes[_id].exists;
  }

  /*
   * @dev Checks if the list is empty
   */
  function isEmpty() public view override returns (bool) {
    return data.list.length == 0;
  }

  /*
   * @dev Returns the current size of the list
   */
  function getSize() external view override returns (uint256) {
    return data.list.length;
  }

  /*
   * @dev Returns the first node in the list (node with the largest CR)
   */
  function getFirst() external view override returns (address) {
    return data.head;
  }

  /*
   * @dev Returns the last node in the list (node with the smallest CR)
   */
  function getLast() external view override returns (address) {
    return data.tail;
  }

  /*
   * @dev Returns the next node (with a smaller CR) in the list for a given node
   * @param _id Node's id
   */
  function getNext(address _id) external view override returns (address) {
    return data.nodes[_id].nextId;
  }

  /*
   * @dev Returns the previous node (with a larger CR) in the list for a given node
   * @param _id Node's id
   */
  function getPrev(address _id) external view override returns (address) {
    return data.nodes[_id].prevId;
  }

  function getByIndex(uint _index) external view override returns (address) {
    return data.list[_index];
  }

  function getUsedCR(address _id) external view override returns (uint) {
    return data.nodes[_id].usedCR;
  }
}
