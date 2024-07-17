import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { MockDebtToken, MockERC20, TroveManager, StabilityPoolManager, LiquidationOperations } from '../typechain';
import { expect } from 'chai';
import { openTrove, deployTesting, setPrice, batchLiquidate } from '../utils/testHelper';
import { MakeDescribeFunctions, logGasMetricTopic, makeDescribe, resetGasMetricByTopic } from '../utils/gasHelper';
import { parseUnits } from 'ethers';
import { Contracts } from '../utils/deployTestBase';

describe('LiquidationOperations', () => {
  let signers: SignerWithAddress[];
  let alice: SignerWithAddress;

  let STABLE: MockDebtToken;
  let BTC: MockERC20;

  let contracts: Contracts;
  let troveManager: TroveManager;
  let stabilityPoolManager: StabilityPoolManager;
  let liquidationOperations: LiquidationOperations;

  const open = async (user: SignerWithAddress, collAmount: bigint, debtAmount: bigint) => {
    return await openTrove({
      from: user,
      contracts,
      colls: [{ tokenAddress: BTC, amount: collAmount }],
      debts: debtAmount === parseUnits('0') ? [] : [{ tokenAddress: STABLE, amount: debtAmount }],
    });
  };

  before(async () => {
    signers = await ethers.getSigners();
    [, alice] = signers;
    resetGasMetricByTopic();
  });

  beforeEach(async () => {
    contracts = await deployTesting();
    troveManager = contracts.troveManager;
    stabilityPoolManager = contracts.stabilityPoolManager;
    liquidationOperations = contracts.liquidationOperations;
    STABLE = contracts.STABLE;
    BTC = contracts.BTC;
  });

  makeDescribe('Batch Liquidate', async (accs: SignerWithAddress[], funcs: MakeDescribeFunctions) => {
    funcs.setTopic('Batch Liquidate');
    // open initial troves
    await open(alice, parseUnits('3', 8), parseUnits('20000'));

    // open troves
    for (const acc of accs) {
      // open
      await open(acc, parseUnits('1', 8), parseUnits('15000'));
    }

    // stability
    await stabilityPoolManager.connect(alice).provideStability([{ tokenAddress: STABLE, amount: parseUnits('10000') }]);

    // drop price
    await setPrice('BTC', '16500', contracts);

    // check ICR
    const MCR = await troveManager.MCR();
    for (const acc of accs) {
      // open
      expect((await hintHelpers.getCurrentICR(acc)).ICR).to.be.lt(MCR);
    }

    // batch liquidate
    const tx = await batchLiquidate(accs, contracts);
    funcs.appendGas(tx);
  });

  after(() => {
    logGasMetricTopic();
  });
});
