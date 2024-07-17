// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import './Interfaces/IPriceFeed.sol';
import './Dependencies/CheckContract.sol';
import './Dependencies/LiquityMath.sol';
import './Dependencies/LiquityBase.sol';
import './Interfaces/ITokenManager.sol';

import '@pythnetwork/pyth-sdk-solidity/IPyth.sol';
import '@pythnetwork/pyth-sdk-solidity/PythStructs.sol';

contract PriceFeed is Ownable(msg.sender), CheckContract, LiquityBase, IPriceFeed {
  string public constant NAME = 'PriceFeed';

  uint public constant ORACLE_AS_TRUSTED_TIMEOUT = 60 * 5; // 5 minutes, Maximum time period allowed since latest round data timestamp.

  IPyth public pyth;
  ITokenManager public tokenManager;

  bool private initialized;
  mapping(address => bytes32) public tokenToOracleId;
  mapping(address => PriceTime) public fallbackPrices; // token => price

  struct PriceTime {
    uint price;
    uint timestamp;
  }
  struct PythResponse {
    bool success;
    uint256 timestamp;
    uint price;
    bool isTrusted;
  }

  // --- Dependency setters ---

  function setAddresses(address _pyth, address _tokenManagerAddress) external onlyOwner {
    if (initialized) revert AlreadyInitialized();
    initialized = true;

    checkContract(_pyth);
    checkContract(_tokenManagerAddress);

    pyth = IPyth(_pyth);
    tokenManager = ITokenManager(_tokenManagerAddress);

    emit PriceFeedInitialized(_pyth, _tokenManagerAddress);
  }

  function initiateNewOracleId(address _tokenAddress, bytes32 _oracleId) external override {
    if (msg.sender != address(tokenManager)) revert NotFromTokenManager();
    tokenToOracleId[_tokenAddress] = _oracleId;
  }

  function setFallbackPrices(TokenAmount[] memory tokenPrices) external override onlyOwner {
    uint time = block.timestamp;
    for (uint i = 0; i < tokenPrices.length; i++)
      fallbackPrices[tokenPrices[i].tokenAddress] = PriceTime(tokenPrices[i].amount, time);

    emit FallbackPriceChanged(tokenPrices);
  }

  // --- Functions ---

  function getPythUpdateFee(bytes[] memory _priceUpdateData) external view override returns (uint) {
    return pyth.getUpdateFee(_priceUpdateData);
  }

  // --- build session price cache ---

  function buildPriceCache() external view override returns (PriceCache memory cache) {
    cache.collPrices = _getTokenPrices(tokenManager.getCollTokenAddresses());
    cache.debtPrices = _getTokenPrices(tokenManager.getDebtTokenAddresses());
    return cache;
  }

  function _getTokenPrices(address[] memory tokens) internal view returns (TokenPrice[] memory) {
    TokenPrice[] memory tokenPrices = new TokenPrice[](tokens.length);
    for (uint i = 0; i < tokens.length; i++) tokenPrices[i] = _buildTokenPrice(tokens[i]);
    return tokenPrices;
  }

  function _buildTokenPrice(address _tokenAddress) internal view returns (TokenPrice memory) {
    (uint price, bool isTrusted) = getPrice(_tokenAddress);
    uint8 decimals = IERC20Metadata(_tokenAddress).decimals();
    return
      TokenPrice(
        _tokenAddress,
        decimals,
        price,
        isTrusted,
        tokenManager.getCollTokenSupportedCollateralRatio(_tokenAddress)
      );
  }

  function updatePythPrices(bytes[] memory _priceUpdateData) external payable override {
    uint feeAmount = pyth.getUpdateFee(_priceUpdateData);
    if (msg.value != feeAmount) revert InvalidPaymentForOracleUpdate();

    pyth.updatePriceFeeds{ value: feeAmount }(_priceUpdateData);
  }

  function getPrice(address _tokenAddress) public view override returns (uint price, bool isTrusted) {
    address stableAddress = address(tokenManager.getStableCoin());
    if (_tokenAddress == stableAddress) return (DECIMAL_PRECISION, true); // stable is always trusted and at fixed price at 1$

    // map token to oracle id
    bytes32 oracleId = tokenToOracleId[_tokenAddress];
    if (oracleId == 0) revert UnknownOracleId();

    // fetch price
    PythResponse memory latestResponse = _getCurrentPythResponse(oracleId);
    price = latestResponse.price;
    isTrusted = latestResponse.success && latestResponse.isTrusted;

    // check for fallback price is pyth is untrusted, price will remain untrusted anyway
    if (!isTrusted) {
      PriceTime memory fallbackPrice = fallbackPrices[_tokenAddress];
      if (fallbackPrice.price > 0) price = fallbackPrice.price;
    }

    // multiply with stock split/exchange if debt token
    if (tokenManager.isDebtToken(_tokenAddress)) {
      IDebtToken debtToken = tokenManager.getDebtToken(_tokenAddress);
      price = _getPriceAfterStockSplitAndExchange(debtToken, latestResponse.price);
    }

    return (price, isTrusted);
  }

  // --- get usd/amount functions ---

  function isSomePriceUntrusted(PriceCache memory _priceCache) external view override returns (bool) {
    for (uint i = 0; i < _priceCache.collPrices.length; i++) if (!_priceCache.collPrices[i].isPriceTrusted) return true;
    for (uint i = 0; i < _priceCache.debtPrices.length; i++) if (!_priceCache.debtPrices[i].isPriceTrusted) return true;

    return false;
  }

  function getUSDValue(address _tokenAddress, uint256 _amount) external view override returns (uint usdValue) {
    TokenPrice memory _tokenPrice = _buildTokenPrice(_tokenAddress);
    return _getUSDValue(_tokenPrice, _amount);
  }

  function getUSDValue(TokenPrice memory _tokenPrice, uint256 _amount) external pure override returns (uint usdValue) {
    return _getUSDValue(_tokenPrice, _amount);
  }

  function getUSDValue(
    PriceCache memory _priceCache,
    address _tokenAddress,
    uint256 _amount
  ) external pure override returns (uint usdValue) {
    return _getUSDValue(_getTokenPrice(_priceCache, _tokenAddress), _amount);
  }

  function _getUSDValue(TokenPrice memory _tokenPrice, uint256 _amount) internal pure returns (uint usdValue) {
    usdValue = (_tokenPrice.price * _amount) / 10 ** _tokenPrice.tokenDecimals;
  }

  function getAmountFromUSDValue(
    address _tokenAddress,
    uint256 _usdValue
  ) external view override returns (uint amount) {
    TokenPrice memory tokenPrice = _buildTokenPrice(_tokenAddress);
    return _getAmountFromUSDValue(tokenPrice, _usdValue);
  }

  function getAmountFromUSDValue(
    TokenPrice memory _tokenPrice,
    uint256 _usdValue
  ) external pure override returns (uint amount) {
    return _getAmountFromUSDValue(_tokenPrice, _usdValue);
  }

  function getAmountFromUSDValue(
    PriceCache memory _priceCache,
    address _tokenAddress,
    uint256 _usdValue
  ) external pure override returns (uint amount) {
    TokenPrice memory tokenPrice = _getTokenPrice(_priceCache, _tokenAddress);
    return _getAmountFromUSDValue(tokenPrice, _usdValue);
  }

  function _getAmountFromUSDValue(
    TokenPrice memory _tokenPrice,
    uint256 _usdValue
  ) internal pure returns (uint amount) {
    amount = (_usdValue * 10 ** _tokenPrice.tokenDecimals) / _tokenPrice.price;
  }

  function getTokenPrice(
    PriceCache memory _priceCache,
    address _tokenAddress
  ) external pure override returns (TokenPrice memory) {
    return _getTokenPrice(_priceCache, _tokenAddress);
  }

  function _getTokenPrice(
    PriceCache memory _priceCache,
    address _tokenAddress
  ) internal pure returns (TokenPrice memory) {
    for (uint i = 0; i < _priceCache.collPrices.length; i++)
      if (_priceCache.collPrices[i].tokenAddress == _tokenAddress) return _priceCache.collPrices[i];
    for (uint i = 0; i < _priceCache.debtPrices.length; i++)
      if (_priceCache.debtPrices[i].tokenAddress == _tokenAddress) return _priceCache.debtPrices[i];
    revert TokenNotInCache();
  }

  // --- internal helper functions ---

  function _getCurrentPythResponse(bytes32 _oracleId) internal view returns (PythResponse memory pythResponse) {
    PythStructs.Price memory response;

    // unsafe price
    try pyth.getPriceUnsafe(_oracleId) returns (PythStructs.Price memory r) {
      response = r;
    } catch {
      return pythResponse;
    }

    // metadata
    pythResponse.success = true;
    pythResponse.timestamp = response.publishTime;
    pythResponse.isTrusted = response.price > 0 && response.publishTime >= block.timestamp - ORACLE_AS_TRUSTED_TIMEOUT;

    // get price
    uint256 unsanitizedPrice = uint256(uint64(response.price)) * DECIMAL_PRECISION;
    pythResponse.price = (
      response.expo > 0
        ? unsanitizedPrice * (10 ** uint32(response.expo))
        : unsanitizedPrice / (10 ** uint32(-response.expo))
    ); // pyth can give positive and negative exponents

    return pythResponse;
  }

  function _getPriceAfterStockSplitAndExchange(IDebtToken _debtToken, uint _price) internal view returns (uint) {
    // cache
    uint currentPrice = _price;
    int splitPrecision = _debtToken.STOCK_SPLIT_PRECISION();

    // get active stock split
    int splitRate = _debtToken.stockExchangeRate();
    address exchangeStock = _debtToken.exchangeStock();
    if (splitRate != 0 && exchangeStock != address(0)) {
      // get price of exchange stock
      (currentPrice, ) = getPrice(exchangeStock);
    } else {
      // get effective stock split
      splitRate = _debtToken.currentStockSplit();
    }

    // manipulate price by stock split / exchange rate
    uint priceAfterSplit;
    if (splitRate >= splitPrecision) {
      // stock split
      priceAfterSplit = (currentPrice * uint(splitRate)) / uint(splitPrecision);
    } else {
      // reverse stock split
      priceAfterSplit = (currentPrice * uint(splitPrecision)) / uint(-splitRate);
    }

    return priceAfterSplit;
  }
}
