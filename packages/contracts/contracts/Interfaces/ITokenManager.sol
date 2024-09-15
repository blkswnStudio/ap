// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import './IBase.sol';
import './IDebtToken.sol';

// Common interface for the dToken Manager.
interface ITokenManager is IBase {
  // --- Events ---

  event SetEnableMinting(bool enable);
  event SetDisableDebtMinting(address indexed token, bool disable);
  event TokenManagerInitialized(
    address _stabilityPoolManagerAddress,
    address _stakingOperations,
    address _priceFeedAddress,
    address _govPayoutAddress
  );
  event DebtTokenAdded(address _debtTokenAddress, bytes32 _oracleId);
  event CollTokenAdded(address _tokenAddress, uint _supportedCollateralRatio, bool _isGovToken, bytes32 _oracleId);
  event CollTokenSupportedCollateralRatioSet(address _collTokenAddress, uint _supportedCollateralRatio);

  // --- Custom Errors ---

  error InvalidDebtToken();
  error SymbolAlreadyExists();
  error StableCoinAlreadyExists();
  error GovTokenAlreadyDefined();
  error SupportedRatioUnderMCR();

  // --- Functions ---

  function govTokenAddress() external view returns (address);

  function govPayoutAddress() external view returns (address);

  function enableMinting() external view returns (bool);

  function disableDebtMinting(address _debtToken) external view returns (bool);

  function getStableCoin() external view returns (IDebtToken);

  function isDebtToken(address _address) external view returns (bool);

  function getDebtToken(address _address) external view returns (IDebtToken);

  function getDebtTokenAddresses() external view returns (address[] memory);

  function addDebtToken(address _debtTokenAddress, bytes32 _oracleId) external;

  function getCollTokenAddresses() external view returns (address[] memory);

  function getCollTokenSupportedCollateralRatio(address _collTokenAddress) external view returns (uint);

  function getGovTokenAddress() external view returns (address);

  function addCollToken(
    address _tokenAddress,
    uint _supportedCollateralRatio,
    bytes32 _oracleId,
    bool _isGovToken
  ) external;

  function setCollTokenSupportedCollateralRatio(address _collTokenAddress, uint _supportedCollateralRatio) external;
}
