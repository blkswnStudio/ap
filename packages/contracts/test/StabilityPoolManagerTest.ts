import { ethers } from 'hardhat';
import { MockDebtToken, MockERC20, StabilityPoolManager } from '../typechain';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { whaleShrimpTroveInit, deployTesting } from '../utils/testHelper';
import { assert, expect } from 'chai';
import { parseUnits } from 'ethers';
import { Contracts } from '../utils/deployTestBase';

describe('StabilityPoolManager', () => {
  let signers: SignerWithAddress[];
  let alice: SignerWithAddress;

  let STABLE: MockDebtToken;
  let USDT: MockERC20;

  let stabilityPoolManager: StabilityPoolManager;
  let contracts: Contracts;

  before(async () => {
    signers = await ethers.getSigners();
    [, , , , , alice] = signers;
  });

  beforeEach(async () => {
    contracts = await deployTesting();

    stabilityPoolManager = contracts.stabilityPoolManager;
    STABLE = contracts.STABLE;
    USDT = contracts.USDT;
  });

  describe('provideStability():', () => {
    it('Should revert if pool does not exist', async () => {
      whaleShrimpTroveInit(contracts, signers, false);

      await expect(
        stabilityPoolManager.connect(alice).provideStability([{ tokenAddress: USDT, amount: parseUnits('1000') }])
      ).to.be.revertedWithCustomError(stabilityPoolManager, 'PoolNotExist');
    });
  });

  describe('withdrawStability():', () => {
    it('Should revert if pool does not exist', async () => {
      whaleShrimpTroveInit(contracts, signers, false);

      await expect(
        stabilityPoolManager.connect(alice).withdrawStability([{ tokenAddress: USDT, amount: parseUnits('1000') }])
      ).to.be.revertedWithCustomError(stabilityPoolManager, 'PoolNotExist');
    });
  });

  describe('getTotalDeposit():', () => {
    it('updates totalDebtDeposits by correct amount', async () => {
      await whaleShrimpTroveInit(contracts, signers, false);

      const totalDeposit_Before = await stabilityPoolManager.getTotalDeposit(STABLE);
      const provideToSP = parseUnits('1000');
      await stabilityPoolManager.connect(alice).provideStability([{ tokenAddress: STABLE, amount: provideToSP }]);
      const totalDeposit_After = await stabilityPoolManager.getTotalDeposit(STABLE);
      assert.equal(totalDeposit_After, totalDeposit_Before + provideToSP);

      await stabilityPoolManager.connect(alice).withdrawStability([{ tokenAddress: STABLE, amount: provideToSP }]);
      const totalDeposit_After_Withdraw = await stabilityPoolManager.getTotalDeposit(STABLE);
      assert.equal(totalDeposit_After_Withdraw, totalDeposit_Before);
    });
  });

  describe('getDepositorDeposits():', async () => {
    it('Should return depositors all deposit', async () => {
      await whaleShrimpTroveInit(contracts, signers, false);

      const provideToSP = parseUnits('1000');
      const depositorDeposits_Before = await stabilityPoolManager.getDepositorDeposits(alice);
      await stabilityPoolManager.connect(alice).provideStability([{ tokenAddress: STABLE, amount: provideToSP }]);
      const depositorDeposits = await stabilityPoolManager.getDepositorDeposits(alice);
      await expect(depositorDeposits_Before[0][1] + provideToSP).to.be.equal(depositorDeposits[0][1]);
    });
  });
});
