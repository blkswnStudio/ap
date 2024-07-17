import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import {
  MockDebtToken,
  MockERC20,
  TroveManager,
  SwapPair,
  SwapOperations,
  MockPyth,
  StakingOperations,
} from '../typechain';
import { expect } from 'chai';
import {
  openTrove,
  getLatestBlockTimestamp,
  deployTesting,
  createPoolPair,
  deployTestMockDebtsAndColls,
} from '../utils/testHelper';
import { MakeDescribeFunctions, logGasMetricTopic, makeDescribe, resetGasMetricByTopic } from '../utils/gasHelper';
import { ContractTransactionResponse, parseUnits } from 'ethers';
import { Contracts } from '../utils/deployTestBase';
import { OracleUpdateDataAndFee, generatePriceUpdateData, generatePriceUpdateDataWithFee } from '../utils/pythHelper';
import config from './config.json';

describe('SwapOperations', () => {
  let signers: SignerWithAddress[];
  let owner: SignerWithAddress;

  let STABLE: MockDebtToken;
  let STOCK: MockDebtToken;
  let BTC: MockERC20;

  let colls: MockERC20[];
  let debts: MockDebtToken[];

  let contracts: Contracts;
  let troveManager: TroveManager;
  let swapOperations: SwapOperations;
  let stakingOperations: StakingOperations;
  let pyth: MockPyth;

  let oracleData: OracleUpdateDataAndFee;

  const open = async (user: SignerWithAddress, collAmount: bigint, debtAmount: bigint) => {
    return await openTrove({
      from: user,
      contracts,
      colls: [{ tokenAddress: BTC, amount: collAmount }],
      debts: debtAmount === parseUnits('0') ? [] : [{ tokenAddress: STABLE, amount: debtAmount }],
    });
  };

  const deadline = async (): Promise<number> => {
    return (await getLatestBlockTimestamp()) + 100;
  };

  const getPair = async (tokenB: MockDebtToken | MockERC20): Promise<SwapPair> => {
    return await ethers.getContractAt('SwapPair', await swapOperations.getPair(STABLE, tokenB));
  };

  const add = async (
    user: SignerWithAddress,
    tokenB: MockDebtToken | MockERC20,
    amountA: bigint,
    amountB: bigint,
    mint: boolean = true
  ): Promise<{ pair: SwapPair; tx: ContractTransactionResponse }> => {
    // mint
    if (mint) {
      await STABLE.unprotectedMint(user, amountA);
      await tokenB.unprotectedMint(user, amountB);
    }

    // approve
    await STABLE.connect(user).approve(swapOperations, amountA);
    await tokenB.connect(user).approve(swapOperations, amountB);

    // add liquidty to pair
    const tx = await swapOperations
      .connect(user)
      .addLiquidity(STABLE, tokenB, amountA, amountB, 0, 0, await priceUpdateAndMintMeta(), await deadline(), {
        value: oracleData.fee,
      });

    const pair = await getPair(tokenB);
    return { pair, tx };
  };

  const mintMeta = async (): IBase.MintMetaStruct => {
    return [
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      await swapOperations.MAX_BORROWING_FEE(),
    ];
  };

  const priceUpdateAndMintMeta = async (): IBase.PriceUpdateAndMintMetaStruct => {
    return [await mintMeta(), await generatePriceUpdateData(pyth)];
  };

  const remove = async (signer: SignerWithAddress, tokenB: MockDebtToken | MockERC20, amount: bigint) => {
    //remove liquidity
    return await swapOperations
      .connect(signer)
      .removeLiquidity(
        STABLE,
        tokenB,
        amount,
        0,
        0,
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        await deadline(),
        oracleData.data,
        {
          value: oracleData.fee,
        }
      );
  };

  before(async () => {
    signers = await ethers.getSigners();
    [owner] = signers;
    resetGasMetricByTopic();
  });

  beforeEach(async () => {
    contracts = await deployTesting();

    const cd = await deployTestMockDebtsAndColls(contracts, config.tokens.coll, config.tokens.debt);
    colls = cd.colls;
    debts = cd.debts;

    troveManager = contracts.troveManager;
    swapOperations = contracts.swapOperations;
    stakingOperations = contracts.stakingOperations;
    pyth = contracts.pyth;

    STABLE = contracts.STABLE;
    STOCK = contracts.STOCK;
    BTC = contracts.BTC;

    oracleData = await generatePriceUpdateDataWithFee(contracts);

    // create stable-stock pair and provide initial liquidity
    await createPoolPair(contracts, STABLE, STOCK);
    await add(owner, STOCK, parseUnits('15000'), parseUnits('100'), true);
  });

  makeDescribe('Swap', async (accs: SignerWithAddress[], funcs: MakeDescribeFunctions) => {
    funcs.setTopic('Swap');
    for (const acc of accs) {
      // mint & approve
      await STABLE.unprotectedMint(acc, parseUnits('1'));
      await STABLE.connect(acc).approve(swapOperations, parseUnits('1'));

      // swap
      const tx = await swapOperations
        .connect(acc)
        .swapExactTokensForTokens(parseUnits('1'), 0, [STABLE, STOCK], acc, await deadline(), oracleData.data, {
          value: oracleData.fee,
        });
      expect(await STOCK.balanceOf(acc)).to.be.greaterThan(0);

      // get gas
      await funcs.appendGas(await tx);
    }
  });

  makeDescribe('Long', async (accs: SignerWithAddress[], funcs: MakeDescribeFunctions) => {
    funcs.setTopic('Long');
    for (const acc of accs) {
      // open trove
      await open(acc, parseUnits('1'), parseUnits('150'));

      // open STOCK long
      const tx = await swapOperations
        .connect(acc)
        .openLongPosition(parseUnits('1'), 0, STOCK, acc, await mintMeta(), await deadline(), oracleData.data, {
          value: oracleData.fee,
        });
      expect(await STOCK.balanceOf(acc)).to.greaterThan(parseUnits('0'));

      // get gas
      await funcs.appendGas(tx);
    }
  });

  makeDescribe('Short', async (accs: SignerWithAddress[], funcs: MakeDescribeFunctions) => {
    funcs.setTopic('Short');
    for (const acc of accs) {
      // open trove
      await open(acc, parseUnits('1'), parseUnits('150'));

      // open STOCK long
      const tx = await swapOperations
        .connect(acc)
        .openShortPosition(parseUnits('1'), 0, STOCK, acc, await mintMeta(), await deadline(), oracleData.data, {
          value: oracleData.fee,
        });
      expect(await STABLE.balanceOf(acc)).to.greaterThan(parseUnits('0'));

      // get gas
      await funcs.appendGas(tx);
    }
  });

  describe('Add Liquidity', () => {
    makeDescribe('without borrow', async (accs: SignerWithAddress[], funcs: MakeDescribeFunctions) => {
      funcs.setTopic('Add Liquidity / without borrow');
      const amount = parseUnits('1000');

      //create pair & add liquidity (owner)
      await add(owner, STOCK, amount, amount, true);

      for (const acc of accs) {
        //add liquidty
        const { pair, tx } = await add(acc, STOCK, amount, amount, true);
        expect(await stakingOperations.balanceOf(pair, acc)).to.be.greaterThan(0);

        // get gas
        await funcs.appendGas(tx);
      }
    });

    makeDescribe('with borrow', async (accs: SignerWithAddress[], funcs: MakeDescribeFunctions) => {
      funcs.setTopic('Add Liquidity / with borrow');
      const amount = parseUnits('1000');

      //create pair & add liquidity (owner)
      await add(owner, STOCK, amount, amount, true);

      for (const acc of accs) {
        //open trove
        await open(acc, parseUnits('1000', 8), parseUnits('150'));

        //add liquidty without tokens
        const { pair, tx } = await add(acc, STOCK, amount, amount, false);
        expect(await stakingOperations.balanceOf(pair, acc)).to.be.greaterThan(0);

        // get gas
        await funcs.appendGas(tx);
      }
    });
  });

  describe('Remove Liquidity', () => {
    makeDescribe('without repay', async (accs: SignerWithAddress[], funcs: MakeDescribeFunctions) => {
      funcs.setTopic('Remove Liquidity / without repay');
      const amount = parseUnits('1000');

      //create pair & add liquidity (owner)
      const { pair } = await add(owner, STOCK, amount, amount, true);

      for (const acc of accs) {
        //add liquidity
        await add(acc, STOCK, amount, amount, true);

        //remove liquidty
        const tx = await remove(acc, STOCK, await stakingOperations.balanceOf(pair, acc));
        expect(await stakingOperations.balanceOf(pair, acc)).to.be.equal(0);

        // get gas
        await funcs.appendGas(tx);
      }
    });

    makeDescribe('with repay', async (accs: SignerWithAddress[], funcs: MakeDescribeFunctions) => {
      funcs.setTopic('Remove Liquidity / with repay');
      const amount = parseUnits('1000');

      //create pair & add liquidity (owner)
      const { pair } = await add(owner, STOCK, amount, amount, true);

      for (const acc of accs) {
        //add liquidity
        await add(acc, STOCK, amount, amount, true);

        //open trove
        await open(acc, parseUnits('1', 8), parseUnits('150'));

        //remove liquidity
        const tx = await remove(acc, STOCK, await stakingOperations.balanceOf(pair, acc));
        expect(await stakingOperations.balanceOf(pair, acc)).to.be.equal(0);
        expect(
          (await troveManager.getTroveRepayableDebts(acc)).find(({ tokenAddress }) => tokenAddress === STABLE.target)
            ?.amount
        ).to.be.equal(0);

        // get gas
        await funcs.appendGas(tx);
      }
    });
  });

  after(() => {
    logGasMetricTopic();
  });
});
