// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';

import './Interfaces/IAlternativePriceFeed.sol';
import './Interfaces/ITokenManager.sol';
import './Interfaces/IPriceFeed.sol';

import './Dependencies/IBalancerV2Vault.sol';
import './Dependencies/IBalancerV2Pool.sol';
import './Dependencies/LiquityBase.sol';
import './Dependencies/CheckContract.sol';

contract AlternativePriceFeed is Ownable(msg.sender), CheckContract, LiquityBase, IAlternativePriceFeed {
  // --- Constants ---

  string public constant NAME = 'AlternativePriceFeed';

  // --- Attributes ---

  bool private initialized;
  mapping(address => FallbackPriceData) public fallbackPrices; // token => price
  mapping(address => IBalancerV2Pool) public balancerPricePool; // token => price finding pool balancer
  IPriceFeed public priceFeed;

  // --- Dependency setters ---

  function setAddresses(address _priceFeed) external onlyOwner {
    if (initialized) revert AlreadyInitialized();
    initialized = true;

    checkContract(_priceFeed);

    priceFeed = IPriceFeed(_priceFeed);

    emit AlternativePriceFeedInitialized(_priceFeed);
  }

  // --- Admin Functions ---

  function setFallbackPrices(TokenAmount[] memory tokenPrices) external onlyOwner {
    TokenAmount memory ta;
    FallbackPriceData storage fpd;
    for (uint i = 0; i < tokenPrices.length; i++) {
      ta = tokenPrices[i];
      fpd = fallbackPrices[ta.tokenAddress];
      fpd.price = ta.amount;
      fpd.lastUpdateTime = uint32(block.timestamp);
    }

    emit FallbackPriceChanged(tokenPrices);
  }

  function setFallbackTrustedTimespan(address _token, uint32 _trustedTimespan) external onlyOwner {
    fallbackPrices[_token].trustedTimespan = _trustedTimespan;
    emit FallbackTrustedTimespanChanged(_token, _trustedTimespan);
  }

  function setBalancerPricePool(address _token, IBalancerV2Pool _pool) external onlyOwner {
    // check valid pool
    if (address(_pool) != address(0)) {
      (address[] memory tokens, , ) = _pool.getVault().getPoolTokens(_pool.getPoolId());

      // check pool contained
      bool contained = false;
      for (uint n = 0; n < tokens.length; n++) {
        if (tokens[n] == _token) {
          contained = true;
          break;
        }
      }
      if (!contained) revert InvalidBalancerPool();
    }

    // set
    balancerPricePool[_token] = _pool;
    emit SetBalancerPricePool(_token, address(_pool));
  }

  // --- View functions ---

  function getPrice(address _tokenAddress) external view override returns (uint price, bool isTrusted, uint timestamp) {
    // cache
    FallbackPriceData memory fb = fallbackPrices[_tokenAddress];

    // balancer price
    price = getBalancerPrice(_tokenAddress);
    if (price != 0) {
      isTrusted = true; // onchain price is always trusted
      return (price, isTrusted, block.timestamp);
    }

    // fallback
    price = fb.price;
    isTrusted = fb.trustedTimespan == 0 ? false : fb.lastUpdateTime + fb.trustedTimespan >= block.timestamp;

    return (price, isTrusted, fb.lastUpdateTime);
  }

  function getBalancerPrice(address _tokenAddress) private view returns (uint price) {
    // cache
    IBalancerV2Pool pool = balancerPricePool[_tokenAddress];

    // check if pool defined
    if (address(pool) == address(0)) return 0;

    // cache
    (address[] memory tokens, uint[] memory balances, ) = pool.getVault().getPoolTokens(pool.getPoolId());
    uint[] memory weights = pool.getNormalizedWeights();

    {
      // accumulate pool values
      uint nonTargetUSD;
      uint nonTargetWeights;
      uint targetWeight;
      uint targetBalance;
      address curToken;
      for (uint n = 0; n < tokens.length; n++) {
        curToken = tokens[n];

        if (curToken != _tokenAddress) {
          // non target token
          nonTargetWeights += weights[n];
          nonTargetUSD += priceFeed.getUSDValue(curToken, balances[n]);
        } else {
          // target token
          targetWeight = weights[n];
          targetBalance = balances[n];
        }
      }

      // calc unit price
      price =
        (((nonTargetUSD * targetWeight) / nonTargetWeights) * (10 ** IERC20Metadata(_tokenAddress).decimals())) /
        targetBalance;
    }

    return price;
  }
}
