import { ethers } from 'hardhat';
import { MockDebtToken, MockERC20, MockTroveManager, BorrowerOperations, SortedTroves } from '../typechain';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  TroveStatus,
  assertRevert,
  openTrove,
  whaleShrimpTroveInit,
  ZERO_ADDRESS,
  deployTesting,
  withdrawalColl,
  redeem,
} from '../utils/testHelper';
import { assert, expect } from 'chai';
import { parseUnits } from 'ethers';
import { Contracts } from '../utils/deployTestBase';
import { OracleUpdateDataAndFee, generatePriceUpdateDataWithFee } from '../utils/pythHelper';

describe('SortedTroves', () => {
  let signers: SignerWithAddress[];
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;
  let whale: SignerWithAddress;
  let dennis: SignerWithAddress;
  let defaulter_1: SignerWithAddress;

  let STABLE: MockDebtToken;
  let BTC: MockERC20;

  let troveManager: MockTroveManager;
  let borrowerOperations: BorrowerOperations;
  let sortedTroves: SortedTroves;
  let contracts: Contracts;

  let oracleData: OracleUpdateDataAndFee;

  before(async () => {
    signers = await ethers.getSigners();
    [, defaulter_1, , whale, alice, bob, carol, dennis] = signers;
  });

  beforeEach(async () => {
    // @ts-ignore
    contracts = await deployTesting();

    troveManager = contracts.troveManager;
    borrowerOperations = contracts.borrowerOperations;
    sortedTroves = contracts.sortedTroves;
    STABLE = contracts.STABLE;
    BTC = contracts.BTC;

    oracleData = await generatePriceUpdateDataWithFee(contracts);
  });

  describe('contains():', () => {
    it('returns true for addresses that have opened troves', async () => {
      //open trove
      await openTrove({
        from: whale,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('5', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('2000') }],
      });
      await openTrove({
        from: alice,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('5', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('2000') }],
      });
      await openTrove({
        from: bob,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('1000') }],
      });

      //check trove status
      const whaleTroveStatus = await troveManager.getTroveStatus(whale.address);
      const aliceTroveStatus = await troveManager.getTroveStatus(alice.address);
      const bobTroveStatus = await troveManager.getTroveStatus(bob.address);

      assert.equal(whaleTroveStatus.toString(), TroveStatus.ACTIVE.toString());
      assert.equal(aliceTroveStatus.toString(), TroveStatus.ACTIVE.toString());
      assert.equal(bobTroveStatus.toString(), TroveStatus.ACTIVE.toString());

      //check sorted list contains trove
      assert.isTrue(await sortedTroves.contains(whale));
      assert.isTrue(await sortedTroves.contains(alice));
      assert.isTrue(await sortedTroves.contains(bob));
    });

    it('returns false for addresses that have not opened troves', async () => {
      //open trove
      await openTrove({
        from: whale,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('5', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('2000') }],
      });
      await openTrove({
        from: alice,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('5', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('2000') }],
      });
      await openTrove({
        from: bob,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('1000') }],
      });

      //check trove status
      const carolTroveStatus = await troveManager.getTroveStatus(carol);
      const dennisTroveStatus = await troveManager.getTroveStatus(dennis);

      assert.equal(carolTroveStatus.toString(), TroveStatus.NON_EXISTENT.toString());
      assert.equal(dennisTroveStatus.toString(), TroveStatus.NON_EXISTENT.toString());

      //check sorted list contains trove
      assert.isFalse(await sortedTroves.contains(carol));
      assert.isFalse(await sortedTroves.contains(dennis));
    });

    it('returns false for addresses that have open and then closed troves', async () => {
      //open trove
      await openTrove({
        from: whale,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('5', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('3000') }],
      });
      await openTrove({
        from: alice,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('5', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('2000') }],
      });
      await openTrove({
        from: bob,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('1000') }],
      });
      await openTrove({
        from: carol,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('5', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('2000') }],
      });

      //to compensate borrowing fee
      await STABLE.connect(whale).transfer(alice, parseUnits('1000'));
      await STABLE.connect(whale).transfer(bob, parseUnits('1000'));
      await STABLE.connect(whale).transfer(carol, parseUnits('1000'));

      //close trove
      await borrowerOperations.connect(alice).closeTrove(oracleData.data, { value: oracleData.fee });
      await borrowerOperations.connect(bob).closeTrove(oracleData.data, { value: oracleData.fee });
      await borrowerOperations.connect(carol).closeTrove(oracleData.data, { value: oracleData.fee });

      //check trove status
      const aliceTroveStatus = await troveManager.getTroveStatus(alice);
      const bobTroveStatus = await troveManager.getTroveStatus(bob);
      const carolTroveStatus = await troveManager.getTroveStatus(carol);

      assert.equal(aliceTroveStatus.toString(), TroveStatus.CLOSED_BY_OWNER.toString());
      assert.equal(bobTroveStatus.toString(), TroveStatus.CLOSED_BY_OWNER.toString());
      assert.equal(carolTroveStatus.toString(), TroveStatus.CLOSED_BY_OWNER.toString());

      //check sorted list contains trove
      assert.isFalse(await sortedTroves.contains(alice));
      assert.isFalse(await sortedTroves.contains(bob));
      assert.isFalse(await sortedTroves.contains(carol));
    });

    it('returns true for addresses that opened, closed and then re-opened a trove', async () => {
      //open trove
      await openTrove({
        from: whale,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('5', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('3000') }],
      });
      await openTrove({
        from: alice,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('5', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('2000') }],
      });
      await openTrove({
        from: bob,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('1000') }],
      });
      await openTrove({
        from: carol,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('5', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('2000') }],
      });

      //to compensate borrowing fee
      await STABLE.connect(whale).transfer(alice, parseUnits('1000'));
      await STABLE.connect(whale).transfer(bob, parseUnits('1000'));
      await STABLE.connect(whale).transfer(carol, parseUnits('1000'));

      //close trove
      await borrowerOperations.connect(alice).closeTrove(oracleData.data, { value: oracleData.fee });
      await borrowerOperations.connect(bob).closeTrove(oracleData.data, { value: oracleData.fee });
      await borrowerOperations.connect(carol).closeTrove(oracleData.data, { value: oracleData.fee });

      //check trove status
      const aliceTroveStatus = await troveManager.getTroveStatus(alice);
      const bobTroveStatus = await troveManager.getTroveStatus(bob);
      const carolTroveStatus = await troveManager.getTroveStatus(carol);

      assert.equal(aliceTroveStatus.toString(), TroveStatus.CLOSED_BY_OWNER.toString());
      assert.equal(bobTroveStatus.toString(), TroveStatus.CLOSED_BY_OWNER.toString());
      assert.equal(carolTroveStatus.toString(), TroveStatus.CLOSED_BY_OWNER.toString());

      //open trove
      await openTrove({
        from: alice,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('5', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('2000') }],
      });
      await openTrove({
        from: bob,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('5', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('1000') }],
      });
      await openTrove({
        from: carol,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('5', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('1000') }],
      });

      //check trove status
      const aliceTroveStatusAfter = await troveManager.getTroveStatus(alice);
      const bobTroveStatusAfter = await troveManager.getTroveStatus(bob);
      const carolTroveStatusAfter = await troveManager.getTroveStatus(carol);

      assert.equal(aliceTroveStatusAfter.toString(), TroveStatus.ACTIVE.toString());
      assert.equal(bobTroveStatusAfter.toString(), TroveStatus.ACTIVE.toString());
      assert.equal(carolTroveStatusAfter.toString(), TroveStatus.ACTIVE.toString());

      //check sorted list contains trove
      assert.isTrue(await sortedTroves.contains(alice));
      assert.isTrue(await sortedTroves.contains(bob));
      assert.isTrue(await sortedTroves.contains(carol));
    });

    it('returns false when there are no troves in the system', async () => {
      assert.isFalse(await sortedTroves.contains(alice));
      assert.isFalse(await sortedTroves.contains(bob));
      assert.isFalse(await sortedTroves.contains(carol));
    });

    it('true when list size is 1 and the trove the only one in system', async () => {
      //open trove
      await openTrove({
        from: whale,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('5', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('3000') }],
      });

      assert.isTrue(await sortedTroves.contains(whale));
    });

    it('false when list size is 1 and the trove is not in the system', async () => {
      //open trove
      await openTrove({
        from: whale,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('5', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('3000') }],
      });

      assert.isFalse(await sortedTroves.contains(alice));
    });
  });

  describe('findInsertPosition():', () => {
    it('No prevId for hint - ascend list starting from nextId, result is after the tail', async () => {
      await whaleShrimpTroveInit(contracts, signers);

      console.log('aa', defaulter_1.address);
      const pos = await sortedTroves.findInsertPosition(parseUnits('100', 16), ZERO_ADDRESS, defaulter_1.address);
      assert.equal(pos[0], defaulter_1.address, 'prevId result should be nextId param');
      assert.equal(pos[1], ZERO_ADDRESS, 'nextId result should be zero');
    });
  });

  describe('validInsertPosition():', () => {
    it('fails if id is zero', async () => {
      const validInsertPosition = await sortedTroves.validInsertPosition(
        parseUnits('100', 16),
        ZERO_ADDRESS,
        ZERO_ADDRESS
      );
      expect(validInsertPosition).to.be.true;
    });
  });

  describe('remove():', () => {
    it('fails if id is not in the list', async () => {
      await assertRevert(sortedTroves.remove(alice));
    });
  });

  describe('troves without coll (only debt) should be removed from the list', () => {
    it('on addColl', async () => {
      //open trove
      await openTrove({
        from: alice,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('5', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('2000') }],
      });
      await openTrove({
        from: bob,
        contracts,
        colls: [{ tokenAddress: STABLE, amount: parseUnits('2000') }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('1000') }],
      });

      //check sorted list contains trove
      assert.isTrue(await sortedTroves.contains(alice));
      assert.isFalse(await sortedTroves.contains(bob));
    });

    it('on withdrawal coll', async () => {
      //open trove
      await openTrove({
        from: alice,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('5', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('2000') }],
      });
      await openTrove({
        from: bob,
        contracts,
        colls: [
          { tokenAddress: BTC, amount: parseUnits('5', 8) },
          { tokenAddress: STABLE, amount: parseUnits('2000') },
        ],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('1000') }],
      });

      //check sorted list contains trove
      assert.isTrue(await sortedTroves.contains(alice));
      assert.isTrue(await sortedTroves.contains(bob));

      await withdrawalColl(bob, contracts, [{ tokenAddress: BTC, amount: parseUnits('5', 8) }]);

      //check sorted list contains trove
      assert.isTrue(await sortedTroves.contains(alice));
      assert.isFalse(await sortedTroves.contains(bob));
    });

    it('on redemption', async () => {
      await openTrove({
        from: bob,
        contracts,
        colls: [
          { tokenAddress: BTC, amount: parseUnits('0.0001', 8) },
          { tokenAddress: STABLE, amount: parseUnits('2000') },
        ],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('1000') }],
      });

      assert.isTrue(await sortedTroves.contains(bob));
      await redeem(bob, parseUnits('500'), contracts);
      assert.isFalse(await sortedTroves.contains(bob)); // no btc in that trove left anymore
    });
  });
});
