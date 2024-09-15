import { ethers } from 'hardhat';
import { DeployHelper } from '../../utils/deployHelpers';
import { AddressLike, parseUnits } from 'ethers';
import {
  TokenManager,
  SwapOperations,
  PriceFeed,
  RedemptionOperations,
  LiquidationOperations,
  BorrowerOperations,
  TroveManager,
  StabilityPoolManager,
  StoragePool,
  ReservePool,
  SortedTroves,
  HintHelpers,
  CollSurplusPool,
  DebtToken,
  StakingOperations,
  IPyth__factory,
  ERC20__factory,
  IPyth,
  ERC20,
  MockERC20,
  MockDebtToken,
  MockBorrowerOperations,
  MockTroveManager,
  MockStabilityPoolManager,
  AlternativePriceFeed,
} from '../../typechain';
import { getPriceId, initOracle, initPrice } from '../../utils/pythHelper';

export interface ContractsCore {
  borrowerOperations: BorrowerOperations | MockBorrowerOperations;
  redemptionOperations: RedemptionOperations;
  liquidationOperations: LiquidationOperations;
  troveManager: TroveManager | MockTroveManager;
  sortedTroves: SortedTroves;
  hintHelpers: HintHelpers;
  stabilityPoolManager: StabilityPoolManager | MockStabilityPoolManager;
  storagePool: StoragePool;
  collSurplusPool: CollSurplusPool;
  reservePool: ReservePool;
  tokenManager: TokenManager;
  priceFeed: PriceFeed;
  alternativePriceFeed: AlternativePriceFeed;
  swapOperations: SwapOperations;
  stakingOperations: StakingOperations;
  STABLE: DebtToken;

  // optional
  pyth: IPyth;
  GOV: ERC20;

  // mock
  USDT: MockERC20 | undefined;
  BTC: MockERC20 | undefined;
  STOCK: MockDebtToken | undefined;
  STOCK_2: MockDebtToken | undefined;

  // stocks
  AAPL: DebtToken;
  TSLA: DebtToken;
}

export const deployCore = async (
  deploy: DeployHelper,
  test: boolean,
  pythAddress: AddressLike | undefined,
  govTokenAddress: AddressLike | undefined,
  ownerAddress: AddressLike | undefined
): Promise<ContractsCore> => {
  const govPayoutAddress = ownerAddress ?? (await ethers.getSigners())[0];
  const contracts: ContractsCore = {} as any;

  deploy.openCategory('Deploy');
  {
    // deploy core contracts
    {
      const mock = test ? 'Mock' : '';
      deploy.openCategory('Core');
      for (const [key, contractName] of [
        ['borrowerOperations', `${mock}BorrowerOperations`],
        ['redemptionOperations', 'RedemptionOperations'],
        ['liquidationOperations', 'LiquidationOperations'],
        ['troveManager', `${mock}TroveManager`],
        ['sortedTroves', 'SortedTroves'],
        ['hintHelpers', 'HintHelpers'],
        ['stabilityPoolManager', `${mock}StabilityPoolManager`],
        ['storagePool', 'StoragePool'],
        ['collSurplusPool', 'CollSurplusPool'],
        ['reservePool', 'ReservePool'],
        ['tokenManager', 'TokenManager'],
        ['priceFeed', 'PriceFeed'],
        ['alternativePriceFeed', 'AlternativePriceFeed'],
        ['swapOperations', 'SwapOperations'],
        ['stakingOperations', 'StakingOperations'],
      ]) {
        (contracts as any)[key] = await deploy.deploy(
          `deploy_${key}`,
          contractName,
          async () => await (await ethers.getContractFactory(contractName)).deploy()
        );
      }

      // deploy PYTH
      if (pythAddress !== undefined) contracts.pyth = IPyth__factory.connect(pythAddress.toString());
      else {
        contracts.pyth = await deploy.deploy(
          'deploy_pyth',
          'MockPyth',
          async () =>
            await (
              await ethers.getContractFactory('MockPyth')
            ).deploy(
              60,
              parseUnits('0.00005') // pyth fees
            )
        );
      }

      deploy.closeCategory();
    }

    // deploy stable (jUSD) and stocks and mocks
    {
      deploy.openCategory('Tokens');
      if (govTokenAddress !== undefined) contracts.GOV = ERC20__factory.connect(govTokenAddress.toString());
      for (const [key, contractName, ...args] of [
        [
          'STABLE',
          test ? 'MockDebtToken' : 'DebtToken',
          contracts.troveManager,
          contracts.redemptionOperations,
          contracts.borrowerOperations,
          contracts.stabilityPoolManager,
          contracts.tokenManager,
          contracts.swapOperations,
          contracts.priceFeed,
          test ? 'STABLE' : 'JUSD',
          test ? 'STABLE' : 'JUSD',
          '1',
          true,
        ],
        ...(govTokenAddress !== undefined ? [] : [['GOV', 'MockERC20', 'Governance', 'GOV', 18]]),
        ...(!test
          ? []
          : [
              ['BTC', 'MockERC20', 'Bitcoin', 'BTC', 8],
              ['USDT', 'MockERC20', 'Tether', 'USDT', 18],
              [
                'STOCK',
                'MockDebtToken',
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
                'MockDebtToken',
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
            ]),
      ]) {
        (contracts as any)[key as string] = await deploy.deploy(
          `deployToken_${key}`,
          `${key} @ ${contractName}`,
          async () => await (await ethers.getContractFactory(contractName as string)).deploy(...args)
        );
      }
      deploy.closeCategory();
    }
  }
  deploy.closeCategory();

  // config
  deploy.openCategory('Config');
  {
    // connect
    deploy.openCategory('Connect');
    for (const [key, args] of [
      ['alternativePriceFeed', [contracts.priceFeed]],
      [
        'borrowerOperations',
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
        'redemptionOperations',
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
        'liquidationOperations',
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
        'troveManager',
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
        'sortedTroves',
        [contracts.troveManager.target, contracts.borrowerOperations.target, contracts.redemptionOperations.target],
      ],
      [
        'hintHelpers',
        [
          contracts.sortedTroves.target,
          contracts.troveManager.target,
          contracts.redemptionOperations.target,
          contracts.priceFeed.target,
        ],
      ],
      [
        'stabilityPoolManager',
        [
          contracts.liquidationOperations.target,
          contracts.priceFeed.target,
          contracts.storagePool.target,
          contracts.reservePool.target,
          contracts.tokenManager.target,
        ],
      ],
      [
        'storagePool',
        [
          contracts.borrowerOperations.target,
          contracts.troveManager.target,
          contracts.redemptionOperations.target,
          contracts.liquidationOperations.target,
          contracts.stabilityPoolManager.target,
          contracts.priceFeed.target,
        ],
      ],
      ['collSurplusPool', [contracts.liquidationOperations.target, contracts.borrowerOperations.target]],
      [
        'reservePool',
        [
          contracts.tokenManager.target,
          contracts.stabilityPoolManager.target,
          contracts.priceFeed.target,
          parseUnits('0.2'), // 20 %
          parseUnits('1000'),
        ],
      ],
      [
        'tokenManager',
        [
          contracts.stabilityPoolManager.target,
          contracts.stakingOperations.target,
          contracts.priceFeed.target,
          govPayoutAddress,
        ],
      ],
      ['priceFeed', [contracts.pyth.target, contracts.tokenManager.target]],
      [
        'swapOperations',
        [
          contracts.borrowerOperations.target,
          contracts.troveManager.target,
          contracts.priceFeed.target,
          contracts.tokenManager.target,
          contracts.stakingOperations.target,
        ],
      ],
      ['stakingOperations', [contracts.swapOperations.target, contracts.tokenManager.target]],
    ]) {
      const c = (contracts as any)[key as string];
      await deploy.send(`link_${key}`, `link (${key})`, async () => await c.setAddresses(...args));
    }
    deploy.closeCategory();

    // mock pyth prices for local and testing
    const noOracleID = '0x' + BigInt(0).toString(8).padStart(64, '0');
    initPrice('BTC', 21000, '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43'); // Pyth: BTC/USD
    initPrice('USDT', 1, '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b'); // Pyth: USDT/USD
    initPrice('STOCK', 150, '0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688'); // Pyth: AAPL/USD
    initPrice('STOCK_2', 350, '0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1'); // Pyth: TSLA/USD
    initPrice('STABLE', 1, noOracleID); // no oracle required, hard set to a value of 1
    initPrice(
      'GOV',
      5, // todo currently for local and staging a (wrong) pyth ticker is used, will be replaced with the alterantive balancer price feed on prod
      govTokenAddress ? noOracleID : '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b'
    ); // Pyth: USDT/USD
    if (!pythAddress) await initOracle(contracts as any);

    // add tokens to token manager
    deploy.openCategory('Add Tokens');
    {
      // debt tokens
      deploy.openCategory('Debt');
      for (const key of ['STABLE', 'STOCK', 'STOCK_2']) {
        const c = (contracts as any)[key];
        if (c === undefined) continue;
        await deploy.send(
          `addDebt_${key}`,
          `addDebt (${key})`,
          async () => await contracts.tokenManager.addDebtToken(c, getPriceId(key))
        );
      }
      deploy.closeCategory();
    }
    {
      // coll tokens
      deploy.openCategory('Coll');
      for (const [key, ratio] of [
        ['BTC', parseUnits('1.1')],
        ['USDT', parseUnits('1.1')],
        ['GOV', parseUnits('1.1')],
      ]) {
        const c = (contracts as any)[key as string];
        if (c === undefined) continue;
        await deploy.send(
          `addColl_${key}`,
          `addColl (${key})`,
          async () =>
            await contracts.tokenManager.addCollToken(
              c as AddressLike,
              ratio as bigint,
              getPriceId(key as string),
              (await c.getAddress()) === (await contracts.GOV.getAddress())
            )
        );
      }
      deploy.closeCategory();
    }
    deploy.closeCategory();

    // alternative price feed
    deploy.openCategory('Alternative PriceFeed');
    await deploy.send(
      `setAlternativePriceFeed`,
      `setAlternativePriceFeed`,
      async () => await contracts.priceFeed.setAlternativePriceFeed(contracts.alternativePriceFeed)
    );
    deploy.closeCategory();

    // handover
    if (ownerAddress !== undefined) {
      deploy.openCategory('Transfer Ownership');
      for (const key of ['tokenManager', 'priceFeed', 'reservePool', 'swapOperations', 'troveManager']) {
        const c = (contracts as any)[key as string];
        await deploy.send(
          `transferOwnership_${key}`,
          `TransferOwnership (${key})`,
          async () => await c.transferOwnership(ownerAddress)
        );
      }
      deploy.closeCategory();
    }
  }

  deploy.closeCategory();

  return contracts;
};
