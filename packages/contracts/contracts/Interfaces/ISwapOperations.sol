// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import './IBBase.sol';

interface ISwapOperations is IBBase {
  error Forbidden();
  error IdenticalAddresses();
  error ReachedPoolLimit();
  error PairExists();
  error Expired();
  error PairDoesNotExist();
  error InsufficientAAmount();
  error InsufficientBAmount();
  error InsufficientInputAmount();
  error InsufficientOutputAmount();
  error InsufficientAmountADesired();
  error InsufficientAmountBDesired();
  error ExcessiveInputAmount();
  error InsufficientLiquidity();
  error InsufficientAmount();
  error InvalidPath();
  error TransferFromFailed();
  error PairRequiresStable();
  error UntrustedOracle();

  event SwapOperationsInitialized(
    address borrowerOperations,
    address troveManager,
    address priceFeed,
    address tokenManager,
    address stakingOperations
  );
  event PairCreated(address indexed token0, address indexed token1, address pair, uint);

  struct RemoveLiquidtyPermitParams {
    address tokenA;
    address tokenB;
    uint liquidity;
    uint amountAMin;
    uint amountBMin;
    uint deadline;
    bool approveMax;
    address _upperHint;
    address _lowerHint;
    uint8 v;
    bytes32 r;
    bytes32 s;
  }

  struct SwapAmount {
    uint amount; // including fee
    uint fee;
  }

  // **** GETTER ****

  function allPairs(uint) external view returns (address pair);

  function allPairsLength() external view returns (uint);

  function isPair(address pair) external view returns (bool);

  function getPair(address tokenA, address tokenB) external view returns (address pair);

  function createPair(address _plainSwapPair, address tokenA, address tokenB) external;

  function getSwapBaseFee() external view returns (uint);

  function setSwapBaseFee(uint _swapBaseFee) external;

  function getGovSwapFee() external view returns (uint);

  function setGovSwapFee(uint _govSwapFee) external;

  function setDynamicFeeAddress(address _dynamicFee) external;

  function calcDynamicSwapFee(uint val) external view returns (uint fee);

  function quote(uint amountA, uint reserveA, uint reserveB) external pure returns (uint amountB);

  function getAmountsOut(
    uint amountIn,
    address[] calldata path
  ) external view returns (SwapAmount[] memory amounts, bool isUsablePrice);

  function getAmountsIn(
    uint amountOut,
    address[] calldata path
  ) external view returns (SwapAmount[] memory amounts, bool isUsablePrice);

  // **** OPERATIONS ****

  function addLiquidity(
    address tokenA,
    address tokenB,
    uint amountADesired,
    uint amountBDesired,
    uint amountAMin,
    uint amountBMin,
    PriceUpdateAndMintMeta memory _priceAndMintMeta,
    uint deadline
  ) external payable returns (uint amountA, uint amountB, uint liquidity);

  function addLiquidityWithPermit(
    address tokenA,
    address tokenB,
    uint amountADesired,
    uint amountBDesired,
    uint amountAMin,
    uint amountBMin,
    PriceUpdateAndMintMeta memory _priceAndMintMeta,
    uint deadline,
    uint8[] memory v,
    bytes32[] memory r,
    bytes32[] memory s
  ) external payable returns (uint amountA, uint amountB, uint liquidity);

  // automatically repays any related open loans from the borrower (msg.sender)
  function removeLiquidity(
    address tokenA,
    address tokenB,
    uint liquidity,
    uint amountAMin,
    uint amountBMin,
    address _upperHint,
    address _lowerHint,
    uint deadline,
    bytes[] memory _priceUpdateData
  ) external payable returns (uint amountA, uint amountB);

  function swapExactTokensForTokens(
    uint amountIn,
    uint amountOutMin,
    address[] calldata path,
    address to,
    uint deadline,
    bytes[] memory _priceUpdateData
  ) external payable returns (SwapAmount[] memory amounts);

  function swapTokensForExactTokens(
    uint amountOut,
    uint amountInMax,
    address[] calldata path,
    address to,
    uint deadline,
    bytes[] memory _priceUpdateData
  ) external payable returns (SwapAmount[] memory amounts);

  function swapExactTokensForTokensWithPermit(
    uint amountIn,
    uint amountOutMin,
    address[] calldata path,
    address to,
    uint deadline,
    uint8 v,
    bytes32 r,
    bytes32 s,
    bytes[] memory _priceUpdateData
  ) external payable returns (SwapAmount[] memory amounts);

  function openLongPosition(
    uint stableToMintIn,
    uint debtOutMin,
    address debtTokenAddress,
    address to,
    MintMeta memory _mintMeta,
    uint deadline,
    bytes[] memory _priceUpdateData
  ) external payable returns (SwapAmount[] memory amounts);

  function openShortPosition(
    uint debtToMintIn,
    uint stableOutMin,
    address debtTokenAddress,
    address to,
    MintMeta memory _mintMeta,
    uint deadline,
    bytes[] memory _priceUpdateData
  ) external payable returns (SwapAmount[] memory amounts);
}
