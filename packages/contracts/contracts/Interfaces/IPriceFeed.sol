// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import './IBase.sol';

interface IPriceFeed is IBase {
  error NoStockSplitUpdateRequired();
  error StockSplitUpdateFailed();
  error UnknownOracleId();
  error BadOracle();
  error NotFromTokenManager();
  error TokenNotInCache();
  error TokenUpdateNotFound(address tokenAddress);
  error InvalidPaymentForOracleUpdate();

  // --- Events ---
  event PriceFeedInitialized(address tellorCallerAddress, address tokenManagerAddress);
  event FallbackPriceChanged(TokenAmount[] tokenPrices);

  // --- Function --

  function initiateNewOracleId(address _tokenAddress, bytes32 _oracleId) external;

  function setFallbackPrices(TokenAmount[] memory tokenPrices) external;

  function isSomePriceUntrusted(PriceCache memory _priceCache) external view returns (bool);

  function getPrice(address _tokenAddress) external view returns (uint price, bool isTrusted);

  function getUSDValue(address _tokenAddress, uint256 _amount) external view returns (uint usdValue);

  function getUSDValue(TokenPrice memory _tokenPrice, uint256 _amount) external view returns (uint usdValue);

  function getUSDValue(
    PriceCache memory _priceCache,
    address _tokenAddress,
    uint256 _amount
  ) external view returns (uint usdValue);

  function getAmountFromUSDValue(address _tokenAddress, uint256 _usdValue) external view returns (uint amount);

  function getAmountFromUSDValue(TokenPrice memory _tokenPrice, uint256 _usdValue) external view returns (uint amount);

  function getAmountFromUSDValue(
    PriceCache memory _priceCache,
    address _tokenAddress,
    uint256 _usdValue
  ) external view returns (uint amount);

  function getTokenPrice(
    PriceCache memory _priceCache,
    address _tokenAddress
  ) external view returns (TokenPrice memory);

  function buildPriceCache() external view returns (PriceCache memory cache);

  function getPythUpdateFee(bytes[] memory _priceUpdateData) external view returns (uint);

  function updatePythPrices(bytes[] memory _priceUpdateData) external payable;
}