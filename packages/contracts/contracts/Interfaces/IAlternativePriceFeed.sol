// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import './IBase.sol';

interface IAlternativePriceFeed is IBase {
  // --- Structs ---

  struct FallbackPriceData {
    uint price;
    uint32 lastUpdateTime;
    uint32 trustedTimespan; // 0 means always untrusted
  }

  // --- Errors ---

  error InvalidBalancerPool();

  // --- Events ---

  event AlternativePriceFeedInitialized(address priceFeed);
  event FallbackTrustedTimespanChanged(address token, uint32 trustedTimespan);
  event FallbackPriceChanged(TokenAmount[] tokenPrices);
  event SetBalancerPricePool(address indexed token, address pool);

  // --- Function --

  function setFallbackPrices(TokenAmount[] memory tokenPrices) external;

  function getPrice(address _tokenAddress) external view returns (uint price, bool isTrusted, uint timestamp);
}
