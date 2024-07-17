import '@nomicfoundation/hardhat-ethers';
import '@nomicfoundation/hardhat-verify';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-network-helpers';
import 'hardhat-abi-exporter';
import 'hardhat-gas-reporter';
import 'hardhat-contract-sizer';
import 'solidity-coverage';
import './deploy/deploy';

import fs from 'fs';
const getSecret = (secretKey: string, defaultValue = '') => {
  const SECRETS_FILE = './secrets.js';
  let secret = defaultValue;
  if (fs.existsSync(SECRETS_FILE)) {
    const { secrets } = require(SECRETS_FILE);
    if (secrets[secretKey]) secret = secrets[secretKey];
  }

  return secret;
};

export default {
  solidity: {
    compilers: [{ version: '0.8.20', settings: { optimizer: { enabled: true, runs: 200 } } }],
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  networks: {
    hardhat: {
      gas: 15000000, // tx gas limit
      blockGasLimit: 15000000,
      gasPrice: 20000000000,
      initialBaseFeePerGas: 0,
      throwOnTransactionFailures: true,
      throwOnCallFailures: true,
      allowUnlimitedContractSize: true,
    },
    localhost: {
      chainId: 31337,
      url: 'http://0.0.0.0:8545',
    },
    remote: {
      chainId: 31338,
      url: 'http://161.97.170.25:8545',
    },
    seiTest: {
      chainId: 1328,
      url: 'https://evm-rpc-testnet.sei-apis.com',
    },
    sei: {
      chainId: 1329,
      url: 'https://evm-rpc.sei-apis.com',
    },
    mainnet: {
      url: `https://eth-mainnet.alchemyapi.io/v2/${getSecret('alchemyAPIKey')}`,
      gasPrice: process.env.GAS_PRICE ? parseInt(process.env.GAS_PRICE) : 20000000000,
      accounts: [
        getSecret('DEPLOYER_PRIVATEKEY', '0x60ddfe7f579ab6867cbe7a2dc03853dc141d7a4ab6dbefc0dae2d2b1bd4e487f'),
        getSecret('ACCOUNT2_PRIVATEKEY', '0x3ec7cedbafd0cb9ec05bf9f7ccfa1e8b42b3e3a02c75addfccbfeb328d1b383b'),
      ],
    },
    rinkeby: {
      url: `https://eth-rinkeby.alchemyapi.io/v2/${getSecret('alchemyAPIKeyRinkeby')}`,
      gas: 10000000, // tx gas limit
      accounts: [
        getSecret('RINKEBY_DEPLOYER_PRIVATEKEY', '0x60ddfe7f579ab6867cbe7a2dc03853dc141d7a4ab6dbefc0dae2d2b1bd4e487f'),
      ],
    },
  },
  namedAccounts: { deployer: { default: 0 } },
  etherscan: { apiKey: getSecret('ETHERSCAN_API_KEY') },
  mocha: { timeout: 12000000 },
  gasReporter: { enabled: process.env.REPORT_GAS ? true : false },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: false,
    strict: true,
  },
  abiExporter: {
    path: './abi',
    clear: true,
    runOnCompile: true,
    flat: true,
    spacing: 4,
    pretty: false,
  },
  typechain: {
    outDir: './typechain',
    target: 'ethers-v6',
  },
};
