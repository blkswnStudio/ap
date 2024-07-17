import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { MockDebtToken, MockERC20, MockPyth, PriceFeed } from '../typechain';
import { expect } from 'chai';
import { deployTesting } from '../utils/testHelper';
import { parseUnits } from 'ethers';
import { generatePriceUpdateData, initOracle, setPrice, updateOracle } from '../utils/pythHelper';
import { Contracts } from '../utils/deployTestBase';

describe('Pyth', () => {
  let signers: SignerWithAddress[];
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  let STABLE: MockDebtToken;
  let STOCK: MockDebtToken;
  let BTC: MockERC20;

  let contracts: Contracts;
  let pyth: MockPyth;
  let priceFeed: PriceFeed;

  before(async () => {
    signers = await ethers.getSigners();
    [owner, alice] = signers;
  });

  beforeEach(async () => {
    contracts = await deployTesting();

    pyth = contracts.pyth;
    priceFeed = contracts.priceFeed;

    STABLE = contracts.STABLE;
    STOCK = contracts.STOCK;
    BTC = contracts.BTC;
  });

  describe('Pyth', () => {
    describe('Set Price', () => {
      it('Set (fail)', async () => {
        const ud = await generatePriceUpdateData(pyth);
        const fee = await pyth.getUpdateFee(ud);

        // missing fee
        await expect(pyth.updatePriceFeeds(ud)).to.be.revertedWithCustomError(pyth, 'InsufficientFee');
      });

      it('Set', async () => {
        const ud = await generatePriceUpdateData(pyth);
        const fee = await pyth.getUpdateFee(ud);

        // update
        await expect(pyth.updatePriceFeeds(ud, { value: fee })).to.not.be.reverted;
      });
    });
  });

  describe('Price Feed', () => {
    describe('Set Price', () => {
      it('Set (fail)', async () => {
        const ud = await generatePriceUpdateData(pyth);
        const fee = await priceFeed.getPythUpdateFee(ud);

        // missing fee
        await expect(priceFeed.updatePythPrices(ud)).to.be.revertedWithCustomError(
          priceFeed,
          'InvalidPaymentForOracleUpdate'
        );
      });

      it('Set', async () => {
        const ud = await generatePriceUpdateData(pyth);
        const fee = await priceFeed.getPythUpdateFee(ud);

        // update
        await expect(priceFeed.updatePythPrices(ud, { value: fee })).to.not.be.reverted;
      });
    });

    describe('Get Price', () => {
      beforeEach(async () => {
        await initOracle(contracts);
      });

      it('Check BTC', async () => {
        // BTC
        expect(await priceFeed['getUSDValue(address,uint256)'](BTC, parseUnits('1', 8))).to.be.equal(
          parseUnits('21000')
        );
      });

      it('Check STOCK', async () => {
        // STOCK
        expect(await priceFeed['getUSDValue(address,uint256)'](STOCK, parseUnits('1'))).to.be.equal(parseUnits('150'));
      });
    });

    describe('Update Price', () => {
      beforeEach(async () => {
        await initOracle(contracts);
      });

      it('Check BTC', async () => {
        // BTC
        expect(await priceFeed['getUSDValue(address,uint256)'](BTC, parseUnits('1', 8))).to.be.equal(
          parseUnits('21000')
        );

        // update
        setPrice('BTC', 25000);
        await updateOracle(contracts);

        // BTC
        expect(await priceFeed['getUSDValue(address,uint256)'](BTC, parseUnits('1', 8))).to.be.equal(
          parseUnits('25000')
        );
      });

      it('Check STOCK', async () => {
        // STOCK
        expect(await priceFeed['getUSDValue(address,uint256)'](STOCK, parseUnits('1'))).to.be.equal(parseUnits('150'));

        // update
        setPrice('STOCK', 250);
        await updateOracle(contracts);

        // STOCK
        expect(await priceFeed['getUSDValue(address,uint256)'](STOCK, parseUnits('1'))).to.be.equal(parseUnits('250'));
      });
    });
  });
});
