import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import {
  MockDebtToken,
  MockERC20,
  TroveManager,
  LiquidationOperations,
  HintHelpers,
  AlternativePriceFeed,
} from '../typechain';
import { expect } from 'chai';
import {
  openTrove,
  deployTesting,
  setPrice,
  batchLiquidate,
  deployTestMockDebtsAndColls,
  createTokenAmountList,
} from '../utils/testHelper';
import { MakeDescribeFunctions, logGasMetricTopic, makeDescribe, resetGasMetricByTopic } from '../utils/gasHelper';
import { parseUnits } from 'ethers';
import { Contracts } from '../utils/deployTestBase';
import config from './config.json';

describe('LiquidationOperations', () => {
  let signers: SignerWithAddress[];
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  let STABLE: MockDebtToken;
  let BTC: MockERC20;

  let colls: MockERC20[];
  let debts: MockDebtToken[];

  let contracts: Contracts;
  let troveManager: TroveManager;
  let hintHelpers: HintHelpers;
  let liquidationOperations: LiquidationOperations;
  let alternativePriceFeed: AlternativePriceFeed;

  const open = async (
    user: SignerWithAddress,
    collAmount: bigint,
    debtAmount: bigint,
    btcAmount: bigint,
    stableAmount: bigint
  ) => {
    return await openTrove({
      from: user,
      contracts,
      colls: [...createTokenAmountList(colls, config.trove.coll, collAmount), { tokenAddress: BTC, amount: btcAmount }],
      debts:
        debtAmount === parseUnits('0')
          ? []
          : [
              ...createTokenAmountList(debts, config.trove.debt, debtAmount),
              { tokenAddress: STABLE, amount: stableAmount },
            ],
    });
  };

  before(async () => {
    signers = await ethers.getSigners();
    [owner, alice] = signers;
    resetGasMetricByTopic();
  });

  beforeEach(async () => {
    contracts = await deployTesting();

    const cd = await deployTestMockDebtsAndColls(contracts, config.tokens.coll, config.tokens.debt);
    colls = cd.colls;
    debts = cd.debts;

    troveManager = contracts.troveManager;
    liquidationOperations = contracts.liquidationOperations;
    hintHelpers = contracts.hintHelpers;
    alternativePriceFeed = contracts.alternativePriceFeed;

    STABLE = contracts.STABLE;
    BTC = contracts.BTC;

    await troveManager.connect(owner).setEnableMintingOnClosedHours(true);
  });

  makeDescribe(
    `Batch Liquidate [${config.liquidations}]`,
    async (accs: SignerWithAddress[], funcs: MakeDescribeFunctions) => {
      funcs.setTopic('Batch Liquidate');

      // open initial troves
      await open(alice, parseUnits('3000000'), parseUnits('1000'), parseUnits('3', 8), parseUnits('20000'));

      // open troves
      for (const acc of accs) await open(acc, 1000n, 1000n, parseUnits('1', 8), parseUnits('15000'));

      // drop price
      await setPrice('BTC', '16500', contracts);

      // check ICR
      const MCR = await troveManager.MCR();
      for (const acc of accs) expect((await hintHelpers['getCurrentICR(address)'](acc)).ICR).to.be.lt(MCR);

      // batch liquidate
      const tx = await batchLiquidate(accs.slice(0, Math.min(accs.length, config.liquidations)), contracts);
      funcs.appendGas(tx);
    }
  );

  after(() => {
    logGasMetricTopic();
  });
});
