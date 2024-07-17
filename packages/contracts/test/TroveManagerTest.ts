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
  liquidate,
  batchLiquidate,
  addColl,
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
      const carolBtcRewardBefore =
        (await troveManager.getPendingRewards(carol, true, false)).find(
          ({ tokenAddress }) => tokenAddress === BTC.target
        )?.amount ?? 0n;
      const amountBeforePriceChange = await priceFeed['getAmountFromUSDValue(address,uint256)'](
        BTC,
        carolBtcRewardBefore
      );

      //drop price again
      await setPrice('BTC', '3000', contracts);
      const isRecoveryModeAfterPriceChange = await storagePool.checkRecoveryMode();
      assert.isFalse(isRecoveryModeAfterPriceChange[0]);

      const carolBtcRewardAfter =
        (await troveManager.getPendingRewards(carol, true, false)).find(
          ({ tokenAddress }) => tokenAddress === BTC.target
        )?.amount ?? 0n;
      const amountAfterPriceChange = await priceFeed['getAmountFromUSDValue(address,uint256)'](
        BTC,
        carolBtcRewardAfter
      );
      assert.equal(amountBeforePriceChange, amountAfterPriceChange);
    });

    it('Returns 0 if there is no pending reward', async () => {
      await whaleShrimpTroveInit(contracts, signers);

      //decrease price
      await setPrice('BTC', '5000', contracts);
      const [isRecoveryMode] = await storagePool.checkRecoveryMode();
      assert.isFalse(isRecoveryMode);

      let od = await generatePriceUpdateDataWithFee(contracts);
      await liquidationOperations.liquidate(defaulter_1, od.data, { value: od.fee });
      const defaulter_1TroveStatus = await troveManager.getTroveStatus(defaulter_1);
      assert.equal(defaulter_1TroveStatus.toString(), TroveStatus.CLOSED_BY_LIQUIDATION_IN_NORMAL_MODE.toString());

      const defaulter_3PendingReward =
        (await troveManager.getPendingRewards(defaulter_3, true, false)).find(
          ({ tokenAddress }) => tokenAddress === BTC.target
        )?.amount ?? 0n;
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

      // alice 3500 / 9000 = 38%
      // bob 5500 / 9000 = 62%
      await setPrice('BTC', '1000', contracts);
      const [isRecoveryMode] = await storagePool.checkRecoveryMode();
      assert.isFalse(isRecoveryMode);
      let od = await generatePriceUpdateDataWithFee(contracts);
      await liquidationOperations.liquidate(carol, od.data, { value: od.fee });

      const aliceBtcReward =
        (await troveManager.getPendingRewards(alice, true, false)).find(
          ({ tokenAddress }) => tokenAddress === BTC.target
        )?.amount ?? 0n;
      const aliceUsdtReward =
        (await troveManager.getPendingRewards(alice, true, false)).find(
          ({ tokenAddress }) => tokenAddress === USDT.target
        )?.amount ?? 0n;
      const aliceStableReward =
        (await troveManager.getPendingRewards(alice, false, true)).find(
          ({ tokenAddress }) => tokenAddress === STABLE.target
        )?.amount ?? 0n;
      expect(aliceBtcReward).to.be.closeTo(parseUnits((0.5 * 0.995 * 0.388888).toString(), 8), 5000n); // removing liquidation fee
      expect(aliceUsdtReward).to.be.closeTo(parseUnits((500 * 0.995 * 0.388888).toString()), 2222222222220222n);
      expect(aliceStableReward).to.be.closeTo(
        parseUnits(((1000 + 1150 * 0.005) * 0.38888).toString()),
        24999999999997388n
      );

      const bobBtcReward =
        (await troveManager.getPendingRewards(bob, true, false)).find(({ tokenAddress }) => tokenAddress === BTC.target)
          ?.amount ?? 0n;
      const bobUsdtReward =
        (await troveManager.getPendingRewards(bob, true, false)).find(
          ({ tokenAddress }) => tokenAddress === USDT.target
        )?.amount ?? 0n;
      const bobStableReward =
        (await troveManager.getPendingRewards(bob, false, true)).find(
          ({ tokenAddress }) => tokenAddress === STABLE.target
        )?.amount ?? 0n;
      expect(bobBtcReward).to.be.closeTo(parseUnits((0.5 * 0.995 * 0.6111).toString(), 8), 5000n);
      expect(bobUsdtReward).to.be.closeTo(parseUnits((500 * 0.995 * 0.6111).toString()), 7777777777775667n);
      expect(bobStableReward).to.be.closeTo(
        parseUnits(((1000 + 1150 * 0.005) * 0.6111).toString()),
        24999999999997388n
      );
    });

    it('redistribute a last coll type trove', async () => {
      await openTrove({
        from: alice,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('3', 8) }],
        debts: [
          { tokenAddress: STABLE, amount: parseUnits('1200') },
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
          { tokenAddress: STABLE, amount: parseUnits('1700') },
          { tokenAddress: STOCK, amount: parseUnits('1') }, // 1 stock
        ],
      });

      await setPrice('BTC', '1000', contracts);
      const [isRecoveryMode] = await storagePool.checkRecoveryMode();
      assert.isFalse(isRecoveryMode);
      let od = await generatePriceUpdateDataWithFee(contracts);
      await liquidationOperations.liquidate(bob, od.data, { value: od.fee });

      const aliceBtcReward =
        (await troveManager.getPendingRewards(alice, true, false)).find(
          ({ tokenAddress }) => tokenAddress === BTC.target
        )?.amount ?? 0n;
      expect(aliceBtcReward).to.be.closeTo(parseUnits((1 * 0.995).toString(), 8), 5n); // removing liquidation fee

      await openTrove({
        from: carol,
        contracts,
        colls: [
          { tokenAddress: BTC, amount: parseUnits('5', 8) },
          { tokenAddress: USDT, amount: parseUnits('1000') },
        ],
        debts: [
          { tokenAddress: STABLE, amount: parseUnits('1700') },
          { tokenAddress: STOCK, amount: parseUnits('1') },
        ],
      });
      expect(
        (await troveManager.getPendingRewards(carol, false, true)).find(
          ({ tokenAddress }) => tokenAddress === STOCK.target
        )?.amount ?? 0n
      ).to.be.equal(0);

      // alice has 100% of the stable rewards
      const aliceStableReward =
        (await troveManager.getPendingRewards(alice, false, true)).find(
          ({ tokenAddress }) => tokenAddress === STABLE.target
        )?.amount ?? 0n;
      expect(aliceStableReward).to.be.equal(parseUnits((1700 + 1850 * 0.005).toString()));
    });

    it('redistribute a last coll type trove, including pending rewards', async () => {
      await setPrice('BTC', '1000', contracts);
      await openTrove({
        from: alice, // will claim the unassigned assets
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('2', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('1200') }],
      }); // todo diesen Test übernehmen, wo zwei Troves ein coll halten welches übrig bleibt und sich diese dann den liquiation rest aufteieln
      await openTrove({
        from: bob,
        contracts,
        colls: [{ tokenAddress: USDT, amount: parseUnits('1000') }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('600') }],
      });
      await openTrove({
        from: carol,
        contracts,
        colls: [{ tokenAddress: USDT, amount: parseUnits('1000') }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('600') }],
      });
      await openTrove({
        from: dennis, // will be liquidated first, to create pending rewards for carol and bod
        contracts,
        colls: [{ tokenAddress: USDT, amount: parseUnits('1000') }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('600') }],
      });

      // liquidate dennis
      await setPrice('USDT', '0.5', contracts);
      await liquidate(dennis, contracts);

      // dennis reopens a trove
      await setPrice('USDT', '1', contracts);
      await openTrove({
        from: dennis, // will be liquidated first, to create pending rewards for carol and bod
        contracts,
        colls: [{ tokenAddress: USDT, amount: parseUnits('1000') }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('600') }],
      });

      const bobUSDTRewards =
        (await troveManager.getPendingRewards(bob, true, false)).find(
          ({ tokenAddress }) => tokenAddress === USDT.target
        )?.amount ?? 0n;
      expect(bobUSDTRewards).to.be.gt(0);

      // liquidate bob and carol
      await setPrice('USDT', '0.5', contracts);
      await batchLiquidate([bob, carol], contracts);
      const bobUSDTRewardsB =
        (await troveManager.getPendingRewards(bob, true, false)).find(
          ({ tokenAddress }) => tokenAddress === USDT.target
        )?.amount ?? 0n;
      expect(bobUSDTRewardsB).to.be.eq(0);

      // liquidate dennis a second time
      await setPrice('USDT', '0.3', contracts);
      await liquidate(dennis, contracts);

      // there is no more USDT as stake (active coll) left
      expect(await contracts.storagePool.getValue(USDT, true, 0)).to.be.equal(0);
      expect(await contracts.storagePool.getValue(USDT, true, 1)).to.be.gt(0);

      // alice adds usd as coll
      await setPrice('USDT', '1', contracts);
      console.log('deposit usdt');
      console.log('BTC', BTC.target);
      console.log('USDT', USDT.target);

      await addColl(alice, contracts, [{ tokenAddress: USDT, amount: parseUnits('1000') }], true);
      const aliceUSDTPendingRewards =
        (await troveManager.getPendingRewards(alice, true, false)).find(
          ({ tokenAddress }) => tokenAddress === USDT.target
        )?.amount ?? 0n;
      expect(aliceUSDTPendingRewards).to.be.eq(0);

      // dennis reopens a trove
      await openTrove({
        from: dennis, // will be liquidated first, to create pending rewards for carol and bod
        contracts,
        colls: [{ tokenAddress: USDT, amount: parseUnits('1000') }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('600') }],
      });

      // liquidate dennis a third time
      await setPrice('USDT', '0.3', contracts);
      await liquidate(dennis, contracts);

      // alice should have pending rewards
      const aliceUSDTPendingRewardsB =
        (await troveManager.getPendingRewards(alice, true, false)).find(
          ({ tokenAddress }) => tokenAddress === USDT.target
        )?.amount ?? 0n;
      expect(aliceUSDTPendingRewardsB).to.be.closeTo(parseUnits('995'), 1000n); // todo die Ungenauigkeiten könnten an der liqudiation coll fee liegen, welche ausbezahlt wird, aber falsch verrechnet
    });
  });
});
