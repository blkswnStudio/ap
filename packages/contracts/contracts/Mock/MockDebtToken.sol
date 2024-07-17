// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import '../DebtToken.sol';

contract MockDebtToken is DebtToken {
  bytes32 private immutable _PERMIT_TYPEHASH = 0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;

  constructor(
    address _troveManagerAddress,
    address _redeemerOperationsAddress,
    address _borrowerOperationsAddress,
    address _tokenManagerAddress,
    address _swapOperationsAddress,
    address _priceFeedAddress,
    string memory _symbol,
    string memory _name,
    string memory _version,
    bool _isStableCoin
  )
    DebtToken(
      _troveManagerAddress,
      _redeemerOperationsAddress,
      _borrowerOperationsAddress,
      _tokenManagerAddress,
      _swapOperationsAddress,
      _priceFeedAddress,
      _symbol,
      _name,
      _version,
      _isStableCoin
    )
  {}

  function unprotectedResetStockFeatures() external {
    currentStockSplit = STOCK_SPLIT_PRECISION;
    stockExchangeRate = 0;
    exchangeStock = address(0);
  }

  function unprotectedMint(address _account, uint256 _amount) external {
    // No check on caller here
    _mint(_account, _amount);
  }

  function unprotectedBurn(address _account, uint _amount) external {
    // No check on caller here
    _burn(_account, _amount);
  }

  function clearAccount(address _account) external {
    uint balance = this.balanceOf(_account);
    _burn(_account, balance);
  }

  function callInternalApprove(address owner, address spender, uint256 amount) external {
    _approve(owner, spender, amount);
  }

  function getChainId() external view returns (uint256 chainID) {
    //return _chainID(); // it’s private
    assembly {
      chainID := chainid()
    }
  }

  function getDigest(
    address owner,
    address spender,
    uint amount,
    uint nonce,
    uint deadline
  ) external view returns (bytes32) {
    return
      keccak256(
        abi.encodePacked(
          uint16(0x1901),
          this.domainSeparator(),
          keccak256(abi.encode(_PERMIT_TYPEHASH, owner, spender, amount, nonce, deadline))
        )
      );
  }

  function recoverAddress(bytes32 digest, uint8 v, bytes32 r, bytes32 s) external pure returns (address) {
    bytes32 signedMsg = MessageHashUtils.toEthSignedMessageHash(digest);
    address recoveredAddress = ECDSA.recover(signedMsg, v, r, s);
    return recoveredAddress;
  }
}
