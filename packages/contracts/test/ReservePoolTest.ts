import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { LiquidationOperations, MockDebtToken, MockERC20, ReservePool, StabilityPoolManager } from '../typechain';
import { expect } from 'chai';
import { openTrove, setPrice, deployTesting } from '../utils/testHelper';
import { parseUnits } from 'ethers';
import { Contracts } from '../utils/deployTestBase';
import { generatePriceUpdateDataWithFee } from '../utils/pythHelper';

describe('Reserve Pool', () => {
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  let STABLE: MockDebtToken;
  let BTC: MockERC20;

  let contracts: Contracts;
  let liquidationOperations: LiquidationOperations;
  let reservePool: ReservePool;
  let stabilityPoolManager: StabilityPoolManager;

  before(async () => {
    [, , , , , alice, bob, carol] = await ethers.getSigners();
  });

  beforeEach(async () => {
    contracts = await deployTesting();
    liquidationOperations = contracts.liquidationOperations;
    reservePool = contracts.reservePool;
    stabilityPoolManager = contracts.stabilityPoolManager;
    STABLE = contracts.STABLE;
    BTC = contracts.BTC;
  });

  describe('reserveCap()', () => {
    it('only owner can set reserve caps', async () => {
      const cap = parseUnits('100');
      await expect(reservePool.connect(alice).setGovReserveCap(cap)).to.be.revertedWithCustomError(
        reservePool,
        'OwnableUnauthorizedAccount'
      );
      await expect(reservePool.connect(alice).setRelativeStableCap(cap)).to.be.revertedWithCustomError(
        reservePool,
        'OwnableUnauthorizedAccount'
      );

      await reservePool.setGovReserveCap(cap);
      await reservePool.setRelativeStableCap(cap);
      expect(await reservePool.relativeStableCap()).to.be.equal(cap);
      expect(await reservePool.govReserveCap()).to.be.equal(cap);
    });

    it('should receive reserve fee when borrowing', async () => {
      const aliceDebt = parseUnits('100');
      await openTrove({
        from: alice,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('10', 8) }],
        debts: [{ tokenAddress: STABLE, amount: aliceDebt }],
      });

      let reserveBal = await STABLE.balanceOf(reservePool);
      const aliceFee = await contracts.troveManager.getBorrowingFee(aliceDebt, true);
      expect(reserveBal).to.be.equal(aliceFee);

      const bobDebt = parseUnits('13000');
      await openTrove({
        from: bob,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
        debts: [{ tokenAddress: STABLE, amount: bobDebt }],
      });
      let reserveBalAfter = await STABLE.balanceOf(reservePool);
      const bobFee = await contracts.troveManager.getBorrowingFee(bobDebt, true);
      expect(reserveBalAfter).to.be.equal(bobFee + reserveBal);
    });

    it('should not receive reserve fee when reached cap', async () => {
      await reservePool.setRelativeStableCap(parseUnits('0.0001'));
      const preSupply = await STABLE.totalSupply();
      const reservePoolStableLimit = (preSupply + parseUnits('200')) / 10000n; // adding 200 for the trove opening fee

      const aliceDebt = parseUnits('2000');
      await openTrove({
        from: alice,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('10', 8) }],
        debts: [{ tokenAddress: STABLE, amount: aliceDebt }],
      });

      const reserveBalAfter = await STABLE.balanceOf(reservePool);
      expect(reserveBalAfter).to.be.equal(reservePoolStableLimit);
    });
  });

  describe('Withdraw (Repay)', () => {
    it('should repay loss when liquidating troves', async () => {
      const aliceDebt = parseUnits('1000');
      await openTrove({
        from: alice,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('10', 8) }],
        debts: [{ tokenAddress: STABLE, amount: aliceDebt }],
      });
      await STABLE.connect(alice).transfer(reservePool, aliceDebt);

      const bobDebt = parseUnits('13000');
      await openTrove({
        from: bob,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
        debts: [{ tokenAddress: STABLE, amount: bobDebt }],
      });

      await openTrove({
        from: carol,
        contracts,
        colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
        debts: [{ tokenAddress: STABLE, amount: parseUnits('3000') }],
      });
      await stabilityPoolManager
        .connect(carol)
        .provideStability([{ tokenAddress: STABLE, amount: parseUnits('3000') }]);

      let reserveBalBefore = await STABLE.balanceOf(reservePool);
      await setPrice('BTC', '10000', contracts);
      const od = await generatePriceUpdateDataWithFee(contracts);
      await liquidationOperations.liquidate(bob, od.data, { value: od.fee });
      let reserveBalAfter = await STABLE.balanceOf(reservePool);

      expect(reserveBalAfter).to.be.lt(reserveBalBefore);
    });
  });
});
