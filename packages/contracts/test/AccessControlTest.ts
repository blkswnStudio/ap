import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { MockDebtToken, MockERC20, StabilityPoolManager, StoragePool, TroveManager } from '../typechain';
import { buildPriceCache, deployTesting } from '../utils/testHelper';
import { Contracts } from '../utils/deployTestBase';

describe('Access Control: Apollon functions with the caller restricted to Apollon contract(s)', () => {
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let contracts: Contracts;
  let troveManager: TroveManager;
  let storagePool: StoragePool;
  let stabilityPoolManager: StabilityPoolManager;
  let BTC: MockERC20;
  let stableDebt: MockDebtToken;

  before(async () => {
    [, alice, bob] = await ethers.getSigners();

    // @ts-ignore
    contracts = await deployTesting();
    troveManager = contracts.troveManager;
    storagePool = contracts.storagePool;
    stabilityPoolManager = contracts.stabilityPoolManager;
    BTC = contracts.BTC;
    stableDebt = contracts.STABLE;
  });

  describe('TroveManager', () => {
    // applyPendingRewards
    it('applyPendingRewards(): reverts when called by an account that is not BorrowerOperations', async () => {
      await expect(
        troveManager.applyPendingRewards(bob, await buildPriceCache(contracts))
      ).to.be.revertedWithCustomError(troveManager, 'NotFromBorrowerOrRedemptionOps');
    });

    // updateRewardSnapshots
    it('updateRewardSnapshots(): reverts when called by an account that is not BorrowerOperations', async () => {
      await expect(troveManager.updateTroveRewardSnapshots(bob)).to.be.revertedWithCustomError(
        troveManager,
        'NotFromBorrowerOrRedemptionOps'
      );
    });

    // removeStake
    it('removeStake(): reverts when called by an account that is not BorrowerOperations', async () => {
      await expect(troveManager.removeStake([[], []], bob)).to.be.revertedWithCustomError(
        troveManager,
        'NotFromBorrowerOrRedemptionOps'
      );
    });

    // updateStakeAndTotalStakes
    it('updateStakeAndTotalStakes(): reverts when called by an account that is not BorrowerOperations', async () => {
      await expect(troveManager.updateStakeAndTotalStakes([[], []], bob)).to.be.revertedWithCustomError(
        troveManager,
        'NotFromBorrowerOrRedemptionOps'
      );
    });

    // closeTrove
    it('closeTrove(): reverts when called by an account that is not BorrowerOperations', async () => {
      await expect(troveManager.closeTroveByProtocol([[], []], bob, 0)).to.be.revertedWithCustomError(
        troveManager,
        'NotFromBorrowerOrRedemptionOps'
      );
    });

    // addTroveOwnerToArray
    it('addTroveOwnerToArray(): reverts when called by an account that is not BorrowerOperations', async () => {
      await expect(troveManager.addTroveOwnerToArray(bob)).to.be.revertedWithCustomError(
        troveManager,
        'NotFromBorrowerOrRedemptionOps'
      );
    });

    // setTroveStatus
    it('setTroveStatus(): reverts when called by an account that is not BorrowerOperations', async () => {
      await expect(troveManager.setTroveStatus(bob, 1)).to.be.revertedWithCustomError(
        troveManager,
        'NotFromBorrowerOrRedemptionOps'
      );
    });

    // increaseTroveColl
    it('increaseTroveColl(): reverts when called by an account that is not BorrowerOperations', async () => {
      await expect(troveManager.increaseTroveColl(bob, [])).to.be.revertedWithCustomError(
        troveManager,
        'NotFromBorrowerOrRedemptionOps'
      );
    });

    // decreaseTroveColl
    it('decreaseTroveColl(): reverts when called by an account that is not BorrowerOperations', async () => {
      await expect(troveManager.decreaseTroveColl(bob, [])).to.be.revertedWithCustomError(
        troveManager,
        'NotFromBorrowerOrRedemptionOps'
      );
    });

    // increaseTroveDebt
    it('increaseTroveDebt(): reverts when called by an account that is not BorrowerOperations', async () => {
      await expect(troveManager.increaseTroveDebt(bob, [])).to.be.revertedWithCustomError(
        troveManager,
        'NotFromBorrowerOrRedemptionOps'
      );
    });

    // decreaseTroveDebt
    it('decreaseTroveDebt(): reverts when called by an account that is not BorrowerOperations', async () => {
      await expect(troveManager.decreaseTroveDebt(bob, [])).to.be.revertedWithCustomError(
        troveManager,
        'NotFromBorrowerOrRedemptionOps'
      );
    });
  });

  describe('StoragePool', () => {
    // withdrawalValue
    it('withdrawalValue(): reverts when called by an account that is not BO nor TroveM nor SP', async () => {
      await expect(storagePool.withdrawalValue(alice, BTC, true, 0, 100)).to.be.revertedWithCustomError(
        storagePool,
        'NotFromBOorTroveMorSP'
      );
    });

    // addValue
    it('addValue(): reverts when called by an account that is not BO nor TroveM', async () => {
      await expect(storagePool.addValue(BTC, true, 0, 100)).to.be.revertedWithCustomError(
        storagePool,
        'NotFromBOorTroveMorSP'
      );
    });

    // subtractValue
    it('subtractValue(): reverts when called by an account that is not BO nor TroveM nor SP', async () => {
      await expect(storagePool.subtractValue(BTC, true, 0, 100)).to.be.revertedWithCustomError(
        storagePool,
        'NotFromBOorTroveMorSP'
      );
    });

    // fallback (payment)
    it('fallback(): reverts when called by an account that is not Borrower Operations nor Default Pool', async () => {
      await expect(
        alice.sendTransaction({
          to: storagePool,
          value: 100n,
        })
      ).to.be.revertedWithoutReason();
    });
  });

  describe('StabilityPoolManager', () => {
    before(async () => {});
    // --- onlyTroveManager ---

    // offset
    it('offset(): reverts when called by an account that is not LiquidationOps', async () => {
      await expect(stabilityPoolManager.offset([[], []], [])).to.be.revertedWithCustomError(
        stabilityPoolManager,
        'NotFromLiquidationOps'
      );
    });

    // --- onlyActivePool ---

    // fallback (payment)
    it('fallback(): reverts when called by an account that is not the Active Pool', async () => {
      await expect(
        alice.sendTransaction({
          to: stabilityPoolManager,
          value: 100n,
        })
      ).to.be.revertedWithoutReason();
    });
  });

  describe('DebtToken', () => {
    // mint
    it('mint(): reverts when called by an account that is not BorrowerOperations', async () => {
      await expect(stableDebt.mint(bob, 100)).to.be.revertedWithCustomError(stableDebt, 'NotFromBorrowerOps');
    });

    // burn
    it('burn(): reverts when called by an account that is not BO nor TroveM nor SP', async () => {
      await expect(stableDebt.burn(bob, 100)).to.be.revertedWithCustomError(
        stableDebt,
        'NotFromBOorTroveMorSPorDebtToken'
      );
    });
  });
});
