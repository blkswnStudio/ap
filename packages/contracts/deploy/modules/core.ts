import { ethers } from 'hardhat';
import { DeployHelper } from '@moonlabs/solidity-scripts/deployHelpers';
import { AddressLike, MaxUint256, parseUnits, ZeroAddress } from 'ethers';
import {
  TokenManager,
  SwapOperations,
  PriceFeed,
  RedemptionOperations,
  LiquidationOperations,
  BorrowerOperations,
  TroveManager,
  StoragePool,
  ReservePool,
  SortedTroves,
  HintHelpers,
  DebtToken,
  CollSurplusPool,
  StakingOperations,
  IPyth__factory,
  ERC20__factory,
  IPyth,
  ERC20,
  MockERC20,
  MockDebtToken,
  MockBorrowerOperations,
  MockTroveManager,
  AlternativePriceFeed,
  MockStakingOperations,
  DynamicFee,
  StakingVestingOperations,
} from '../../typechain';
import {
  generatePriceUpdateDataWithFee,
  generatePriceUpdateDataWithFeeViaHermes,
  getPriceId,
  initOracle,
  initPrice,
} from '../../utils/pythHelper';
import { Contracts } from '../../utils/deployTestBase';

export interface ContractsCore {
  borrowerOperations: BorrowerOperations | MockBorrowerOperations;
  redemptionOperations: RedemptionOperations;
  liquidationOperations: LiquidationOperations;
  troveManager: TroveManager | MockTroveManager;
  sortedTroves: SortedTroves;
  hintHelpers: HintHelpers;
  storagePool: StoragePool;
  collSurplusPool: CollSurplusPool;
  reservePool: ReservePool;
  tokenManager: TokenManager;
  priceFeed: PriceFeed;
  alternativePriceFeed: AlternativePriceFeed;
  swapOperations: SwapOperations;
  dynamicFee: DynamicFee;
  stakingOperations: StakingOperations | MockStakingOperations;
  stakingVestingOperations: StakingVestingOperations;
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
  deployMockAssets: boolean,
  deploySwapPools: boolean,
  pythAddress: AddressLike | undefined,
  govTokenAddress: AddressLike | undefined,
  ownerAddress: AddressLike | undefined,
  deployTokensExceptStableAndGov: boolean = true
): Promise<ContractsCore> => {
  const govPayoutAddress = ownerAddress ?? (await ethers.getSigners())[0];
  if (test) deployMockAssets = true;
  const contracts: ContractsCore = {} as any;
  const isMockPyth = pythAddress == null;

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
        ['storagePool', 'StoragePool'],
        ['collSurplusPool', 'CollSurplusPool'],
        ['reservePool', 'ReservePool'],
        ['tokenManager', 'TokenManager'],
        ['priceFeed', 'PriceFeed'],
        ['alternativePriceFeed', 'AlternativePriceFeed'],
        ['swapOperations', 'SwapOperations'],
        ['dynamicFee', 'DynamicFee'],
        ['stakingOperations', `${mock}StakingOperations`],
        ['stakingVestingOperations', `StakingVestingOperations`],
      ]) {
        (contracts as any)[key] = await deploy.deploy(
          `deploy_${key}`,
          contractName,
          async () => await (await ethers.getContractFactory(contractName)).deploy()
        );
      }

      // deploy PYTH
      if (!isMockPyth) contracts.pyth = IPyth__factory.connect(pythAddress.toString());
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
          deployMockAssets ? 'MockDebtToken' : 'DebtToken',
          contracts.troveManager,
          contracts.redemptionOperations,
          contracts.borrowerOperations,
          contracts.tokenManager,
          contracts.swapOperations,
          contracts.priceFeed,
          'jUSD',
          'jUSD',
          '1',
          true,
        ],
        ...(govTokenAddress !== undefined ? [] : [['GOV', 'MockERC20', 'Governance', 'GOV', 18]]),
        ...(!deployMockAssets && deployTokensExceptStableAndGov
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
                contracts.tokenManager,
                contracts.swapOperations,
                contracts.priceFeed,
                'jAAPL',
                'jAAPL',
                '1',
                false,
              ],
              [
                'STOCK_2',
                'MockDebtToken',
                contracts.troveManager,
                contracts.redemptionOperations,
                contracts.borrowerOperations,
                contracts.tokenManager,
                contracts.swapOperations,
                contracts.priceFeed,
                'jTSLA',
                'jTSLA',
                '1',
                false,
              ],
            ]),
      ])
        (contracts as any)[key as string] = await deploy.deploy(
          `deployToken_${key}`,
          contractName as string,
          async () => await (await ethers.getContractFactory(contractName as string)).deploy(...args),
          `${key} @ ${contractName}`
        );
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
          contracts.collSurplusPool.target,
          contracts.reservePool.target,
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
        'storagePool',
        [
          contracts.borrowerOperations.target,
          contracts.troveManager.target,
          contracts.redemptionOperations.target,
          contracts.liquidationOperations.target,
          contracts.priceFeed.target,
          contracts.reservePool.target,
        ],
      ],
      ['collSurplusPool', [contracts.liquidationOperations.target, contracts.borrowerOperations.target]],
      [
        'reservePool',
        [
          contracts.tokenManager.target,
          contracts.priceFeed.target,
          contracts.liquidationOperations.target,
          contracts.storagePool.target,
          parseUnits('0.2'), // 20 %
        ],
      ],
      ['tokenManager', [contracts.stakingOperations.target, contracts.priceFeed.target, govPayoutAddress]],
      ['priceFeed', [contracts.pyth.target, contracts.tokenManager.target]],
      [
        'swapOperations',
        [
          contracts.borrowerOperations.target,
          contracts.troveManager.target,
          contracts.priceFeed.target,
          contracts.tokenManager.target,
          contracts.stakingOperations.target,
          contracts.dynamicFee.target,
        ],
      ],
      [
        'stakingOperations',
        [contracts.swapOperations.target, contracts.tokenManager.target, contracts.stakingVestingOperations.target],
      ],
      ['stakingVestingOperations', [contracts.stakingOperations.target]],
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
    if (isMockPyth) await initOracle(contracts as any);

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
        ['BTC', parseUnits(test ? '1.1' : '1.5')],
        ['USDT', parseUnits('1.1')],
        ['GOV', parseUnits(test ? '1.1' : '2')],
        ['STABLE', parseUnits(test ? '1.5' : '1.1')],
        ['STOCK', parseUnits(test ? '1.6' : '1.1')],
        ['STOCK_2', parseUnits(test ? '1.6' : '1.1')],
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
    for (const asset of ['STOCK', 'STOCK_2'])
      if (!!contracts[asset])
        await deploy.send(
          `setFallbackTrustedTimespan_${asset}`,
          `setFallbackTrustedTimespan (${asset})`,
          async () => await contracts.alternativePriceFeed.setFallbackTrustedTimespan(contracts[asset].target, 180)
        );
    deploy.closeCategory();

    // swap pool setup
    if (deploySwapPools) {
      deploy.openCategory('Swap Pools');

      await openTrove({
        isMockPyth,
        deploy,
        contracts: contracts as any,
        colls: [
          { tokenAddress: contracts.BTC, amount: parseUnits('10', 8) },
          { tokenAddress: contracts.USDT, amount: parseUnits('500000') },
          { tokenAddress: contracts.GOV, amount: parseUnits('500000') },
        ],
      });

      for (const pool of [
        [contracts.BTC, 'BTC', parseUnits('0.2', 8), parseUnits('10000')],
        [contracts.USDT, 'USDT', parseUnits('10000'), parseUnits('10000')],
        [contracts.GOV, 'GOV', parseUnits('4000'), parseUnits('10000')],
        [contracts.STOCK, 'STOCK', parseUnits('65'), parseUnits('10000')],
        [contracts.STOCK_2, 'STOCK_2', parseUnits('12'), parseUnits('10000')],
      ])
        await deploySwapPool(contracts, deploy, isMockPyth, pool);

      // init staking rewards
      await deploy.send(`mint_staking_rewards`, `mint staking rewards`, async () =>
        contracts.GOV.unprotectedMint(contracts.stakingOperations.target, parseUnits('1000000'))
      );
      await deploy.send(`setStakingRewardsPerSecond`, `setStakingRewardsPerSecond`, async () =>
        contracts.tokenManager.setStakingRewardsPerSecond(parseUnits('0.001'))
      );

      deploy.closeCategory();
    }

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

async function openTrove({
  deploy,
  contracts,
  colls,
  isMockPyth,
}: {
  deploy: any;
  contracts: Contracts;
  colls: any[];
  isMockPyth?: boolean;
}) {
  const from = (await ethers.getSigners())[0];
  deploy.openCategory('open trove');

  for (const { tokenAddress, amount } of colls) {
    await deploy.send(
      `mint_${tokenAddress.target}`,
      `Mint (${tokenAddress.target})`,
      async () => await tokenAddress.unprotectedMint(from, amount)
    );
    await deploy.send(
      `approve_${tokenAddress.target}`,
      `Approve (${tokenAddress.target})`,
      async () => await tokenAddress.connect(from).approve(contracts.borrowerOperations, amount)
    );
  }

  const od = isMockPyth
    ? await generatePriceUpdateDataWithFee(contracts)
    : await generatePriceUpdateDataWithFeeViaHermes(contracts);
  await deploy.send(
    `openTrove`,
    `Open Trove`,
    async () => await contracts.borrowerOperations.connect(from).openTrove(colls, od.data, { value: od.fee })
  );

  deploy.closeCategory();
}

async function deploySwapPool(contracts, deploy, isMockPyth, [token, symbol, tokenAmount, stableAmount]) {
  const from = (await ethers.getSigners())[0];
  deploy.openCategory(`Pool ${token.target} = ${symbol}`);

  // minting
  await deploy.send(
    `mint_pool_a_${token.target}`,
    `Mint (${token.target})`,
    async () => await token.unprotectedMint(from, tokenAmount)
  );
  await deploy.send(
    `mint_pool_b_${token.target}`,
    `Mint (Stable)`,
    async () => await contracts.STABLE.unprotectedMint(from, stableAmount)
  );

  // approve
  await deploy.send(`approve_pool_a_${token.target}`, `Approve (${token.target})`, async () =>
    token.approve(contracts.swapOperations.target, MaxUint256)
  );
  await deploy.send(`approve_pool_b_${token.target}`, `Approve (Stable)`, async () =>
    contracts.STABLE.approve(contracts.swapOperations.target, MaxUint256)
  );

  // deploy pair
  const pair = await deploy.deploy(
    `deploy_pool_${token.target}`,
    'SwapPair',
    async () => await (await ethers.getContractFactory('SwapPair')).deploy(contracts.swapOperations.target),
    `Deploy swap pair`
  );
  await deploy.send(`init_pool_${token.target}`, `Init pool`, async () =>
    contracts.swapOperations.createPair(pair.target, token, contracts.STABLE)
  );
  await deploy.send(`staking_pool_${token.target}`, `set staking alloc`, async () =>
    contracts.tokenManager.setStakingAllocPoint(pair.target, 1)
  );

  // deploy initial liquidity
  const blockTimestamp = (await ethers.provider.getBlock('latest'))?.timestamp ?? 0;
  const od = isMockPyth
    ? await generatePriceUpdateDataWithFee(contracts)
    : await generatePriceUpdateDataWithFeeViaHermes(contracts);
  await deploy.send(`pool_liquidity_${token.target}`, `mint initial liquidity`, async () =>
    contracts.swapOperations.addLiquidity(
      token,
      contracts.STABLE,
      tokenAmount,
      stableAmount,
      0,
      0,
      {
        meta: { upperHint: ZeroAddress, lowerHint: ZeroAddress, maxFeePercentage: 0 },
        priceUpdateData: od.data,
      },
      blockTimestamp + 60 * 5,
      { value: od.fee }
    )
  );

  deploy.closeCategory();
}

export const deployMockDebtsAndColls = async (
  deploy: DeployHelper,
  contracts: ContractsCore,
  collTokens: number,
  debtTokens: number
) => {
  const colls: MockERC20[] = [];
  const debts: MockDebtToken[] = [];
  const noOracleID = '0x' + BigInt(0).toString(8).padStart(64, '0');

  deploy.openCategory('Deploy');
  {
    // collaterals
    deploy.openCategory('Collaterals');
    for (let n = 0; n < collTokens; n++) {
      const key = `Coll_${n + 1}`;
      const t = await deploy.deploy(
        `deployToken_${key}`,
        `MockERC20`,
        async () => await (await ethers.getContractFactory(`MockERC20`)).deploy(key, key, 18),
        `${key} @ MockERC20`
      );
      colls.push(t);
      initPrice(key, 1000, '0x' + BigInt(n).toString(8).padStart(64, '0'));
    }
    deploy.closeCategory();

    // debts
    deploy.openCategory('Debts');
    for (let n = 0; n < debtTokens; n++) {
      const key = `Debt_${n + 1}`;
      const t = await deploy.deploy(
        `deployToken_${key}`,
        `MockDebtToken`,
        async () =>
          await (
            await ethers.getContractFactory(`MockDebtToken`)
          ).deploy(
            contracts.troveManager,
            contracts.redemptionOperations,
            contracts.borrowerOperations,
            contracts.tokenManager,
            contracts.swapOperations,
            contracts.priceFeed,
            key,
            key,
            '1',
            false
          ),
        `${key} @ MockDebtToken`
      );
      debts.push(t);
      initPrice(
        key,
        1000,
        '0x' +
          BigInt(n + 10000)
            .toString(8)
            .padStart(64, '0')
      );
    }
    deploy.closeCategory();
  }
  deploy.closeCategory();

  deploy.openCategory('Config');
  {
    // add tokens to token manager
    deploy.openCategory('Add Tokens');
    {
      // debt tokens
      deploy.openCategory('Debt');
      for (let n = 0; n < debts.length; n++) {
        const key = `Debt_${n + 1}`;
        await deploy.send(
          `addDebt_${key}`,
          `addDebt (${key}) => [${getPriceId(key)}]`,
          async () =>
            await contracts.tokenManager.addDebtToken(
              debts[n],
              '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b'
            ) //getPriceId(key))
        );
      }
      deploy.closeCategory();
    }
    {
      // coll tokens
      deploy.openCategory('Coll');
      for (let n = 0; n < colls.length; n++) {
        const key = `Coll_${n + 1}`;
        await deploy.send(
          `addColl_${key}`,
          `addColl_ (${key}) => [${getPriceId(key)}]`,
          async () =>
            await contracts.tokenManager.addCollToken(
              colls[n],
              parseUnits('1.1'),
              '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
              false
            ) //getPriceId(key), false)
        );
      }
      deploy.closeCategory();
    }
    deploy.closeCategory();

    // mock pyth
    deploy.openCategory('MockPyth');
    await initOracle(contracts as any);
    deploy.closeCategory();
  }
  deploy.closeCategory();

  /*
  // alternative price feed
  deploy.openCategory('Alternative PriceFeed');
  {
    const trustedTime = 24 * 60 * 60; // 1 day

    deploy.openCategory('Debt');
    for (let n = 0; n < debts.length; n++) {
      const key = `Debt_${n + 1}`;
      await deploy.send(
        `setFallbackTrustedTimespan_${key}`,
        `setFallbackTrustedTimespan (${key})`,
        async () => await contracts.alternativePriceFeed.setFallbackTrustedTimespan(debts[n], trustedTime)
      );
      await deploy.send(
        `setFallbackPrices_${key}`,
        `setFallbackPrices (${key})`,
        async () =>
          await contracts.alternativePriceFeed.setFallbackPrices([
            { tokenAddress: debts[n].target, amount: parseUnits('1000') },
          ])
      );
    }
    deploy.closeCategory();

    // coll tokens
    deploy.openCategory('Coll');
    for (let n = 0; n < colls.length; n++) {
      const key = `Coll_${n + 1}`;
      await deploy.send(
        `setFallbackTrustedTimespan_${key}`,
        `setFallbackTrustedTimespan (${key})`,
        async () => await contracts.alternativePriceFeed.setFallbackTrustedTimespan(colls[n], trustedTime)
      );
      await deploy.send(
        `setFallbackPrices_${key}`,
        `setFallbackPrices (${key})`,
        async () =>
          await contracts.alternativePriceFeed.setFallbackPrices([
            { tokenAddress: colls[n].target, amount: parseUnits('1000') },
          ])
      );
    }
    deploy.closeCategory();
  }
  deploy.closeCategory();
  */

  return { colls, debts };
};
