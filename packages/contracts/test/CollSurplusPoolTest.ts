import { ethers } from 'hardhat';
import {
  MockERC20,
  MockTroveManager,
  StoragePool,
  LiquidationOperations,
  HintHelpers,
  BorrowerOperations,
  CollSurplusPool,
} from '../typechain';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { TroveStatus, assertRevert, whaleShrimpTroveInit, deployTesting, setPrice } from '../utils/testHelper';
import { assert, expect } from 'chai';
import { Contracts } from '../utils/deployTestBase';
import { generatePriceUpdateDataWithFee } from '../utils/pythHelper';

describe('CollSurplusPool', () => {
  let signers: SignerWithAddress[];
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let BTC: MockERC20;

  let storagePool: StoragePool;
  let troveManager: MockTroveManager;
  let liquidationOperations: LiquidationOperations;
  let borrowerOperations: BorrowerOperations;
  let hintHelpers: HintHelpers;
  let collSurplusPool: CollSurplusPool;
  let contracts: Contracts;

  before(async () => {
    signers = await ethers.getSigners();
    [, , , , , alice, bob] = signers;
  });

  beforeEach(async () => {
    // @ts-ignore
    contracts = await deployTesting();

    troveManager = contracts.troveManager;
    hintHelpers = contracts.hintHelpers;
    liquidationOperations = contracts.liquidationOperations;
    storagePool = contracts.storagePool;
    borrowerOperations = contracts.borrowerOperations;
    collSurplusPool = contracts.collSurplusPool;
    BTC = contracts.BTC;
  });

  describe('getCollateral():', () => {
    it('Returns the Coll balance of the CollSurplusPool after redemption', async () => {
      const eth_1 = await collSurplusPool.getCollateral(alice);
      expect(eth_1.length).to.be.equal(0);
      await whaleShrimpTroveInit(contracts, signers);

      await setPrice('BTC', '2400', contracts);

      //check recovery mode
      const [isRecoveryMode] = await storagePool.checkRecoveryMode();
      assert.isTrue(isRecoveryMode);

      // Confirm alice has ICR > MCR
      const [ICR_B] = await hintHelpers.getCurrentICR(bob);
      expect(ICR_B).to.be.gt(110n);

      const od = await generatePriceUpdateDataWithFee(contracts);
      await liquidationOperations.liquidate(bob, od.data, { value: od.fee });
      expect(await troveManager.getTroveStatus(bob)).to.be.equal(TroveStatus.CLOSED_BY_LIQUIDATION_IN_RECOVERY_MODE);

      const [[, coll_bob]] = await collSurplusPool.getCollateral(bob);

      assert.isTrue(coll_bob > 0n);
    });
  });

  describe('claimColl(): ', () => {
    it('Reverts if caller is not Borrower Operations', async () => {
      await assertRevert(collSurplusPool.connect(alice).claimColl(alice), 'NotFromProtocol');
    });

    it('Reverts if nothing to claim', async () => {
      await borrowerOperations.connect(alice).claimCollateral();
    });

    it('Deletes caller coll surplus balances after coll claim', async () => {
      await whaleShrimpTroveInit(contracts, signers);

      await setPrice('BTC', '2400', contracts);

      //check recovery mode
      const [isRecoveryMode] = await storagePool.checkRecoveryMode();
      assert.isTrue(isRecoveryMode);

      // Confirm alice has ICR > MCR
      const [ICR_B] = await hintHelpers.getCurrentICR(bob);
      expect(ICR_B).to.be.gt(110n);

      const od = await generatePriceUpdateDataWithFee(contracts);
      await liquidationOperations.liquidate(bob, od.data, { value: od.fee });
      expect(await troveManager.getTroveStatus(bob)).to.be.equal(TroveStatus.CLOSED_BY_LIQUIDATION_IN_RECOVERY_MODE);

      const [[, coll_bob]] = await collSurplusPool.getCollateral(bob);

      await borrowerOperations.connect(bob).claimCollateral();

      const coll_bob_after = await collSurplusPool.getCollateral(bob);

      const bobBlance = await BTC.balanceOf(bob);

      assert.equal(bobBlance, coll_bob);
      assert.equal(coll_bob_after.length, 0);
    });
  });

  describe('accountSurplus(): ', () => {
    it('Reverts if caller is not Trove Manager', async () => {
      await assertRevert(collSurplusPool.connect(alice).accountSurplus(alice, []), 'NotFromProtocol');
    });

    it('Patch the collSurplus claim', async () => {
      await whaleShrimpTroveInit(contracts, signers);

      await setPrice('BTC', '2400', contracts);

      //check recovery mode
      const [isRecoveryMode] = await storagePool.checkRecoveryMode();
      assert.isTrue(isRecoveryMode);

      // Confirm alice has ICR > MCR
      const [ICR_B] = await hintHelpers.getCurrentICR(bob);
      expect(ICR_B).to.be.gt(110n);

      const od = await generatePriceUpdateDataWithFee(contracts);
      await liquidationOperations.liquidate(bob, od.data, { value: od.fee });
      expect(await troveManager.getTroveStatus(bob)).to.be.equal(TroveStatus.CLOSED_BY_LIQUIDATION_IN_RECOVERY_MODE);

      const collSurplus = await collSurplusPool.getCollateral(bob);

      expect(collSurplus.length).to.be.equal(1);
    });
  });
});
