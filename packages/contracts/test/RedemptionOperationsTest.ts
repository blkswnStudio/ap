import { ethers } from 'hardhat';
import { MockDebtToken, MockERC20, PriceFeed, MockTroveManager, StoragePool, RedemptionOperations } from '../typechain';
import { HardhatEthersSigner, SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import {
  buildPriceCache,
  getRedemptionMeta,
  MAX_BORROWING_FEE,
  openTrove,
  redeem,
  deployTesting,
  whaleShrimpTroveInit,
  addColl,
} from '../utils/testHelper';
import { assert, expect } from 'chai';
import { parseUnits, ZeroAddress } from 'ethers';
import { Contracts } from '../utils/deployTestBase';
import { OracleUpdateDataAndFee, generatePriceUpdateDataWithFee, getPriceId } from '../utils/pythHelper';

describe('RedemptionOperations', () => {
  let signers: SignerWithAddress[];
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let defaulter_1: SignerWithAddress;
  let defaulter_2: SignerWithAddress;
  let erin: SignerWithAddress;

  let contracts: Contracts;
  let priceFeed: PriceFeed;
  let troveManager: MockTroveManager;
  let redemptionOperations: RedemptionOperations;
  let storagePool: StoragePool;
  let STABLE: MockDebtToken;
  let USDT: MockERC20;
  let BTC: MockERC20;

  let oracleData: OracleUpdateDataAndFee;

  before(async () => {
    signers = await ethers.getSigners();
    [, defaulter_1, defaulter_2, , , alice, bob, , , erin] = signers;
  });

  beforeEach(async () => {
    contracts = await deployTesting();
    priceFeed = contracts.priceFeed;
    troveManager = contracts.troveManager;
    redemptionOperations = contracts.redemptionOperations;
    storagePool = contracts.storagePool;
    STABLE = contracts.STABLE;
    BTC = contracts.BTC;
    USDT = contracts.USDT;

    oracleData = await generatePriceUpdateDataWithFee(contracts);
  });

  describe('redeemCollateral()', () => {
    describe('working exmaples', () => {
      let bobStableBalanceBefore: bigint,
        btcStableBalanceBefore: bigint,
        defaulterTroveStableDebtBefore: bigint,
        defaulterTroveBTCBefore: bigint,
        defaulter2TroveStableDebtBefore: bigint,
        defaulter2TroveBTCBefore: bigint,
        toRedeem: bigint,
        redemptionMeta: any;

      beforeEach(async () => {
        await whaleShrimpTroveInit(contracts, signers);

        bobStableBalanceBefore = await STABLE.balanceOf(bob);
        btcStableBalanceBefore = await storagePool.getValue(BTC, true, 0);

        const priceCache = await buildPriceCache(contracts);
        defaulterTroveStableDebtBefore =
          (await troveManager.getTroveRepayableDebts(defaulter_1)).find(
            ({ tokenAddress }) => tokenAddress === STABLE.target
          )?.amount ?? 0n;
        defaulterTroveBTCBefore =
          (await troveManager.getTroveWithdrawableColls(defaulter_1)).find(
            ({ tokenAddress }) => tokenAddress === BTC.target
          )?.amount ?? 0n;

        defaulter2TroveStableDebtBefore =
          (await troveManager.getTroveRepayableDebts(defaulter_2)).find(
            ({ tokenAddress }) => tokenAddress === STABLE.target
          )?.amount ?? 0n;
        defaulter2TroveBTCBefore =
          (await troveManager.getTroveWithdrawableColls(defaulter_2)).find(
            ({ tokenAddress }) => tokenAddress === BTC.target
          )?.amount ?? 0n;
      });

      it('one partial', async () => {
        toRedeem = parseUnits('50');
      });

      it('one fully', async () => {
        toRedeem = parseUnits('100.5');
      });

      it('first fully, second partial', async () => {
        toRedeem = parseUnits('150');
      });

      it('two fully', async () => {
        toRedeem = parseUnits('201');
      });

      afterEach(async () => {
        redemptionMeta = await getRedemptionMeta(await redeem(bob, toRedeem, contracts), contracts);

        const bobStableBalanceAfter = await STABLE.balanceOf(bob);
        expect(bobStableBalanceAfter).to.be.equal(bobStableBalanceBefore - toRedeem);

        const [, btcDrawn, , btcPayout] = redemptionMeta.totals[2].find((f: any) => f[0] === BTC.target);
        assert.equal(await BTC.balanceOf(bob), btcPayout);
        assert.isAtMost(
          (toRedeem * parseUnits('1', 8)) / (await priceFeed['getUSDValue(address,uint256)'](BTC, parseUnits('1', 8))) -
            btcDrawn,
          10n
        );

        // checking totals
        const btcStorageBalanceAfter = await storagePool.getValue(BTC, true, 0);
        assert.equal(btcStorageBalanceAfter, btcStableBalanceBefore - btcDrawn);

        // checking defaulter 1
        const [, stableDrawn, collDrawn] = redemptionMeta.redemptions.find((f: any) => f[0] === defaulter_1.address);

        const defaulterTroveStableDebtAfter =
          (await troveManager.getTroveRepayableDebts(defaulter_1)).find(
            ({ tokenAddress }) => tokenAddress === STABLE.target
          )?.amount ?? 0n;
        expect(defaulterTroveStableDebtAfter).to.be.equal(defaulterTroveStableDebtBefore - stableDrawn);

        const defaulterTroveBTCAfter =
          (await troveManager.getTroveWithdrawableColls(defaulter_1)).find(
            ({ tokenAddress }) => tokenAddress === BTC.target
          )?.amount ?? 0n;
        expect(defaulterTroveBTCAfter).to.be.equal(
          defaulterTroveBTCBefore - collDrawn.find((f: any) => f[0] === BTC.target)[1]
        );

        // checking defaulter 2
        if (redemptionMeta.redemptions.length === 2) {
          const [, stableDrawn2, collDrawn2] = redemptionMeta.redemptions.find(
            (f: any) => f[0] === defaulter_2.address
          );
          const defaulter2TroveStableDebtAfter =
            (await troveManager.getTroveRepayableDebts(defaulter_2)).find(
              ({ tokenAddress }) => tokenAddress === STABLE.target
            )?.amount ?? 0n;
          expect(defaulter2TroveStableDebtAfter).to.be.equal(defaulter2TroveStableDebtBefore - stableDrawn2);

          const defaulter2TroveBTCAfter =
            (await troveManager.getTroveWithdrawableColls(defaulter_2)).find(
              ({ tokenAddress }) => tokenAddress === BTC.target
            )?.amount ?? 0n;
          expect(defaulter2TroveBTCAfter).to.be.equal(
            defaulter2TroveBTCBefore - collDrawn2.find((f: any) => f[0] === BTC.target)[1]
          );
        }
      });
    });

    it('Should revert if stable coin amount is zero', async function () {
      await expect(redeem(alice, 0n, contracts)).to.be.revertedWithCustomError(redemptionOperations, 'ZeroAmount');
    });

    it('Should revert if max fee percentage is less than REDEMPTION_FEE_FLOOR', async function () {
      await expect(
        contracts.redemptionOperations
          .connect(alice)
          .redeemCollateral(parseUnits('1'), [], 0.004e18, oracleData.data, { value: oracleData.fee })
      ).to.be.revertedWithCustomError(redemptionOperations, 'InvalidMaxFeePercent');
    });

    it('Should revert if stable coin amount exceeds debt balance', async function () {
      await expect(
        contracts.redemptionOperations
          .connect(alice)
          .redeemCollateral(parseUnits('10000'), [], MAX_BORROWING_FEE, oracleData.data, { value: oracleData.fee })
      ).to.be.revertedWithCustomError(redemptionOperations, 'ExceedDebtBalance');
    });

    it('Should fail with invalid hint, non-existent trove', async function () {
      await whaleShrimpTroveInit(contracts, signers);

      await expect(
        contracts.redemptionOperations
          .connect(bob)
          .redeemCollateral(
            parseUnits('50'),
            [{ trove: ZeroAddress, lowerHint: ZeroAddress, upperHint: ZeroAddress, expectedCR: 0n }],
            MAX_BORROWING_FEE,
            oracleData.data,
            { value: oracleData.fee }
          )
      ).to.be.revertedWithCustomError(redemptionOperations, 'HintUnknown');
    });

    it('Should fail with invalid hint, trove with stable', async function () {
      await whaleShrimpTroveInit(contracts, signers);

      await openTrove({
        from: erin,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
      });
      await expect(
        contracts.redemptionOperations
          .connect(bob)
          .redeemCollateral(
            parseUnits('50'),
            [{ trove: erin, lowerHint: ZeroAddress, upperHint: ZeroAddress, expectedCR: parseUnits('1') }],
            MAX_BORROWING_FEE,
            oracleData.data,
            { value: oracleData.fee }
          )
      ).to.be.revertedWithCustomError(redemptionOperations, 'InvalidRedemptionHint');
    });

    it('Should fail with invalid hint, trove with higher CR', async function () {
      await whaleShrimpTroveInit(contracts, signers);

      const toRedeem = parseUnits('50');
      const simulatedRedemption = await contracts.redemptionOperations.calculateTroveRedemption(alice, toRedeem, true);
      await expect(
        contracts.redemptionOperations.connect(bob).redeemCollateral(
          toRedeem,
          [
            {
              trove: alice,
              lowerHint: ZeroAddress,
              upperHint: ZeroAddress,
              expectedCR: simulatedRedemption.resultingCR,
            },
          ],
          MAX_BORROWING_FEE,
          oracleData.data,
          { value: oracleData.fee }
        )
      ).to.be.revertedWithCustomError(redemptionOperations, 'InvalidHintLowerCRExists');
    });

    it('Redeem with STABLE as collateral, but ignore it', async () => {
      // open troves
      await openTrove({
        from: alice,
        colls: [{ tokenAddress: BTC, amount: parseUnits('1', 9) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('5000') }],
        contracts,
      });

      // functions
      const getCollateral = async (_user: HardhatEthersSigner, _token: MockDebtToken | MockERC20) => {
        const addr = await _token.getAddress();
        const i = (await troveManager.getTroveWithdrawableColls(_user)).find(t => t.tokenAddress === addr);
        return i?.amount || 0n;
      };

      // add STABLE as collateral
      contracts.tokenManager.addCollToken(STABLE, parseUnits('1.1'), getPriceId('STABLE'), false);

      // open trove for bob
      await openTrove({
        from: bob,
        colls: [
          { tokenAddress: BTC, amount: parseUnits('0.01', 9) },
          { tokenAddress: USDT, amount: parseUnits('100') },
        ],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('100') }],
        contracts,
      });
      expect(await getCollateral(bob, STABLE)).equal(parseUnits('0'));
      await addColl(bob, contracts, [{ tokenAddress: STABLE, amount: parseUnits('100') }], true);
      expect(await getCollateral(bob, STABLE)).equal(parseUnits('100'));

      // redeem alice (bob's trove)
      const toRedeem = parseUnits('200');
      const aliceBefore = await STABLE.balanceOf(alice);
      await getRedemptionMeta(await redeem(alice, toRedeem, contracts), contracts);
      expect(await STABLE.balanceOf(alice)).to.be.equal(aliceBefore - toRedeem);
      expect(await getCollateral(bob, BTC)).lessThan(parseUnits('0.01', 9));
      expect(await getCollateral(bob, USDT)).lessThan(parseUnits('100'));
      expect(await getCollateral(bob, STABLE)).equal(parseUnits('100'));
    });
  });
});
