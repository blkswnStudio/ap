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
} from '../utils/testHelper';
import { MakeDescribeFunctions, logGasMetricTopic, makeDescribe, resetGasMetricByTopic } from '../utils/gasHelper';
import { parseUnits } from 'ethers';
import { Contracts } from '../utils/deployTestBase';

describe('BorrowerOperations', () => {
  let signers: SignerWithAddress[];
  let owner: SignerWithAddress;

  let STABLE: MockDebtToken;
  let BTC: MockERC20;

  let contracts: Contracts;
  let troveManager: TroveManager;
  let borrowerOperations: BorrowerOperations;

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
    [owner] = signers;
    resetGasMetricByTopic();
  });

  beforeEach(async () => {
    contracts = await deployTesting();

    troveManager = contracts.troveManager;
    borrowerOperations = contracts.borrowerOperations;

    STABLE = contracts.STABLE;
    BTC = contracts.BTC;
  });

  makeDescribe('Open Trove', async (accs: SignerWithAddress[], funcs: MakeDescribeFunctions) => {
    funcs.setTopic('Open Trove');
    for (const acc of accs) {
      // open
      const tx = await open(acc, parseUnits('1', 8), parseUnits('100'));
      funcs.appendGas(tx);
    }
  });

  makeDescribe('Close Trove', async (accs: SignerWithAddress[], funcs: MakeDescribeFunctions) => {
    funcs.setTopic('Close Trove');
    // open initial trove
    await open(owner, parseUnits('1', 8), parseUnits('10000'));

    // open all
    for (const acc of accs) {
      await open(acc, parseUnits('0.02', 8), parseUnits('100'));
    }

    // close all
    for (const acc of accs) {
      // to compensate borrowing fees
      await STABLE.connect(owner).transfer(acc, parseUnits('100'));

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
    await open(owner, parseUnits('1', 8), parseUnits('10000'));

    // open all
    const colls: bigint[] = [];
    for (const acc of accs) {
      // open
      await open(acc, parseUnits('0.02', 8), parseUnits('100'));

      // get colleteral
      const collBefore = (await troveManager.getTroveColl(acc))[0].amount;
      colls.push(collBefore);
    }

    // add collateral
    const collTopUp = parseUnits('1', 8);
    for (const acc of accs) {
      // add collateral
      const tx = await addColl(acc, contracts, [{ tokenAddress: BTC, amount: collTopUp }], true);
      funcs.appendGas(tx);

      // check
      const status = (await troveManager.Troves(acc)).status;
      const collAfter = (await troveManager.getTroveColl(acc))[0].amount;
      expect(collAfter).to.be.equal(colls[accs.indexOf(acc)] + collTopUp);
      expect(status).to.be.equal(1n);
    }
  });

  makeDescribe('Withdraw Collateral', async (accs: SignerWithAddress[], funcs: MakeDescribeFunctions) => {
    funcs.setTopic('Withdraw Collateral');
    // open initial trove
    await open(owner, parseUnits('1', 8), parseUnits('10000'));

    // open all
    for (const acc of accs) {
      await open(acc, parseUnits('1.5', 8), parseUnits('10000'));
    }

    // withdraw collateral
    for (const acc of accs) {
      // withdraw collateral
      const tx = await withdrawalColl(acc, contracts, [{ tokenAddress: BTC, amount: parseUnits('0.1', 8) }]);
      funcs.appendGas(tx);

      // check
      const status = (await troveManager.Troves(acc)).status;
      expect(status).to.be.equal(1n);
    }
  });

  makeDescribe('Increase Debt', async (accs: SignerWithAddress[], funcs: MakeDescribeFunctions) => {
    funcs.setTopic('Increase Debt');
    // open initial trove
    await open(owner, parseUnits('1', 8), parseUnits('10000'));

    // open all
    for (const acc of accs) {
      // open
      await open(acc, parseUnits('1.5', 8), parseUnits('10000'));
    }

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
    await open(owner, parseUnits('1', 8), parseUnits('10000'));

    // open all
    const borrowAmount = parseUnits('10000');
    for (const acc of accs) {
      // open
      await open(acc, parseUnits('1', 8), borrowAmount);
    }

    // repay debt
    for (const acc of accs) {
      // check before
      const debtBefore = await getTroveEntireDebt(contracts, acc);
      expect(debtBefore).to.be.gt(borrowAmount);
      const stableBefore = await STABLE.balanceOf(acc);
      expect(stableBefore).to.be.equal(borrowAmount);

      // repay
      const tx = await repayDebt(acc, contracts, [{ tokenAddress: STABLE, amount: debtBefore / 10n }]);
      funcs.appendGas(tx.tx);

      // check after
      const stableAfter = await STABLE.balanceOf(acc);
      expect(stableAfter).to.be.equal(stableBefore - debtBefore / 10n);
    }
  });

  after(() => {
    logGasMetricTopic();
  });
});
