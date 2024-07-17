// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import '../Interfaces/IBase.sol';
import { IPriceFeed } from '../Interfaces/IPriceFeed.sol';

library LiquityMath {
  uint internal constant DECIMAL_PRECISION = 1e18;

  function _min(uint _a, uint _b) internal pure returns (uint) {
    return (_a < _b) ? _a : _b;
  }

  function _max(uint _a, uint _b) internal pure returns (uint) {
    return (_a >= _b) ? _a : _b;
  }

  /*
   * Multiply two decimal numbers and use normal rounding rules:
   * -round product up if 19'th mantissa digit >= 5
   * -round product down if 19'th mantissa digit < 5
   *
   * Used only inside the exponentiation, _decPow().
   */
  function decMul(uint x, uint y) internal pure returns (uint decProd) {
    uint prod_xy = x * y;

    decProd = (prod_xy + DECIMAL_PRECISION / 2) / DECIMAL_PRECISION;
  }

  /*
   * _decPow: Exponentiation function for 18-digit decimal base, and integer exponent n.
   *
   * Uses the efficient "exponentiation by squaring" algorithm. O(log(n)) complexity.
   *
   * Called by two functions that represent time in units of minutes:
   * 1) TroveManager._calcDecayedBaseRate
   * 2) CommunityIssuance._getCumulativeIssuanceFraction
   *
   * The exponent is capped to avoid reverting due to overflow. The cap 525600000 equals
   * "minutes in 1000 years": 60 * 24 * 365 * 1000
   *
   * If a period of > 1000 years is ever used as an exponent in either of the above functions, the result will be
   * negligibly different from just passing the cap, since:
   *
   * In function 1), the decayed base rate will be 0 for 1000 years or > 1000 years
   * In function 2), the difference in tokens issued at 1000 years and any time > 1000 years, will be negligible
   */
  function _decPow(uint _base, uint _minutes) internal pure returns (uint) {
    if (_minutes > 525600000) {
      _minutes = 525600000;
    } // cap to avoid overflow

    if (_minutes == 0) {
      return DECIMAL_PRECISION;
    }

    uint y = DECIMAL_PRECISION;
    uint x = _base;
    uint n = _minutes;

    // Exponentiation-by-squaring
    while (n > 1) {
      if (n % 2 == 0) {
        x = decMul(x, x);
        n = n / 2;
      } else {
        // if (n % 2 != 0)
        y = decMul(x, y);
        x = decMul(x, x);
        n = (n - 1) / 2;
      }
    }

    return decMul(x, y);
  }

  function _getAbsoluteDifference(uint _a, uint _b) internal pure returns (uint) {
    return (_a >= _b) ? _a - _b : _b - _a;
  }

  function _computeCR(uint _coll, uint _debt) internal pure returns (uint) {
    if (_debt > 0) return (_coll * DECIMAL_PRECISION) / _debt;

    // Return the maximal value for uint256 if the Trove has a debt of 0. Represents "infinite" CR.
    // if (_debt == 0)
    return 2 ** 256 - 1;
  }

  function _computeMaxDebtValue(uint _collInUSD, uint _supportedCollateralRatio) internal pure returns (uint) {
    return (_collInUSD * DECIMAL_PRECISION) / _supportedCollateralRatio;
  }

  function _computeIMCR(uint _maxDebtInUSD, uint _collInUSD) internal pure returns (uint) {
    if (_collInUSD == 0) return 2 ** 256 - 1;

    return (_collInUSD * DECIMAL_PRECISION) / _maxDebtInUSD;
  }

  // babylonian method (https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method)
  function _sqrt(uint y) internal pure returns (uint z) {
    if (y > 3) {
      z = y;
      uint x = y / 2 + 1;
      while (x < z) {
        z = x;
        x = (y / x + x) / 2;
      }
    } else if (y != 0) {
      z = 1;
    }
  }
}
