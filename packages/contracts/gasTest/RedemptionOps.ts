import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { MockDebtToken, MockERC20, TroveManager, StoragePool, PriceFeed } from '../typechain';
import { assert, expect } from 'chai';
import {
  openTrove,
  deployTesting,
  getRedemptionMeta,
  redeem,
  deployTestMockDebtsAndColls,
  createTokenAmountList,
  addColl,
  increaseDebt,
} from '../utils/testHelper';
import { MakeDescribeFunctions, logGasMetricTopic, makeDescribe, resetGasMetricByTopic } from '../utils/gasHelper';
import { parseUnits } from 'ethers';
import { Contracts } from '../utils/deployTestBase';
import config from './config.json';

describe('RedemptionOperations', () => {
  let signers: SignerWithAddress[];
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let STABLE: MockDebtToken;
  let BTC: MockERC20;

  let colls: MockERC20[];
  let debts: MockDebtToken[];

  let contracts: Contracts;
  let troveManager: TroveManager;
  let storagePool: StoragePool;
  let priceFeed: PriceFeed;

  const open = async (
    user: SignerWithAddress,
    collAmount: bigint,
    debtAmount: bigint,
    btcAmount: bigint,
    stableAmount: bigint
  ) => {
    await openTrove({
      from: user,
      contracts,
      colls: [{ tokenAddress: BTC, amount: btcAmount }],
      debts: [],
    });

    await increaseDebt(
      user,
      contracts,
      createTokenAmountList(debts, config.trove.debt, token =>
        token.target === STABLE.target ? stableAmount : debtAmount
      )
    );

    await addColl(
      user,
      contracts,
      createTokenAmountList(colls, config.trove.coll, token => (token.target === BTC.target ? 0 : collAmount)),
      true
    );
  };

  before(async () => {
    signers = await ethers.getSigners();
    [owner, alice] = signers;
    resetGasMetricByTopic();
  });

  beforeEach(async () => {
    contracts = await deployTesting();

    troveManager = contracts.troveManager;
    storagePool = contracts.storagePool;
    priceFeed = contracts.priceFeed;

    const cd = await deployTestMockDebtsAndColls(contracts, config.tokens.coll, config.tokens.debt);
    colls = cd.colls;
    debts = cd.debts;

    STABLE = contracts.STABLE;
    BTC = contracts.BTC;

    await troveManager.connect(owner).setEnableMintingOnClosedHours(true);
  });

  makeDescribe(`Redeem [${config.redeems}]`, async (accs: SignerWithAddress[], funcs: MakeDescribeFunctions) => {
    funcs.setTopic('Redeem');
    // open initial troves
    await open(alice, parseUnits('10000'), parseUnits('1'), parseUnits('100', 8), parseUnits('20000'));

    // open troves
    const troveInfos: any[] = [];
    for (const acc of accs) {
      // open
      await open(acc, parseUnits('10'), parseUnits('1'), parseUnits('0.5', 8), parseUnits('100'));

      // get values
      troveInfos.push({
        stableBefore: (await troveManager['getTroveRepayableDebts(address)'](acc)).find(
          ({ tokenAddress }) => tokenAddress === STABLE.target
        )?.amount,
        btcBefore:
          (await troveManager['getTroveWithdrawableColls(address)'](acc)).find(
            ({ tokenAddress }) => tokenAddress === BTC.target
          )?.amount ?? 0n,
      });
    }

    // get values before
    const stableBefore = await STABLE.balanceOf(alice);
    const btcBefore = await storagePool.getValue(BTC, true, 0);

    // redeem, get meta & price cache
    const toRedeem = parseUnits('100') * BigInt(Math.min(accs.length, config.redeems));
    const tx = await redeem(alice, toRedeem, contracts);
    const redemptionMeta = await getRedemptionMeta(tx, contracts);
    funcs.appendGas(tx);

    // check values after
    const stableAfter = await STABLE.balanceOf(alice);
    expect(stableAfter).to.be.equal(stableBefore - toRedeem);
    const [, btcDrawn, , btcPayout] = redemptionMeta.totals[2].find((f: any) => f[0] === BTC.target);
    assert.equal(await BTC.balanceOf(alice), btcPayout);

    // checking totals
    const btcAfter = await storagePool.getValue(BTC, true, 0);
    assert.equal(btcAfter, btcBefore - btcDrawn);

    // checking accounts
    for (const acc of accs) {
      // check meta
      const r = redemptionMeta.redemptions.find((f: any) => f[0] === acc.address);
      if (r === undefined) continue;
      const [, stableDrawn, collDrawn] = r;
      const info = troveInfos[accs.indexOf(acc)];

      // checking stable debt
      const stableDebtAfter = (await troveManager['getTroveRepayableDebts(address)'](acc)).find(
        ({ tokenAddress }) => tokenAddress === STABLE.target
      )?.amount;
      expect(stableDebtAfter).to.be.equal(info.stableBefore - stableDrawn);

      // checking btc
      const btcAfter =
        (await troveManager['getTroveWithdrawableColls(address)'](acc)).find(
          ({ tokenAddress }) => tokenAddress === BTC.target
        )?.amount ?? 0n;
      expect(btcAfter).to.be.equal(info.btcBefore - collDrawn.find((f: any) => f[0] === BTC.target)[1]);
    }
  });

  after(() => {
    logGasMetricTopic();
  });
});
