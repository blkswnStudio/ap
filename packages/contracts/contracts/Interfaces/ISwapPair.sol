// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import './ISwapERC20.sol';

interface ISwapPair is ISwapERC20 {
  error Locked();
  error TransferFailed();
  error Forbidden();
  error Overflow();
  error InsufficientLiquidityMinted();
  error InsufficientLiquidityBurned();
  error InsufficientInputAmount();
  error InsufficientOutputAmount();
  error InsufficientLiquidity();
  error InvalidTo();
  error K();
  error NotFromSwapOperations();

  event Mint(address indexed to, uint amount0, uint amount1);
  event Burn(address indexed from, uint amount0, uint amount1);
  event Swap(
    address indexed sender,
    uint amount0In,
    uint amount1In,
    uint amount0Out,
    uint amount1Out,
    uint amount0InFee,
    uint amount1InFee,
    address indexed to
  );
  event Sync(uint112 reserve0, uint112 reserve1);

  // **** GETTER ****

  function MINIMUM_LIQUIDITY() external pure returns (uint);

  function token0() external view returns (address);

  function token1() external view returns (address);

  function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);

  function price0CumulativeLast() external view returns (uint);

  function price1CumulativeLast() external view returns (uint);

  function getSwapFee(
    uint postReserve0,
    uint postReserve1
  ) external view returns (uint feePercentage, bool isUsablePrice);

  // **** OPERATIONS ****

  function mint(address to) external returns (uint liquidity);

  function burn(
    address to,
    uint liquidity,
    uint debt0,
    uint debt1
  ) external returns (uint amount0, uint amount1, uint burned0, uint burned1);

  function swap(uint amount0InFee, uint amount1InFee, uint amount0Out, uint amount1Out, address to) external;

  function skim(address to) external;

  function sync() external;

  function initialize(address, address, address, address, address) external;
}
