const { batchFlatten } = require('@moonlabs/solidity-scripts/flatten.js');

const args = [
  {
    file: './contracts/SwapOperations.sol',
    out: './flat/SwapOperations',
  },
  {
    file: './contracts/TroveManager.sol',
    out: './flat/TroveManager',
  },
  {
    file: './contracts/HintHelpers.sol',
    out: './flat/HintHelpers',
  },
  {
    file: './contracts/StakingOperations.sol',
    out: './flat/StakingOperations',
  },
  {
    file: './contracts/BorrowerOperations.sol',
    out: './flat/BorrowerOperations',
  },
  {
    file: './contracts/TokenManager.sol',
    out: './flat/TokenManager',
  },
  {
    file: './contracts/StoragePool.sol',
    out: './flat/StoragePool',
  },
  {
    file: './contracts/ReservePool.sol',
    out: './flat/ReservePool',
  },
  {
    file: './contracts/PriceFeed.sol',
    out: './flat/PriceFeed',
  },
  {
    file: './contracts/LiquidationOperations.sol',
    out: './flat/LiquidationOperations',
  },
  {
    file: './contracts/RedemptionOperations.sol',
    out: './flat/RedemptionOperations',
  },
  {
    file: './contracts/DebtToken.sol',
    out: './flat/DebtToken',
  },
  {
    file: './contracts/Mock/MockDebtToken.sol',
    out: './flat/MockDebtToken',
  },
  {
    file: './contracts/Mock/MockERC20.sol',
    out: './flat/MockERC20',
  },
];

batchFlatten(args);
