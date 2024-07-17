import { ethers } from 'hardhat';
import {
  MockDebtToken,
  MockERC20,
  PriceFeed,
  MockTroveManager,
  HintHelpers,
  StabilityPoolManager,
  StoragePool,
  LiquidationOperations,
} from '../typechain';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  openTrove,
  whaleShrimpTroveInit,
  getTCR,
  TroveStatus,
  repayDebt,
  setPrice,
  buildPriceCache,
  deployTesting,
} from '../utils/testHelper';
import { assert, expect } from 'chai';
import { parseUnits, ZeroAddress } from 'ethers';
import { Contracts } from '../utils/deployTestBase';
import { generatePriceUpdateDataWithFee } from '../utils/pythHelper';

describe('TroveManager', () => {
  let signers: SignerWithAddress[];
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let whale: SignerWithAddress;
  let carol: SignerWithAddress;
  let dennis: SignerWithAddress;

  let defaulter_1: SignerWithAddress;
  let defaulter_3: SignerWithAddress;

  let storagePool: StoragePool;

  let STABLE: MockDebtToken;
  let STOCK: MockDebtToken;
  let BTC: MockERC20;
  let USDT: MockERC20;

  let priceFeed: PriceFeed;
  let troveManager: MockTroveManager;

  let stabilityPoolManager: StabilityPoolManager;
  let hintHelpers: HintHelpers;
  let liquidationOperations: LiquidationOperations;
  let contracts: Contracts;

  before(async () => {
    signers = await ethers.getSigners();
    [, defaulter_1, , defaulter_3, whale, alice, bob, carol, dennis] = signers;
  });

  beforeEach(async () => {
    contracts = await deployTesting();

    priceFeed = contracts.priceFeed;
    troveManager = contracts.troveManager;
    hintHelpers = contracts.hintHelpers;
    liquidationOperations = contracts.liquidationOperations;
    storagePool = contracts.storagePool;
    stabilityPoolManager = contracts.stabilityPoolManager;
    STABLE = contracts.STABLE;
    BTC = contracts.BTC;
    USDT = contracts.USDT;
    STOCK = contracts.STOCK;
  });

  describe('TroveOwners', () => {
    it('Should add new trove owner to the Trove Owners array', async function () {
      const prevTroveOwnersCount = await troveManager.getTroveOwnersCount();

      await openTrove({
        from: whale,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('1850') }],
      });

      const oTrove = await troveManager.Troves(whale.address);
      const newTroveOwnersCount = await troveManager.getTroveOwnersCount();

      expect(oTrove.arrayIndex).to.be.equal(prevTroveOwnersCount);
      expect(newTroveOwnersCount).to.be.equal(prevTroveOwnersCount + '1');
    });
  });

  describe('getPendingReward()', () => {
    it('liquidates a Trove that a) was skipped in a previous liquidation and b) has pending rewards', async () => {
      await openTrove({
        from: alice,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('8000') }],
      });
      await stabilityPoolManager
        .connect(alice)
        .provideStability([{ tokenAddress: STABLE, amount: parseUnits('1000') }]);

      await openTrove({
        from: bob,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('2', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('10000') }],
      });
      await openTrove({
        from: dennis,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('15000') }],
      });
      await openTrove({
        from: carol,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('14000') }],
      });

      //decrease price
      await setPrice('BTC', '15000', contracts);

      // Confirm system is not in Recovery Mode
      const [isRecoveryModeBefore] = await storagePool.checkRecoveryMode();
      assert.isFalse(isRecoveryModeBefore);

      // carol gets liquidated, creates pending rewards for all
      let od = await generatePriceUpdateDataWithFee(contracts);
      await liquidationOperations.liquidate(carol, od.data, { value: od.fee }); // -> about 25% 1 btc to alice -> 0.25BTC
      const carol_Status = await troveManager.getTroveStatus(carol);
      assert.equal(carol_Status.toString(), TroveStatus.CLOSED_BY_LIQUIDATION_IN_NORMAL_MODE.toString());
      await stabilityPoolManager.connect(carol).provideStability([{ tokenAddress: STABLE, amount: parseUnits('100') }]);

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
      od = await generatePriceUpdateDataWithFee(contracts);
      await liquidationOperations.batchLiquidateTroves([alice, dennis], od.data, { value: od.fee }); // about 1/3 btc to alice, -> 0.33BTC
      const alice_Status = await troveManager.getTroveStatus(alice);
      assert.equal(alice_Status.toString(), TroveStatus.ACTIVE.toString());
      const dennis_Status = await troveManager.getTroveStatus(dennis);
      assert.equal(dennis_Status.toString(), TroveStatus.CLOSED_BY_LIQUIDATION_IN_RECOVERY_MODE.toString());

      // remaining trove, bob repay a little debt, applying their pending rewards
      await repayDebt(bob, contracts, [{ tokenAddress: STABLE, amount: parseUnits('1000') }]);

      // Check alice is the only trove that has pending rewards
      const alicePendingBTCReward = await troveManager.getPendingRewards(alice, BTC, true);
      assert.isTrue(alicePendingBTCReward > 0);
      const bobPendingReward = await troveManager.getPendingRewards(bob, BTC, true);
      assert.isFalse(bobPendingReward > 0);

      // Check alice's pending coll and debt rewards are <= the coll and debt in the DefaultPool
      const priceCache = await buildPriceCache(contracts);
      const PendingDebtSTABLE_A = await troveManager.getPendingRewards(alice, STABLE, false);
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
      od = await generatePriceUpdateDataWithFee(contracts);
      const liquidateAgain_alice = await liquidationOperations.liquidate(alice, od.data, { value: od.fee });
      const liquidateAgain_aliceReceipt = await liquidateAgain_alice.wait();
      assert.isTrue(!!liquidateAgain_aliceReceipt?.status);
      const bobStatusFinal = await troveManager.getTroveStatus(bob);
      assert.equal(bobStatusFinal.toString(), TroveStatus.ACTIVE.toString());
      const troveLengthAfter = await troveManager.getTroveOwnersCount();

      // Confirm Troves count
      expect(troveLengthBefore - troveLengthAfter).to.be.equal(1);
    });

    it('Pending reward not affected after collateral price change', async () => {
      await whaleShrimpTroveInit(contracts, signers);

      //decrease price
      await setPrice('BTC', '5000', contracts);

      //check recovery mode status
      const [isRecoveryMode] = await storagePool.checkRecoveryMode();
      assert.isFalse(isRecoveryMode);

      //liquidae defaulter_1
      let od = await generatePriceUpdateDataWithFee(contracts);
      await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee });
      const defaulter_1TroveStatus = await troveManager.getTroveStatus(defaulter_1);
      assert.equal(defaulter_1TroveStatus.toString(), TroveStatus.CLOSED_BY_LIQUIDATION_IN_NORMAL_MODE.toString());
      const carolBtcRewardBefore = await troveManager.getPendingRewards(carol, BTC, true);
      const amountBeforePriceChange = await priceFeed['getAmountFromUSDValue(address,uint256)'](
        BTC,
        carolBtcRewardBefore
      );

      //drop price again
      await setPrice('BTC', '3000', contracts);
      const isRecoveryModeAfterPriceChange = await storagePool.checkRecoveryMode();
      assert.isFalse(isRecoveryModeAfterPriceChange[0]);

      const carolBtcRewardAfter = await troveManager.getPendingRewards(carol, BTC, true);
      const amountAfterPriceChange = await priceFeed['getAmountFromUSDValue(address,uint256)'](
        BTC,
        carolBtcRewardAfter
      );
      assert.equal(amountBeforePriceChange, amountAfterPriceChange);
    });

    it('Returns 0 if there is no pending reward', async () => {
      await whaleShrimpTroveInit(contracts, signers, false);

      //decrease price
      await setPrice('BTC', '5000', contracts);
      const [isRecoveryMode] = await storagePool.checkRecoveryMode();
      assert.isFalse(isRecoveryMode);

      let od = await generatePriceUpdateDataWithFee(contracts);
      await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee });
      const defaulter_1TroveStatus = await troveManager.getTroveStatus(defaulter_1);
      assert.equal(defaulter_1TroveStatus.toString(), TroveStatus.CLOSED_BY_LIQUIDATION_IN_NORMAL_MODE.toString());

      const defaulter_3PendingReward = await troveManager.getPendingRewards(defaulter_3, BTC, true);
      assert.equal(defaulter_3PendingReward.toString(), '0');
    });

    it('redistribute across multiple coll types', async () => {
      await openTrove({
        from: alice,
        contracts,
        colls: [
          { tokenAddress: BTC, amount: parseUnits('1', 8) },
          { tokenAddress: USDT, amount: parseUnits('2500') },
        ],
        debts: [
          { tokenAddress: STABLE, amount: parseUnits('1000') },
          { tokenAddress: STOCK, amount: parseUnits('1') },
        ],
      });
      await openTrove({
        from: bob,
        contracts,
        colls: [
          { tokenAddress: BTC, amount: parseUnits('3', 8) },
          { tokenAddress: USDT, amount: parseUnits('2500') },
        ],
        debts: [
          { tokenAddress: STABLE, amount: parseUnits('1000') },
          { tokenAddress: STOCK, amount: parseUnits('1') },
        ],
      });
      await openTrove({
        from: carol,
        contracts,
        colls: [
          { tokenAddress: BTC, amount: parseUnits('0.5', 8) },
          { tokenAddress: USDT, amount: parseUnits('500') },
        ],
        debts: [
          { tokenAddress: STABLE, amount: parseUnits('1000') },
          { tokenAddress: STOCK, amount: parseUnits('1') },
        ],
      });

      // btc@1000$ -> 44% 4btc 4000$, 56% 5000 usdt
      await setPrice('BTC', '1000', contracts);
      const [isRecoveryMode] = await storagePool.checkRecoveryMode();
      assert.isFalse(isRecoveryMode);
      let od = await generatePriceUpdateDataWithFee(contracts);
      await liquidationOperations.liquidate(carol, od.data, { value: od.fee });

      const aliceBtcReward = await troveManager.getPendingRewards(alice, BTC, true);
      const aliceUsdtReward = await troveManager.getPendingRewards(alice, USDT, true);
      const aliceStableReward = await troveManager.getPendingRewards(alice, STABLE, false);
      expect(aliceBtcReward).to.be.equal(parseUnits((0.5 * 0.995 * 0.25).toString(), 8)); // removing liquidation fee
      expect(aliceUsdtReward).to.be.equal(parseUnits((500 * 0.995 * 0.5).toString()));
      const redistributedStable = 1000 + 1150 * 0.005; // added initial borrowing fee
      const aliceStableRewardPerBTCColl = redistributedStable * 0.5 * 0.25;
      const aliceStableRewardPerUSDTColl = redistributedStable * 0.5 * 0.5;
      expect(aliceStableReward).to.be.equal(
        parseUnits((aliceStableRewardPerBTCColl + aliceStableRewardPerUSDTColl).toString())
      );

      const bobBtcReward = await troveManager.getPendingRewards(bob, BTC, true);
      const bobUsdtReward = await troveManager.getPendingRewards(bob, USDT, true);
      const bobStableReward = await troveManager.getPendingRewards(bob, STABLE, false);
      expect(bobBtcReward).to.be.equal(parseUnits((0.5 * 0.995 * 0.75).toString(), 8));
      expect(bobUsdtReward).to.be.equal(parseUnits((500 * 0.995 * 0.5).toString()));
      const stableRewardPerBTCColl = redistributedStable * 0.5 * 0.75;
      const stableRewardPerUSDTColl = redistributedStable * 0.5 * 0.5;
      expect(bobStableReward).to.be.equal(parseUnits((stableRewardPerBTCColl + stableRewardPerUSDTColl).toString()));
    });

    it('redistribute a last coll type trove', async () => {
      await openTrove({
        from: alice,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('3', 8) }],
        debts: [
          { tokenAddress: STABLE, amount: parseUnits('1000') },
          { tokenAddress: STOCK, amount: parseUnits('1') },
        ],
      });
      await openTrove({
        from: bob,
        contracts,
        colls: [
          { tokenAddress: BTC, amount: parseUnits('1', 8) },
          { tokenAddress: USDT, amount: parseUnits('1000') },
        ],
        debts: [
          { tokenAddress: STABLE, amount: parseUnits('1500') },
          { tokenAddress: STOCK, amount: parseUnits('1') },
        ],
      });

      await setPrice('BTC', '1000', contracts);
      const [isRecoveryMode] = await storagePool.checkRecoveryMode();
      assert.isFalse(isRecoveryMode);
      let od = await generatePriceUpdateDataWithFee(contracts);
      await liquidationOperations.liquidate(bob, od.data, { value: od.fee });

      const aliceBtcReward = await troveManager.getPendingRewards(alice, BTC, true);
      expect(aliceBtcReward).to.be.closeTo(parseUnits((1 * 0.995).toString(), 8), 5n); // removing liquidation fee

      const aliceStableReward = await troveManager.getPendingRewards(alice, STABLE, false);
      const redistributedStable = 1500 + 1650 * 0.005; // added initial borrowing fee
      const aliceStableRewardPerBTCColl = redistributedStable * 0.5; // 50% of bobs coll was btc
      const aliceStableRewardPerUSDTColl = redistributedStable * 0; // alice does not have usdt coll
      expect(aliceStableReward).to.be.equal(
        parseUnits((aliceStableRewardPerBTCColl + aliceStableRewardPerUSDTColl).toString())
      );

      // alice claims the unassigned assets from the usdt coll type
      await contracts.borrowerOperations
        .connect(alice)
        .claimUnassignedAssets(parseUnits('1'), ZeroAddress, ZeroAddress, od.data, { value: od.fee });
      expect(await contracts.storagePool.getValue(USDT, true, 3)).to.be.equal(0);
      expect(await contracts.storagePool.getValue(STABLE, false, 3)).to.be.equal(0);
      expect(await contracts.storagePool.getValue(STOCK, false, 3)).to.be.equal(0);
      expect(await contracts.troveManager.getTroveWithdrawableColl(alice, USDT)).to.be.equal(
        parseUnits((1000 * 0.995).toString())
      );
      expect(await contracts.troveManager.getTroveRepayableDebt(alice, STABLE, false, false)).to.be.equal(
        parseUnits((redistributedStable + 1000 + 1150 * 0.005).toString()) // all of bobs stable + the own one including borrowing fee
      );
      expect(await contracts.troveManager.getTroveRepayableDebt(alice, STOCK, false, false)).to.be.closeTo(
        parseUnits('2'),
        1n
      );
    });
  });
});
