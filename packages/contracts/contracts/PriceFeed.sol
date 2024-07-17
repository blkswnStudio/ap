// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import './Interfaces/IPriceFeed.sol';
import './Interfaces/IAlternativePriceFeed.sol';
import './Dependencies/CheckContract.sol';
import './Dependencies/LiquityMath.sol';
import './Dependencies/LiquityBase.sol';
import './Interfaces/ITokenManager.sol';

import '@pythnetwork/pyth-sdk-solidity/IPyth.sol';
import '@pythnetwork/pyth-sdk-solidity/PythStructs.sol';

contract PriceFeed is Ownable(msg.sender), CheckContract, LiquityBase, IPriceFeed {
  string public constant NAME = 'PriceFeed';

  uint public constant ORACLE_AS_TRUSTED_TIMEOUT = 5 minutes; // 5 minutes, Maximum time period allowed since latest round data timestamp.
  uint public constant OLD_PYTH_PRICE_TIMEOUT = 1 minutes;

  IAlternativePriceFeed public altFeed;
  IPyth public pyth;
  ITokenManager public tokenManager;

  bool private initialized;
  mapping(address => bytes32) public tokenToOracleId;
  mapping(bytes32 => address) public oracleIdToToken;

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
    if (msg.sender != address(tokenManager) && msg.sender != this.owner()) revert NotFromTokenManager();
    tokenToOracleId[_tokenAddress] = _oracleId;
    if (uint(_oracleId) != 0) oracleIdToToken[_oracleId] = _tokenAddress;
  }

  function getGovToken() external view override returns (address) {
    return tokenManager.govTokenAddress();
  }

  // --- Admin Functions ---

  function setAlternativePriceFeed(address _altFeed) external onlyOwner {
    checkContract(_altFeed);
    altFeed = IAlternativePriceFeed(_altFeed);
    emit SetAltPriceFeed(_altFeed);
  }

  // --- Functions ---

  function getPythUpdateFee(bytes[] memory _priceUpdateData) external view override returns (uint) {
    return pyth.getUpdateFee(_priceUpdateData);
  }

  // --- build session price cache ---

  function checkPriceUsable(address _token, bool _trusted) public view override returns (bool) {
    if (_trusted) return true;
    return tokenManager.disableDebtMinting(_token); // if minting is disabled, price still is trusted (to still allow minting of other tokens)
  }

  function buildPriceCache(bool revertOnUntrusted) external view override returns (PriceCache memory cache) {
    cache.collPrices = _getTokenPrices(tokenManager.getCollTokenAddresses(), revertOnUntrusted);
    cache.debtPrices = _getTokenPrices(tokenManager.getDebtTokenAddresses(), revertOnUntrusted);
    return cache;
  }

  function _getTokenPrices(
    address[] memory tokens,
    bool revertOnUntrusted
  ) internal view returns (TokenPrice[] memory) {
    TokenPrice[] memory tokenPrices = new TokenPrice[](tokens.length);
    for (uint i = 0; i < tokens.length; i++) {
      tokenPrices[i] = _buildTokenPrice(tokens[i]);
      if (revertOnUntrusted && !checkPriceUsable(tokens[i], tokenPrices[i].isPriceTrusted))
        revert OracleUntrusted(tokens[i]);
    }
    return tokenPrices;
  }

  function _buildTokenPrice(address _tokenAddress) internal view returns (TokenPrice memory) {
    (uint price, bool isTrusted, bool isSecondary) = getPriceFromSource(_tokenAddress, true);
    uint8 decimals = IERC20Metadata(_tokenAddress).decimals();
    return
      TokenPrice(
        _tokenAddress,
        decimals,
        price,
        isTrusted,
        !isSecondary,
        tokenManager.getCollTokenSupportedCollateralRatio(_tokenAddress)
      );
  }

  function updatePythPrices(bytes[] memory _priceUpdateData) external payable override {
    uint feeAmount = pyth.getUpdateFee(_priceUpdateData);
    if (msg.value != feeAmount) revert InvalidPaymentForOracleUpdate();

    pyth.updatePriceFeeds{ value: feeAmount }(_priceUpdateData);
  }

  function getPrice(
    address _tokenAddress
  ) public view override returns (uint price, bool isTrusted, bool secondarySource) {
    return getPriceFromSource(_tokenAddress, true);
  }

  function getPriceFromSource(
    address _tokenAddress,
    bool _allowSecondary
  ) public view override returns (uint price, bool isTrusted, bool secondarySource) {
    address stableAddress = address(tokenManager.getStableCoin());
    if (_tokenAddress == stableAddress) return (DECIMAL_PRECISION, true, false); // stable is always trusted and at fixed price at 1$ as primary source

    // map token to oracle id
    uint priceTime;
    bytes32 oracleId = tokenToOracleId[_tokenAddress];
    if (oracleId != 0) {
      // fetch price
      PythResponse memory latestResponse = _getCurrentPythResponse(oracleId);
      price = latestResponse.price;
      priceTime = latestResponse.timestamp;
      isTrusted = latestResponse.success && latestResponse.isTrusted;
    }

    // check for alternative price feed
    if (
      (_allowSecondary || oracleId == 0) && // in case there is no oracle id, the alternative feed becomes primary
      (!isTrusted || priceTime < block.timestamp - OLD_PYTH_PRICE_TIMEOUT) &&
      address(altFeed) != address(0)
    ) {
      (uint altPrice, bool altIsTrusted, uint altTimestamp) = altFeed.getPrice(_tokenAddress);
      if (altPrice != 0 && altTimestamp >= priceTime && (altIsTrusted || !isTrusted)) {
        // take trusted or newer
        secondarySource = true;
        price = altPrice;
        isTrusted = altIsTrusted && altTimestamp >= block.timestamp - ORACLE_AS_TRUSTED_TIMEOUT; // trusted state might be changed by alt price feed
      } else if (oracleId == 0) revert UnknownOracleId();
    }

    // multiply with stock split/exchange if debt token
    if (tokenManager.isDebtToken(_tokenAddress)) {
      IDebtToken debtToken = tokenManager.getDebtToken(_tokenAddress);
      price = _getPriceAfterStockSplitAndExchange(debtToken, price);
    }

    return (price, isTrusted, secondarySource);
  }

  // --- get usd/amount functions ---

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
      (currentPrice, , ) = getPrice(exchangeStock);
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
