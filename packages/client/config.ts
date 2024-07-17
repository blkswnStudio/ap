import { parseUnits } from 'ethers';
import { getCheckSum } from './app/utils/crypto';

// first one is the default network
export const NETWORKS = [
  {
    // chainName: 'Arbitrum Sepolia',
    // chainId: '0x66eee',
    // chainIdNumber: 421614,
    // rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
    // nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    // blockExplorerUrls: ['https://polygonscan.com/'],
    // graphEndpoint: 'https://api.studio.thegraph.com/query/75729/apollonseidevnetv1/version/latest',
    chainName: 'Sei Testnet',
    chainId: '0x530',
    chainIdNumber: 1328,
    rpcUrls: ['https://evm-rpc-testnet.sei-apis.com'],
    nativeCurrency: { name: 'SEI', symbol: 'SEI', decimals: 18 },
    blockExplorerUrls: ['https://polygonscan.com/'],
    graphEndpoint: 'https://api.goldsky.com/api/public/project_clyov5gbzku2e01yob93efovj/subgraphs/apollon/0.3/gn',
    authorizationHeader: '',
    featureFlags: {
      seedCollateralEnabled: true,
    },
    contracts: {
      ERC20: {
        BTC: '0x066a77fec273cf6d4b53b06a021da16334df72f2',
        USDT: '0xa0133a037f653a0d5088f505e72657c28b71c9fb',
        GOV: '0x8a795dcb8641a041de41b0031affd0dce24694e7',
        STABLE: '0xe2fe7ab7e53efdb85ae4eb3c2dedc9bbf44c005e',
        STOCK_1: '0xc47f75cf47590753b0adcf8ea8ad7d586e21720d',
        STOCK_2: '0x50233a98e3beba470a593c7b6ffc712e6f8758c7',
      },
      DebtToken: {
        STABLE: '0xe2fe7ab7e53efdb85ae4eb3c2dedc9bbf44c005e',
        STOCK_1: '0xc47f75cf47590753b0adcf8ea8ad7d586e21720d',
        STOCK_2: '0x50233a98e3beba470a593c7b6ffc712e6f8758c7',
      },
      SwapPairs: {
        BTC: '0x179e78fdc2d02f6763aaba620d5de671574a1c7a',
        USDT: '0x01334ca3d329cdf230c6c9bfd9dfba6df672f7ae',
        GOV: '0x8a795dcb8641a041de41b0031affd0dce24694e7',
        STOCK_1: '0x86b3f303aa8ac5ac77b85c1fbc8bcf22b1bd811d',
        STOCK_2: '0x272ebea9357d89e22f7f96459894c4c501f70643',
      },
      TroveManager: '0x7ad92eb4f7e85d2a33fce3e8b6d0d510fc3ec9d8',
      StabilityPoolManager: '0xb2de6ff38ece15b64de08892b4e42e6c3de4aeae',
      SwapOperations: '0x07fee975953066b1c8ca15996c731916b941da45',
      BorrowerOperations: '0x50f4a680c0a248bb0e11f09204d4b56896ae30c6',
      StoragePool: '0xbcf093318929f1abe4aa133c00c78d667a822c69',
      SortedTroves: '0xfcf98f6d248a03580bfd1ca9f2ef8d895318cc83',
      HintHelpers: '0x01c8fcfedc8b9738559b51789da05876b26bbc6e',
      PriceFeed: '0x2b0c1a7588bc05042deb8e68d22b89f2fbb66859',
      RedemptionOperations: '0xfb550547062685dfee004f701fda395fc393b84b',
      CollSurplus: '0xe7ab3f9a88e2a1c2d91e422fcec0a8c2099b3f39',
      StakingOperations: '0x7613e79cdb63216c1e5c6be13e2c4b117c0182c0',
    },
  },
  {
    chainName: 'Localhost',
    chainId: '0x7a69', // 31337 in hex
    chainIdNumber: 31337,
    rpcUrls: ['http://127.0.0.1:8545'],
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    blockExplorerUrls: ['https://polygonscan.com/'],
    graphEndpoint: 'http://localhost:8000/subgraphs/name/subgraph',
    authorizationHeader: '',
    featureFlags: {
      seedCollateralEnabled: true,
    },
    contracts: {
      ERC20: {
        BTC: '0x67d269191c92caf3cd7723f116c85e6e9bf55933',
        USDT: '0xc3e53f4d16ae77db1c982e75a937b9f60fe63690',
        GOV: '0x84ea74d481ee0a5332c457a4d796187f6ba67feb',
      },
      DebtToken: {
        STABLE: '0x9e545e3c0baab3e08cdfd552c960a1050f373042',
        STOCK_1: '0xa82ff9afd8f496c3d6ac40e2a0f282e47488cfc9',
        STOCK_2: '0x1613beb3b2c4f22ee086b2b38c1476a3ce7f78e8',
      },
      SwapPairs: {
        BTC: '0x809d550fca64d94bd9f66e60752a544199cfac3d',
        USDT: '0x2bdcc0de6be1f7d2ee689a0342d76f52e8efaba3',
        GOV: '0xb0d4afd8879ed9f52b28595d31b441d079b2ca07',
        STOCK_1: '0x4c4a2f8c81640e47606d3fd77b353e87ba015584',
        STOCK_2: '0x8198f5d8f8cffe8f9c413d98a0a55aeb8ab9fbb7',
      },
      TroveManager: '0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9',
      StabilityPoolManager: '0x0165878a594ca255338adfa4d48449f69242eb8f',
      SwapOperations: '0xa51c1fc2f0d1a1b8494ed1fe312d7c3a78ed91c0',
      BorrowerOperations: '0x5fbdb2315678afecb367f032d93f642f64180aa3',
      StoragePool: '0xa513e6e4b8f2a923d98304ec87f64353c4d5c853',
      SortedTroves: '0xdc64a140aa3e981100a9beca4e685f962f0cf6c9',
      HintHelpers: '0x5fc8d32690cc91d4c39d9d3abcbd16989f875707',
      PriceFeed: '0xb7f8bc63bbcad18155201308c8f3540b07f84f5e',
      RedemptionOperations: '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512',
      CollSurplus: '0x2279b7a0a67db372996a5fab50d91eaa73d2ebe6',
      StakingOperations: '0x0dcd1bf9a1b36ce34237eeafef220932846bcd82',
    },
  },
] as const;

export const defaultNetwork = NETWORKS[0];

export const Contracts_ATC = NETWORKS[0].contracts;
export const Contracts_Localhost = NETWORKS[1].contracts as unknown as typeof Contracts_ATC;

export const isPoolAddress = (
  address: string,
): address is
  | '0x179e78fdc2d02f6763aaba620d5de671574a1c7a'
  | '0x01334ca3d329cdf230c6c9bfd9dfba6df672f7ae'
  | '0x8a795dcb8641a041de41b0031affd0dce24694e7'
  | '0x86b3f303aa8ac5ac77b85c1fbc8bcf22b1bd811d'
  | '0x272ebea9357d89e22f7f96459894c4c501f70643' => {
  return [...Object.values(Contracts_ATC.SwapPairs)]
    .map((address) => getCheckSum(address))
    .includes(getCheckSum(address) as any);
};

export const isDebtTokenAddress = (
  address: string,
): address is
  | '0xe2fe7ab7e53efdb85ae4eb3c2dedc9bbf44c005e'
  | '0xc47f75cf47590753b0adcf8ea8ad7d586e21720d'
  | '0x50233a98e3beba470a593c7b6ffc712e6f8758c7' => {
  return [...Object.values(Contracts_ATC.DebtToken)]
    .map((address) => getCheckSum(address))
    .includes(getCheckSum(address) as any);
};
export const isStableCoinAddress = (address: string): address is '0xe2fe7ab7e53efdb85ae4eb3c2dedc9bbf44c005e' => {
  return getCheckSum(Contracts_ATC.DebtToken.STABLE) === getCheckSum(address);
};

export const isCollateralTokenAddress = (
  address: string,
): address is
  | '0x066a77fec273cf6d4b53b06a021da16334df72f2'
  | '0xa0133a037f653a0d5088f505e72657c28b71c9fb'
  | '0x8a795dcb8641a041de41b0031affd0dce24694e7'
  | '0xe2fe7ab7e53efdb85ae4eb3c2dedc9bbf44c005e'
  | '0xc47f75cf47590753b0adcf8ea8ad7d586e21720d'
  | '0x50233a98e3beba470a593c7b6ffc712e6f8758c7' => {
  return [...Object.values(Contracts_ATC.ERC20)]
    .map((address) => getCheckSum(address))
    .includes(getCheckSum(address) as any);
};

export const seedCollateralTokensAmount: Record<
  (typeof Contracts_ATC.ERC20)[keyof typeof Contracts_ATC.ERC20],
  bigint
> = {
  [Contracts_ATC.ERC20.BTC]: parseUnits('1', 9),
  [Contracts_ATC.ERC20.GOV]: parseUnits('10000', 18),
  [Contracts_ATC.ERC20.USDT]: parseUnits('10000', 18),
  [Contracts_ATC.ERC20.STABLE]: parseUnits('5000', 9),
  [Contracts_ATC.ERC20.STOCK_1]: parseUnits('2', 18),
  [Contracts_ATC.ERC20.STOCK_2]: parseUnits('2', 18),
};
