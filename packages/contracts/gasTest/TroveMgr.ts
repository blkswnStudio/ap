import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { MockDebtToken, MockERC20, TroveManager, BorrowerOperations } from '../typechain';
import { expect } from 'chai';
import {
  openTrove,
  deployTesting,
  addColl,
  withdrawalColl,
  getTroveEntireDebt,
  increaseDebt,
  repayDebt,
  closeTrove,
  deployTestMockDebtsAndColls,
  createTokenAmountList,
} from '../utils/testHelper';
import { MakeDescribeFunctions, logGasMetricTopic, makeDescribe, resetGasMetricByTopic } from '../utils/gasHelper';
import { parseUnits } from 'ethers';
import { Contracts } from '../utils/deployTestBase';
import config from './config.json';

describe('TroveManager', () => {
  let signers: SignerWithAddress[];
  let owner: SignerWithAddress;

  let STABLE: MockDebtToken;

  let colls: MockERC20[];
  let debts: MockDebtToken[];

  let contracts: Contracts;
  let troveManager: TroveManager;

  const open = async (user: SignerWithAddress, collAmount: bigint, debtAmount: bigint) => {
    return await openTrove({
      from: user,
      contracts,
      colls: createTokenAmountList(colls, config.trove.coll, collAmount),
      debts: debtAmount === parseUnits('0') ? [] : createTokenAmountList(debts, config.trove.debt, debtAmount),
    });
  };

  before(async () => {
    signers = await ethers.getSigners();
    [owner] = signers;
    resetGasMetricByTopic();
  });

  beforeEach(async () => {
    contracts = await deployTesting(false);

    const cd = await deployTestMockDebtsAndColls(contracts, config.tokens.coll, config.tokens.debt);
    colls = cd.colls;
    debts = cd.debts;

    troveManager = contracts.troveManager;

    STABLE = contracts.STABLE;

    await troveManager.connect(owner).setEnableMintingOnClosedHours(true);
  });

  makeDescribe('Open Trove', async (accs: SignerWithAddress[], funcs: MakeDescribeFunctions) => {
    funcs.setTopic('Open Trove');
    for (const acc of accs) {
      // open
      const tx = await open(acc, parseUnits('10'), parseUnits('1'));
      funcs.appendGas(tx);
    }
  });

  makeDescribe('Close Trove', async (accs: SignerWithAddress[], funcs: MakeDescribeFunctions) => {
    funcs.setTopic('Close Trove');
    // open initial trove
    await open(owner, parseUnits('10000'), parseUnits('1'));

    // open all
    for (const acc of accs) await open(acc, parseUnits('1000'), parseUnits('1'));

    // close all
    for (const acc of accs) {
      // to compensate borrowing fees
      for (const d of debts) await d.connect(owner).unprotectedMint(acc, parseUnits('2'));
      await STABLE.connect(owner).unprotectedMint(acc, parseUnits('100'));

      // close
      const tx = await closeTrove(acc, contracts);
      funcs.appendGas(tx);

      // check
      const status = (await troveManager.Troves(acc)).status;
      expect(status).to.be.equal(2n);
    }
  });

  makeDescribe('Add Collateral', async (accs: SignerWithAddress[], funcs: MakeDescribeFunctions) => {
    funcs.setTopic('Add Collateral');
    // open initial trove
    await open(owner, parseUnits('10000'), parseUnits('1'));

    // open all
    const collAmounts: bigint[] = [];
    for (const acc of accs) {
      // open
      await open(acc, parseUnits('10'), parseUnits('1'));

      // get collateral
      const collBefore = (await troveManager.getTroveColl(acc)).find(
        f => f.tokenAddress === colls[0].target.toString()
      )!.amount;
      collAmounts.push(collBefore);
    }

    // add collateral
    const collTopUp = parseUnits('1');
    for (const acc of accs) {
      // add collateral
      const tx = await addColl(acc, contracts, createTokenAmountList(colls, config.trove.coll, collTopUp), true);
      funcs.appendGas(tx);

      // check
      const status = (await troveManager.Troves(acc)).status;
      const collAfter = (await troveManager.getTroveColl(acc)).find(
        f => f.tokenAddress === colls[0].target.toString()
      )!.amount;
      expect(collAfter).to.be.equal(collAmounts[accs.indexOf(acc)] + collTopUp);
      expect(status).to.be.equal(1n);
    }
  });

  makeDescribe('Withdraw Collateral', async (accs: SignerWithAddress[], funcs: MakeDescribeFunctions) => {
    funcs.setTopic('Withdraw Collateral');
    // open initial trove
    await open(owner, parseUnits('10000'), parseUnits('1'));

    // open all
    for (const acc of accs) await open(acc, parseUnits('100'), parseUnits('1'));

    // withdraw collateral
    for (const acc of accs) {
      // withdraw collateral
      const tx = await withdrawalColl(acc, contracts, createTokenAmountList(colls, config.trove.coll, parseUnits('1')));
      funcs.appendGas(tx);

      // check
      const status = (await troveManager.Troves(acc)).status;
      expect(status).to.be.equal(1n);
    }
  });

  makeDescribe('Increase Debt', async (accs: SignerWithAddress[], funcs: MakeDescribeFunctions) => {
    funcs.setTopic('Increase Debt');
    // open initial trove
    await open(owner, parseUnits('10000'), parseUnits('1'));

    // open all
    for (const acc of accs) await open(acc, parseUnits('1000'), parseUnits('1'));

    // increase debt
    for (const acc of accs) {
      // check before
      const debtBefore = await getTroveEntireDebt(contracts, acc);
      expect(debtBefore).to.be.gt(0n);

      // increase
      const tx = await increaseDebt(acc, contracts, [{ tokenAddress: STABLE, amount: parseUnits('100') }]);
      funcs.appendGas(tx.tx);

      // check after
      const debtAfter = await getTroveEntireDebt(contracts, acc);
      expect(debtAfter - debtBefore).to.be.equal(parseUnits('100') + parseUnits('100') / 200n);
    }
  });

  makeDescribe('Repay Debt', async (accs: SignerWithAddress[], funcs: MakeDescribeFunctions) => {
    funcs.setTopic('Repay Debt');
    // open initial trove
    await open(owner, parseUnits('1000'), parseUnits('1'));

    // open all
    const borrowAmount = parseUnits('1');
    for (const acc of accs) await open(acc, parseUnits('10'), borrowAmount);

    // repay debt
    for (const acc of accs) {
      // mint
      for (const d of debts) await d.connect(owner).unprotectedMint(acc, borrowAmount / 10n);

      // repay
      const tx = await repayDebt(acc, contracts, createTokenAmountList(debts, config.trove.debt, borrowAmount / 10n));
      funcs.appendGas(tx.tx);
    }
  });

  after(() => {
    logGasMetricTopic();
  });
});
