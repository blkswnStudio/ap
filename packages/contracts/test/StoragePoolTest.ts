import { ethers } from 'hardhat';
import { MockDebtToken, MockERC20, StoragePool, MockBorrowerOperations } from '../typechain';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { assertRevert, buildPriceCache, deployTesting } from '../utils/testHelper';
import { assert, expect } from 'chai';
import { parseUnits } from 'ethers';
import { Contracts } from '../utils/deployTestBase';

describe('StoragePool', () => {
  const oneBTC = parseUnits('1', 8);
  const oneSTABLE = parseUnits('1');

  let signers: SignerWithAddress[];
  let alice: SignerWithAddress;

  let STABLE: MockDebtToken;
  let BTC: MockERC20;
  let USDT: MockERC20;
  let STOCK: MockDebtToken;

  let storagePool: StoragePool;
  let borrowerOperations: MockBorrowerOperations;
  let contracts: Contracts;

  before(async () => {
    signers = await ethers.getSigners();
    [, , , , , alice] = signers;
  });

  beforeEach(async () => {
    contracts = await deployTesting();

    borrowerOperations = contracts.borrowerOperations;
    storagePool = contracts.storagePool;
    USDT = contracts.USDT;
    STABLE = contracts.STABLE;
    BTC = contracts.BTC;
    STOCK = contracts.STOCK;
  });

  describe('StoragePool Mechanisms', () => {
    describe('addValue()', () => {
      it('addValue() revert if caller is neither borrowerOperationsAddress nor troveManagerAddress nor stabilityPoolManagerAddress for all _poolType', async () => {
        await assertRevert(storagePool.addValue(STABLE, false, 0, 1), 'NotFromBOorTroveMorSP');
      });

      it('addValue(): increases the recorded token debt by the correct amount', async () => {
        await borrowerOperations.testStoragePool_addValue(STABLE, false, 0, 100n);

        const tokenDebt_balanceAfter = await storagePool.getValue(STABLE, false, 0);
        assert.equal(tokenDebt_balanceAfter, 100n);
      });

      it('addValue(): emits "StoragePoolValueUpdated" event with expected arguments', async () => {
        const tx = borrowerOperations.testStoragePool_addValue(STABLE, false, 0, 100n);

        await expect(tx).to.emit(storagePool, 'StoragePoolValueUpdated').withArgs(STABLE.target, false, 0, 100n);
      });
    });

    describe('subtractValue()', () => {
      it('subtractValue() revert if caller is neither borrowerOperationsAddress nor troveManagerAddress nor stabilityPoolManagerAddress for all _poolType', async () => {
        await assertRevert(storagePool.subtractValue(STABLE, false, 0, 1), 'NotFromBOorTroveMorSP');
      });

      it('subtractValue() revert if the token does not yet have an entry', async () => {
        await assertRevert(
          borrowerOperations.testStoragePool_subtractValue(STABLE, false, 0, 100n),
          'PoolEntryDoesntExist'
        );
      });

      it('subtractValue(): decreases the recorded token debt by the correct amount', async () => {
        // First add anything to add default pool entry
        await borrowerOperations.testStoragePool_addValue(STABLE, false, 0, 101n);
        await borrowerOperations.testStoragePool_subtractValue(STABLE, false, 0, 100n);

        const tokenDebt_balanceAfter = await storagePool.getValue(STABLE, false, 0);
        assert.equal(tokenDebt_balanceAfter, 1n);
      });

      it('subtractValue(): emits "StoragePoolValueUpdated" event with expected arguments', async () => {
        await borrowerOperations.testStoragePool_addValue(STABLE, false, 0, 101n);
        const tx = borrowerOperations.testStoragePool_subtractValue(STABLE, false, 0, 100n);

        await expect(tx).to.emit(storagePool, 'StoragePoolValueUpdated').withArgs(STABLE.target, false, 0, 1);
      });
    });

    describe('withdrawalValue()', () => {
      it('withdrawalValue() revert if caller is neither borrowerOperationsAddress nor troveManagerAddress nor stabilityPoolManagerAddress for all _poolType', async () => {
        await assertRevert(storagePool.withdrawalValue(alice, STABLE, false, 0, 1n), 'NotFromBOorTroveMorSP');
      });

      it('withdrawalValue() send token from the storagePool to Alice successfully', async () => {
        // Give storagePool some tokens
        await borrowerOperations.testDebtToken_mint(storagePool, 100n, STABLE);

        await borrowerOperations.testStoragePool_addValue(STABLE, false, 0, 100n);

        await borrowerOperations.testStoragePool_withdrawalValue(alice, STABLE, false, 0, 30n);

        const tokenDebt_balanceAfter = await storagePool.getValue(STABLE, false, 0);
        assert.equal(tokenDebt_balanceAfter, 70n);

        const alice_balanceAfter = await STABLE.balanceOf(alice.address);
        assert.equal(alice_balanceAfter, 30n);
      });
    });

    describe('getEntireSystemColl()', () => {
      it('getEntireSystemColl() should return 0 when no collTokens are there', async () => {
        const entireCollateral = await storagePool.getEntireSystemColl(await buildPriceCache(contracts));

        assert.equal(entireCollateral, 0n);
      });

      it('getEntireSystemColl() should return the complete dollar value of all collateral tokens', async () => {
        // add and remove value
        await borrowerOperations.testStoragePool_addValue(USDT, true, 0, oneSTABLE);
        await borrowerOperations.testStoragePool_subtractValue(USDT, true, 0, oneSTABLE);

        // Should all be added up
        await borrowerOperations.testStoragePool_addValue(USDT, true, 1, oneSTABLE);
        await borrowerOperations.testStoragePool_addValue(BTC, true, 0, oneBTC);

        // unrelated
        await borrowerOperations.testStoragePool_addValue(STABLE, false, 0, oneSTABLE);

        const entireCollateral = await storagePool.getEntireSystemColl(await buildPriceCache(contracts));
        const twoStablesAndABitcoin = parseUnits('21001');

        assert.equal(entireCollateral, twoStablesAndABitcoin);
      });
    });

    describe('getEntireSystemDebt()', () => {
      it('getEntireSystemDebt() should return 0 when no collTokens are there', async () => {
        const entireCollateral = await storagePool.getEntireSystemDebt(await buildPriceCache(contracts));

        assert.equal(entireCollateral, 0n);
      });

      it('getEntireSystemDebt() should return the complete dollar value of all debt tokens', async () => {
        // Should all be added up
        await borrowerOperations.testStoragePool_addValue(STABLE, false, 0, oneSTABLE);
        await borrowerOperations.testStoragePool_addValue(STABLE, false, 1, oneSTABLE);
        await borrowerOperations.testStoragePool_addValue(STOCK, false, 0, oneSTABLE);

        // unrelated
        await borrowerOperations.testStoragePool_addValue(BTC, true, 0, oneBTC);

        const entireCollateral = await storagePool.getEntireSystemDebt(await buildPriceCache(contracts));
        const threeStablesAndABitcoin = parseUnits('152');

        assert.equal(entireCollateral, threeStablesAndABitcoin);
      });
    });

    describe('transferBetweenTypes()', () => {
      it('transferBetweenTypes() revert if caller is neither borrowerOperationsAddress nor troveManagerAddress nor stabilityPoolManagerAddress for all _poolType)', async () => {
        await assertRevert(storagePool.transferBetweenTypes(BTC, false, 0, 1, oneBTC), 'NotFromBOorTroveMorSP');
      });

      it('transferBetweenTypes() revert if the token does not yet have an entry', async () => {
        await assertRevert(
          borrowerOperations.testStoragePool_transferBetweenTypes(STABLE, false, 0, 1, 10),
          'PoolEntryDoesntExist'
        );
      });

      it('transferBetweenTypes(): exchanges the recorded token balance by the correct amount', async () => {
        // First add anything to add default pool entry
        await borrowerOperations.testStoragePool_addValue(STABLE, false, 0, 100n);
        const tx = borrowerOperations.testStoragePool_transferBetweenTypes(STABLE, false, 0, 1, 10n);

        await expect(tx).to.emit(storagePool, 'StoragePoolValueUpdated').withArgs(STABLE.target, false, 0, 90n);
        await expect(tx).to.emit(storagePool, 'StoragePoolValueUpdated').withArgs(STABLE.target, false, 1, 10n);

        const defaultPoolTokenDebt_balanceAfter = await storagePool.getValue(STABLE, false, 0);
        assert.equal(defaultPoolTokenDebt_balanceAfter, 90n);

        const activePoolTokenDebt_balanceAfter = await storagePool.getValue(STABLE, false, 1);
        assert.equal(activePoolTokenDebt_balanceAfter, 10n);
      });
    });

    describe('checkRecoveryMode()', () => {
      it('checkRecoveryMode(): returns false when enough collateral exists in the system', async () => {
        const collateralAmount = parseUnits('1.5');

        // add twice the amount of debt as collateral to have exactly the border TCR
        await borrowerOperations.testStoragePool_addValue(USDT, true, 0, collateralAmount);
        await borrowerOperations.testStoragePool_addValue(USDT, true, 1, collateralAmount);

        const systemDebtAmount = parseUnits('2');
        await borrowerOperations.testStoragePool_addValue(STABLE, false, 1, systemDebtAmount);

        const [isInRecoveryMode, TCR, entireSystemColl, entireSystemDebt] = await storagePool.checkRecoveryMode();

        assert.isFalse(isInRecoveryMode);
        const expectedCollateralRatio = parseUnits('1.5');
        assert.equal(TCR, expectedCollateralRatio);
        assert.equal(entireSystemColl, collateralAmount + collateralAmount);
        assert.equal(entireSystemDebt, systemDebtAmount);
      });

      it('checkRecoveryMode(): returns true when not enough collateral exists in the system', async () => {
        const collateralAmount = parseUnits('1.5');

        // add twice the amount of debt as collateral to have exactly the border TCR
        await borrowerOperations.testStoragePool_addValue(STABLE, true, 0, collateralAmount);
        await borrowerOperations.testStoragePool_addValue(STABLE, true, 1, collateralAmount);

        const systemDebtAmount = parseUnits('2.01');
        await borrowerOperations.testStoragePool_addValue(STABLE, false, 1, systemDebtAmount);

        const [isInRecoveryMode, TCR, entireSystemColl, entireSystemDebt] = await storagePool.checkRecoveryMode();

        assert.isTrue(isInRecoveryMode);
        const minimumCollateralRatio = parseUnits('1.5');
        // @ts-ignore
        assert.isBelow(TCR, minimumCollateralRatio);
      });
    });
  });

  describe('ActivePool', () => {
    it('getValue(): gets the recorded token balance', async () => {
      const recordedTokenBalance = await storagePool.getValue(BTC, true, 0);

      assert.equal(recordedTokenBalance, 0n);
    });

    it('getValue(): gets the recorded token debt', async () => {
      const recordedTokenDebt = await storagePool.getValue(STABLE, false, 0);

      assert.equal(recordedTokenDebt, 0n);
    });
  });

  describe('DefaultPool', () => {
    it('getValue(): gets the recorded token balance', async () => {
      const recordedTokenBalance = await storagePool.getValue(BTC, true, 1);

      assert.equal(recordedTokenBalance, 0n);
    });

    it('getValue(): gets the recorded token debt', async () => {
      const recordedTokenDebt = await storagePool.getValue(STABLE, false, 1);

      assert.equal(recordedTokenDebt, 0n);
    });

    describe('Authenticated transactions as borrowerOperation', () => {
      it('addValue(): increases the recorded token debt by the correct amount', async () => {
        await borrowerOperations.testStoragePool_addValue(STABLE, false, 1, 100n);

        const tokenDebt_balanceAfter = await storagePool.getValue(STABLE, false, 1);
        assert.equal(tokenDebt_balanceAfter, 100n);
      });

      it('subtractValue(): decreases the recorded token balance by the correct amount', async () => {
        // First add anything to add default pool entry
        await borrowerOperations.testStoragePool_addValue(STABLE, false, 1, 101n);
        await borrowerOperations.testStoragePool_subtractValue(STABLE, false, 1, 100n);

        const tokenDebt_balanceAfter = await storagePool.getValue(STABLE, false, 1);
        assert.equal(tokenDebt_balanceAfter, 1n);
      });

      it('transferBetweenTypes(): exchanges the recorded token balance by the correct amount', async () => {
        // First add anything to add default pool entry
        await borrowerOperations.testStoragePool_addValue(STABLE, false, 1, 100n);
        await borrowerOperations.testStoragePool_transferBetweenTypes(STABLE, false, 1, 0, 10n);

        const defaultPoolTokenDebt_balanceAfter = await storagePool.getValue(STABLE, false, 1);
        assert.equal(defaultPoolTokenDebt_balanceAfter, 90n);

        const activePoolTokenDebt_balanceAfter = await storagePool.getValue(STABLE, false, 0);
        assert.equal(activePoolTokenDebt_balanceAfter, 10n);
      });
    });
  });
});
