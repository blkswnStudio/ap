// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import '@openzeppelin/contracts/access/Ownable.sol';

import './Interfaces/IDebtToken.sol';
import './Dependencies/CheckContract.sol';
import './Interfaces/ITokenManager.sol';
import './Dependencies/LiquityBase.sol';
import './DebtToken.sol';
import './Interfaces/IStabilityPoolManager.sol';
import './Interfaces/IPriceFeed.sol';
import './Interfaces/IStakingOperations.sol';
import './Interfaces/ISwapPair.sol';

contract TokenManager is LiquityBase, Ownable(msg.sender), CheckContract, ITokenManager {
  string public constant NAME = 'TokenManager';

  IPriceFeed public priceFeed;
  IStabilityPoolManager public stabilityPoolManager;
  IStakingOperations public stakingOperations;

  // --- Data structures ---

  bool private initialized;

  address[] public debtTokenAddresses;
  mapping(address => IDebtToken) public debtTokens;
  IDebtToken public stableCoin;

  address[] public collTokenAddresses;
  mapping(address => uint) public collTokenSupportedCollateralRatio;

  address public govTokenAddress;
  address public govPayoutAddress;

  bool public override enableMinting = true; // Is token minting enabled or frozen
  mapping(address => bool) public override disableDebtMinting;

  // --- Dependency setter ---

  function setAddresses(
    address _stabilityPoolManagerAddress,
    address _stakingOperations,
    address _priceFeedAddress,
    address _govPayoutAddress
  ) external onlyOwner {
    if (initialized) revert AlreadyInitialized();
    initialized = true;

    checkContract(_stabilityPoolManagerAddress);
    checkContract(_priceFeedAddress);
    checkContract(_stakingOperations);

    stabilityPoolManager = IStabilityPoolManager(_stabilityPoolManagerAddress);
    stakingOperations = IStakingOperations(_stakingOperations);
    priceFeed = IPriceFeed(_priceFeedAddress);
    govPayoutAddress = _govPayoutAddress;

    emit TokenManagerInitialized(
      _stabilityPoolManagerAddress,
      _stakingOperations,
      _priceFeedAddress,
      _govPayoutAddress
    );
  }

  // --- Getters ---

  function getStableCoin() external view override returns (IDebtToken) {
    return stableCoin;
  }

  function isDebtToken(address _address) external view override returns (bool) {
    return address(debtTokens[_address]) != address(0);
  }

  function getDebtToken(address _address) external view override returns (IDebtToken debtToken) {
    debtToken = debtTokens[_address];
    if (address(debtToken) == address(0)) revert InvalidDebtToken();
    return debtToken;
  }

  function getDebtTokenAddresses() external view override returns (address[] memory) {
    return debtTokenAddresses;
  }

  function getCollTokenAddresses() external view override returns (address[] memory) {
    return collTokenAddresses;
  }

  function getCollTokenSupportedCollateralRatio(address _collTokenAddress) external view override returns (uint) {
    return collTokenSupportedCollateralRatio[_collTokenAddress];
  }

  function getGovTokenAddress() external view override returns (address) {
    return govTokenAddress;
  }

  // --- Setters ---

  function setBurnRedistributeAddress(address _target) external onlyOwner {
    stakingOperations.setRedistributeAddress(_target);
  }

  function setStakingRewardsPerSecond(uint _rewardsPerSecond) external onlyOwner {
    stakingOperations.setRewardsPerSecond(_rewardsPerSecond);
  }

  function setStakingAllocPoint(address _lpToken, uint _allocPoint) external onlyOwner {
    stakingOperations.setPool(ISwapPair(_lpToken), _allocPoint);
  }

  function setEnableMinting(bool _enable) external onlyOwner {
    enableMinting = _enable;
    emit SetEnableMinting(enableMinting);
  }

  function setDisableDebtMinting(address _token, bool _disable) external onlyOwner {
    disableDebtMinting[_token] = _disable;
    emit SetDisableDebtMinting(_token, _disable);
  }

  function setSymbolAndName(address _debtTokenAddress, string memory _symbol, string memory _name) external onlyOwner {
    this.getDebtToken(_debtTokenAddress).setSymbolAndName(_symbol, _name);
  }

  function setNextStockSplitRelative(address _debtTokenAddress, int32 _relativeSplit) external onlyOwner {
    return this.getDebtToken(_debtTokenAddress).setNextStockSplitRelative(_relativeSplit);
  }

  function setStockExchange(
    address _debtTokenAddress,
    address _exchangeForStock,
    int _exchangeRate
  ) external onlyOwner {
    return this.getDebtToken(_debtTokenAddress).setStockExchange(_exchangeForStock, _exchangeRate);
  }

  function setOracleId(address _token, bytes32 _oracleId) external onlyOwner {
    priceFeed.initiateNewOracleId(_token, _oracleId);
  }

  function addDebtTokenWithoutOracleId(address _debtTokenAddress) external onlyOwner {
    addDebtToken(_debtTokenAddress, 0);
  }

  function addDebtToken(address _debtTokenAddress, bytes32 _oracleId) public override onlyOwner {
    checkContract(_debtTokenAddress);

    IDebtToken debtToken = IDebtToken(_debtTokenAddress);
    bool isStableCoin = debtToken.isStableCoin();
    if (isStableCoin && address(stableCoin) != address(0)) revert StableCoinAlreadyExists();

    string memory symbol = debtToken.symbol();
    for (uint i = 0; i < debtTokenAddresses.length; i++) {
      if (keccak256(bytes(IDebtToken(debtTokenAddresses[i]).symbol())) != keccak256(bytes(symbol))) continue;
      revert SymbolAlreadyExists();
    }

    debtTokenAddresses.push(_debtTokenAddress);
    debtTokens[_debtTokenAddress] = debtToken;
    if (isStableCoin) stableCoin = debtToken;
    stabilityPoolManager.addStabilityPool(debtToken);
    priceFeed.initiateNewOracleId(_debtTokenAddress, _oracleId);

    emit DebtTokenAdded(_debtTokenAddress, _oracleId);
  }

  function addCollTokenWithoutOracleId(
    address _tokenAddress,
    uint _supportedCollateralRatio,
    bool _isGovToken
  ) external onlyOwner {
    addCollToken(_tokenAddress, _supportedCollateralRatio, 0, _isGovToken);
  }

  function addCollToken(
    address _tokenAddress,
    uint _supportedCollateralRatio,
    bytes32 _oracleId,
    bool _isGovToken
  ) public override onlyOwner {
    if (_supportedCollateralRatio < MCR) revert SupportedRatioUnderMCR();
    if (_isGovToken && govTokenAddress != address(0)) revert GovTokenAlreadyDefined();

    for (uint i = 0; i < collTokenAddresses.length; i++)
      if (collTokenAddresses[i] == _tokenAddress) revert SymbolAlreadyExists();

    collTokenAddresses.push(_tokenAddress);
    collTokenSupportedCollateralRatio[_tokenAddress] = _supportedCollateralRatio;
    priceFeed.initiateNewOracleId(_tokenAddress, _oracleId);
    if (_isGovToken) govTokenAddress = _tokenAddress;

    emit CollTokenAdded(_tokenAddress, _supportedCollateralRatio, _isGovToken, _oracleId);
  }

  function setCollTokenSupportedCollateralRatio(
    address _collTokenAddress,
    uint _supportedCollateralRatio
  ) external override onlyOwner {
    if (_supportedCollateralRatio < MCR) revert SupportedRatioUnderMCR();
    collTokenSupportedCollateralRatio[_collTokenAddress] = _supportedCollateralRatio;
    emit CollTokenSupportedCollateralRatioSet(_collTokenAddress, _supportedCollateralRatio);
  }
}
