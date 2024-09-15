import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import {
  LiquidationOperations,
  MockDebtToken,
  MockERC20,
  HintHelpers,
  StabilityPoolManager,
  StoragePool,
  TroveManager,
} from '../typechain';
import { expect, assert } from 'chai';
import {
  getStabilityPool,
  openTrove,
  assertRevert,
  whaleShrimpTroveInit,
  fastForwardTime,
  TimeValues,
  getEmittedLiquidationValues,
  increaseDebt,
  deployTesting,
  setPrice,
} from '../utils/testHelper';
import { Addressable, parseUnits } from 'ethers';
import { Contracts } from '../utils/deployTestBase';
import { generatePriceUpdateDataWithFee } from '../utils/pythHelper';

describe('StabilityPool', () => {
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

  let STABLE: MockDebtToken;
  let STOCK: MockDebtToken;
  let BTC: MockERC20;
  let USDT: MockERC20;

  let contracts: Contracts;
  let hintHelpers: HintHelpers;
  let troveManager: TroveManager;
  let storagePool: StoragePool;
  let stabilityPoolManager: StabilityPoolManager;
  let liquidationOperations: LiquidationOperations;

  before(async () => {
    signers = await ethers.getSigners();
    [, defaulter_1, defaulter_2, defaulter_3, whale, alice, bob, carol, dennis, erin] = signers;
  });

  describe('Stability Pool Mechanisms', async () => {
    beforeEach(async () => {
      contracts = await deployTesting();

      hintHelpers = contracts.hintHelpers;
      troveManager = contracts.troveManager;
      storagePool = contracts.storagePool;
      stabilityPoolManager = contracts.stabilityPoolManager;
      liquidationOperations = contracts.liquidationOperations;

      STABLE = contracts.STABLE;
      STOCK = contracts.STOCK;
      BTC = contracts.BTC;
      USDT = contracts.USDT;
    });

    describe('provideToSP()', () => {
      // increases recorded stable at Stability Pool
      it('increases the Stability Pool stable balance', async () => {
        // --- SETUP --- Give Alice a least 200
        await STOCK.unprotectedMint(alice, 200);

        // --- TEST ---
        await stabilityPoolManager.connect(alice).provideStability([{ tokenAddress: STOCK, amount: 200 }]);

        // check pools total
        const stockDeposit = (await stabilityPoolManager.getTotalDeposits()).find(d => d.tokenAddress === STOCK.target);
        expect(stockDeposit?.amount).to.be.equal(200n);
      });

      it("updates the user's deposit record in StabilityPool", async () => {
        // --- SETUP --- Give Alice a least 200
        await STOCK.unprotectedMint(alice, 200n);

        // --- TEST ---
        // check user's deposit record before
        const depositBefore = (await stabilityPoolManager.connect(alice).getCompoundedDeposits()).find(
          d => d.tokenAddress === STOCK.target
        )?.amount;
        expect(depositBefore).to.be.equal(0n);

        await stabilityPoolManager.connect(alice).provideStability([{ tokenAddress: STOCK, amount: 200n }]);

        // check user's deposit record after
        const depositAfter = (await stabilityPoolManager.connect(alice).getCompoundedDeposits()).find(
          d => d.tokenAddress === STOCK.target
        )?.amount;
        expect(depositAfter).to.be.equal(200n);
      });

      it("reduces the user's stock balance by the correct amount", async () => {
        // --- SETUP --- Give Alice a least 200
        await STOCK.unprotectedMint(alice, 200n);

        // --- TEST ---
        // get user's deposit record before
        const stockBefore = await STOCK.balanceOf(alice);

        // provideToSP()
        await stabilityPoolManager.connect(alice).provideStability([{ tokenAddress: STOCK, amount: 200n }]);

        // check user's balance change
        const stockAfter = await STOCK.balanceOf(alice);
        expect(stockBefore - stockAfter).to.be.equal(200n);
      });

      it('Correctly updates user snapshots of accumulated rewards per unit staked', async () => {
        // --- SETUP ---

        // Whale opens Trove and deposits to SP
        await openTrove({
          from: whale,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
          debts: [{ tokenAddress: STOCK, amount: parseUnits('1') }],
        });
        await stabilityPoolManager.connect(whale).provideStability([{ tokenAddress: STOCK, amount: parseUnits('1') }]);

        // 2 Troves opened, each withdraws minimum debt
        await openTrove({
          from: defaulter_1,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('0.02', 8) }],
          debts: [{ tokenAddress: STOCK, amount: parseUnits('1') }],
        });
        await openTrove({
          from: defaulter_2,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('0.02', 8) }],
          debts: [{ tokenAddress: STOCK, amount: parseUnits('1') }],
        });

        // Alice makes Trove and withdraws 1 stock
        await openTrove({
          from: alice,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
          debts: [{ tokenAddress: STOCK, amount: parseUnits('1') }],
        });

        // price drops: defaulter's Troves fall below MCR, whale doesn't
        await setPrice('BTC', '9500', contracts);

        const stockBefore = (await stabilityPoolManager.getTotalDeposits()).find(
          d => d.tokenAddress === STOCK.target
        )?.amount;

        // Troves are closed
        const od = await generatePriceUpdateDataWithFee(contracts);
        await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee });
        expect(await troveManager.getTroveStatus(defaulter_1)).to.be.equal(3n);
        await liquidationOperations.liquidate(defaulter_2, od.data, { value: od.fee });
        expect(await troveManager.getTroveStatus(defaulter_2)).to.be.equal(3n);

        // Confirm SP has decreased
        const stockAfter = (await contracts.stabilityPoolManager.getTotalDeposits()).find(
          (d: { tokenAddress: string | Addressable }) => d.tokenAddress === STOCK.target
        )?.amount;

        expect(stockAfter).to.be.lt(stockBefore);

        // --- TEST ---
        const stockPool = await getStabilityPool(contracts, STOCK);
        const P_Before = await stockPool.P();
        const S_Before_BTC = await stockPool.epochToScaleToCollTokenToSum(0, 0, BTC);
        const S_Before_USDT = await stockPool.epochToScaleToCollTokenToSum(0, 0, USDT);
        // const G_Before = await stockPool.epochToScaleToG(0, 0);
        expect(P_Before).to.be.gt(0n);
        expect(S_Before_BTC).to.be.gt(0n);
        expect(S_Before_USDT).to.be.eq(0n); // should be 0, because there was no usdt coll which could be added

        // Check 'Before' snapshots
        const alice_snapshot_Before = await stockPool.depositSnapshots(alice);
        const alice_snapshot_P_Before = alice_snapshot_Before.P;
        expect(alice_snapshot_P_Before).to.be.eq(0n);
        // const alice_snapshot_G_Before = alice_snapshot_Before[2].toString();
        // assert.equal(alice_snapshot_G_Before, '0');

        const alice_snapshot_S_Before_BTC = await stockPool.getDepositorCollGain(alice, BTC);
        expect(alice_snapshot_S_Before_BTC).to.be.eq(0n);

        // Make deposit
        await stabilityPoolManager.connect(alice).provideStability([{ tokenAddress: STOCK, amount: 1 }]);
        await stockPool.depositSnapshots(alice);

        const alice_snapshot_S_After_BTC = await stockPool.getDepositorCollGain(alice, BTC);
        expect(alice_snapshot_S_Before_BTC).to.be.equal(alice_snapshot_S_After_BTC);
      });

      it("multiple deposits: updates user's deposit and snapshots", async () => {
        // --- SETUP ---

        // Whale opens Trove and deposits to SP
        await openTrove({
          from: whale,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
          debts: [{ tokenAddress: STOCK, amount: parseUnits('1') }],
        });
        await stabilityPoolManager.connect(whale).provideStability([{ tokenAddress: STOCK, amount: parseUnits('1') }]);

        // 2 Troves opened, each withdraws minimum debt
        await openTrove({
          from: defaulter_1,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('0.02', 8) }],
          debts: [{ tokenAddress: STOCK, amount: parseUnits('1') }],
        });
        await openTrove({
          from: defaulter_2,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('0.02', 8) }],
          debts: [{ tokenAddress: STOCK, amount: parseUnits('1') }],
        });
        await openTrove({
          from: defaulter_3,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('0.02', 8) }],
          debts: [{ tokenAddress: STOCK, amount: parseUnits('1') }],
        });

        // --- TEST ---

        // Alice makes deposit #1
        await openTrove({
          from: alice,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
          debts: [{ tokenAddress: STOCK, amount: parseUnits('3') }],
        });
        await stabilityPoolManager.connect(alice).provideStability([{ tokenAddress: STOCK, amount: parseUnits('1') }]);

        const stockPool = await getStabilityPool(contracts, STOCK);
        const alice_Snapshot_S_0 = await stockPool.getDepositorCollGain(alice, BTC);
        const alice_Snapshot_P_0 = (await stockPool.depositSnapshots(alice)).P;
        expect(alice_Snapshot_S_0).to.be.equal(0n);
        expect(alice_Snapshot_P_0).to.be.equal(parseUnits('1'));

        // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
        await setPrice('BTC', '9500', contracts);

        // 2 users with Trove with 2 STOCK drawn are closed
        // 0.04 BTC -> 50% to the whale, 50% to alice
        // pool is empty after that
        let od = await generatePriceUpdateDataWithFee(contracts);
        await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee });
        await liquidationOperations.liquidate(defaulter_2, od.data, { value: od.fee });

        const alice_compoundedDeposit_1 = await stockPool.getCompoundedDebtDeposit(alice);
        expect(alice_compoundedDeposit_1).to.be.equal(0n); // all debt was consumed

        // Alice makes deposit #2
        // 0.02 BTC will be paid out to alice
        const alice_topUp_1 = parseUnits('1');
        await stabilityPoolManager.connect(alice).provideStability([{ tokenAddress: STOCK, amount: alice_topUp_1 }]);
        const alice_newDeposit_1 = await stockPool.getCompoundedDebtDeposit(alice);
        expect(alice_newDeposit_1).to.be.equal(alice_topUp_1);
        const alice_btc_balance = await BTC.balanceOf(alice.address);
        expect(alice_btc_balance).to.be.equal(1980098); // 0.02 BTC - 0.5% liquidation fee

        // get system reward terms
        const S_1 = await stockPool.epochToScaleToCollTokenToSum(1, 0, BTC);
        expect(S_1).to.be.equal(0n); // pool is empty...
        const P_1 = await stockPool.P();
        expect(P_1).to.be.equal(parseUnits('1'));

        // check Alice's new snapshot is correct
        const alice_Snapshot_S_1 = await stockPool.getDepositorCollGain(alice, BTC);
        expect(alice_Snapshot_S_1).to.be.equal(0n); // is 0, because alice claimed all coll rewards by providing more stability
        const alice_Snapshot_P_1 = (await stockPool.depositSnapshots(alice)).P;
        expect(alice_Snapshot_P_1).to.be.equal(P_1);

        // Bob withdraws stock and deposits to StabilityPool
        await openTrove({
          from: bob,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
          debts: [{ tokenAddress: STOCK, amount: parseUnits('1') }],
        });
        await stabilityPoolManager.connect(bob).provideStability([{ tokenAddress: STOCK, amount: parseUnits('1', 5) }]);

        // Defaulter 3 Trove is closed
        // 0.02 BTC, 50% alice, 50% bob
        await liquidationOperations.liquidate(defaulter_3, od.data, { value: od.fee });

        const P_2 = await stockPool.P();
        expect(P_2).to.be.lt(P_1);
        const S_2 = await stockPool.epochToScaleToCollTokenToSum(1, 0, BTC);
        expect(S_2).to.be.gt(S_1); // should be larger because some btc is added throw the defaulter 3 liquidation

        const alice_Snapshot_S_2 = await stockPool.getDepositorCollGain(alice, BTC);
        expect(alice_Snapshot_S_2).to.be.eq(S_2 / parseUnits('1'));

        // Alice makes deposit #3:
        await stabilityPoolManager
          .connect(alice)
          .provideStability([{ tokenAddress: STOCK, amount: parseUnits('1', 5) }]);

        // check Alice's new snapshot is correct
        const alice_Snapshot_P_2 = (await stockPool.depositSnapshots(alice)).P;
        expect(alice_Snapshot_P_2).to.be.eq(P_2);
      });

      it('reverts if user tries to provide more than their STOCK balance', async () => {
        await STOCK.unprotectedMint(alice, 200n);
        await STOCK.unprotectedMint(bob, 200n);
        const aliceBalance = await STOCK.balanceOf(alice);
        const bobBalance = await STOCK.balanceOf(bob);

        // Alice, attempts to deposit 1 wei more than her balance
        const aliceTxPromise = stabilityPoolManager
          .connect(alice)
          .provideStability([{ tokenAddress: STOCK, amount: aliceBalance + 1n }]);
        await assertRevert(aliceTxPromise);

        // Bob, attempts to deposit 23000n more than his balance
        const bobTxPromise = stabilityPoolManager
          .connect(bob)
          .provideStability([{ tokenAddress: STOCK, amount: bobBalance + 23000n }]);
        await assertRevert(bobTxPromise);
      });

      it('reverts if user tries to provide 2^256-1 STABLE, which exceeds their balance', async () => {
        await STOCK.unprotectedMint(alice, 200n);

        // Alice attempts to deposit 2^256-1
        const aliceTxPromise = stabilityPoolManager
          .connect(alice)
          .provideStability([{ tokenAddress: STOCK, amount: 2 ^ 256 }]);
        await assertRevert(aliceTxPromise);
      });

      it("doesn't impact other users' deposits or coll gains", async () => {
        await whaleShrimpTroveInit(contracts, signers);

        // Price drops
        await setPrice('BTC', '9500', contracts);

        // 2 defaulters are closed
        const od = await generatePriceUpdateDataWithFee(contracts);
        await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee });
        await liquidationOperations.liquidate(defaulter_2, od.data, { value: od.fee });

        const stockPool = await getStabilityPool(contracts, STABLE);
        const alice_stableDeposit_Before = await stockPool.getCompoundedDebtDeposit(alice);
        const bob_stableDeposit_Before = await stockPool.getCompoundedDebtDeposit(bob);
        const carol_stableDeposit_Before = await stockPool.getCompoundedDebtDeposit(carol);

        const alice_btc_gain_before = await stockPool.getDepositorCollGain(alice, BTC);
        const bob_btc_gain_before = await stockPool.getDepositorCollGain(bob, BTC);
        const carol_btc_gain_before = await stockPool.getDepositorCollGain(carol, BTC);

        //check non-zero stock and coll Gain in the Stability Pool
        const stockInPool = await stockPool.getTotalDeposit();
        const btcInPool = (await stockPool.getTotalGainedColl()).find(d => d.tokenAddress === BTC.target)?.amount;
        expect(stockInPool).to.be.gt(0);
        expect(btcInPool).to.be.gt(0);

        // D makes an SP deposit
        await stabilityPoolManager
          .connect(dennis)
          .provideStability([{ tokenAddress: STABLE, amount: parseUnits('300') }]);

        const alice_stableDeposit_after = await stockPool.getCompoundedDebtDeposit(alice);
        const bob_stableDeposit_after = await stockPool.getCompoundedDebtDeposit(bob);
        const carol_stableDeposit_after = await stockPool.getCompoundedDebtDeposit(carol);

        const alice_btc_gain_after = await stockPool.getDepositorCollGain(alice, BTC);
        const bob_btc_gain_after = await stockPool.getDepositorCollGain(bob, BTC);
        const carol_btc_gain_after = await stockPool.getDepositorCollGain(carol, BTC);

        // Check compounded deposits and ETH gains for A, B and C have not changed
        expect(alice_stableDeposit_Before).to.be.equal(alice_stableDeposit_after);
        expect(bob_stableDeposit_Before).to.be.equal(bob_stableDeposit_after);
        expect(carol_stableDeposit_Before).to.be.equal(carol_stableDeposit_after);

        expect(alice_btc_gain_before).to.be.equal(alice_btc_gain_after);
        expect(bob_btc_gain_before).to.be.equal(bob_btc_gain_after);
        expect(carol_btc_gain_before).to.be.equal(carol_btc_gain_after);
      });

      it("doesn't impact system debt, collateral or TCR", async () => {
        await whaleShrimpTroveInit(contracts, signers);

        // Price drops
        await setPrice('BTC', '9500', contracts);

        // Defaulters are liquidated
        const od = await generatePriceUpdateDataWithFee(contracts);
        await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee });
        await liquidationOperations.liquidate(defaulter_2, od.data, { value: od.fee });

        const activeDebt_Before = await storagePool.getValue(STABLE, false, 0);
        const defaultedDebt_Before = await storagePool.getValue(STABLE, false, 1);
        const activeColl_Before = await storagePool.getValue(BTC, true, 0);
        const defaultedColl_Before = await storagePool.getValue(BTC, true, 1);
        const [, tcrBefore, ,] = await storagePool.checkRecoveryMode();

        // D makes an SP deposit
        await stabilityPoolManager
          .connect(dennis)
          .provideStability([{ tokenAddress: STABLE, amount: parseUnits('300') }]);

        const activeDebt_After = await storagePool.getValue(STABLE, false, 0);
        const defaultedDebt_After = await storagePool.getValue(STABLE, false, 1);
        const activeColl_After = await storagePool.getValue(BTC, true, 0);
        const defaultedColl_After = await storagePool.getValue(BTC, true, 1);
        const [, tcrAfter, ,] = await storagePool.checkRecoveryMode();

        // Check total system debt, collateral and TCR have not changed after a Stability deposit is made
        expect(activeDebt_Before).to.be.equal(activeDebt_After);
        expect(defaultedDebt_Before).to.be.equal(defaultedDebt_After);
        expect(activeColl_Before).to.be.equal(activeColl_After);
        expect(defaultedColl_Before).to.be.equal(defaultedColl_After);
        expect(tcrBefore).to.be.equal(tcrAfter);
      });

      it("doesn't impact any troves, including the caller's trove", async () => {
        await whaleShrimpTroveInit(contracts, signers);

        // Price drops
        await setPrice('BTC', '9500', contracts);

        // Get debt, collateral and ICR of all existing troves
        const whale_Debt_Before = (await troveManager.getTroveDebt(whale))[0][1];
        const alice_Debt_Before = (await troveManager.getTroveDebt(alice))[0][1];
        const bob_Debt_Before = (await troveManager.getTroveDebt(bob))[0][1];
        const carol_Debt_Before = (await troveManager.getTroveDebt(carol))[0][1];
        const dennis_Debt_Before = (await troveManager.getTroveDebt(dennis))[0][1];

        const whale_Coll_Before = (await troveManager.getTroveColl(whale))[0][1];
        const alice_Coll_Before = (await troveManager.getTroveColl(alice))[0][1];
        const bob_Coll_Before = (await troveManager.getTroveColl(bob))[0][1];
        const carol_Coll_Before = (await troveManager.getTroveColl(carol))[0][1];
        const dennis_Coll_Before = (await troveManager.getTroveColl(dennis))[0][1];

        const whale_ICR_Before = (await hintHelpers.getCurrentICR(whale))[0];
        const alice_ICR_Before = (await hintHelpers.getCurrentICR(alice))[0];
        const bob_ICR_Before = (await hintHelpers.getCurrentICR(bob))[0];
        const carol_ICR_Before = (await hintHelpers.getCurrentICR(carol))[0];
        const dennis_ICR_Before = (await hintHelpers.getCurrentICR(dennis))[0];

        // D makes an SP deposit
        await stabilityPoolManager
          .connect(dennis)
          .provideStability([{ tokenAddress: STABLE, amount: parseUnits('300') }]);

        const whale_Debt_After = (await troveManager.getTroveDebt(whale))[0][1];
        const alice_Debt_After = (await troveManager.getTroveDebt(alice))[0][1];
        const bob_Debt_After = (await troveManager.getTroveDebt(bob))[0][1];
        const carol_Debt_After = (await troveManager.getTroveDebt(carol))[0][1];
        const dennis_Debt_After = (await troveManager.getTroveDebt(dennis))[0][1];

        const whale_Coll_After = (await troveManager.getTroveColl(whale))[0][1];
        const alice_Coll_After = (await troveManager.getTroveColl(alice))[0][1];
        const bob_Coll_After = (await troveManager.getTroveColl(bob))[0][1];
        const carol_Coll_After = (await troveManager.getTroveColl(carol))[0][1];
        const dennis_Coll_After = (await troveManager.getTroveColl(dennis))[0][1];

        const whale_ICR_After = (await hintHelpers.getCurrentICR(whale))[0];
        const alice_ICR_After = (await hintHelpers.getCurrentICR(alice))[0];
        const bob_ICR_After = (await hintHelpers.getCurrentICR(bob))[0];
        const carol_ICR_After = (await hintHelpers.getCurrentICR(carol))[0];
        const dennis_ICR_After = (await hintHelpers.getCurrentICR(dennis))[0];

        expect(whale_Debt_Before).to.be.equal(whale_Debt_After);
        expect(alice_Debt_Before).to.be.equal(alice_Debt_After);
        expect(bob_Debt_Before).to.be.equal(bob_Debt_After);
        expect(carol_Debt_Before).to.be.equal(carol_Debt_After);
        expect(dennis_Debt_Before).to.be.equal(dennis_Debt_After);

        expect(whale_Coll_Before).to.be.equal(whale_Coll_After);
        expect(alice_Coll_Before).to.be.equal(alice_Coll_After);
        expect(bob_Coll_Before).to.be.equal(bob_Coll_After);
        expect(carol_Coll_Before).to.be.equal(carol_Coll_After);
        expect(dennis_Coll_Before).to.be.equal(dennis_Coll_After);

        expect(whale_ICR_Before).to.be.equal(whale_ICR_After);
        expect(alice_ICR_Before).to.be.equal(alice_ICR_After);
        expect(bob_ICR_Before).to.be.equal(bob_ICR_After);
        expect(carol_ICR_Before).to.be.equal(carol_ICR_After);
        expect(dennis_ICR_Before).to.be.equal(dennis_ICR_After);
      });

      it("doesn't protect the depositor's trove from liquidation", async () => {
        await whaleShrimpTroveInit(contracts, signers);

        // Confirm Bob has a Stability deposit
        expect(
          (await stabilityPoolManager.connect(bob).getCompoundedDeposits()).find(d => d.tokenAddress === STABLE.target)
            ?.amount
        ).to.be.equal(parseUnits('2000'));

        // Price drops
        await setPrice('BTC', '100', contracts);

        // Liquidate bob
        const od = await generatePriceUpdateDataWithFee(contracts);
        await liquidationOperations.liquidate(bob, od.data, { value: od.fee });

        // Check Bob's trove has been removed from the system
        expect(await troveManager.getTroveStatus(bob)).to.be.equal(4n); // check Bob's trove status was closed by liquidation in recovery mode
      });

      it('providing 0 stable reverts', async () => {
        await whaleShrimpTroveInit(contracts, signers);

        const StableInSP_Before = (await stabilityPoolManager.getTotalDeposits()).find(
          d => d.tokenAddress === STABLE.target
        )?.[1];
        expect(StableInSP_Before).to.be.equal(parseUnits('6000'));

        // Bob provides 0 stable to the Stability Pool
        const bobTxPromise = stabilityPoolManager
          .connect(alice)
          .provideStability([{ tokenAddress: STOCK, amount: 0n }]);
        await assertRevert(bobTxPromise);
      });

      it('new deposit: depositor does not receive ETH gains', async () => {
        await openTrove({
          from: whale,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('5000') }],
        });

        // Whale transfers stable to A
        await STABLE.connect(whale).transfer(alice, parseUnits('500'));

        // B open troves
        await openTrove({
          from: bob,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('2000') }],
        });

        // --- TEST ---

        // get current ETH balances
        const A_btcBalance_Before = await BTC.balanceOf(alice.address);
        const B_btcBalance_Before = await BTC.balanceOf(bob.address);

        // provide to SP
        await stabilityPoolManager
          .connect(alice)
          .provideStability([{ tokenAddress: STABLE, amount: parseUnits('500') }]);
        await stabilityPoolManager
          .connect(bob)
          .provideStability([{ tokenAddress: STABLE, amount: parseUnits('2000') }]);

        // Get  ETH balances after
        const A_btcBalance_After = await BTC.balanceOf(alice.address);
        const B_btcBalance_After = await BTC.balanceOf(bob.address);

        // Check ETH balances have not changed
        expect(A_btcBalance_Before).to.be.equal(A_btcBalance_After);
        expect(B_btcBalance_Before).to.be.equal(B_btcBalance_After);
      });

      it('new deposit after past full withdrawal: depositor does not receive btc gains', async () => {
        await whaleShrimpTroveInit(contracts, signers);

        // time passes
        await fastForwardTime(TimeValues.SECONDS_IN_ONE_HOUR);

        // whale deposits. A,B,C,D earn gov token
        await stabilityPoolManager
          .connect(whale)
          .provideStability([{ tokenAddress: STABLE, amount: parseUnits('1000') }]);

        // Price drops, defaulter is liquidated, A, B, C, D earn btc
        await setPrice('BTC', '9500', contracts);
        const od = await generatePriceUpdateDataWithFee(contracts);
        await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee });

        // Price bounces back
        await setPrice('BTC', '21000', contracts);

        // A whale fully withdraw from the pool
        await stabilityPoolManager
          .connect(whale)
          .withdrawStability([{ tokenAddress: STABLE, amount: parseUnits('1000') }]); // gets paid out a little bit more because of the defaulter liquidation/compensation

        // --- TEST ---

        // get current btc balances
        const whale_btcBalance_Before = await BTC.balanceOf(whale.address);

        // provide to SP
        await stabilityPoolManager
          .connect(whale)
          .provideStability([{ tokenAddress: STABLE, amount: parseUnits('1000') }]);

        const whale_btcBalance_After = await BTC.balanceOf(whale.address);

        // Check ETH balances have not changed
        expect(whale_btcBalance_Before).to.be.equal(whale_btcBalance_After);
      });

      it('reverts when amount is zero', async () => {
        await openTrove({
          from: whale,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('1850') }],
        });
        await openTrove({
          from: alice,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('1000') }],
        });

        // Whale transfers stable to bob
        await STABLE.connect(whale).transfer(bob, parseUnits('100'));

        await assertRevert(
          stabilityPoolManager.connect(whale).provideStability([{ tokenAddress: STABLE, amount: 0n }]),
          'ZeroAmount()'
        );
        await assertRevert(
          stabilityPoolManager.connect(alice).provideStability([{ tokenAddress: STABLE, amount: 0n }]),
          'ZeroAmount()'
        );
        await assertRevert(
          stabilityPoolManager.connect(bob).provideStability([{ tokenAddress: STABLE, amount: 0n }]),
          'ZeroAmount()'
        );
      });

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

    describe('withdrawFromSP()', () => {
      it('partial retrieval - retrieves correct stable amount and the entire btc Gain, and updates deposit', async () => {
        // --- SETUP ---
        await whaleShrimpTroveInit(contracts, signers);

        const stabilityPool = await getStabilityPool(contracts, STABLE);
        const stableInPoolA = await stabilityPool.getTotalDeposit();
        expect(stableInPoolA).to.be.equal(parseUnits('6000'));

        // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
        await setPrice('BTC', '5000', contracts);

        // 2 users with Trove with stable drawn are closed
        // @ts-ignore
        const od = await generatePriceUpdateDataWithFee(contracts);
        const [liquidatedDebts_1] = await getEmittedLiquidationValues(
          await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee }),
          contracts
        );
        const [liquidatedDebts_2] = await getEmittedLiquidationValues(
          await liquidationOperations.liquidate(defaulter_2, od.data, { value: od.fee }),
          contracts
        );

        // Alice stable loss
        const aliceStabilityPoolStake = parseUnits('1') / 6n; // based on the whaleShrimpTroveInit() setup
        const expectedStableLoss =
          liquidatedDebts_1.find((d: any) => d[0] === STABLE.target)?.[1] +
          liquidatedDebts_2.find((d: any) => d[0] === STABLE.target)?.[1];
        const aliceInitialPoolDeposit = parseUnits('1000');
        const expectedCompoundedStableDeposit_A =
          aliceInitialPoolDeposit - (expectedStableLoss * aliceStabilityPoolStake) / parseUnits('1');
        const compoundedStableDeposit_A =
          (await stabilityPoolManager.connect(alice).getCompoundedDeposits()).find(
            d => d.tokenAddress === STABLE.target
          )?.amount ?? 0n;
        expect(expectedCompoundedStableDeposit_A - compoundedStableDeposit_A).to.be.lt(5000);

        // Alice retrieves part of her entitled stable
        await stabilityPoolManager
          .connect(alice)
          .withdrawStability([{ tokenAddress: STABLE, amount: parseUnits('1000') }]);
        const aliceStableBalanceAfterWithdrawal = await STABLE.balanceOf(alice);
        expect(expectedCompoundedStableDeposit_A - aliceStableBalanceAfterWithdrawal).to.be.lt(5000);

        // check Alice's deposit has been updated to equal her compounded deposit minus her withdrawal */
        const compoundedStableDeposit_B = (await stabilityPoolManager.connect(alice).getCompoundedDeposits()).find(
          d => d.tokenAddress === STABLE.target
        )?.amount;
        expect(compoundedStableDeposit_B).to.be.equal(0);

        // Expect Alice has withdrawn all ETH gain
        const alice_pendingBTCGain = await stabilityPool.getDepositorCollGain(alice, BTC);
        expect(alice_pendingBTCGain).to.be.equal(0);

        // correct remaining total debt in stability pool
        const stableInPoolB = await stabilityPool.getTotalDeposit();
        expect(stableInPoolA - aliceStableBalanceAfterWithdrawal - expectedStableLoss - stableInPoolB).to.be.lt(5000);
      });

      it('partial retrieval - leaves the correct amount of stable in the Stability Pool', async () => {
        // --- SETUP ---
        await whaleShrimpTroveInit(contracts, signers);

        const stabilityPool = await getStabilityPool(contracts, STABLE);
        const stableInPoolA = await stabilityPool.getTotalDeposit();
        expect(stableInPoolA).to.be.equal(parseUnits('6000'));

        // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
        await setPrice('BTC', '5000', contracts);

        // 2 users with Trove with stable drawn are closed
        // @ts-ignore
        const od = await generatePriceUpdateDataWithFee(contracts);
        const [liquidatedDebts_1] = await getEmittedLiquidationValues(
          await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee }),
          contracts
        );
        const [liquidatedDebts_2] = await getEmittedLiquidationValues(
          await liquidationOperations.liquidate(defaulter_2, od.data, { value: od.fee }),
          contracts
        );

        // Alice retrieves part of her entitled stable
        await stabilityPoolManager
          .connect(alice)
          .withdrawStability([{ tokenAddress: STABLE, amount: parseUnits('500') }]);

        const expectedRemainingStable =
          stableInPoolA -
          liquidatedDebts_1.find((d: any) => d[0] === STABLE.target)?.[1] -
          liquidatedDebts_2.find((d: any) => d[0] === STABLE.target)?.[1] -
          (await STABLE.balanceOf(alice));

        const stableInPoolB = await stabilityPool.getTotalDeposit();
        expect(expectedRemainingStable - stableInPoolB).to.be.lt(5000);
      });

      it('Subsequent deposit and withdrawal attempt from same account, with no intermediate liquidations, withdraws zero ETH', async () => {
        // --- SETUP ---
        await whaleShrimpTroveInit(contracts, signers);

        // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
        await setPrice('BTC', '5000', contracts);

        // 2 users with Trove with stable drawn are closed
        const od = await generatePriceUpdateDataWithFee(contracts);
        await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee });
        await liquidationOperations.liquidate(defaulter_2, od.data, { value: od.fee });

        // Alice retrieves all of her entitled stable:
        await stabilityPoolManager
          .connect(alice)
          .withdrawStability([{ tokenAddress: STABLE, amount: parseUnits('1000') }]);

        const stabilityPool = await getStabilityPool(contracts, STABLE);
        expect(await stabilityPool.getDepositorCollGain(alice, BTC)).to.be.equal(0);

        // Alice makes second deposit
        await stabilityPoolManager
          .connect(alice)
          .provideStability([{ tokenAddress: STABLE, amount: parseUnits('500') }]);
        expect(await stabilityPool.getDepositorCollGain(alice, BTC)).to.be.equal(0);

        const BTCinSP_Before = (await stabilityPool.getTotalGainedColl()).find(
          d => d.tokenAddress === BTC.target
        )?.amount;

        // Alice attempts second withdrawal
        await stabilityPoolManager
          .connect(alice)
          .withdrawStability([{ tokenAddress: STABLE, amount: parseUnits('500') }]);
        expect(await stabilityPool.getDepositorCollGain(alice, BTC)).to.be.equal(0);

        // Check ETH in pool does not change
        const BTCinSP_After = (await stabilityPool.getTotalGainedColl()).find(
          d => d.tokenAddress === BTC.target
        )?.amount;
        expect(BTCinSP_Before).to.be.equal(BTCinSP_After);

        // Third deposit
        await stabilityPoolManager
          .connect(alice)
          .provideStability([{ tokenAddress: STABLE, amount: parseUnits('500') }]);
        expect(await stabilityPool.getDepositorCollGain(alice, BTC)).to.be.equal(0);
      });

      it("it correctly updates the user's stable and btc snapshots of entitled reward per unit staked", async () => {
        await whaleShrimpTroveInit(contracts, signers);
        const stabilityPool = await getStabilityPool(contracts, STABLE);

        // check 'Before' snapshots
        const alice_snapshot_S_Before = await stabilityPool.getDepositorCollSnapshot(alice, BTC);
        const alice_snapshot_P_Before = (await stabilityPool.depositSnapshots(alice)).P;
        expect(alice_snapshot_S_Before).to.be.equal(0);
        expect(alice_snapshot_P_Before).to.be.equal('1000000000000000000');

        // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
        await setPrice('BTC', '5000', contracts);

        // 2 defaulters liquidated
        const od = await generatePriceUpdateDataWithFee(contracts);
        await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee });
        await liquidationOperations.liquidate(defaulter_2, od.data, { value: od.fee });

        // Alice retrieves part of her entitled stable
        await stabilityPoolManager
          .connect(alice)
          .withdrawStability([{ tokenAddress: STABLE, amount: parseUnits('500') }]);

        const P = await stabilityPool.P();
        const S = await stabilityPool.epochToScaleToCollTokenToSum(0, 0, BTC);
        // check 'After' snapshots
        const alice_snapshot_S_After = await stabilityPool.getDepositorCollSnapshot(alice, BTC);
        const alice_snapshot_P_After = (await stabilityPool.depositSnapshots(alice)).P;
        expect(alice_snapshot_S_After).to.be.equal(S);
        expect(alice_snapshot_P_After).to.be.equal(P);
      });

      it('decreases StabilityPool ETH', async () => {
        // --- SETUP ---
        await whaleShrimpTroveInit(contracts, signers);
        const stabilityPool = await getStabilityPool(contracts, STABLE);

        // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
        await setPrice('BTC', '5000', contracts);

        const [isRecoveryMode] = await storagePool.checkRecoveryMode();
        expect(isRecoveryMode).to.be.equal(false);

        // @ts-ignore
        const od = await generatePriceUpdateDataWithFee(contracts);
        const [, liquidatedColls] = await getEmittedLiquidationValues(
          await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee }),
          contracts
        );

        const btcStablePoolGain = liquidatedColls.find((d: any) => d[0] === BTC.target)?.[1];
        expect(btcStablePoolGain).to.be.equal(await BTC.balanceOf(stabilityPool.target));

        const aliceStabilityPoolStake = parseUnits('1') / 6n; // based on the whaleShrimpTroveInit() setup
        const aliceExpectedBTCGain = (btcStablePoolGain * aliceStabilityPoolStake) / parseUnits('1');
        const aliceBTCGain = await stabilityPool.getDepositorCollGain(alice, BTC);
        expect(aliceExpectedBTCGain - aliceBTCGain).to.be.lt(5000);

        //Get ActivePool and StabilityPool Ether before retrieval:
        const active_BTC_Before = await storagePool.getValue(BTC, true, 0);
        const stability_BTC_Before =
          (await stabilityPool.getTotalGainedColl()).find(d => d.tokenAddress === BTC.target)?.amount ?? 0n;

        // Alice retrieves all of her deposit
        await stabilityPoolManager
          .connect(alice)
          .withdrawStability([{ tokenAddress: STABLE, amount: parseUnits('1000') }]);

        const active_BTC_After = await storagePool.getValue(BTC, true, 0);
        expect(active_BTC_Before).to.be.equal(active_BTC_After);

        // Expect StabilityPool to have decreased by Alice's ETHGain
        const stability_BTC_After =
          (await stabilityPool.getTotalGainedColl()).find(d => d.tokenAddress === BTC.target)?.amount ?? 0n;
        expect(stability_BTC_Before - stability_BTC_After - aliceBTCGain).to.be.lt(5000);
      });

      it('All depositors are able to withdraw from the SP to their account', async () => {
        await whaleShrimpTroveInit(contracts, signers);

        // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
        await setPrice('BTC', '5000', contracts);
        const od = await generatePriceUpdateDataWithFee(contracts);
        await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee });

        // All depositors attempt to withdraw
        await stabilityPoolManager
          .connect(alice)
          .withdrawStability([{ tokenAddress: STABLE, amount: parseUnits('5000') }]); // gets paid out a little bit more because of the defaulter liquidation/compensation
        await stabilityPoolManager
          .connect(bob)
          .withdrawStability([{ tokenAddress: STABLE, amount: parseUnits('5000') }]); // gets paid out a little bit more because of the defaulter liquidation/compensation
        await stabilityPoolManager
          .connect(carol)
          .withdrawStability([{ tokenAddress: STABLE, amount: parseUnits('5000') }]); // gets paid out a little bit more because of the defaulter liquidation/compensation

        const stabilityPool = await getStabilityPool(contracts, STABLE);
        const totalDeposits = await stabilityPool.getTotalDeposit();
        expect(totalDeposits).to.be.lt(10000);
      });

      it("increases depositor's stable token balance by the expected amount", async () => {
        await whaleShrimpTroveInit(contracts, signers);

        const stabilityPool = await getStabilityPool(contracts, STABLE);
        const poolDebtBefore = await STABLE.balanceOf(stabilityPool.target);
        expect(poolDebtBefore).to.be.equal(parseUnits('6000'));

        // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
        await setPrice('BTC', '5000', contracts);
        await contracts.reservePool.setRelativeStableCap(0);
        const od = await generatePriceUpdateDataWithFee(contracts);
        await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee });

        const poolDebtAfter = await STABLE.balanceOf(stabilityPool.target);
        expect(poolDebtAfter).to.be.equal(parseUnits('6000') - BigInt(Number(parseUnits('100')) * 0.995)); // defaulters' debt got compensated

        // Bob issues a further 1000 stable from his trove
        const bobsNewDebts = parseUnits('1000');
        await increaseDebt(bob, contracts, [{ tokenAddress: STABLE, amount: bobsNewDebts }]);

        // alive 1/6 of 100 = 16.66
        await stabilityPoolManager
          .connect(alice)
          .withdrawStability([{ tokenAddress: STABLE, amount: parseUnits('5000') }]);
        expect((await STABLE.balanceOf(alice)) - poolDebtAfter / 6n).to.be.lt(1000);

        // bob 2/6 of 100 = 33.33
        await stabilityPoolManager
          .connect(bob)
          .withdrawStability([{ tokenAddress: STABLE, amount: parseUnits('5000') }]);
        expect((await STABLE.balanceOf(bob)) - (poolDebtAfter / 6n) * 2n - bobsNewDebts).to.be.lt(1000);

        // carol 3/6 of 100 = 50
        await stabilityPoolManager
          .connect(carol)
          .withdrawStability([{ tokenAddress: STABLE, amount: parseUnits('5000') }]);
        expect((await STABLE.balanceOf(carol)) - (poolDebtAfter / 6n) * 3n).to.be.lt(1000);
      });

      it("doesn't impact other users Stability deposits or coll gains", async () => {
        await whaleShrimpTroveInit(contracts, signers);

        // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
        await setPrice('BTC', '5000', contracts);
        const od = await generatePriceUpdateDataWithFee(contracts);
        await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee });
        await liquidationOperations.liquidate(defaulter_2, od.data, { value: od.fee });

        const stabilityPool = await getStabilityPool(contracts, STABLE);
        const alice_Deposit_Before = (await stabilityPool.getCompoundedDebtDeposit(alice)).toString();
        const alice_Gain_Before = (await stabilityPool.getDepositorCollGain(alice, BTC)).toString();

        // Carol withdraws her Stability deposit
        await stabilityPoolManager
          .connect(carol)
          .withdrawStability([{ tokenAddress: STABLE, amount: parseUnits('5000') }]);

        const alice_Deposit_After = (await stabilityPool.getCompoundedDebtDeposit(alice)).toString();
        const alice_Gain_After = (await stabilityPool.getDepositorCollGain(alice, BTC)).toString();

        // Check compounded deposits and coll gains for A and B have not changed
        assert.equal(alice_Deposit_Before, alice_Deposit_After);
        assert.equal(alice_Gain_Before, alice_Gain_After);
      });

      it("doesn't impact system debt, collateral or TCR ", async () => {
        await whaleShrimpTroveInit(contracts, signers);

        // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
        await setPrice('BTC', '5000', contracts);
        const od = await generatePriceUpdateDataWithFee(contracts);
        await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee });
        await liquidationOperations.liquidate(defaulter_2, od.data, { value: od.fee });

        const activeDebt_Before = await storagePool.getValue(STABLE, false, 0);
        const defaultedDebt_Before = await storagePool.getValue(STABLE, false, 1);
        const activeColl_Before = await storagePool.getValue(BTC, true, 0);
        const defaultedColl_Before = await storagePool.getValue(BTC, true, 1);
        const [, tcrBefore, ,] = await storagePool.checkRecoveryMode();

        // Carol withdraws her Stability deposit
        await stabilityPoolManager
          .connect(carol)
          .withdrawStability([{ tokenAddress: STABLE, amount: parseUnits('5000') }]);

        const activeDebt_After = await storagePool.getValue(STABLE, false, 0);
        const defaultedDebt_After = await storagePool.getValue(STABLE, false, 1);
        const activeColl_After = await storagePool.getValue(BTC, true, 0);
        const defaultedColl_After = await storagePool.getValue(BTC, true, 1);
        const [, tcrAfter, ,] = await storagePool.checkRecoveryMode();

        // Check total system debt, collateral and TCR have not changed after a Stability deposit is made
        assert.equal(activeDebt_Before, activeDebt_After);
        assert.equal(defaultedDebt_Before, defaultedDebt_After);
        assert.equal(activeColl_Before, activeColl_After);
        assert.equal(defaultedColl_Before, defaultedColl_After);
        assert.equal(tcrBefore, tcrAfter);
      });

      it("doesn't impact any troves, including the caller's trove", async () => {
        await whaleShrimpTroveInit(contracts, signers);

        // price drops: defaulters' Troves fall below MCR, alice and whale Trove remain active
        await setPrice('BTC', '5000', contracts);
        const od = await generatePriceUpdateDataWithFee(contracts);
        await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee });
        await liquidationOperations.liquidate(defaulter_2, od.data, { value: od.fee });

        // Get debt, collateral and ICR of all existing troves
        const whale_Debt_Before = (await troveManager.getTroveDebt(whale))[0][1];
        const alice_Debt_Before = (await troveManager.getTroveDebt(alice))[0][1];
        const bob_Debt_Before = (await troveManager.getTroveDebt(bob))[0][1];
        const carol_Debt_Before = (await troveManager.getTroveDebt(carol))[0][1];

        const whale_Coll_Before = (await troveManager.getTroveColl(whale))[0][1];
        const alice_Coll_Before = (await troveManager.getTroveColl(alice))[0][1];
        const bob_Coll_Before = (await troveManager.getTroveColl(bob))[0][1];
        const carol_Coll_Before = (await troveManager.getTroveColl(carol))[0][1];

        const whale_ICR_Before = (await hintHelpers.getCurrentICR(whale))[0];
        const alice_ICR_Before = (await hintHelpers.getCurrentICR(alice))[0];
        const bob_ICR_Before = (await hintHelpers.getCurrentICR(bob))[0];
        const carol_ICR_Before = (await hintHelpers.getCurrentICR(carol))[0];

        // Carol withdraws her Stability deposit
        await stabilityPoolManager
          .connect(carol)
          .withdrawStability([{ tokenAddress: STABLE, amount: parseUnits('5000') }]);

        const whale_Debt_After = (await troveManager.getTroveDebt(whale))[0][1];
        const alice_Debt_After = (await troveManager.getTroveDebt(alice))[0][1];
        const bob_Debt_After = (await troveManager.getTroveDebt(bob))[0][1];
        const carol_Debt_After = (await troveManager.getTroveDebt(carol))[0][1];

        const whale_Coll_After = (await troveManager.getTroveColl(whale))[0][1];
        const alice_Coll_After = (await troveManager.getTroveColl(alice))[0][1];
        const bob_Coll_After = (await troveManager.getTroveColl(bob))[0][1];
        const carol_Coll_After = (await troveManager.getTroveColl(carol))[0][1];

        const whale_ICR_After = (await hintHelpers.getCurrentICR(whale))[0];
        const alice_ICR_After = (await hintHelpers.getCurrentICR(alice))[0];
        const bob_ICR_After = (await hintHelpers.getCurrentICR(bob))[0];
        const carol_ICR_After = (await hintHelpers.getCurrentICR(carol))[0];

        // Check all troves are unaffected by Carol's Stability deposit withdrawal
        assert.equal(whale_Debt_Before, whale_Debt_After);
        assert.equal(alice_Debt_Before, alice_Debt_After);
        assert.equal(bob_Debt_Before, bob_Debt_After);
        assert.equal(carol_Debt_Before, carol_Debt_After);

        assert.equal(whale_Coll_Before, whale_Coll_After);
        assert.equal(alice_Coll_Before, alice_Coll_After);
        assert.equal(bob_Coll_Before, bob_Coll_After);
        assert.equal(carol_Coll_Before, carol_Coll_After);

        assert.equal(whale_ICR_Before, whale_ICR_After);
        assert.equal(alice_ICR_Before, alice_ICR_After);
        assert.equal(bob_ICR_Before, bob_ICR_After);
        assert.equal(carol_ICR_Before, carol_ICR_After);
      });

      it("withdrawing 0 stable doesn't alter the caller's deposit or the total stable in the Stability Pool", async () => {
        await whaleShrimpTroveInit(contracts, signers);
        const stabilityPool = await getStabilityPool(contracts, STABLE);

        const bob_Deposit_Before = await stabilityPool.getCompoundedDebtDeposit(bob);
        const LUSDinSP_Before = await stabilityPool.getTotalDeposit();
        assert.equal(LUSDinSP_Before, parseUnits('6000'));

        // Bob withdraws 0 LUSD from the Stability Pool
        await stabilityPoolManager.connect(bob).withdrawStability([{ tokenAddress: STABLE, amount: parseUnits('0') }]);

        // check Bob's deposit and total LUSD in Stability Pool has not changed
        const bob_Deposit_After = await stabilityPool.getCompoundedDebtDeposit(bob);
        const LUSDinSP_After = await stabilityPool.getTotalDeposit();

        assert.equal(bob_Deposit_Before, bob_Deposit_After);
        assert.equal(LUSDinSP_Before, LUSDinSP_After);
      });

      it("withdrawing 0 ETH Gain does not alter the caller's ETH balance, their trove collateral, or the ETH  in the Stability Pool", async () => {
        await whaleShrimpTroveInit(contracts, signers);

        await setPrice('BTC', '5000', contracts);
        const od = await generatePriceUpdateDataWithFee(contracts);
        await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee });

        // Dennis opens trove and deposits to Stability Pool
        await stabilityPoolManager
          .connect(dennis)
          .provideStability([{ tokenAddress: STABLE, amount: parseUnits('300') }]);

        // Check Dennis has 0 coll gain
        const stabilityPool = await getStabilityPool(contracts, STABLE);
        const dennisCollGain = await stabilityPool.getDepositorCollGain(dennis, BTC);
        assert.equal(dennisCollGain, parseUnits('0'));

        const dennisBTCBefore = await BTC.balanceOf(dennis);
        const dennisTroveBTCCollBefore = (await troveManager.getTroveColl(dennis))[0][1];
        const btcPoolBefore = (await stabilityPool.getTotalGainedColl()).find(
          d => d.tokenAddress === BTC.target
        )?.amount;

        // Dennis withdraws his full deposit and ETHGain to his account
        await stabilityPoolManager
          .connect(dennis)
          .withdrawStability([{ tokenAddress: STABLE, amount: parseUnits('1000') }]);

        // Check withdrawal does not alter Dennis' ETH balance or his trove's collateral
        const dennisBTCAfter = await BTC.balanceOf(dennis);
        const dennisTroveBTCCollAfter = (await troveManager.getTroveColl(dennis))[0][1];
        const btcPoolAfter = (await stabilityPool.getTotalGainedColl()).find(
          d => d.tokenAddress === BTC.target
        )?.amount;

        assert.equal(dennisBTCBefore, dennisBTCAfter);
        assert.equal(dennisTroveBTCCollBefore, dennisTroveBTCCollAfter);

        // Check withdrawal has not altered the ETH in the Stability Pool
        assert.equal(btcPoolBefore, btcPoolAfter);
      });

      it("Request to withdraw > caller's deposit only withdraws the caller's compounded deposit", async () => {
        await whaleShrimpTroveInit(contracts, signers);

        await setPrice('BTC', '5000', contracts);
        const od = await generatePriceUpdateDataWithFee(contracts);
        await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee });

        const alice_Stable_Balance_Before = await STABLE.balanceOf(alice);
        const bob_Stable_Balance_Before = await STABLE.balanceOf(bob);

        const stabilityPool = await getStabilityPool(contracts, STABLE);
        const alice_Deposit_Before = await stabilityPool.getCompoundedDebtDeposit(alice);
        const bob_Deposit_Before = await stabilityPool.getCompoundedDebtDeposit(bob);
        const stableInSPBefore = await stabilityPool.getTotalDeposit();

        // Bob attempts to withdraws 1 wei more than his compounded deposit from the Stability Pool
        await stabilityPoolManager.connect(bob).withdrawStability([
          {
            tokenAddress: STABLE,
            amount: bob_Deposit_Before + BigInt(1),
          },
        ]);

        // Check Bob's LUSD balance has risen by only the value of his compounded deposit
        const bob_LUSD_Balance_After = await STABLE.balanceOf(bob);
        expect(bob_LUSD_Balance_After).to.be.closeTo(bob_Stable_Balance_Before + bob_Deposit_Before, parseUnits('0.4'));

        // Alice attempts to withdraws 2309842309.000000000000000000 LUSD from the Stability Pool
        await stabilityPoolManager
          .connect(alice)
          .withdrawStability([{ tokenAddress: STABLE, amount: parseUnits('9999999999') }]);

        // Check Alice's LUSD balance has risen by only the value of her compounded deposit
        const alice_expectedLUSDBalance = alice_Stable_Balance_Before + alice_Deposit_Before;
        const alice_LUSD_Balance_After = await STABLE.balanceOf(alice);
        expect(alice_LUSD_Balance_After).to.be.closeTo(alice_expectedLUSDBalance, parseUnits('0.2'));

        // Check LUSD in Stability Pool has been reduced by only Alice's compounded deposit and Bob's compounded deposit
        const expectedLUSDinSP = stableInSPBefore - alice_Deposit_Before - bob_Deposit_Before;
        const LUSDinSP_After = await stabilityPool.getTotalDeposit();
        assert.equal(LUSDinSP_After, expectedLUSDinSP);
      });

      it('caller can withdraw full deposit and ETH gain during Recovery Mode', async () => {
        await whaleShrimpTroveInit(contracts, signers);
        const stabilityPool = await getStabilityPool(contracts, STABLE);

        await setPrice('BTC', '5000', contracts);
        const od = await generatePriceUpdateDataWithFee(contracts);
        await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee });

        const [isRecoveryModeBefore] = await storagePool.checkRecoveryMode();
        assert.isFalse(isRecoveryModeBefore);

        const alice_LUSD_Balance_Before = await STABLE.balanceOf(alice);
        const bob_LUSD_Balance_Before = await STABLE.balanceOf(bob);
        const carol_LUSD_Balance_Before = await STABLE.balanceOf(carol);

        const alice_ETH_Balance_Before = await BTC.balanceOf(alice);
        const bob_ETH_Balance_Before = await BTC.balanceOf(bob);
        const carol_ETH_Balance_Before = await BTC.balanceOf(carol);

        const alice_Deposit_Before = await stabilityPool.getCompoundedDebtDeposit(alice);
        const bob_Deposit_Before = await stabilityPool.getCompoundedDebtDeposit(bob);
        const carol_Deposit_Before = await stabilityPool.getCompoundedDebtDeposit(carol);

        const alice_ETHGain_Before = await stabilityPool.getDepositorCollGain(alice, BTC);
        const bob_ETHGain_Before = await stabilityPool.getDepositorCollGain(bob, BTC);
        const carol_ETHGain_Before = await stabilityPool.getDepositorCollGain(carol, BTC);
        const LUSDinSP_Before = await stabilityPool.getTotalDeposit();

        // Price rises
        await setPrice('BTC', '500', contracts);
        const [isRecoveryModeAfter] = await storagePool.checkRecoveryMode();
        assert.isTrue(isRecoveryModeAfter);

        // A, B, C withdraw their full deposits from the Stability Pool
        await stabilityPoolManager
          .connect(alice)
          .withdrawStability([{ tokenAddress: STABLE, amount: parseUnits('5000') }]);
        await stabilityPoolManager
          .connect(bob)
          .withdrawStability([{ tokenAddress: STABLE, amount: parseUnits('5000') }]);
        await stabilityPoolManager
          .connect(carol)
          .withdrawStability([{ tokenAddress: STABLE, amount: parseUnits('5000') }]);

        // Check LUSD balances of A, B, C have risen by the value of their compounded deposits, respectively
        const alice_expectedLUSDBalance = alice_LUSD_Balance_Before + alice_Deposit_Before;
        const bob_expectedLUSDBalance = bob_LUSD_Balance_Before + bob_Deposit_Before;
        const carol_expectedLUSDBalance = carol_LUSD_Balance_Before + carol_Deposit_Before;

        const alice_LUSD_Balance_After = await STABLE.balanceOf(alice);
        const bob_LUSD_Balance_After = await STABLE.balanceOf(bob);
        const carol_LUSD_Balance_After = await STABLE.balanceOf(carol);

        expect(alice_LUSD_Balance_After).to.be.closeTo(alice_expectedLUSDBalance, parseUnits('0.2'));
        expect(bob_LUSD_Balance_After).to.be.closeTo(bob_expectedLUSDBalance, parseUnits('0.4'));
        expect(carol_LUSD_Balance_After).to.be.closeTo(carol_expectedLUSDBalance, parseUnits('0.5'));

        // Check ETH balances of A, B, C have increased by the value of their ETH gain from liquidations, respectively
        const alice_expectedETHBalance = alice_ETH_Balance_Before + alice_ETHGain_Before;
        const bob_expectedETHBalance = bob_ETH_Balance_Before + bob_ETHGain_Before;
        const carol_expectedETHBalance = carol_ETH_Balance_Before + carol_ETHGain_Before;

        assert.equal(alice_expectedETHBalance, await BTC.balanceOf(alice));
        assert.equal(bob_expectedETHBalance, await BTC.balanceOf(bob));
        assert.equal(carol_expectedETHBalance, await BTC.balanceOf(carol));

        // Check LUSD in Stability Pool has been reduced by A, B and C's compounded deposit
        const expectedLUSDinSP = LUSDinSP_Before - alice_Deposit_Before - bob_Deposit_Before - carol_Deposit_Before;
        const LUSDinSP_After = await stabilityPool.getTotalDeposit();
        assert.equal(LUSDinSP_After, expectedLUSDinSP);

        // Check ETH in SP has reduced to zero
        const ETHinSP_After = (await stabilityPool.getTotalGainedColl()).find(
          d => d.tokenAddress === BTC.target
        )?.amount;
        expect(ETHinSP_After).to.be.lt(10000);
      });

      it('depositor does not earn further ETH gains from liquidations while their compounded deposit == 0: ', async () => {
        await whaleShrimpTroveInit(contracts, signers);
        const stabilityPool = await getStabilityPool(contracts, STABLE);

        await openTrove({
          from: erin,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('7000') }],
        });
        await setPrice('BTC', '5000', contracts);
        const od = await generatePriceUpdateDataWithFee(contracts);
        await liquidationOperations.liquidate(erin, od.data, { value: od.fee });

        const LUSDinSP = await stabilityPool.getTotalDeposit();
        assert.equal(LUSDinSP, 0n);

        // Check Stability deposits have been fully cancelled with debt, and are now all zero
        const alice_Deposit = await stabilityPool.getCompoundedDebtDeposit(alice);
        const bob_Deposit = await stabilityPool.getCompoundedDebtDeposit(bob);
        assert.equal(alice_Deposit, 0n);
        assert.equal(bob_Deposit, 0n);

        // Get ETH gain for A and B
        const alice_ETHGain_1 = await stabilityPool.getDepositorCollGain(alice, BTC);
        const bob_ETHGain_1 = await stabilityPool.getDepositorCollGain(bob, BTC);

        // Whale deposits 1000 LUSD to Stability Pool
        await stabilityPoolManager
          .connect(whale)
          .provideStability([{ tokenAddress: STABLE, amount: parseUnits('1000') }]);

        // Liquidation 2
        await liquidationOperations.liquidate(defaulter_2, od.data, { value: od.fee });

        // Check Alice and Bob have not received ETH gain from liquidation 2 while their deposit was 0
        const alice_ETHGain_2 = await stabilityPool.getDepositorCollGain(alice, BTC);
        const bob_ETHGain_2 = await stabilityPool.getDepositorCollGain(bob, BTC);
        assert.equal(alice_ETHGain_1, alice_ETHGain_2);
        assert.equal(bob_ETHGain_1, bob_ETHGain_2);
      });
    });

    describe('withdrawGains():', () => {
      it("Applies stable loss to user's deposit, and redirects coll reward to user's wallet", async () => {
        await whaleShrimpTroveInit(contracts, signers);

        const aliceBTCBefore = await BTC.balanceOf(alice);

        await setPrice('BTC', '5000', contracts);
        const od = await generatePriceUpdateDataWithFee(contracts);
        await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee });

        const stabilityPool = await getStabilityPool(contracts, STABLE);
        const btcGainA = await stabilityPool.getDepositorCollGain(alice, BTC);
        const compoundedDeposit_A = await stabilityPool.getCompoundedDebtDeposit(alice);

        await stabilityPoolManager.connect(alice).withdrawGains();

        const compoundedDeposit_B = await stabilityPool.getCompoundedDebtDeposit(alice);
        expect(compoundedDeposit_A - compoundedDeposit_B).to.be.lt(10000);

        const aliceBTCAfter = await BTC.balanceOf(alice);
        expect(btcGainA).to.be.gt(0);
        assert.equal(aliceBTCBefore + btcGainA, aliceBTCAfter);
      });

      it('Subsequent deposit and withdrawal attempt from same account, with no intermediate liquidations, withdraws zero ETH', async () => {
        await whaleShrimpTroveInit(contracts, signers);
        const stabilityPool = await getStabilityPool(contracts, STABLE);

        await setPrice('BTC', '5000', contracts);
        const od = await generatePriceUpdateDataWithFee(contracts);
        await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee });

        await stabilityPoolManager.connect(alice).withdrawGains();

        expect(await stabilityPool.getDepositorCollGain(alice, BTC)).to.be.equal(0);

        const aliceBTCBefore = await BTC.balanceOf(alice);
        const btcInSPBefore = (await stabilityPool.getTotalGainedColl()).find(
          d => d.tokenAddress === BTC.target
        )?.amount;

        // Alice attempts second withdrawal
        await stabilityPoolManager.connect(alice).withdrawGains();

        // Check ETH in pool does not change
        const aliceBTCAfter = await BTC.balanceOf(alice);
        const btcInSPAfter = (await stabilityPool.getTotalGainedColl()).find(
          d => d.tokenAddress === BTC.target
        )?.amount;

        expect(aliceBTCAfter).to.be.equal(aliceBTCBefore);
        expect(btcInSPAfter).to.be.equal(btcInSPBefore);
      });

      it('All depositors are able to withdraw their coll gain from the SP', async () => {
        await whaleShrimpTroveInit(contracts, signers);
        const stabilityPool = await getStabilityPool(contracts, STABLE);

        await setPrice('BTC', '5000', contracts);
        const od = await generatePriceUpdateDataWithFee(contracts);
        await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee });

        // All depositors attempt to withdraw
        await stabilityPoolManager.connect(alice).withdrawGains();
        await stabilityPoolManager.connect(bob).withdrawGains();
        await stabilityPoolManager.connect(carol).withdrawGains();
        await stabilityPoolManager.connect(dennis).withdrawGains();
      });

      it('caller can withdraw full deposit and ETH gain to their wallet during Recovery Mode', async () => {
        await whaleShrimpTroveInit(contracts, signers);
        const stabilityPool = await getStabilityPool(contracts, STABLE);

        const [isRecoveryModeA] = await storagePool.checkRecoveryMode();
        assert.isFalse(isRecoveryModeA);

        const alice_Collateral_Before = await BTC.balanceOf(alice);
        const bob_Collateral_Before = await BTC.balanceOf(bob);
        const carol_Collateral_Before = await BTC.balanceOf(carol);

        await setPrice('BTC', '5000', contracts);
        const od = await generatePriceUpdateDataWithFee(contracts);
        await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee });

        await setPrice('BTC', '5', contracts);
        const [isRecoveryModeB] = await storagePool.checkRecoveryMode();
        assert.isTrue(isRecoveryModeB);

        const alice_ETHGain_Before = await stabilityPool.getDepositorCollGain(alice, BTC);
        const bob_ETHGain_Before = await stabilityPool.getDepositorCollGain(bob, BTC);
        const carol_ETHGain_Before = await stabilityPool.getDepositorCollGain(carol, BTC);

        // A, B, C withdraw their full ETH gain from the Stability Pool to their trove
        await stabilityPoolManager.connect(alice).withdrawGains();
        await stabilityPoolManager.connect(bob).withdrawGains();
        await stabilityPoolManager.connect(carol).withdrawGains();

        // Check collateral of troves A, B, C has increased by the value of their ETH gain from liquidations, respectively
        const alice_expectedCollateral = alice_Collateral_Before + alice_ETHGain_Before;
        const bob_expectedColalteral = bob_Collateral_Before + bob_ETHGain_Before;
        const carol_expectedCollateral = carol_Collateral_Before + carol_ETHGain_Before;

        const alice_Collateral_After = await BTC.balanceOf(alice);
        const bob_Collateral_After = await BTC.balanceOf(bob);
        const carol_Collateral_After = await BTC.balanceOf(carol);

        assert.equal(alice_expectedCollateral, alice_Collateral_After);
        assert.equal(bob_expectedColalteral, bob_Collateral_After);
        assert.equal(carol_expectedCollateral, carol_Collateral_After);

        // no btc left in pool, all claimed
        const btcInPool = (await stabilityPool.getTotalGainedColl()).find(d => d.tokenAddress === BTC.target)?.amount;
        expect(btcInPool).to.be.lt(10000);
      });
    });
  });
});
