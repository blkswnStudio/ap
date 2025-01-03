const { batchFlatten } = require('@moonlabs/solidity-scripts/flatten.js');

const args = [
  {
    file: './contracts/LiquidationOperations.sol',
    out: './flat/LiquidationOperations',
  },
];

batchFlatten(args);
