// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import '@openzeppelin/contracts/utils/Address.sol';

contract CheckContract {
  using Address for address;

  error ZeroAddress();
  error NotContract();

  /**
   * Check that the account is an already deployed non-destroyed contract.
   * See: https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/Address.sol#L12
   */
  function checkContract(address _account) internal view {
    if (_account == address(0)) revert ZeroAddress();

    uint256 size;
    assembly {
      size := extcodesize(_account)
    }
    if (size == 0) revert NotContract();
  }
}
