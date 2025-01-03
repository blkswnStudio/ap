import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { MockDebtToken, MockERC20, TroveManager, StoragePool, PriceFeed } from '../typechain';
import { assert, expect } from 'chai';
import { openTrove, deployTesting, getRedemptionMeta, redeem } from '../utils/testHelper';
import { MakeDescribeFunctions, logGasMetricTopic, makeDescribe, resetGasMetricByTopic } from '../utils/gasHelper';
import { parseUnits } from 'ethers';
import { Contracts } from '../utils/deployTestBase';

describe('RedemptionOperations', () => {
  let signers: SignerWithAddress[];
  let alice: SignerWithAddress;
  let STABLE: MockDebtToken;
  let BTC: MockERC20;
  let contracts: Contracts;
  let troveManager: TroveManager;
  let storagePool: StoragePool;
  let priceFeed: PriceFeed;

  const open = async (user: SignerWithAddress, collAmount: bigint, debtAmount: bigint) => {
    return await openTrove({
      from: user,
      contracts,
      colls: [{ tokenAddress: BTC, amount: collAmount }],
      debts: debtAmount === parseUnits('0') ? [] : [{ tokenAddress: STABLE, amount: debtAmount }],
    });
  };

  before(async () => {
    signers = await ethers.getSigners();
    [, alice] = signers;
    resetGasMetricByTopic();
  });

  beforeEach(async () => {
    contracts = await deployTesting();
    troveManager = contracts.troveManager;
    storagePool = contracts.storagePool;
    priceFeed = contracts.priceFeed;
    STABLE = contracts.STABLE;
    BTC = contracts.BTC;
  });

  makeDescribe('Redeem', async (accs: SignerWithAddress[], funcs: MakeDescribeFunctions) => {
    funcs.setTopic('Redeem');
    // open initial troves
    await open(alice, parseUnits('100', 8), parseUnits('200000'));

    // open troves
    const troveInfos: any[] = [];
    for (const acc of accs) {
      // open
      await open(acc, parseUnits('0.02', 8), parseUnits('100'));

      // get values
      troveInfos.push({
        stableBefore: await troveManager.getTroveRepayableDebt(acc, STABLE, true),
        btcBefore:
          (await troveManager.getTroveWithdrawableColls(acc)).find(({ tokenAddress }) => tokenAddress === BTC.target)
            ?.amount ?? 0n,
      });
    }

    // get values before
    const stableBefore = await STABLE.balanceOf(alice);
    const btcBefore = await storagePool.getValue(BTC, true, 0);

    // redeem, get meta & price cache
    const toRedeem = parseUnits('100') * BigInt(accs.length);
    const tx = await redeem(alice, toRedeem, contracts);
    const redemptionMeta = await getRedemptionMeta(tx, contracts);
    funcs.appendGas(tx);

    // check values after
    const stableAfter = await STABLE.balanceOf(alice);
    expect(stableAfter).to.be.equal(stableBefore - toRedeem);
    const [, btcDrawn, , btcPayout] = redemptionMeta.totals[2].find((f: any) => f[0] === BTC.target);
    assert.equal(await BTC.balanceOf(alice), btcPayout);
    assert.isAtMost(
      (toRedeem * parseUnits('1', 8)) / (await priceFeed['getUSDValue(address,uint256)'](BTC, parseUnits('1', 8))) -
        btcDrawn,
      10n
    );

    // checking totals
    const btcAfter = await storagePool.getValue(BTC, true, 0);
    assert.equal(btcAfter, btcBefore - btcDrawn);

    // checking accounts
    for (const acc of accs) {
      // check meta
      const [, stableDrawn, collDrawn] = redemptionMeta.redemptions.find((f: any) => f[0] === acc.address);
      const info = troveInfos[accs.indexOf(acc)];

      // checking stable debt
      const stableDebtAfter = await troveManager.getTroveRepayableDebt(acc, STABLE, true);
      expect(stableDebtAfter).to.be.equal(info.stableBefore - stableDrawn);

      // checking btc
      const btcAfter =
        (await troveManager.getTroveWithdrawableColls(acc)).find(({ tokenAddress }) => tokenAddress === BTC.target)
          ?.amount ?? 0n;
      expect(btcAfter).to.be.equal(info.btcBefore - collDrawn.find((f: any) => f[0] === BTC.target)[1]);
    }
  });

  after(() => {
    logGasMetricTopic();
  });
});
