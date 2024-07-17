import { ethers } from 'hardhat';
import {
  TokenManager,
  SwapOperations,
  PriceFeed,
  RedemptionOperations,
  LiquidationOperations,
  MockBorrowerOperations,
  MockTroveManager,
  MockStabilityPoolManager,
  StoragePool,
  ReservePool,
  SortedTroves,
  HintHelpers,
  CollSurplusPool,
  MockERC20,
  MockDebtToken,
  MockPyth,
  StakingOperations,
} from '../typechain';
import { parseUnits } from 'ethers';
import { getPriceId, initOracle, initPrice, setPrice, updateOracle } from './pythHelper';

export interface Contracts {
  borrowerOperations: MockBorrowerOperations;
  redemptionOperations: RedemptionOperations;
  liquidationOperations: LiquidationOperations;
  troveManager: MockTroveManager;
  sortedTroves: SortedTroves;
  hintHelpers: HintHelpers;
  stabilityPoolManager: MockStabilityPoolManager;
  storagePool: StoragePool;
  collSurplusPool: CollSurplusPool;
  reservePool: ReservePool;
  tokenManager: TokenManager;
  priceFeed: PriceFeed;
  swapOperations: SwapOperations;
  stakingOperations: StakingOperations;
  pyth: MockPyth;

  USDT: MockERC20;
  BTC: MockERC20;
  ETH: MockERC20;
  GOV: MockERC20;

  STABLE: MockDebtToken;
  STOCK: MockDebtToken;
  STOCK_2: MockDebtToken;
}

export default async function deployTestBase(): Promise<Contracts> {
  const govPayoutAddress = (await ethers.getSigners())[0];
  const contracts: Contracts = {} as any;

  // deploy all contracts
  let txs = [];
  for (const [key, factoryName] of [
    ['borrowerOperations', 'MockBorrowerOperations'],
    ['redemptionOperations', 'RedemptionOperations'],
    ['liquidationOperations', 'LiquidationOperations'],
    ['troveManager', 'MockTroveManager'],
    ['sortedTroves', 'SortedTroves'],
    ['hintHelpers', 'HintHelpers'],
    ['stabilityPoolManager', 'MockStabilityPoolManager'],
    ['storagePool', 'StoragePool'],
    ['collSurplusPool', 'CollSurplusPool'],
    ['reservePool', 'ReservePool'],
    ['tokenManager', 'TokenManager'],
    ['priceFeed', 'PriceFeed'],
    ['swapOperations', 'SwapOperations'],
    ['stakingOperations', 'StakingOperations'],
  ]) {
    const factory = await ethers.getContractFactory(factoryName);
    const contract = await factory.deploy();
    txs.push(contract.waitForDeployment());
    contracts[key] = contract;
  }
  await Promise.all(txs);

  contracts.pyth = await (
    await ethers.getContractFactory('MockPyth')
  ).deploy(
    60,
    parseUnits('0.00005') // pyth fees
  );
  await contracts.pyth.waitForDeployment();

  // connect them
  txs = [];
  for (const [c, args] of [
    [
      contracts.borrowerOperations,
      [
        contracts.troveManager.target,
        contracts.storagePool.target,
        contracts.stabilityPoolManager.target,
        contracts.priceFeed.target,
        contracts.tokenManager.target,
        contracts.swapOperations.target,
        contracts.sortedTroves.target,
        contracts.collSurplusPool.target,
      ],
    ],
    [
      contracts.redemptionOperations,
      [
        contracts.troveManager.target,
        contracts.storagePool.target,
        contracts.priceFeed.target,
        contracts.tokenManager.target,
        contracts.sortedTroves.target,
        contracts.hintHelpers.target,
      ],
    ],
    [
      contracts.liquidationOperations,
      [
        contracts.troveManager.target,
        contracts.storagePool.target,
        contracts.priceFeed.target,
        contracts.tokenManager.target,
        contracts.stabilityPoolManager.target,
        contracts.collSurplusPool.target,
      ],
    ],
    [
      contracts.troveManager,
      [
        contracts.borrowerOperations.target,
        contracts.redemptionOperations.target,
        contracts.liquidationOperations.target,
        contracts.storagePool.target,
        contracts.priceFeed.target,
        contracts.sortedTroves.target,
        contracts.tokenManager.target,
        contracts.reservePool.target,
      ],
    ],
    [
      contracts.sortedTroves,
      [contracts.troveManager.target, contracts.borrowerOperations.target, contracts.redemptionOperations.target],
    ],
    [
      contracts.hintHelpers,
      [
        contracts.sortedTroves.target,
        contracts.troveManager.target,
        contracts.redemptionOperations.target,
        contracts.priceFeed.target,
      ],
    ],
    [
      contracts.stabilityPoolManager,
      [
        contracts.liquidationOperations.target,
        contracts.priceFeed.target,
        contracts.storagePool.target,
        contracts.reservePool.target,
        contracts.tokenManager.target,
      ],
    ],
    [
      contracts.storagePool,
      [
        contracts.borrowerOperations.target,
        contracts.troveManager.target,
        contracts.redemptionOperations.target,
        contracts.liquidationOperations.target,
        contracts.stabilityPoolManager.target,
        contracts.priceFeed.target,
      ],
    ],
    [contracts.collSurplusPool, [contracts.liquidationOperations.target, contracts.borrowerOperations.target]],
    [
      contracts.reservePool,
      [
        contracts.tokenManager.target,
        contracts.stabilityPoolManager.target,
        contracts.priceFeed.target,
        parseUnits('0.2'), // 20 %
        parseUnits('1000'),
      ],
    ],
    [
      contracts.tokenManager,
      [
        contracts.stabilityPoolManager.target,
        contracts.stakingOperations.target,
        contracts.priceFeed.target,
        govPayoutAddress,
      ],
    ],
    [contracts.priceFeed, [contracts.pyth.target, contracts.tokenManager.target]],
    [
      contracts.swapOperations,
      [
        contracts.borrowerOperations.target,
        contracts.troveManager.target,
        contracts.priceFeed.target,
        contracts.tokenManager.target,
        contracts.stakingOperations.target,
      ],
    ],
    [contracts.stakingOperations, [contracts.swapOperations.target, contracts.tokenManager.target]],
  ]) {
    const tx = await c.setAddresses(...args);
    txs.push(tx.wait());
  }
  await Promise.all(txs);

  // seed mock tokens
  const mockERC20Factory = await ethers.getContractFactory('MockERC20');
  const mockDebtTokenFactory = await ethers.getContractFactory('MockDebtToken');
  txs = [];
  for (const [key, factory, ...args] of [
    ['BTC', mockERC20Factory, 'Bitcoin', 'BTC', 8],
    ['ETH', mockERC20Factory, 'Ethereum', 'ETH', 18],
    ['USDT', mockERC20Factory, 'Tether', 'USDT', 18],
    ['GOV', mockERC20Factory, 'Governance', 'GOV', 18],
    [
      'STABLE',
      mockDebtTokenFactory,
      contracts.troveManager,
      contracts.redemptionOperations,
      contracts.borrowerOperations,
      contracts.stabilityPoolManager,
      contracts.tokenManager,
      contracts.swapOperations,
      contracts.priceFeed,
      'STABLE',
      'STABLE',
      '1',
      true,
    ],
    [
      'STOCK',
      mockDebtTokenFactory,
      contracts.troveManager,
      contracts.redemptionOperations,
      contracts.borrowerOperations,
      contracts.stabilityPoolManager,
      contracts.tokenManager,
      contracts.swapOperations,
      contracts.priceFeed,
      'STOCK',
      'STOCK',
      '1',
      false,
    ],
    [
      'STOCK_2',
      mockDebtTokenFactory,
      contracts.troveManager,
      contracts.redemptionOperations,
      contracts.borrowerOperations,
      contracts.stabilityPoolManager,
      contracts.tokenManager,
      contracts.swapOperations,
      contracts.priceFeed,
      'STOCK_2',
      'STOCK_2',
      '1',
      false,
    ],
  ]) {
    const contract = await factory.deploy(...args);
    txs.push(contract.waitForDeployment());
    contracts[key] = contract;
  }
  await Promise.all(txs);

  // set initial coin prices
  initPrice('BTC', 21000);
  initPrice('ETH', 1500);
  initPrice('USDT', 1);
  initPrice('GOV', 5);
  initPrice('STABLE', 1);
  initPrice('STOCK', 150);
  initPrice('STOCK_2', 350);
  await initOracle(contracts);

  // add tokens to token manager
  await Promise.all([
    (
      await contracts.tokenManager.addCollToken(
        contracts.STABLE,
        parseUnits('1.5'),
        '0x' + BigInt(0).toString(8).padStart(64, '0'),
        false
      )
    ).wait(),
    (
      await contracts.tokenManager.addDebtToken(contracts.STABLE, '0x' + BigInt(0).toString(8).padStart(64, '0'))
    ).wait(),
    (await contracts.tokenManager.addDebtToken(contracts.STOCK, getPriceId('STOCK'))).wait(),
    (await contracts.tokenManager.addDebtToken(contracts.STOCK_2, getPriceId('STOCK_2'))).wait(),
    (await contracts.tokenManager.addCollToken(contracts.BTC, parseUnits('1.1'), getPriceId('BTC'), false)).wait(),
    (await contracts.tokenManager.addCollToken(contracts.USDT, parseUnits('1.1'), getPriceId('USDT'), false)).wait(),
    (await contracts.tokenManager.addCollToken(contracts.GOV, parseUnits('1.1'), getPriceId('GOV'), true)).wait(),
  ]);

  return contracts;
}

export const resetPrices = async (contracts: Contracts) => {
  await setPrice('BTC', 21000);
  await setPrice('USDT', 1);
  await setPrice('GOV', 5);
  await setPrice('STABLE', 1);
  await setPrice('STOCK', 150);
  await setPrice('STOCK_2', 350);
  await updateOracle(contracts);
};
