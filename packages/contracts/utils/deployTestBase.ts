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
  AlternativePriceFeed,
} from '../typechain';
import { DeployHelper } from './deployHelpers';
import { deployCore } from '../deploy/modules/core';

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
  alternativePriceFeed: AlternativePriceFeed;
  swapOperations: SwapOperations;
  stakingOperations: StakingOperations;
  pyth: MockPyth;

  USDT: MockERC20;
  BTC: MockERC20;
  GOV: MockERC20;

  STABLE: MockDebtToken;
  STOCK: MockDebtToken;
  STOCK_2: MockDebtToken;
}

export default async function deployTestBase(): Promise<Contracts> {
  // deploy helper
  const deploy = new DeployHelper();
  deploy.silent = true;
  await deploy.init();

  // deploy
  const contractsCore = await deployCore(deploy, true, undefined, undefined, undefined);

  return {
    borrowerOperations: contractsCore.borrowerOperations as MockBorrowerOperations,
    redemptionOperations: contractsCore.redemptionOperations,
    liquidationOperations: contractsCore.liquidationOperations,
    troveManager: contractsCore.troveManager as MockTroveManager,
    sortedTroves: contractsCore.sortedTroves,
    hintHelpers: contractsCore.hintHelpers,
    stabilityPoolManager: contractsCore.stabilityPoolManager as MockStabilityPoolManager,
    storagePool: contractsCore.storagePool,
    collSurplusPool: contractsCore.collSurplusPool,
    reservePool: contractsCore.reservePool,
    tokenManager: contractsCore.tokenManager,
    priceFeed: contractsCore.priceFeed,
    alternativePriceFeed: contractsCore.alternativePriceFeed,
    swapOperations: contractsCore.swapOperations,
    stakingOperations: contractsCore.stakingOperations,
    pyth: contractsCore.pyth as MockPyth,

    USDT: contractsCore.USDT as MockERC20,
    BTC: contractsCore.BTC as MockERC20,
    GOV: contractsCore.GOV as MockERC20,

    STABLE: contractsCore.STABLE as MockDebtToken,
    STOCK: contractsCore.STOCK as MockDebtToken,
    STOCK_2: contractsCore.STOCK_2 as MockDebtToken,
  };
}
