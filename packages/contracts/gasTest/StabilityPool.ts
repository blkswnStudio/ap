import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { MockDebtToken, StabilityPoolManager } from '../typechain';
import { expect } from 'chai';
import { deployTesting } from '../utils/testHelper';
import { MakeDescribeFunctions, logGasMetricTopic, makeDescribe, resetGasMetricByTopic } from '../utils/gasHelper';
import { Contracts } from '../utils/deployTestBase';

describe('StabilityPool', () => {
  let STOCK: MockDebtToken;
  let contracts: Contracts;
  let stabilityPoolManager: StabilityPoolManager;

  before(async () => {
    resetGasMetricByTopic();
  });

  beforeEach(async () => {
    contracts = await deployTesting();
    stabilityPoolManager = contracts.stabilityPoolManager;
    STOCK = contracts.STOCK;
  });

  makeDescribe('Provide Stability', async (accs: SignerWithAddress[], funcs: MakeDescribeFunctions) => {
    funcs.setTopic('Provide Stability');

    // provide statbility
    for (const acc of accs) {
      // mint
      await STOCK.unprotectedMint(acc, 200);

      // provide
      const tx = await stabilityPoolManager.connect(acc).provideStability([{ tokenAddress: STOCK, amount: 200 }]);
      funcs.appendGas(tx);

      // check pools total
      const stockDeposit = (await stabilityPoolManager.getTotalDeposits()).find(d => d.tokenAddress === STOCK.target);
      expect(stockDeposit?.amount).to.be.equal(200n * BigInt(accs.indexOf(acc) + 1));
    }
  });

  makeDescribe('Withdraw Stability', async (accs: SignerWithAddress[], funcs: MakeDescribeFunctions) => {
    funcs.setTopic('Withdraw Stability');

    // provide statbility and withdraw
    for (const acc of accs) {
      // mint
      await STOCK.unprotectedMint(acc, 200);

      // provide
      await stabilityPoolManager.connect(acc).provideStability([{ tokenAddress: STOCK, amount: 200 }]);

      // check pools total
      const stockDeposit = (await stabilityPoolManager.getTotalDeposits()).find(d => d.tokenAddress === STOCK.target);
      expect(stockDeposit?.amount).to.be.equal(200n * BigInt(accs.indexOf(acc) + 1));
    }

    for (const acc of accs) {
      // withdraw
      const tx = await stabilityPoolManager.connect(acc).withdrawStability([{ tokenAddress: STOCK, amount: 200 }]);
      funcs.appendGas(tx);

      // check pools total
      const stockDeposit = (await stabilityPoolManager.getTotalDeposits()).find(d => d.tokenAddress === STOCK.target);
      expect(stockDeposit?.amount).to.be.equal(200n * BigInt(accs.length - (accs.indexOf(acc) + 1)));
    }
  });

  after(() => {
    logGasMetricTopic();
  });
});
