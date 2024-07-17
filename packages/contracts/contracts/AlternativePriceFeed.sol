// SPDX-License-Identifier: MIT

pragma solidity 0.8.20;

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
  // --- Structs ---

  struct TokenBalancerInfo {
    IBalancerV2Pool poolForPriceCalculation; // pool to use to calculate price of token
    bool tokenIsBalancerLP; // token is a balancer LP
  }

  // --- Constants ---

  string public constant NAME = 'AlternativePriceFeed';

  // --- Attributes ---

  bool private initialized;
  mapping(address => FallbackPriceData) public fallbackPrices; // token => price
  mapping(address => TokenBalancerInfo) public tokenBalancerInfo; // token => BalancerV2 info
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
    tokenBalancerInfo[_token].poolForPriceCalculation = _pool;
    emit SetBalancerPricePool(_token, address(_pool));
  }

  function setTokenAsBalancerPool(address _token, bool _isBalancer) external onlyOwner {
    if (_isBalancer) {
      // check valid pool (call will fail otherwise)
      try IBalancerV2Pool(_token).getVault().getPoolTokens(IBalancerV2Pool(_token).getPoolId()) {} catch {
        revert InvalidBalancerPool();
      }
    }

    tokenBalancerInfo[_token].tokenIsBalancerLP = _isBalancer;
  }

  // --- View functions ---

  function getPrice(address _tokenAddress) external view override returns (uint price, bool isTrusted, uint timestamp) {
    // balancer price
    price = getBalancerPrice(_tokenAddress);
    if (price != 0) {
      isTrusted = true; // onchain price is always trusted
      return (price, isTrusted, block.timestamp);
    }

    // fallback
    FallbackPriceData memory fb = fallbackPrices[_tokenAddress];
    price = fb.price;
    isTrusted = fb.trustedTimespan == 0 ? false : fb.lastUpdateTime + fb.trustedTimespan >= block.timestamp;

    return (price, isTrusted, fb.lastUpdateTime);
  }

  function getBalancerPrice(address _tokenAddress) private view returns (uint price) {
    // cache
    TokenBalancerInfo memory info = tokenBalancerInfo[_tokenAddress];
    IBalancerV2Pool pool = (info.tokenIsBalancerLP ? IBalancerV2Pool(_tokenAddress) : info.poolForPriceCalculation);

    // check if pool defined
    if (address(pool) == address(0)) return 0;

    (address[] memory tokens, uint[] memory balances, ) = pool.getVault().getPoolTokens(pool.getPoolId());
    if (info.tokenIsBalancerLP) {
      // token is a BalancerV2 LP, so we need to calculate its value by adding value of balances and normalizing it
      uint usd;
      for (uint n = 0; n < tokens.length; n++) {
        if (tokens[n] == _tokenAddress) continue; // skip LP token itself, wired balancerV2 logic...
        usd += priceFeed.getUSDValue(tokens[n], balances[n]);
      }
      price = (usd * (10 ** pool.decimals())) / pool.getActualSupply();
    } else {
      uint[] memory weights = pool.getNormalizedWeights();

      // token price is calculated with a BalancerV2 pool, be checking ratio in pool and value of balances
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
