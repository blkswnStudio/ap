import { parseUnits } from 'ethers';
import { getCheckSum } from './app/utils/crypto';

// first one is the default network
export const NETWORKS = [
  {
    environment: ['development', 'staging'],
    chainName: 'Sei Atlantic',
    chainId: '0x530',
    chainIdNumber: 1328,
    rpcUrls: ['https://evm-rpc-testnet.sei-apis.com'],
    nativeCurrency: { name: 'SEI', symbol: 'SEI', decimals: 18 },
    blockExplorerUrls: ['https://seitrace.com/?chain=atlantic-2'],
    graphEndpoint: 'https://api.studio.thegraph.com/query/75729/jassets/version/latest',
    authorizationHeader: '',
    featureFlags: {
      seedCollateralEnabled: true,
    },
    image: 'https://s3.coinmarketcap.com/static-gravity/image/992744cfbd5e40f5920018ee7a830b98.png',
    contracts: {
      ERC20: {
        BTC: '0x4aa1e095302bbcf0639763e38206fe9fa6e0b1c9',
        USDT: '0x061aaecfc4c9da3e29b4ba289fd8f94b4f09630f',
        GOV: '0x23a948c465e15913be002899f4c3c80831cadb53',
        STABLE: '0xbb59243bd1b037a715aee76e49abb22186e95a58',
        STOCK_1: '0x2aeb4b537e9c2a50a5c07dc2fdd54ece77b340b7',
        STOCK_2: '0xa8ac39bdd767e54c870057bb2bee26e89a34f9c3',
      },
      DebtToken: {
        STABLE: '0xbb59243bd1b037a715aee76e49abb22186e95a58',
        STOCK_1: '0x2aeb4b537e9c2a50a5c07dc2fdd54ece77b340b7',
        STOCK_2: '0xa8ac39bdd767e54c870057bb2bee26e89a34f9c3',
      },
      SwapPairs: {
        BTC: '0xa2605f4bda29b22545a3e8c1dab16b81c79717c0',
        USDT: '0xa0b137fd397d7fe38db7f6b181e69e1c3d8e0fda',
        GOV: '0x20cc7eced581a8e4fb8341a7dd67d01b7b7c16d9',
        STOCK_1: '0xee9afdc89f0fc6859a7561753bd40a6ffe07aec4',
        STOCK_2: '0x46e168f1d0c26e87ba33460a0bec556076a9f692',
      },
      TroveManager: '0xfd24360a5807d4833f2e75c430d44df921beeb5e',
      StabilityPoolManager: '0xa6d768cb77a799dbed4cf3dbec0a2d1028a6970c',
      SwapOperations: '0x1cb7bfd62dc8f0232047bac561ec30b879d6e596',
      BorrowerOperations: '0xb4adcfd9b139b79df74800b66e273c1a927c0231',
      StoragePool: '0xadd2f6546059800baccbc1183be6db4f90b5f919',
      SortedTroves: '0x745ca8d3e1e0b27dd73be2fb0aa2cf5801561d23',
      HintHelpers: '0x5341b19454c9ca15c86a84b4d8a2144291dfc0fd',
      PriceFeed: '0x2c938b4091918ebe78ec1741898d39c321d7f72d',
      RedemptionOperations: '0x7e42a84e6114091fbfa6255fb22568e070049ed8',
      CollSurplus: '0xdc6a3bf135a64292cf572cc19c0c154ce709ca27',
      StakingOperations: '0x8dd13d9857d4f1d4151da43de49ade96d7c530aa',
      StakingVestingOperations: '0x0B306BF915C4d645ff596e518fAf3F9669b97016',
    },
  },
  {
    environment: ['development'],
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
    image: '',
    contracts: {
      ERC20: {
        BTC: '0x3aa5ebb10dc797cac828524e59a333d0a371443c',
        USDT: '0xc6e7df5e7b4f2a278906862b61205850344d4e7d',
        GOV: '0x68b1d87f95878fe05b998f19b66f4baba5de1aed',
        STABLE: '0x9a9f2ccfde556a7e9ff0848998aa4a0cfd8863ae',
        STOCK_1: '0x59b670e9fa9d0a427751af201d676719a970857b',
        STOCK_2: '0x4ed7c70f96b99c776995fb64377f0d4ab3b0e1c1',
      },
      DebtToken: {
        STABLE: '0x9a9f2ccfde556a7e9ff0848998aa4a0cfd8863ae',
        STOCK_1: '0x59b670e9fa9d0a427751af201d676719a970857b',
        STOCK_2: '0x4ed7c70f96b99c776995fb64377f0d4ab3b0e1c1',
      },
      SwapPairs: {
        BTC: '0x922d6956c99e12dfeb3224dea977d0939758a1fe',
        USDT: '0xd8a5a9b31c3c0232e196d518e89fd8bf83acad43',
        GOV: '0x172076e0166d1f9cc711c77adf8488051744980c',
        STOCK_1: '0x1c85638e118b37167e9298c2268758e058ddfda0',
        STOCK_2: '0xf953b3a269d80e3eb0f2947630da976b896a8c5b',
      },
      TroveManager: '0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9',
      StabilityPoolManager: '0x0165878a594ca255338adfa4d48449f69242eb8f',
      SwapOperations: '0x0DCd1Bf9A1b36cE34237eEaFef220932846BCD82',
      BorrowerOperations: '0x5fbdb2315678afecb367f032d93f642f64180aa3',
      StoragePool: '0xa513e6e4b8f2a923d98304ec87f64353c4d5c853',
      SortedTroves: '0xdc64a140aa3e981100a9beca4e685f962f0cf6c9',
      HintHelpers: '0x5fc8d32690cc91d4c39d9d3abcbd16989f875707',
      PriceFeed: '0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e',
      RedemptionOperations: '0xe7f1725e7734ce288f8367e1bb143e90bb3f0512',
      CollSurplus: '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6',
      StakingOperations: '0x9A676e781A523b5d0C0e43731313A708CB607508',
      StakingVestingOperations: '0x0B306BF915C4d645ff596e518fAf3F9669b97016',
      MockPyth: '0x959922bE3CAee4b8Cd9a407cc3ac1C251C2007B1',
    },
  },
] as const;

export const defaultNetwork = NETWORKS[0];

export const Contracts_ATC = NETWORKS[0].contracts;
export const Contracts_Localhost = NETWORKS[1].contracts as unknown as typeof Contracts_ATC;

export const isPoolAddress = (
  address: string,
): address is
  | '0xa2605f4bda29b22545a3e8c1dab16b81c79717c0'
  | '0xa0b137fd397d7fe38db7f6b181e69e1c3d8e0fda'
  | '0x20cc7eced581a8e4fb8341a7dd67d01b7b7c16d9'
  | '0xee9afdc89f0fc6859a7561753bd40a6ffe07aec4'
  | '0x46e168f1d0c26e87ba33460a0bec556076a9f692' => {
  return [...Object.values(Contracts_ATC.SwapPairs)]
    .map((address) => getCheckSum(address))
    .includes(getCheckSum(address) as any);
};

export const isDebtTokenAddress = (
  address: string,
): address is
  | '0xbb59243bd1b037a715aee76e49abb22186e95a58'
  | '0x2aeb4b537e9c2a50a5c07dc2fdd54ece77b340b7'
  | '0xa8ac39bdd767e54c870057bb2bee26e89a34f9c3' => {
  return [...Object.values(Contracts_ATC.DebtToken)]
    .map((address) => getCheckSum(address))
    .includes(getCheckSum(address) as any);
};
export const isStableCoinAddress = (address: string): address is '0xbb59243bd1b037a715aee76e49abb22186e95a58' => {
  return getCheckSum(Contracts_ATC.DebtToken.STABLE) === getCheckSum(address);
};
export const isGOVTokenAddress = (address: string): address is '0x23a948c465e15913be002899f4c3c80831cadb53' => {
  return getCheckSum(Contracts_ATC.ERC20.GOV) === getCheckSum(address);
};

export const isCollateralTokenAddress = (
  address: string,
): address is
  | '0x4aa1e095302bbcf0639763e38206fe9fa6e0b1c9'
  | '0x061aaecfc4c9da3e29b4ba289fd8f94b4f09630f'
  | '0x23a948c465e15913be002899f4c3c80831cadb53'
  | '0xbb59243bd1b037a715aee76e49abb22186e95a58'
  | '0x2aeb4b537e9c2a50a5c07dc2fdd54ece77b340b7'
  | '0xa8ac39bdd767e54c870057bb2bee26e89a34f9c3' => {
  return [...Object.values(Contracts_ATC.ERC20)]
    .map((address) => getCheckSum(address))
    .includes(getCheckSum(address) as any);
};

export const seedCollateralTokensAmount: Record<string, bigint> = {
  [Contracts_ATC.ERC20.BTC]: parseUnits('1', 9),
  [Contracts_ATC.ERC20.GOV]: parseUnits('10000', 18),
  [Contracts_ATC.ERC20.USDT]: parseUnits('10000', 18),
};
