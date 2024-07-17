import { ethers } from 'hardhat';
import {
  MockDebtToken,
  MockERC20,
  PriceFeed,
  MockTroveManager,
  StoragePool,
  LiquidationOperations,
  HintHelpers,
  SortedTroves,
} from '../typechain';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  TroveStatus,
  assertRevert,
  getEmittedLiquidationValues,
  openTrove,
  whaleShrimpTroveInit,
  repayDebt,
  setPrice,
  deployTesting,
  buildPriceCache,
  withdrawalColl,
  addColl,
  getTroveStake,
  getTCR,
  liquidate,
  closeTrove,
  batchLiquidate,
  increaseDebt,
} from '../utils/testHelper';
import { assert, expect } from 'chai';
import { parseUnits } from 'ethers';
import { Contracts } from '../utils/deployTestBase';
import { generatePriceUpdateDataWithFee } from '../utils/pythHelper';

describe('LiquidationOperations', () => {
  let signers: SignerWithAddress[];
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;
  let whale: SignerWithAddress;
  let dennis: SignerWithAddress;
  let erin: SignerWithAddress;

  let defaulter_1: SignerWithAddress;
  let defaulter_2: SignerWithAddress;
  let defaulter_3: SignerWithAddress;

  let storagePool: StoragePool;

  let STABLE: MockDebtToken;
  let BTC: MockERC20;
  let STOCK: MockERC20;

  let priceFeed: PriceFeed;
  let troveManager: MockTroveManager;
  let sortedTroves: SortedTroves;

  let liquidationOperations: LiquidationOperations;
  let hintHelpers: HintHelpers;
  let contracts: Contracts;

  before(async () => {
    signers = await ethers.getSigners();
    [, defaulter_1, defaulter_2, defaulter_3, whale, alice, bob, carol, dennis, erin] = signers;
  });

  beforeEach(async () => {
    contracts = await deployTesting();
    priceFeed = contracts.priceFeed;
    troveManager = contracts.troveManager;
    liquidationOperations = contracts.liquidationOperations;
    storagePool = contracts.storagePool;
    hintHelpers = contracts.hintHelpers;
    sortedTroves = contracts.sortedTroves;
    STABLE = contracts.STABLE;
    BTC = contracts.BTC;
    STOCK = contracts.STOCK;
  });

  describe('in Normal Mode', () => {
    describe('liquidate()', () => {
      it('closes a Trove that has ICR < MCR', async () => {
        await whaleShrimpTroveInit(contracts, signers);
        await setPrice('BTC', '5000', contracts);

        const [isRecoveryMode] = await storagePool.checkRecoveryMode();
        assert.isFalse(isRecoveryMode);

        // liquidate
        await liquidate(defaulter_1, contracts);

        const trove = await troveManager.getTroveStatus(defaulter_1);
        assert.equal(trove, 3n); // closedByLiquidation

        const troveStake = await troveManager.getTroveStakes(defaulter_1, BTC.target);
        assert.equal(troveStake, 0n);

        const troveDebt = await troveManager.getTroveDebt(defaulter_1);
        assert.lengthOf(troveDebt, 0);

        const troveColl = await troveManager.getTroveColl(defaulter_1);
        assert.lengthOf(troveColl, 0);
      });

      it('decreases ActivePool collateral by liquidated amount', async () => {
        await whaleShrimpTroveInit(contracts, signers);
        await setPrice('BTC', '5000', contracts);

        const [isRecoveryMode] = await storagePool.checkRecoveryMode();
        assert.isFalse(isRecoveryMode);

        const storageActivePool_Before = await storagePool.getValue(BTC, true, 0);
        const activePoolDebt_Before = await storagePool.getValue(STABLE, false, 0);
        expect(storageActivePool_Before).to.be.gt(parseUnits('1', 8));
        expect(activePoolDebt_Before).to.be.gt(parseUnits('6000'));

        // liquidate
        await liquidate(defaulter_1, contracts);

        const storageActivePool_After = await storagePool.getValue(BTC, true, 0);
        assert.equal(storageActivePool_After, storageActivePool_Before - parseUnits('0.02', 8));

        const borrowedDebt = parseUnits('100');
        const activePoolDebt_After = await storagePool.getValue(STABLE, false, 0);
        assert.equal(
          activePoolDebt_After,
          activePoolDebt_Before - borrowedDebt - (await troveManager.getBorrowingFee(borrowedDebt, true, 0))
        );
      });

      it('increases DefaultPool coll and debt by correct amounts', async () => {
        await whaleShrimpTroveInit(contracts, signers);
        await setPrice('BTC', '5000', contracts);

        const [isRecoveryMode] = await storagePool.checkRecoveryMode();
        assert.isFalse(isRecoveryMode);

        const defaultPoolCollBefore = await storagePool.getValue(BTC, true, 1);
        const defaultPoolDebtBefore = await storagePool.getValue(STABLE, false, 1);
        expect(defaultPoolCollBefore).to.be.equal(0n);
        expect(defaultPoolDebtBefore).to.be.equal(0n);

        // liquidate
        await liquidate(defaulter_1, contracts);

        const liquidatedColl = parseUnits('0.02', 8);
        const defaultPollCollAfter = await storagePool.getValue(BTC, true, 1);
        expect(defaultPollCollAfter).to.be.equal(
          liquidatedColl - (await troveManager.getCollGasCompensation(liquidatedColl))
        );

        const liquidatedDebt = parseUnits('100');
        const defaultPoolDebtAfter = await storagePool.getValue(STABLE, false, 1);
        expect(defaultPoolDebtAfter).to.be.equal(
          liquidatedDebt + (await troveManager.getBorrowingFee(liquidatedDebt, true, 0))
        );
      });

      it("removes the Trove's stake from the total stakes", async () => {
        await whaleShrimpTroveInit(contracts, signers);
        await setPrice('BTC', '5000', contracts);

        const [isRecoveryMode] = await storagePool.checkRecoveryMode();
        assert.isFalse(isRecoveryMode);

        const stakes_Before = await troveManager.totalStakes(BTC);
        assert.equal(stakes_Before, parseUnits('5.04', 8));

        // liquidate
        await liquidate(defaulter_1, contracts);

        const stakes_After = await troveManager.totalStakes(BTC);
        assert.equal(stakes_After, parseUnits('5.02', 8));
      });

      it('Removes the correct trove from the TroveOwners array, and moves the last array element to the new empty slot', async () => {
        await whaleShrimpTroveInit(contracts, signers);

        //price drops
        await setPrice('BTC', '5000', contracts);

        const [isRecoveryMode] = await storagePool.checkRecoveryMode();
        assert.isFalse(isRecoveryMode);

        const totalTroveOwners_before = await troveManager.getTroveOwnersCount();
        assert.equal(totalTroveOwners_before, 7n);

        const bob_arrayIndex = (await troveManager.Troves(bob))[1];
        const alice_arrayIndex = (await troveManager.Troves(alice))[1];
        const defaulter2 = (await troveManager.Troves(defaulter_2))[1];

        const trove_0 = await troveManager.TroveOwners(bob_arrayIndex);
        const trove_1 = await troveManager.TroveOwners(alice_arrayIndex);
        const trove_2 = await troveManager.TroveOwners(defaulter2);

        assert.equal(trove_0, bob.address);
        assert.equal(trove_1, alice.address);
        assert.equal(trove_2, defaulter_2.address);

        // liquidate
        await liquidate(defaulter_1, contracts);

        const totalTroveOwners_after = await troveManager.getTroveOwnersCount();
        assert.equal(totalTroveOwners_after, 6n);

        const bob_arrayIndex_after = (await troveManager.Troves(bob))[1];
        const defaulter_arrayIndex_after = (await troveManager.Troves(defaulter_2))[1];

        const trove_0_after = await troveManager.TroveOwners(bob_arrayIndex_after);
        const trove_1_after = await troveManager.TroveOwners(defaulter_arrayIndex_after);

        assert.equal(trove_0_after, bob.address);
        assert.equal(trove_1_after, defaulter_2.address);
      });

      it('updates the snapshots of total stakes and total collateral', async () => {
        await whaleShrimpTroveInit(contracts, signers);

        //price drops
        await setPrice('BTC', '5000', contracts);

        const [isRecoveryMode] = await storagePool.checkRecoveryMode();
        assert.isFalse(isRecoveryMode);

        const totalStakes_Before = await troveManager.totalStakes(BTC);
        const totalStakesSnapshot_Before = await troveManager.totalStakesSnapshot(BTC);
        const totalCollateralSnapshot_Before = await troveManager.totalCollateralSnapshots(BTC);

        const totalBTC = parseUnits('5.04', 8);
        assert.equal(totalStakes_Before, totalBTC);
        assert.equal(totalStakesSnapshot_Before, 0n);
        assert.equal(totalCollateralSnapshot_Before, 0n);

        // liquidate
        await liquidate(defaulter_1, contracts);

        const totalStakes_After = await troveManager.totalStakes(BTC);
        const totalStakesSnapshot_After = await troveManager.totalStakesSnapshot(BTC);
        const totalCollateralSnapshot_After = await troveManager.totalCollateralSnapshots(BTC);

        const defaulterBTC = parseUnits('0.02', 8);
        assert.equal(totalStakes_After, totalBTC - defaulterBTC);
        assert.equal(totalStakesSnapshot_After, totalBTC - defaulterBTC);
        assert.equal(
          totalCollateralSnapshot_After,
          totalBTC - (await troveManager.getCollGasCompensation(defaulterBTC))
        );
      });

      it('updates the L_coll reward-per-unit-staked totals', async () => {
        await whaleShrimpTroveInit(contracts, signers);
        await setPrice('BTC', '5000', contracts);

        const [isRecoveryMode] = await storagePool.checkRecoveryMode();
        assert.isFalse(isRecoveryMode);

        // 1. liquidation
        await liquidate(defaulter_1, contracts);

        const defaulterBTC = parseUnits('0.02', 8);
        const defaulterBTCWithoutFee = defaulterBTC - (await troveManager.getCollGasCompensation(defaulterBTC));
        let remainingActiveBTC = parseUnits('5.04', 8) - defaulterBTC;
        const totalStake = await troveManager.totalStakes(BTC);

        // checking liquidated snapshots
        const L_BTC_A = await troveManager.liquidatedTokensPerStake(BTC, BTC, true);
        const L_STABLE_A = await troveManager.liquidatedTokensPerStake(BTC, STABLE, false);
        expect(L_BTC_A).to.be.equal((defaulterBTCWithoutFee * parseUnits('1')) / totalStake);
        expect(L_STABLE_A).to.be.equal((parseUnits('100.5') * parseUnits('1')) / totalStake);

        // checking alice pending btc rewards
        const alicePendingBTC =
          (await troveManager.getPendingRewards(alice, true, false)).find(
            ({ tokenAddress }) => tokenAddress === BTC.target
          )?.amount ?? 0n;
        const aliceBTCCollStake = (parseUnits('1', 8) * parseUnits('1', 8)) / remainingActiveBTC;
        const aliceExpectedBTCPending = (defaulterBTCWithoutFee * aliceBTCCollStake) / parseUnits('1', 8);
        expect(alicePendingBTC - aliceExpectedBTCPending).to.be.lt(5);

        // 2. liquidation
        const defaulterStableRewards =
          (await troveManager.getPendingRewards(defaulter_2, false, true)).find(
            ({ tokenAddress }) => tokenAddress === STABLE.target
          )?.amount ?? 0n;
        const defaulterBTCRewards =
          (await troveManager.getPendingRewards(defaulter_2, true, false)).find(
            ({ tokenAddress }) => tokenAddress === BTC.target
          )?.amount ?? 0n;
        await liquidate(defaulter_2, contracts);

        remainingActiveBTC -= defaulterBTC;

        // checking liquidated snapshots
        const totalStakeB = await troveManager.totalStakes(BTC);
        const L_BTC_B = await troveManager.liquidatedTokensPerStake(BTC, BTC, true);
        const L_STABLE_B = await troveManager.liquidatedTokensPerStake(BTC, STABLE, true);
        expect(
          L_BTC_B - ((2n * defaulterBTCWithoutFee + defaulterBTCRewards) * parseUnits('1')) / totalStakeB
        ).to.be.lt(1);
        expect(
          L_STABLE_B - ((2n * parseUnits('100.5') + defaulterStableRewards) * parseUnits('1')) / totalStakeB
        ).to.be.lt(17000000000000);

        // checking alice pending btc rewards
        const alicePendingBTCB =
          (await troveManager.getPendingRewards(alice, true, false)).find(
            ({ tokenAddress }) => tokenAddress === BTC.target
          )?.amount ?? 0n;
        const aliceBTCCollStakeB = (parseUnits('1', 8) * parseUnits('1', 8)) / remainingActiveBTC;
        const aliceExpectedBTCPendingB = (defaulterBTCWithoutFee * 2n * aliceBTCCollStakeB) / parseUnits('1', 8);
        expect(alicePendingBTCB - aliceExpectedBTCPendingB).to.be.lt(5001);
      });

      it('reverts if trove is non-existent', async () => {
        const od = await generatePriceUpdateDataWithFee(contracts);
        await expect(liquidationOperations.liquidate(alice, od.data, { value: od.fee })).to.be.revertedWithCustomError(
          liquidationOperations,
          'NoLiquidatableTrove'
        );
      });

      it('reverts if trove is already closedByLiquidation', async () => {
        await whaleShrimpTroveInit(contracts, signers);
        await setPrice('BTC', '5000', contracts);
        await liquidate(defaulter_1, contracts);

        const od = await generatePriceUpdateDataWithFee(contracts);
        await expect(
          liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee })
        ).to.be.revertedWithCustomError(liquidationOperations, 'NoLiquidatableTrove');
      });

      it('reverts if trove has been closed', async () => {
        await openTrove({
          from: defaulter_2,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('0.02', 8) }],
        });
        await openTrove({
          from: defaulter_3,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('0.02', 8) }],
        });
        await closeTrove(defaulter_3, contracts);
        const od = await generatePriceUpdateDataWithFee(contracts);
        await expect(
          liquidationOperations.liquidate(defaulter_3, od.data, { value: od.fee })
        ).to.be.revertedWithCustomError(liquidationOperations, 'NoLiquidatableTrove');
      });

      it('does nothing if trove has >= 110% ICR', async () => {
        await whaleShrimpTroveInit(contracts, signers);
        const od = await generatePriceUpdateDataWithFee(contracts);
        await assertRevert(liquidationOperations.liquidate(alice, od.data, { value: od.fee }), 'NoLiquidatableTrove');
      });

      it("does not affect the SP deposit or coll gain when called on an SP depositor's address that has no trove", async () => {
        await whaleShrimpTroveInit(contracts, signers);

        // Bob sends tokens to erin, who has no trove
        await STABLE.connect(bob).transfer(erin, parseUnits('500'));

        // defaulter gets liquidated
        await setPrice('BTC', '5000', contracts);
        await liquidate(defaulter_1, contracts);

        const od = await generatePriceUpdateDataWithFee(contracts);
        await expect(liquidationOperations.liquidate(erin, od.data, { value: od.fee })).to.be.revertedWithCustomError(
          liquidationOperations,
          'NoLiquidatableTrove'
        );
      });

      it("does not alter the liquidated user's token balance", async () => {
        await whaleShrimpTroveInit(contracts, signers);

        const btcBalanceBefore = await BTC.balanceOf(defaulter_1);

        // defaulter gets liquidated
        await setPrice('BTC', '5000', contracts);
        await liquidate(defaulter_1, contracts);

        const btcBalanceAfter = await BTC.balanceOf(defaulter_1);
        assert.equal(btcBalanceBefore, btcBalanceAfter);
      });

      it('liquidates based on entire collateral/debt (including pending rewards), not raw collateral/debt', async () => {
        await whaleShrimpTroveInit(contracts, signers);
        await setPrice('BTC', '5000', contracts);

        const [aliceICRBefore] = await hintHelpers.getCurrentICR(alice);
        const [d1ICRBefore] = await hintHelpers.getCurrentICR(defaulter_1);
        const [d2ICRBefore] = await hintHelpers.getCurrentICR(defaulter_2);
        expect(d1ICRBefore).to.be.equal(d2ICRBefore);

        // defaulter 1 gets liquidated
        await liquidate(defaulter_1, contracts);

        // gets a little bit higher/better because the 200 stable gas comp gets removed as debt from the defaulter, which results in a >110% ICR of the trove even after liquidation
        const [aliceICRAfter] = await hintHelpers.getCurrentICR(alice);
        const [d2ICRAfter] = await hintHelpers.getCurrentICR(defaulter_2);
        expect(aliceICRAfter).to.be.lt(aliceICRBefore); // alice icr gets lower/worse, because it was in the beginning higher then the defaulter's ICR
        expect(d2ICRAfter).to.be.lt(d2ICRBefore);

        // defaulter 2 gets liquidated
        await liquidate(defaulter_2, contracts);

        const [aliceICRAfter2] = await hintHelpers.getCurrentICR(alice);
        expect(aliceICRAfter2).to.be.lt(aliceICRAfter);
      });

      it('closes every Trove with ICR < MCR, when n > number of undercollateralized troves', async () => {
        await openTrove({
          from: alice,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('2000') }],
        });
        await openTrove({
          from: bob,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('2000') }],
        });
        await openTrove({
          from: carol,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('2', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('500') }],
        });
        await openTrove({
          from: whale,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('2', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('500') }],
        });

        // Price drops
        await setPrice('BTC', '1300', contracts);

        // check recovery mode
        const [isRecoveryModeAfter] = await storagePool.checkRecoveryMode();
        assert.isFalse(isRecoveryModeAfter);
        const MCR = await troveManager.MCR();

        // Confirm troves are ICR < 110%
        const aliceICR = (await hintHelpers.getCurrentICR(alice)).ICR;
        expect(aliceICR).to.be.lte(MCR);
        const bobICR = (await hintHelpers.getCurrentICR(bob)).ICR;
        expect(bobICR).to.be.lte(MCR);

        // Confirm ICR > 110% for the rest
        const carolICR = (await hintHelpers.getCurrentICR(carol)).ICR;
        expect(carolICR).to.be.gte(MCR);

        // Confirm Whale has ICR > 110%
        const whaleICR = (await hintHelpers.getCurrentICR(whale)).ICR;
        expect(whaleICR).to.be.gte(MCR);
        const troveLengthBefore = await troveManager.getTroveOwnersCount();

        // liquidateTroves used batch for liquidation
        await batchLiquidate([alice, bob], contracts);

        // Confirm troves are closed by liquidation in normal mode
        const aliceStatus = await troveManager.getTroveStatus(alice);
        expect(aliceStatus).to.be.equal(TroveStatus.CLOSED_BY_LIQUIDATION_IN_NORMAL_MODE);
        const bobStatus = await troveManager.getTroveStatus(bob);
        expect(bobStatus).to.be.equal(TroveStatus.CLOSED_BY_LIQUIDATION_IN_NORMAL_MODE);
        const troveLengthAfter = await troveManager.getTroveOwnersCount();

        // Confirm Troves count
        expect(troveLengthBefore - troveLengthAfter).to.be.equal(2);
      });

      it('a pure redistribution reduces the TCR only as a result of compensation', async () => {
        await openTrove({
          from: alice,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('2', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('8200') }],
        });
        await openTrove({
          from: bob,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('2', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('9700') }],
        });
        await openTrove({
          from: carol,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('2', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('18200') }],
        });
        await openTrove({
          from: dennis,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('2', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('18700') }],
        });
        await openTrove({
          from: whale,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('3', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('10200') }],
        });

        //decrease price
        await setPrice('BTC', '10000', contracts);

        //get entire system coll & debt
        const priceCache = await buildPriceCache(contracts);
        const entireSystemColl_Before = await storagePool.getEntireSystemColl(priceCache);
        const entireSystemDebt_Before = await storagePool.getEntireSystemDebt(priceCache);

        const TCR_0 = await getTCR(contracts);
        const expectedTCR_0 = (entireSystemColl_Before * parseUnits('1')) / entireSystemDebt_Before;
        expect(expectedTCR_0).to.be.equal(TCR_0);

        // Confirm system is not in Recovery Mode
        const [isRecoveryModeBefore] = await storagePool.checkRecoveryMode();
        assert.isFalse(isRecoveryModeBefore);

        // Check TCR does not decrease with each liquidation for carol
        const carolLiquidate = await liquidate(carol, contracts);
        assert.isFalse(await troveManager.isTroveActive(carol));
        const [, , collGasComp_1] = await getEmittedLiquidationValues(carolLiquidate, contracts);
        const btcGasComp_1 = collGasComp_1.find((e: MockERC20[]) => e[0] === BTC.target)[1];
        const btcGasComp_1_USD = await priceFeed['getUSDValue(address,uint256)'](BTC, btcGasComp_1);

        // Expect only change to TCR to be due to the issued gas compensation
        const TCR_1 = await getTCR(contracts);
        const expectedTCR_1 =
          ((entireSystemColl_Before - btcGasComp_1_USD) * parseUnits('1')) / entireSystemDebt_Before;
        expect(expectedTCR_1).to.be.equal(TCR_1);

        // Check TCR does not decrease with each liquidation for dennis
        const denisLiquidate = await liquidate(dennis, contracts);
        const [, , collGasComp_2] = await getEmittedLiquidationValues(denisLiquidate, contracts);
        const btcGasComp_2 = collGasComp_2.find((e: MockERC20[]) => e[0] === BTC.target)[1];
        const btcGasComp_2_USD = await priceFeed['getUSDValue(address,uint256)'](BTC, btcGasComp_2);

        // Expect only change to TCR to be due to the issued gas compensation
        const TCR_2 = await getTCR(contracts);
        const expectedTCR_2 =
          ((entireSystemColl_Before - btcGasComp_1_USD - btcGasComp_2_USD) * parseUnits('1')) / entireSystemDebt_Before;
        expect(expectedTCR_2).to.be.equal(TCR_2);
      });

      it("does not liquidate a SP depositor's trove with ICR > 110%, and does not affect their SP deposit or collateral gain", async () => {
        await openTrove({
          from: whale,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('3', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('10000') }],
        });
        await openTrove({
          from: bob,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('2', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('10000') }],
        });
        await openTrove({
          from: carol,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('10000') }],
        });

        // carol gets liquidated
        await setPrice('BTC', '10000', contracts);
        const [isInRecoveryMode] = await storagePool.checkRecoveryMode();
        assert.isFalse(isInRecoveryMode);
        const liquidateCarol = await liquidate(carol, contracts);
        const [liquidatedDebt, liquidatedColl] = await getEmittedLiquidationValues(liquidateCarol, contracts);
        const liquidateCarolTroveStatus = await troveManager.getTroveStatus(carol);
        assert.equal(liquidateCarolTroveStatus.toString(), TroveStatus.CLOSED_BY_LIQUIDATION_IN_NORMAL_MODE.toString());

        // price increases, dennis ICR > 110% again
        await setPrice('BTC', '17000', contracts);
        const getDennisCurrentICR = (await hintHelpers.getCurrentICR(bob)).ICR;
        expect(getDennisCurrentICR).to.be.gt(parseUnits('110', 16));

        // Attempt to liquidate bob
        const od = await generatePriceUpdateDataWithFee(contracts);
        await expect(liquidationOperations.liquidate(bob, od.data, { value: od.fee })).to.be.revertedWithCustomError(
          liquidationOperations,
          'NoLiquidatableTrove'
        );
        assert.isTrue(await troveManager.isTroveActive(bob));
      });

      it('Liquidates undercollateralized trove if there are two troves in the system', async () => {
        await openTrove({
          from: alice,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('5', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('1000') }],
        });
        await openTrove({
          from: bob,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('1000') }],
        });

        //drop price
        await setPrice('BTC', '1000', contracts);

        // Confirm system is not in Recovery Mode
        const [isRecoveryModeBefore] = await storagePool.checkRecoveryMode();
        assert.isFalse(isRecoveryModeBefore);

        const bobICRAfter = (await hintHelpers.getCurrentICR(bob)).ICR;
        assert.isTrue(bobICRAfter < parseUnits('110', 16));

        const totalActiveTrovesBefore = await troveManager.getTroveOwnersCount();
        assert.equal(totalActiveTrovesBefore.toString(), '2');

        // Confirm system is not in Recovery Mode
        const [isRecoveryModeAfter] = await storagePool.checkRecoveryMode();
        assert.isFalse(isRecoveryModeAfter);

        //liquidate bob
        await liquidate(bob, contracts);
        assert.equal(
          (await troveManager.getTroveStatus(bob)).toString(),
          TroveStatus.CLOSED_BY_LIQUIDATION_IN_NORMAL_MODE.toString()
        );

        const totalActiveTrovesAfter = await troveManager.getTroveOwnersCount();
        assert.equal(totalActiveTrovesAfter.toString(), '1');

        assert.equal((await troveManager.getTroveStatus(alice)).toString(), TroveStatus.ACTIVE.toString());
      });
    });
  });

  describe('batchLiquidateTroves()', () => {
    it('should revert if no troves are passed', async () => {
      await whaleShrimpTroveInit(contracts, signers);

      const od = await generatePriceUpdateDataWithFee(contracts);
      await expect(
        liquidationOperations.batchLiquidateTroves([], od.data, { value: od.fee })
      ).to.be.revertedWithCustomError(liquidationOperations, 'EmptyArray');
    });

    it('closes every trove with ICR < MCR in the given array', async () => {
      await openTrove({
        from: whale,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('3', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('20000') }],
      });
      await openTrove({
        from: alice,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('16000') }],
      });
      await openTrove({
        from: bob,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('15000') }],
      });
      await openTrove({
        from: carol,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('12000') }],
      });
      await openTrove({
        from: dennis,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('11000') }],
      });

      const MCR = await troveManager.MCR();

      //drop price
      await setPrice('BTC', '16500', contracts);

      //check system is not in recovery
      const [isRecoveryMode] = await storagePool.checkRecoveryMode();
      assert.isFalse(isRecoveryMode);

      //confirm troves alice & bob are ICR < 110%
      expect((await hintHelpers.getCurrentICR(alice)).ICR).to.be.lt(MCR);
      expect((await hintHelpers.getCurrentICR(bob)).ICR).to.be.lt(MCR);

      //confirm troves carol & dennis are ICR > 110%
      expect((await hintHelpers.getCurrentICR(carol)).ICR).to.be.gt(MCR);
      expect((await hintHelpers.getCurrentICR(dennis)).ICR).to.be.gt(MCR);

      //confirm whale is ICR > 110%
      expect((await hintHelpers.getCurrentICR(whale)).ICR).to.be.gt(MCR);

      //batch liquidate except whale
      await batchLiquidate([alice, bob, carol, dennis], contracts);

      //check all troves are closed
      const aliceTroveStatus = await troveManager.getTroveStatus(alice);
      assert.equal(aliceTroveStatus.toString(), TroveStatus.CLOSED_BY_LIQUIDATION_IN_NORMAL_MODE.toString());
      const bobTroveStatus = await troveManager.getTroveStatus(bob);
      assert.equal(bobTroveStatus.toString(), TroveStatus.CLOSED_BY_LIQUIDATION_IN_NORMAL_MODE.toString());

      //check carol, denis & whale are still active
      const carolTroveStatus = await troveManager.getTroveStatus(carol);
      assert.equal(carolTroveStatus.toString(), TroveStatus.ACTIVE.toString());
      const dennisTroveStatus = await troveManager.getTroveStatus(dennis);
      assert.equal(dennisTroveStatus.toString(), TroveStatus.ACTIVE.toString());
      const whaleTroveStatus = await troveManager.getTroveStatus(whale);
      assert.equal(whaleTroveStatus.toString(), TroveStatus.ACTIVE.toString());
    });

    it('skips if trove is non-existent', async () => {
      await whaleShrimpTroveInit(contracts, signers);

      const [isRecoveryMode] = await storagePool.checkRecoveryMode();
      assert.isFalse(isRecoveryMode);

      const od = await generatePriceUpdateDataWithFee(contracts);
      await expect(
        liquidationOperations.batchLiquidateTroves([defaulter_3], od.data, { value: od.fee })
      ).to.be.revertedWithCustomError(liquidationOperations, 'NoLiquidatableTrove');
    });

    it('does not close troves with ICR >= MCR in the given array', async () => {
      await setPrice('STOCK', '1', contracts);
      await whaleShrimpTroveInit(contracts, signers, contracts.STOCK);

      const [isRecoveryMode] = await storagePool.checkRecoveryMode();
      assert.isFalse(isRecoveryMode);

      await setPrice('STOCK', '5', contracts);
      const MCR = await troveManager.MCR();

      // Validate ICR >= MCR
      const aliceICR = await hintHelpers.getCurrentICR(alice.address);
      expect(aliceICR[0]).to.be.gte(MCR);

      const bobICR = await hintHelpers.getCurrentICR(bob.address);
      expect(bobICR[0]).to.be.gte(MCR);

      const carolICR = await hintHelpers.getCurrentICR(carol.address);
      expect(carolICR[0]).to.be.gte(MCR);

      const dennisICR = await hintHelpers.getCurrentICR(dennis.address);
      expect(dennisICR[0]).to.be.gte(MCR);

      // Validate ICR < MCR
      const defaulter_1ICR = await hintHelpers.getCurrentICR(defaulter_1.address);
      expect(defaulter_1ICR[0]).to.be.lte(MCR);

      const defaulter_2ICR = await hintHelpers.getCurrentICR(defaulter_2.address);
      expect(defaulter_2ICR[0]).to.be.lte(MCR);

      // Batch liquidate all the troves
      await batchLiquidate([alice, bob, carol, dennis, defaulter_1, defaulter_2], contracts);

      // Validate Troves with ICR >= MCR are not liquidated
      const aliceTrove = await troveManager.getTroveStatus(alice.address);
      expect(aliceTrove).to.be.equal(TroveStatus.ACTIVE);

      const bobTrove = await troveManager.getTroveStatus(bob.address);
      expect(bobTrove).to.be.equal(TroveStatus.ACTIVE);

      const carolTrove = await troveManager.getTroveStatus(carol.address);
      expect(carolTrove).to.be.equal(TroveStatus.ACTIVE);

      const dennisTrove = await troveManager.getTroveStatus(dennis.address);
      expect(dennisTrove).to.be.equal(TroveStatus.ACTIVE);

      // Validate Troves with ICR < MCR are liquidated
      const defaulter_1Trove = await troveManager.getTroveStatus(defaulter_1.address);
      expect(defaulter_1Trove).to.be.equal(TroveStatus.CLOSED_BY_LIQUIDATION_IN_NORMAL_MODE);

      const defaulter_2Trove = await troveManager.getTroveStatus(defaulter_2.address);
      expect(defaulter_2Trove).to.be.equal(TroveStatus.CLOSED_BY_LIQUIDATION_IN_NORMAL_MODE);
    });

    it('does not close troves with ICR >= MCR in the given array', async () => {
      await setPrice('STOCK', '1', contracts);
      await whaleShrimpTroveInit(contracts, signers, contracts.STOCK);

      const [isRecoveryMode] = await storagePool.checkRecoveryMode();
      assert.isFalse(isRecoveryMode);

      await setPrice('STOCK', '5', contracts);
      const MCR = await troveManager.MCR();

      // Validate ICR >= MCR
      const aliceICR = await hintHelpers.getCurrentICR(alice.address);
      expect(aliceICR[0]).to.be.gte(MCR);

      const bobICR = await hintHelpers.getCurrentICR(bob.address);
      expect(bobICR[0]).to.be.gte(MCR);

      const carolICR = await hintHelpers.getCurrentICR(carol.address);
      expect(carolICR[0]).to.be.gte(MCR);

      const dennisICR = await hintHelpers.getCurrentICR(dennis.address);
      expect(dennisICR[0]).to.be.gte(MCR);

      // Validate ICR < MCR
      const defaulter_1ICR = await hintHelpers.getCurrentICR(defaulter_1.address);
      expect(defaulter_1ICR[0]).to.be.lte(MCR);

      const defaulter_2ICR = await hintHelpers.getCurrentICR(defaulter_2.address);
      expect(defaulter_2ICR[0]).to.be.lte(MCR);

      // Batch liquidate all the troves
      await batchLiquidate([alice, bob, carol, dennis, defaulter_1, defaulter_2], contracts);

      // Validate Troves with ICR >= MCR are not liquidated
      const aliceTrove = await troveManager.getTroveStatus(alice.address);
      expect(aliceTrove).to.be.equal(TroveStatus.ACTIVE);

      const bobTrove = await troveManager.getTroveStatus(bob.address);
      expect(bobTrove).to.be.equal(TroveStatus.ACTIVE);

      const carolTrove = await troveManager.getTroveStatus(carol.address);
      expect(carolTrove).to.be.equal(TroveStatus.ACTIVE);

      const dennisTrove = await troveManager.getTroveStatus(dennis.address);
      expect(dennisTrove).to.be.equal(TroveStatus.ACTIVE);

      // Validate Troves with ICR < MCR are liquidated
      const defaulter_1Trove = await troveManager.getTroveStatus(defaulter_1.address);
      expect(defaulter_1Trove).to.be.equal(TroveStatus.CLOSED_BY_LIQUIDATION_IN_NORMAL_MODE);

      const defaulter_2Trove = await troveManager.getTroveStatus(defaulter_2.address);
      expect(defaulter_2Trove).to.be.equal(TroveStatus.CLOSED_BY_LIQUIDATION_IN_NORMAL_MODE);
    });

    it('liquidates a Trove that a) was skipped in a previous liquidation and b) has pending rewards', async () => {
      await openTrove({
        from: alice,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('8000') }],
      });
      await openTrove({
        from: bob,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('2', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('10000') }],
      });
      await openTrove({
        from: carol,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('14000') }],
      });
      await openTrove({
        from: dennis,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('15000') }],
      });

      //decrease price
      await setPrice('BTC', '15000', contracts);

      // Confirm system is not in Recovery Mode
      const [isRecoveryModeBefore] = await storagePool.checkRecoveryMode();
      assert.isFalse(isRecoveryModeBefore);

      // carol gets liquidated, creates pending rewards for all
      await liquidate(carol, contracts);
      const carol_Status = await troveManager.getTroveStatus(carol);
      assert.equal(carol_Status.toString(), TroveStatus.CLOSED_BY_LIQUIDATION_IN_NORMAL_MODE.toString());

      //drop price again
      await setPrice('BTC', '12000', contracts);

      //check recovery mode
      const [isRecoveryModeAfter] = await storagePool.checkRecoveryMode();
      assert.isTrue(isRecoveryModeAfter);

      // Confirm alice has ICR > TCR
      const TCR = await getTCR(contracts);
      const ICR_A = await hintHelpers.getCurrentICR(alice);
      expect(ICR_A[0]).to.be.gt(TCR);

      // Attempt to liquidate alice and dennis, which skips alice in the liquidation since it is immune
      await batchLiquidate([alice, dennis], contracts);
      const alice_Status = await troveManager.getTroveStatus(alice);
      assert.equal(alice_Status.toString(), TroveStatus.ACTIVE.toString());
      const dennis_Status = await troveManager.getTroveStatus(dennis);
      assert.equal(dennis_Status.toString(), TroveStatus.CLOSED_BY_LIQUIDATION_IN_RECOVERY_MODE.toString());

      // remaining troves bob repay a little debt, applying their pending rewards
      await repayDebt(bob, contracts, [{ tokenAddress: STABLE, amount: parseUnits('1000') }]);

      // Check alice is the only trove that has pending rewards
      const alicePendingBTCReward =
        (await troveManager.getPendingRewards(alice, true, false)).find(
          ({ tokenAddress }) => tokenAddress === BTC.target
        )?.amount ?? 0n;
      assert.isTrue(alicePendingBTCReward > 0);
      const bobPendingReward =
        (await troveManager.getPendingRewards(bob, true, false)).find(({ tokenAddress }) => tokenAddress === BTC.target)
          ?.amount ?? 0n;
      assert.isFalse(bobPendingReward > 0);

      // Check alice's pending coll and debt rewards are <= the coll and debt in the DefaultPool
      const priceCache = await buildPriceCache(contracts);
      const PendingDebtSTABLE_A =
        (await troveManager.getPendingRewards(alice, false, true)).find(
          ({ tokenAddress }) => tokenAddress === STABLE.target
        )?.amount ?? 0n;
      const entireSystemCollUsd = await storagePool.getEntireSystemColl(priceCache);
      const entireSystemCollAmount = await priceFeed['getAmountFromUSDValue(address,uint256)'](
        BTC,
        entireSystemCollUsd
      );
      const entireSystemDebt = await storagePool.getEntireSystemDebt(priceCache);
      expect(PendingDebtSTABLE_A).to.be.lte(entireSystemDebt);
      expect(alicePendingBTCReward).to.be.lte(entireSystemCollUsd);

      //Check only difference is dust
      expect(alicePendingBTCReward - entireSystemCollAmount).to.be.lt(1000);
      expect(PendingDebtSTABLE_A - entireSystemDebt).to.be.lt(1000);

      // Confirm system is still in Recovery Mode
      const [isRecoveryModeAfter_Active] = await storagePool.checkRecoveryMode();
      assert.isTrue(isRecoveryModeAfter_Active);

      //drop price again
      await setPrice('BTC', '5000', contracts);

      //check trove length before liquidation
      const troveLengthBefore = await troveManager.getTroveOwnersCount();

      // Try to liquidate alice again. Check it succeeds and closes alice's trove
      const liquidateAgain_alice = await batchLiquidate([alice, bob], contracts);
      const liquidateAgain_aliceReceipt = await liquidateAgain_alice.wait();
      assert.isTrue(!!liquidateAgain_aliceReceipt?.status);
      const bobStatusFinal = await troveManager.getTroveStatus(bob);
      assert.equal(bobStatusFinal.toString(), TroveStatus.ACTIVE.toString());
      const troveLengthAfter = await troveManager.getTroveOwnersCount();

      // Confirm Troves count
      expect(troveLengthBefore - troveLengthAfter).to.be.equal(1);
    });

    it('pending rewards from unused debt tokens', async () => {
      await openTrove({
        from: alice,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('5', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('8000') }],
      });

      const bobStockAmount = parseUnits('5');
      await openTrove({
        from: bob,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('2', 8) }],
        debts: [
          { tokenAddress: STABLE, amount: parseUnits('10000') },
          { tokenAddress: STOCK, amount: bobStockAmount },
        ],
      });

      await setPrice('BTC', '5000', contracts);
      await batchLiquidate([bob], contracts);

      const aliceStockReward =
        (await troveManager.getPendingRewards(alice, false, true)).find(
          ({ tokenAddress }) => tokenAddress === STOCK.target
        )?.amount ?? 0n;
      assert.equal(aliceStockReward, bobStockAmount);

      const aliceDebts = await troveManager.getTroveRepayableDebts(alice);
      assert.equal(aliceDebts[1][1], bobStockAmount);

      await increaseDebt(alice, contracts, [{ tokenAddress: STABLE, amount: parseUnits('10') }]);

      const aliceStockRewardB =
        (await troveManager.getPendingRewards(alice, false, true)).find(
          ({ tokenAddress }) => tokenAddress === STOCK.target
        )?.amount ?? 0n;
      assert.equal(aliceStockRewardB, 0n);

      const aliceDebtsB = await troveManager.getTroveRepayableDebts(alice);
      assert.equal(aliceDebtsB[1][1], bobStockAmount);
    });

    it('reverts if array is empty', async () => {
      const od = await generatePriceUpdateDataWithFee(contracts);
      await expect(
        liquidationOperations.batchLiquidateTroves([], od.data, { value: od.fee })
      ).to.be.revertedWithCustomError(liquidationOperations, 'EmptyArray');
    });

    it('skips if a trove has been closed', async () => {
      await whaleShrimpTroveInit(contracts, signers);
      assert.equal((await troveManager.getTroveOwnersCount()).toString(), '7');

      await STABLE.connect(whale).transfer(bob.address, parseUnits('500'));

      //drop price
      await setPrice('BTC', '5000', contracts);

      //check recovery mode
      const [isRecoveryModeBefore] = await storagePool.checkRecoveryMode();
      assert.isFalse(isRecoveryModeBefore);

      const txBobTroveClose = await closeTrove(bob, contracts);
      const txBobTroveCloseReceipt = await txBobTroveClose.wait();
      assert.isTrue(!!txBobTroveCloseReceipt?.status);

      assert.equal((await troveManager.getTroveStatus(bob)).toString(), TroveStatus.CLOSED_BY_OWNER.toString());

      //check recovery mode
      const [isRecoveryModeAfter] = await storagePool.checkRecoveryMode();
      assert.isFalse(isRecoveryModeAfter);

      //check ICR is less then 110%
      const defaulter_1ICR = await hintHelpers.getCurrentICR(defaulter_1.address);
      expect(defaulter_1ICR[0]).to.be.lt(parseUnits('110', 16));

      //transfer stable to defaulter 2
      await STABLE.connect(carol).transfer(defaulter_1.address, parseUnits('500'));

      //liquidate
      await batchLiquidate([defaulter_1, bob, carol, dennis, alice], contracts);

      //check trove status
      assert.equal(
        (await troveManager.getTroveStatus(defaulter_1)).toString(),
        TroveStatus.CLOSED_BY_LIQUIDATION_IN_NORMAL_MODE.toString()
      );

      //check trove status is active
      assert.equal((await troveManager.getTroveStatus(defaulter_2)).toString(), TroveStatus.ACTIVE.toString());
      assert.equal((await troveManager.getTroveStatus(carol)).toString(), TroveStatus.ACTIVE.toString());
      assert.equal((await troveManager.getTroveStatus(dennis)).toString(), TroveStatus.ACTIVE.toString());
      assert.equal((await troveManager.getTroveStatus(alice)).toString(), TroveStatus.ACTIVE.toString());

      //check defaulter 1 is still closed by owner
      assert.equal((await troveManager.getTroveStatus(bob)).toString(), TroveStatus.CLOSED_BY_OWNER.toString());

      //check trove length
      assert.equal((await troveManager.getTroveOwnersCount()).toString(), '5');
    });

    it('does not liquidate troves that are not in the given array', async () => {
      await whaleShrimpTroveInit(contracts, signers);

      //Check trove owner length
      assert.equal((await troveManager.getTroveOwnersCount()).toString(), '7');

      //drop price
      await setPrice('BTC', '5000', contracts);

      const [isRecoveryMode] = await storagePool.checkRecoveryMode();
      assert.isFalse(isRecoveryMode);

      //batchliquidate defaulter 1 and 2
      await batchLiquidate([defaulter_1, defaulter_2], contracts);

      //check trove status
      assert.equal(
        (await troveManager.getTroveStatus(defaulter_1)).toString(),
        TroveStatus.CLOSED_BY_LIQUIDATION_IN_NORMAL_MODE.toString()
      );
      assert.equal(
        (await troveManager.getTroveStatus(defaulter_2)).toString(),
        TroveStatus.CLOSED_BY_LIQUIDATION_IN_NORMAL_MODE.toString()
      );

      //check active troves
      assert.equal((await troveManager.getTroveStatus(bob)).toString(), TroveStatus.ACTIVE.toString());
      assert.equal((await troveManager.getTroveStatus(alice)).toString(), TroveStatus.ACTIVE.toString());
      assert.equal((await troveManager.getTroveStatus(carol)).toString(), TroveStatus.ACTIVE.toString());
      assert.equal((await troveManager.getTroveStatus(dennis)).toString(), TroveStatus.ACTIVE.toString());
      assert.equal((await troveManager.getTroveStatus(whale)).toString(), TroveStatus.ACTIVE.toString());

      //check trove length
      assert.equal((await troveManager.getTroveOwnersCount()).toString(), '5');
    });
  });

  describe('in Recovery Mode', () => {
    describe('checkRecoveryMode()', () => {
      it('Returns true if TCR falls below CCR', async () => {
        await whaleShrimpTroveInit(contracts, signers);

        // find TCR
        const TCR = await getTCR(contracts);
        assert.isTrue(TCR / parseUnits('1', 16) > 150n);

        const [isRecoveryMode] = await storagePool['checkRecoveryMode()']();
        assert.isFalse(isRecoveryMode);

        //decrease price
        await setPrice('BTC', '2000', contracts);

        //check TCR
        const TCR_after = await getTCR(contracts);
        assert.isTrue(TCR_after / parseUnits('1', 16) < 150n);

        const [isRecoveryModeAfter] = await storagePool['checkRecoveryMode()']();
        assert.isTrue(isRecoveryModeAfter);
      });

      it('Returns true if TCR stays less than CCR', async () => {
        await whaleShrimpTroveInit(contracts, signers);

        const TCR = await getTCR(contracts);
        assert.isTrue(TCR / parseUnits('1', 16) > 150n);

        //drop price
        await setPrice('BTC', '2000', contracts);

        const [isRecoveryMode] = await storagePool['checkRecoveryMode()']();
        assert.isTrue(isRecoveryMode);

        // // mint into alice's account
        // await BTC.connect(alice).unprotectedMint(alice.address, parseUnits('1', 8));

        // //increase allowance of alice
        // await BTC.connect(alice).approve(borrowerOperations, parseUnits('4', 8));

        await addColl(alice, contracts, [{ tokenAddress: BTC, amount: parseUnits('0.1', 8) }], true);

        // await borrowerOperations.connect(alice).addColl([{ tokenAddress: BTC, amount: parseUnits('1', 8) }]);

        const [isRecoveryMode_After] = await storagePool['checkRecoveryMode()']();
        assert.isTrue(isRecoveryMode_After);
      });

      it('returns false if TCR stays above CCR', async () => {
        await whaleShrimpTroveInit(contracts, signers);

        const TCR = await getTCR(contracts);
        assert.isTrue(TCR / parseUnits('1', 16) > 150n);

        await withdrawalColl(dennis, contracts, [{ tokenAddress: BTC, amount: parseUnits('0.1', 8) }]);

        // await borrowerOperations.connect(dennis).withdrawColl([{ tokenAddress: BTC, amount: parseUnits('0.1', 8) }]);

        const [isRecoveryMode] = await storagePool['checkRecoveryMode()']();
        assert.isFalse(isRecoveryMode);
      });

      it('returns false if TCR rises above CCR', async () => {
        await whaleShrimpTroveInit(contracts, signers);

        // get TCR
        const TCR = await getTCR(contracts);
        assert.isTrue(TCR / parseUnits('1', 16) > 150n);

        //drop price
        await setPrice('BTC', '2000', contracts);

        //check recovery mode
        const [isRecoveryMode] = await storagePool['checkRecoveryMode()']();
        assert.isTrue(isRecoveryMode);

        // add collateral to alice's trove
        await addColl(alice, contracts, [{ tokenAddress: BTC, amount: parseUnits('2', 8) }], true);

        //check recovery mode
        const [isRecoveryMode_After] = await storagePool['checkRecoveryMode()']();
        assert.isFalse(isRecoveryMode_After);
      });
    });

    describe('liquidate()', () => {
      it('with ICR < 100%: removes stake and updates totalStakes', async () => {
        await whaleShrimpTroveInit(contracts, signers);

        // get TCR
        const TCR = await getTCR(contracts);
        assert.isTrue(TCR / parseUnits('1', 16) > 150n);

        const bobStakeBefore = await getTroveStake(contracts, bob, BTC);
        assert.equal(bobStakeBefore, parseUnits('1', 8));

        const totalStakesBefore = await troveManager.totalStakes(BTC);
        assert.equal(totalStakesBefore, parseUnits('5.04', 8));

        //decrease price
        await setPrice('BTC', '2000', contracts);

        //check bob ICR
        const [bobICR] = await hintHelpers.getCurrentICR(bob);
        assert.isTrue(bobICR / parseUnits('1', 16) < 110n);

        //liquidate bob
        await liquidate(bob, contracts);
        expect(await troveManager.getTroveStatus(bob)).to.be.equal(TroveStatus.CLOSED_BY_LIQUIDATION_IN_RECOVERY_MODE);

        const bobStakeAfter = await getTroveStake(contracts, bob, BTC);
        assert.equal(bobStakeAfter, 0n);

        const totalStakesAfter = await troveManager.totalStakes(BTC);
        assert.equal(totalStakesAfter, totalStakesBefore - bobStakeBefore);
      });

      it('with ICR < 100%: updates system snapshots correctly', async () => {
        await whaleShrimpTroveInit(contracts, signers);

        //get TCR
        const TCR = await getTCR(contracts);
        assert.isTrue(TCR / parseUnits('1', 16) > 150n);

        //decrease price
        await setPrice('BTC', '2000', contracts);

        //check recovery mode
        const [isRecoveryMode] = await storagePool['checkRecoveryMode()']();
        assert.isTrue(isRecoveryMode);

        const totalStakes = await troveManager.totalStakes(BTC);
        assert.equal(totalStakes, parseUnits('5.04', 8));

        const defaulter_1Stakes = await getTroveStake(contracts, defaulter_1, BTC);

        //liquidate defaulter_1
        await liquidate(defaulter_1, contracts);
        expect(await troveManager.getTroveStatus(defaulter_1)).to.be.equal(
          TroveStatus.CLOSED_BY_LIQUIDATION_IN_RECOVERY_MODE
        );

        //get value
        const defaultPoolValue = await storagePool.getValue(BTC, true, 1);

        //total stake snapshot
        const totalStakesSnapshot_Before = await troveManager.totalStakesSnapshot(BTC);
        assert.equal(totalStakesSnapshot_Before, totalStakes - defaulter_1Stakes);

        //total collateral snapshot
        const totalCollateralSnapshot_Before = await troveManager.totalCollateralSnapshots(BTC);
        assert.equal(totalCollateralSnapshot_Before, totalStakesSnapshot_Before + defaultPoolValue);

        const defaulter_2Stakes = await getTroveStake(contracts, defaulter_2, BTC);

        //liquidate defaulter_2
        await liquidate(defaulter_2, contracts);
        expect(await troveManager.getTroveStatus(defaulter_2)).to.be.equal(
          TroveStatus.CLOSED_BY_LIQUIDATION_IN_RECOVERY_MODE
        );

        //get value
        const defaultPoolValue_After = await storagePool.getValue(BTC, true, 1);

        const totalStakesSnapshot_After = await troveManager.totalStakesSnapshot(BTC);
        assert.equal(totalStakesSnapshot_After, totalStakesSnapshot_Before - defaulter_2Stakes);

        const totalCollateralSnapshot_After = await troveManager.totalCollateralSnapshots(BTC);

        assert.equal(totalCollateralSnapshot_After, totalStakesSnapshot_After + defaultPoolValue_After);
      });

      it('with 100% < ICR < 110%: closes the Trove and removes it from the Trove array', async () => {
        await whaleShrimpTroveInit(contracts, signers);

        const defaulter_1TroveStatusBefore = await troveManager.getTroveStatus(defaulter_1);
        assert.equal(defaulter_1TroveStatusBefore.toString(), TroveStatus.ACTIVE.toString());

        const troveLengthBefore = await troveManager.getTroveOwnersCount();
        assert.equal(troveLengthBefore.toString(), '7');

        //decrease price
        await setPrice('BTC', '2000', contracts);

        //check recovery mode
        const [isRecoveryModeBefore] = await storagePool['checkRecoveryMode()']();
        assert.isTrue(isRecoveryModeBefore);

        //get currentICR
        const [defaulter_1ICR] = await hintHelpers.getCurrentICR(defaulter_1);
        assert.isTrue(defaulter_1ICR / parseUnits('1', 16) < 110n);

        //liquidate defaulter_1
        await liquidate(defaulter_1, contracts);

        const defaulter_1TroveStatusAfter = await troveManager.getTroveStatus(defaulter_1);
        assert.equal(
          defaulter_1TroveStatusAfter.toString(),
          TroveStatus.CLOSED_BY_LIQUIDATION_IN_RECOVERY_MODE.toString()
        );

        //check trove length
        const troveLengthAfter = await troveManager.getTroveOwnersCount();
        assert.equal(troveLengthAfter.toString(), '6');
      });

      it('with 100% < ICR < 110%: offsets as much debt as possible with the Stability Pool, then redistributes the remainder coll and debt', async () => {
        const whaleColl = parseUnits('30', 8);
        const spDeposit = parseUnits('200000');
        await openTrove({
          from: whale,
          contracts,
          colls: [{ tokenAddress: BTC, amount: whaleColl }],
          debts: [{ tokenAddress: STABLE, amount: spDeposit }],
        });

        await openTrove({
          from: alice,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('2', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('15000') }],
        });

        const bobColl = parseUnits('2', 8);

        await openTrove({
          from: bob,
          contracts,
          colls: [{ tokenAddress: BTC, amount: bobColl }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('19000') }],
        });

        //drop price
        await setPrice('BTC', '10000', contracts);

        // Confirm system is in Recovery Mode
        const [isRecoveryModeBefore] = await storagePool['checkRecoveryMode()']();
        assert.isTrue(isRecoveryModeBefore);

        //check bob ICR
        const [bobICR] = await hintHelpers.getCurrentICR(bob);
        assert.isTrue(bobICR / parseUnits('1', 16) > 100n);
        assert.isTrue(bobICR / parseUnits('1', 16) < 110n);

        //liquidate carol
        await liquidate(bob, contracts);
      });

      it('recovery mode, with  110% < ICR < TCR, full stability pool off set', async () => {
        await openTrove({
          from: whale,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('2', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('5700') }],
        });
        await openTrove({
          from: alice,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('2', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('5700') }],
        });
        const bobsDebt = parseUnits('4200');
        const bobsColl = parseUnits('1', 8);
        await openTrove({
          from: bob,
          contracts,
          colls: [{ tokenAddress: BTC, amount: bobsColl }],
          debts: [{ tokenAddress: STABLE, amount: bobsDebt }],
        });

        //decrease price
        await setPrice('BTC', '4700', contracts);

        const [aliceICR] = await hintHelpers.getCurrentICR(alice);
        const [bobICR] = await hintHelpers.getCurrentICR(bob);
        expect(aliceICR / parseUnits('1', 16)).to.be.gt(110n);
        expect(bobICR / parseUnits('1', 16)).to.be.lt(150n);

        //check recovery mode
        const [isRecoveryModeBefore] = await storagePool['checkRecoveryMode()']();
        assert.isTrue(isRecoveryModeBefore);

        //total snapshot
        const totalStakesSnapshot_Before = await troveManager.totalStakesSnapshot(BTC);
        assert.equal(totalStakesSnapshot_Before, 0n);
        const totalCollateralSnapshot_Before = await troveManager.totalCollateralSnapshots(BTC);
        assert.equal(totalCollateralSnapshot_Before, 0n);

        //liquidate bob
        await liquidate(bob, contracts);
        expect(await troveManager.getTroveStatus(bob)).to.be.equal(TroveStatus.CLOSED_BY_LIQUIDATION_IN_RECOVERY_MODE);

        //check totals
        const totalCollateralSnapshot_After = await troveManager.totalCollateralSnapshots(BTC);
        assert.equal(totalCollateralSnapshot_After, 498295414n); // from the remaining two open troves

        const btcSurplus =
          (await contracts.collSurplusPool.getCollateral(bob)).find(({ tokenAddress }) => tokenAddress === BTC.target)
            ?.amount ?? 0n;
        expect(btcSurplus).to.be.equal(1204586n);
        expect(btcSurplus + totalCollateralSnapshot_After).to.be.equal(parseUnits(`${5 - 1 * 0.005}`, 8));

        // check bobs coll surplus
        const bobCollWithoutGasComp = bobsColl - bobsColl / 200n;
        const bobsSurplus =
          bobCollWithoutGasComp -
          (await priceFeed['getAmountFromUSDValue(address,uint256)'](
            BTC,
            (bobsDebt * parseUnits('1.1')) / parseUnits('1')
          )); // 110% MCR cap
        const collSurplus = await contracts.collSurplusPool.getCollateral(bob);
        expect(collSurplus.length).to.be.equal(1);
        expect(collSurplus[0].amount - bobsSurplus).to.be.below(0.000025e9);
      });

      it('with  110% < ICR < TCR, and StabilityPool debt > debt to liquidate: updates system snapshots', async () => {
        await openTrove({
          from: whale,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('2', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('5700') }],
        });
        await openTrove({
          from: alice,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('2', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('5700') }],
        });
        await openTrove({
          from: bob,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('4200') }],
        });

        //decrease price
        await setPrice('BTC', '4700', contracts);

        //check recovery mode
        const [isRecoveryModeBefore] = await storagePool['checkRecoveryMode()']();
        assert.isTrue(isRecoveryModeBefore);

        //check bob ICR
        const [bobICR] = await hintHelpers.getCurrentICR(bob);
        expect(bobICR / parseUnits('1', 16)).to.be.gt(110n);
        expect(bobICR / parseUnits('1', 16)).to.be.lt(150n);

        //total stake snapshot
        const totalStakesSnapshot_Before = await troveManager.totalStakesSnapshot(BTC);
        assert.equal(totalStakesSnapshot_Before, 0n);

        //total collateral snapshot
        const totalCollateralSnapshot_Before = await troveManager.totalCollateralSnapshots(BTC);
        assert.equal(totalCollateralSnapshot_Before, 0n);

        //liquidate bob
        await liquidate(bob, contracts);
        expect(await troveManager.getTroveStatus(bob)).to.be.equal(TroveStatus.CLOSED_BY_LIQUIDATION_IN_RECOVERY_MODE);

        //get value
        const defaultPoolValue = await storagePool.getValue(BTC, true, 1);

        //get total coll
        const priceCache = await buildPriceCache(contracts);
        const totalCollateral = await storagePool.getEntireSystemColl(priceCache);

        // get amount from USD value
        const totalCollateralAmount = await priceFeed['getAmountFromUSDValue(address,uint256)'](BTC, totalCollateral);

        //total stake snapshot after
        const totalStakesSnapshot_After = await troveManager.totalStakesSnapshot(BTC);
        assert.equal(totalStakesSnapshot_After, totalCollateralAmount - defaultPoolValue);

        //get total collateral snapshot
        const totalCollateralSnapshot_After = await troveManager.totalCollateralSnapshots(BTC);
        assert.equal(totalCollateralSnapshot_After, totalCollateralAmount);
      });

      it('with 110% < ICR < TCR, and StabilityPool debt > debt to liquidate: closes the Trove', async () => {
        await openTrove({
          from: whale,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('2', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('5700') }],
        });
        await openTrove({
          from: alice,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('2', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('5700') }],
        });
        await openTrove({
          from: bob,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('4200') }],
        });

        //decrease price
        await setPrice('BTC', '4700', contracts);

        //check and log TCR
        const TCR = await getTCR(contracts);

        //check recovery mode
        const [isRecoveryModeBefore] = await storagePool['checkRecoveryMode()']();
        assert.isTrue(isRecoveryModeBefore);

        //check bob trove status
        const bobTroveStatusBefore = await troveManager.getTroveStatus(bob);
        assert.equal(bobTroveStatusBefore.toString(), TroveStatus.ACTIVE.toString());

        //check bob ICR
        const [bobICR] = await hintHelpers.getCurrentICR(bob);
        expect(bobICR / parseUnits('1', 16)).to.be.gt(110n);
        expect(bobICR / parseUnits('1', 16)).to.be.lt(150n);

        //liquidate bob
        await liquidate(bob, contracts);
        expect(await troveManager.getTroveStatus(bob)).to.be.equal(TroveStatus.CLOSED_BY_LIQUIDATION_IN_RECOVERY_MODE);
      });
    });

    describe('batchLiquidateTroves()', () => {
      it('Liquidates all troves with ICR < 110%, inrecovery mode', async () => {
        await whaleShrimpTroveInit(contracts, signers);

        //decrease price
        await await setPrice('BTC', '2300', contracts);

        //get TCR
        const TCR = await getTCR(contracts);
        assert.isTrue(TCR / parseUnits('1', 16) < 150n);

        //check recovery mode
        const [isRecoveryModeBefore] = await storagePool['checkRecoveryMode()']();
        assert.isTrue(isRecoveryModeBefore);

        //check ICR
        const [bobICR] = await hintHelpers.getCurrentICR(bob);
        expect(bobICR / parseUnits('1', 16)).to.be.lt(150n);

        const [defaulter_1ICR] = await hintHelpers.getCurrentICR(defaulter_1);
        expect(defaulter_1ICR / parseUnits('1', 16)).to.be.lt(150n);

        const [defaulter_2ICR] = await hintHelpers.getCurrentICR(defaulter_2);
        expect(defaulter_2ICR / parseUnits('1', 16)).to.be.lt(150n);

        const [carolICR] = await hintHelpers.getCurrentICR(carol);
        expect(carolICR / parseUnits('1', 16)).to.be.lt(150n);

        const [dennisICR] = await hintHelpers.getCurrentICR(dennis);
        expect(dennisICR / parseUnits('1', 16)).to.be.gt(150n);

        const [aliceICR] = await hintHelpers.getCurrentICR(alice);
        expect(aliceICR / parseUnits('1', 16)).to.be.gt(150n);

        //batchliquidate bob
        await batchLiquidate([defaulter_1, defaulter_2, bob, carol, dennis, alice], contracts);

        //check recovery mode
        const [isRecoveryModeAfter] = await storagePool['checkRecoveryMode()']();
        assert.isTrue(isRecoveryModeAfter);

        //check trove status
        expect(await troveManager.getTroveStatus(defaulter_1)).to.be.equal(
          TroveStatus.CLOSED_BY_LIQUIDATION_IN_RECOVERY_MODE
        );
        expect(await troveManager.getTroveStatus(defaulter_2)).to.be.equal(
          TroveStatus.CLOSED_BY_LIQUIDATION_IN_RECOVERY_MODE
        );
        expect(await troveManager.getTroveStatus(bob)).to.be.equal(TroveStatus.CLOSED_BY_LIQUIDATION_IN_RECOVERY_MODE);
        expect(await troveManager.getTroveStatus(carol)).to.be.equal(
          TroveStatus.CLOSED_BY_LIQUIDATION_IN_RECOVERY_MODE
        );
        expect(await troveManager.getTroveStatus(dennis)).to.be.equal(TroveStatus.ACTIVE);
        expect(await troveManager.getTroveStatus(alice)).to.be.equal(TroveStatus.ACTIVE);

        expect(await sortedTroves.contains(defaulter_1)).to.be.equal(false);
        expect(await sortedTroves.contains(defaulter_2)).to.be.equal(false);
        expect(await sortedTroves.contains(bob)).to.be.equal(false);
        expect(await sortedTroves.contains(carol)).to.be.equal(false);
        expect(await sortedTroves.contains(dennis)).to.be.equal(true);
        expect(await sortedTroves.contains(alice)).to.be.equal(true);
      });

      it('Liquidates all troves with ICR < 110%, transitioning Normal -> Recovery Mode', async () => {
        await whaleShrimpTroveInit(contracts, signers);
        await STABLE.connect(whale).transfer(alice, parseUnits('1200'));
        await closeTrove(alice, contracts);

        //decrease price
        await setPrice('BTC', '2000', contracts);

        //check recovery mode
        const [isRecoveryModeBefore] = await storagePool['checkRecoveryMode()']();
        assert.isTrue(isRecoveryModeBefore);

        // batchLIquidate
        await batchLiquidate([alice, bob, carol, defaulter_1, defaulter_2], contracts);

        //check trove status
        expect(await troveManager.getTroveStatus(alice)).to.be.equal(TroveStatus.CLOSED_BY_OWNER);
        expect(await troveManager.getTroveStatus(bob)).to.be.equal(TroveStatus.CLOSED_BY_LIQUIDATION_IN_RECOVERY_MODE);
        expect(await troveManager.getTroveStatus(carol)).to.be.equal(
          TroveStatus.CLOSED_BY_LIQUIDATION_IN_RECOVERY_MODE
        );
        expect(await troveManager.getTroveStatus(defaulter_1)).to.be.equal(
          TroveStatus.CLOSED_BY_LIQUIDATION_IN_RECOVERY_MODE
        );
        expect(await troveManager.getTroveStatus(defaulter_2)).to.be.equal(
          TroveStatus.CLOSED_BY_LIQUIDATION_IN_RECOVERY_MODE
        );

        //check sorted troves
        expect(await sortedTroves.contains(bob)).to.be.equal(false);
        expect(await sortedTroves.contains(carol)).to.be.equal(false);
        expect(await sortedTroves.contains(defaulter_1)).to.be.equal(false);
        expect(await sortedTroves.contains(defaulter_2)).to.be.equal(false);
      });

      it('with a non fullfilled liquidation: non liquidated trove remains in Trove Owners array', async () => {
        await whaleShrimpTroveInit(contracts, signers);

        //decrease price
        await setPrice('BTC', '2000', contracts);

        //check recovery mode
        const [isRecoveryModeBefore] = await storagePool['checkRecoveryMode()']();
        assert.isTrue(isRecoveryModeBefore);

        //check ICR
        const [bobICR] = await hintHelpers.getCurrentICR(bob);
        expect(bobICR / parseUnits('1', 16)).to.be.lt(150n);
        expect(bobICR / parseUnits('1', 16)).to.be.gt(95n);

        const [dennisICR] = await hintHelpers.getCurrentICR(dennis);
        expect(dennisICR / parseUnits('1', 16)).to.be.gt(150n);

        await batchLiquidate([bob, dennis], contracts);

        //get trove length
        const troveLength = await troveManager.getTroveOwnersCount();

        let addressFound = false;
        let addressIdx = 0;

        for (let i = 0; i < troveLength; i++) {
          const address = await troveManager.getTroveOwners();
          if (address[i] === dennis.address) {
            addressFound = true;
            addressIdx = i;
          }
        }

        assert.isTrue(addressFound);
        const idxOnStruct = await troveManager.Troves(dennis.address);
        assert.equal(addressIdx, Number(idxOnStruct[1]));
      });
    });
  });
});
