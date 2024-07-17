// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol';
import './Dependencies/LiquityMath.sol';
import './Dependencies/LiquityBase.sol';
import './Dependencies/UQ112x112.sol';
import './Dependencies/CheckContract.sol';
import './Interfaces/ISwapPair.sol';
import './Interfaces/ISwapOperations.sol';
import './Interfaces/ISwapCallee.sol';
import './SwapERC20.sol';
import './Interfaces/IPriceFeed.sol';
import './Interfaces/ITokenManager.sol';
import './Interfaces/IStakingOperations.sol';

contract SwapPair is ISwapPair, SwapERC20, CheckContract, LiquityBase {
  using UQ112x112 for uint224;

  uint public constant MINIMUM_LIQUIDITY = 10 ** 3;
  bytes4 private constant SELECTOR = bytes4(keccak256(bytes('transfer(address,uint256)')));

  ISwapOperations public swapOperations;
  IPriceFeed public priceFeed;
  ITokenManager public tokenManager;
  IStakingOperations public stakingOperations;

  address public token0;
  address public token1;

  uint112 private reserve0; // uses single storage slot, accessible via getReserves
  uint112 private reserve1; // uses single storage slot, accessible via getReserves
  uint32 private blockTimestampLast; // uses single storage slot, accessible via getReserves

  uint public price0CumulativeLast;
  uint public price1CumulativeLast;

  constructor(address _operations) {
    checkContract(_operations);
    swapOperations = ISwapOperations(_operations);
  }

  // called once by the operations at time of deployment
  function initialize(
    address _token0,
    address _token1,
    address _tokenManager,
    address _priceFeedAddress,
    address _stakingOperations
  ) external {
    if (msg.sender != address(swapOperations)) revert Forbidden();

    token0 = _token0;
    token1 = _token1;
    tokenManager = ITokenManager(_tokenManager);
    priceFeed = IPriceFeed(_priceFeedAddress);
    stakingOperations = IStakingOperations(_stakingOperations);
  }

  uint private unlocked = 1;
  modifier lock() {
    if (unlocked == 0) revert Locked();

    unlocked = 0;
    _;
    unlocked = 1;
  }

  function getReserves() public view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast) {
    _reserve0 = reserve0;
    _reserve1 = reserve1;
    _blockTimestampLast = blockTimestampLast;
  }

  function _safeTransfer(address token, address to, uint value) private {
    (bool success, bytes memory data) = token.call(abi.encodeWithSelector(SELECTOR, to, value));

    if (!success || (data.length > 0 && abi.decode(data, (bool)) == false)) revert TransferFailed();
  }

  // update reserves and, on the first call per block, price accumulators
  function _update(uint balance0, uint balance1, uint112 _reserve0, uint112 _reserve1) private {
    if (balance0 > type(uint112).max || balance1 > type(uint112).max) revert Overflow();

    uint32 blockTimestamp = uint32(block.timestamp % 2 ** 32);
    uint32 timeElapsed = blockTimestamp - blockTimestampLast; // overflow is desired
    if (timeElapsed > 0 && _reserve0 != 0 && _reserve1 != 0) {
      // * never overflows, and + overflow is desired
      price0CumulativeLast += uint(UQ112x112.encode(_reserve1).uqdiv(_reserve0)) * timeElapsed;
      price1CumulativeLast += uint(UQ112x112.encode(_reserve0).uqdiv(_reserve1)) * timeElapsed;
    }

    reserve0 = uint112(balance0);
    reserve1 = uint112(balance1);
    blockTimestampLast = blockTimestamp;
    emit Sync(reserve0, reserve1);
  }

  // this low-level function should be called from a contract which performs important safety checks
  function mint(address to) external lock returns (uint liquidity) {
    _requireCallerIsOperations();

    (uint112 _reserve0, uint112 _reserve1, ) = getReserves(); // gas savings
    uint balance0 = IERC20(token0).balanceOf(address(this));
    uint balance1 = IERC20(token1).balanceOf(address(this));
    uint amount0 = balance0 - _reserve0;
    uint amount1 = balance1 - _reserve1;

    uint _totalSupply = totalSupply; // gas savings
    if (_totalSupply == 0) {
      liquidity = LiquityMath._sqrt(amount0 * amount1) - MINIMUM_LIQUIDITY;
      _mint(address(0), MINIMUM_LIQUIDITY); // permanently lock the first MINIMUM_LIQUIDITY tokens
    } else {
      liquidity = LiquityMath._min((amount0 * _totalSupply) / _reserve0, (amount1 * _totalSupply) / _reserve1);
    }

    // mint to staking & deposit for user
    if (liquidity == 0) revert InsufficientLiquidityMinted();
    _mint(address(stakingOperations), liquidity);
    stakingOperations.depositFor(ISwapPair(address(this)), to, liquidity);
    _update(balance0, balance1, _reserve0, _reserve1);

    emit Mint(msg.sender, amount0, amount1);
  }

  // this low-level function should be called from a contract which performs important safety checks
  // directly burns debt tokens if the user has any left to repay
  function burn(
    address to,
    uint liquidity,
    uint debt0,
    uint debt1
  ) external lock returns (uint amount0, uint amount1, uint burned0, uint burned1) {
    _requireCallerIsOperations();

    (uint112 _reserve0, uint112 _reserve1, ) = getReserves();

    uint balance0 = IERC20(token0).balanceOf(address(this));
    uint balance1 = IERC20(token1).balanceOf(address(this));

    {
      uint _totalSupply = totalSupply; // gas savings
      amount0 = (liquidity * balance0) / _totalSupply; // using balances ensures pro-rata distribution
      amount1 = (liquidity * balance1) / _totalSupply; // using balances ensures pro-rata distribution

      if (amount0 == 0 || amount1 == 0) revert InsufficientLiquidityBurned();

      // withdraw from staking and burn
      stakingOperations.withdrawFor(ISwapPair(address(this)), to, liquidity);
      _burn(address(stakingOperations), liquidity);
    }

    // check if the user has any debts left to repay
    burned0 = LiquityMath._min(debt0, amount0);
    burned1 = LiquityMath._min(debt1, amount1);
    if (burned0 != 0) IDebtToken(token0).burn(address(this), burned0);
    if (burned1 != 0) IDebtToken(token1).burn(address(this), burned1);

    // payout whats left
    _safeTransfer(token0, to, amount0 - burned0);
    _safeTransfer(token1, to, amount1 - burned1);

    balance0 = IERC20(token0).balanceOf(address(this));
    balance1 = IERC20(token1).balanceOf(address(this));
    _update(balance0, balance1, _reserve0, _reserve1);

    emit Burn(msg.sender, amount0, amount1, to);
  }

  function _getDexPrice(uint reserve0_, uint reserve1_) internal view returns (uint) {
    uint token0Decimal = IERC20Metadata(token0).decimals();
    uint token1Decimal = IERC20Metadata(token1).decimals();
    return (reserve0_ * 10 ** token1Decimal * DECIMAL_PRECISION) / reserve1_ / 10 ** token0Decimal;
  }

  function _calcFee(uint val) internal pure returns (uint fee) {
    if (val < 0.02e18) return 0;
    else if (val < 0.05e18) return ((val - 0.02e18) * 0.00066e18) / DECIMAL_PRECISION;
    else if (val < 0.07e18) return 0.002e18 + ((val - 0.05e18) * 0.00525e18) / DECIMAL_PRECISION;
    else if (val < 0.1e18) return 0.0125e18 + ((val - 0.07e18) * 0.0125e18) / DECIMAL_PRECISION;
    else if (val < 0.11e18) return 0.05e18 + ((val - 0.1e18) * 0.025e18) / DECIMAL_PRECISION;
    else return 0.075e18;
  }

  function getSwapFee(uint postReserve0, uint postReserve1) public view override returns (uint feePercentage) {
    address nonStableCoin = token1; // find stable coin
    if (tokenManager.isDebtToken(nonStableCoin) && totalSupply > 0) {
      // query prices
      (uint oraclePrice, ) = priceFeed.getPrice(nonStableCoin);
      uint preDexPrice = _getDexPrice(reserve0, reserve1);
      uint postDexPrice = _getDexPrice(postReserve0, postReserve1);

      // only apply the dynamic fee if the swap trades against the oracle peg
      if (
        (postDexPrice > oraclePrice && postDexPrice > preDexPrice) ||
        (postDexPrice < oraclePrice && preDexPrice > postDexPrice)
      ) {
        uint avgDexPrice = (preDexPrice + postDexPrice) / 2;
        uint priceRatio = (oraclePrice * DECIMAL_PRECISION) / avgDexPrice; // 1e18
        return
          _calcFee(priceRatio > DECIMAL_PRECISION ? priceRatio - DECIMAL_PRECISION : DECIMAL_PRECISION - priceRatio) +
          swapOperations.getSwapBaseFee();
      }
    }

    return swapOperations.getSwapBaseFee();
  }

  function swap(uint amount0InFee, uint amount1InFee, uint amount0Out, uint amount1Out, address to) external lock {
    _requireCallerIsOperations();
    if (to == token0 || to == token1) revert InvalidTo();
    if (amount0Out == 0 && amount1Out == 0) revert InsufficientOutputAmount();
    if (amount0Out > reserve0 || amount1Out > reserve1) revert InsufficientLiquidity();

    // optimistically transfer tokens
    if (amount0Out > 0) _safeTransfer(token0, to, amount0Out);
    if (amount1Out > 0) _safeTransfer(token1, to, amount1Out);

    // get pool balances (which already includes amountIn)
    uint balance0 = IERC20(token0).balanceOf(address(this));
    uint balance1 = IERC20(token1).balanceOf(address(this));

    // calculate the inputs based on the balances
    uint amount0In = balance0 > reserve0 - amount0Out ? balance0 - (reserve0 - amount0Out) : 0;
    uint amount1In = balance1 > reserve1 - amount1Out ? balance1 - (reserve1 - amount1Out) : 0;
    if (amount0In == 0 && amount1In == 0) revert InsufficientInputAmount();

    // validate the swap
    if ((balance0 - amount0InFee) * (balance1 - amount1InFee) < uint(reserve0) * uint(reserve1)) revert K();

    // gov swap fee payment
    if (amount0InFee > 0) {
      uint amount0GovFee = (amount0InFee * swapOperations.getGovSwapFee()) / DECIMAL_PRECISION;
      _safeTransfer(token0, tokenManager.govPayoutAddress(), amount0GovFee);
      balance0 -= amount0GovFee;
    }
    if (amount1InFee > 0) {
      uint amount1GovFee = (amount1InFee * swapOperations.getGovSwapFee()) / DECIMAL_PRECISION;
      _safeTransfer(token1, tokenManager.govPayoutAddress(), amount1GovFee);
      balance1 -= amount1GovFee;
    }

    _update(balance0, balance1, reserve0, reserve1);
    emit Swap(msg.sender, amount0In, amount1In, amount0Out, amount1Out, amount0InFee, amount1InFee, to);
  }

  // force balances to match reserves
  function skim(address to) external lock {
    address _token0 = token0; // gas savings
    address _token1 = token1; // gas savings
    _safeTransfer(_token0, to, IERC20(_token0).balanceOf(address(this)) - reserve0);
    _safeTransfer(_token1, to, IERC20(_token1).balanceOf(address(this)) - reserve1);
  }

  // force reserves to match balances
  function sync() external lock {
    _update(IERC20(token0).balanceOf(address(this)), IERC20(token1).balanceOf(address(this)), reserve0, reserve1);
  }

  function _requireCallerIsOperations() internal view {
    if (msg.sender != address(swapOperations)) revert NotFromSwapOperations();
  }
}
