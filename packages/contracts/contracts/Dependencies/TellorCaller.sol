// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import './ITellorCaller.sol';
import './ITellor.sol';

/*
 * This contract has a single external function that calls Tellor: getTellorCurrentValue().
 *
 * The function is called by the Liquity contract PriceFeed.sol. If any of its inner calls to Tellor revert,
 * this function will revert, and PriceFeed will catch the failure and handle it accordingly.
 *
 * The function comes from Tellor's own wrapper contract, 'UsingTellor.sol':
 * https://github.com/tellor-io/usingtellor/blob/master/contracts/UsingTellor.sol
 *
 */
contract TellorCaller is ITellorCaller {
  ITellor public tellor;

  constructor(address _tellorMasterAddress) {
    tellor = ITellor(_tellorMasterAddress);
  }

  /*
   * getTellorCurrentValue(): identical to getCurrentValue() in UsingTellor.sol
   *
   * @dev Allows the user to get the latest value for the requestId specified
   * @param _requestId is the requestId to look up the value for
   * @param _fetchPreviousValue bool true if the previous value is desired
   * @return value the value retrieved
   * @return _timestampRetrieved the value's timestamp
   */
  function getTellorCurrentValue(
    uint256 _requestId,
    bool _fetchPreviousValue
  ) external view override returns (uint256 value, uint256 _timestampRetrieved) {
    uint256 _count = tellor.getNewValueCountbyRequestId(_requestId);
    uint256 _time = tellor.getTimestampbyRequestIDandIndex(_requestId, _count - (_fetchPreviousValue ? 2 : 1));
    uint256 _value = tellor.retrieveData(_requestId, _time);
    return (_value, _time);
  }
}
