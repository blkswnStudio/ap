import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import { MockDebtToken, PriceFeed, TokenManager } from '../typechain';
import { expect } from 'chai';
import { parseUnits } from 'ethers';
import { deployTesting, setPrice } from '../utils/testHelper';
import { Contracts } from '../utils/deployTestBase';

describe('StockFeatures', () => {
  let signers: SignerWithAddress[];
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  let STOCK: MockDebtToken;
  let STOCK_2: MockDebtToken;

  let contracts: Contracts;
  let priceFeed: PriceFeed;
  let tokenManager: TokenManager;

  let precision: bigint;

  before(async () => {
    signers = await ethers.getSigners();
    [owner, alice] = signers;
  });

  beforeEach(async () => {
    // @ts-ignore
    contracts = await deployTesting();

    priceFeed = contracts.priceFeed;
    tokenManager = contracts.tokenManager;

    STOCK = contracts.STOCK;
    STOCK_2 = contracts.STOCK_2;

    precision = await STOCK.STOCK_SPLIT_PRECISION();
  });

  const exchangeRate = (rate: number): bigint => {
    return parseUnits(rate.toString(), 8);
  };

  const split = async (_split: number) => {
    await tokenManager.connect(owner).setNextStockSplitRelative(STOCK, _split);
  };

  const checkCurrent = async (_split: number) => {
    const divisor = parseUnits('1', 8);
    const dividend = parseUnits(Math.abs(_split).toFixed(8), 8);
    const val = ((_split < 0 ? -precision : precision) * dividend) / divisor;
    expect(await STOCK.currentStockSplit()).to.be.equal(val);
  };

  const getPrice = async (current: string, afterSplit?: string, trusted?: boolean): Promise<boolean> => {
    // set prices
    await setPrice('STOCK', current, contracts);

    // get price
    const priceInfo = await priceFeed.getPrice(STOCK);

    // expect
    if (afterSplit !== undefined) {
      expect(priceInfo.price).to.be.equal(parseUnits(afterSplit));
    }
    if (trusted !== undefined) {
      expect(priceInfo.isTrusted).to.be.equal(trusted);
    }

    return (
      (afterSplit === undefined || parseUnits(afterSplit) == priceInfo.price) &&
      (trusted === undefined || trusted == priceInfo.isTrusted)
    );
  };

  describe('Stock Rename', () => {
    it('Setter only callable by tokenManager', async () => {
      // expected fail
      await expect(STOCK.connect(alice).setSymbolAndName('TEST', 'Test Stock')).to.be.revertedWithCustomError(
        STOCK,
        'NotFromDTManager'
      );

      //expected success
      await expect(
        tokenManager.connect(owner).setSymbolAndName(STOCK, 'TEST', 'Test Stock')
      ).to.not.be.revertedWithCustomError(STOCK, 'NotFromDTManager');
    });

    it('Change name and symbol', async () => {
      //rename
      await tokenManager.connect(owner).setSymbolAndName(STOCK, 'TEST', 'Test Stock');
      expect(await STOCK.symbol()).to.be.equal('TEST');
      expect(await STOCK.name()).to.be.equal('Test Stock');
    });
  });

  describe('Stock Split', () => {
    it('Setter only callable by tokenManager with owner', async () => {
      // nextStockSplitRelative (fail)
      await expect(STOCK.connect(alice).setNextStockSplitRelative(2)).to.be.revertedWithCustomError(
        STOCK,
        'NotFromDTManager'
      );

      // nextStockSplitRelative (fail)
      await expect(tokenManager.connect(alice).setNextStockSplitRelative(STOCK, 2)).to.be.revertedWithCustomError(
        tokenManager,
        'OwnableUnauthorizedAccount'
      );

      // nextStockSplitRelative
      await expect(tokenManager.connect(owner).setNextStockSplitRelative(STOCK, 2)).to.not.be.revertedWithCustomError(
        STOCK,
        'NotFromDTManager'
      );
    });

    describe('Set next stock split', () => {
      it('stock split', async () => {
        //set stock split x2
        await split(2);

        //check stock split
        await checkCurrent(2);
      });

      it('reverse stock split', async () => {
        //set reverse stock split x3
        await split(-3);

        //check stock split
        await checkCurrent(-3);
      });

      it('mixed', async () => {
        //stock split x2
        await split(2);
        await checkCurrent(2);

        //reverse stock split x3
        await split(-3);
        await checkCurrent(-1.5);

        //stock split x60
        await split(60);
        await checkCurrent(40);

        //revsere stock split x100
        await split(-100);
        await checkCurrent(-2.5);
      });
    });

    describe('getPrice (test if split is applied)', () => {
      it('stock split', async () => {
        //set stock split x2
        await split(2);

        //check
        expect(await getPrice('1', '2', true)).to.be.equal(true);
      });

      it('reverse stock split', async () => {
        //set reverse stock split x2
        await split(-2);

        //check
        expect(await getPrice('1', '0.5', true)).to.be.equal(true);
      });

      it('stock split mixed', async () => {
        //set stock split x2
        await split(2);

        //check
        expect(await getPrice('1', '2', true)).to.be.equal(true);

        //set reverse stock split x2
        await split(-2);

        //check
        expect(await getPrice('1', '1', true)).to.be.equal(true);
      });
    });
  });

  describe('Stock Exchange', () => {
    it('Setter only callable by tokenManager', async () => {
      // setStockExchange (fail)
      await expect(STOCK.connect(alice).setStockExchange(STOCK_2, exchangeRate(5))).to.be.revertedWithCustomError(
        STOCK,
        'NotFromDTManager'
      );

      // nextStockSplitRelative
      await expect(
        tokenManager.connect(owner).setStockExchange(STOCK, STOCK_2, exchangeRate(5))
      ).to.not.be.revertedWithCustomError(STOCK, 'NotFromDTManager');
    });

    it('Trigger Stock exchange', async () => {
      // get price before
      expect((await priceFeed.getPrice(STOCK)).price).to.be.equal(parseUnits('150'));
      expect((await priceFeed.getPrice(STOCK_2)).price).to.be.equal(parseUnits('350'));

      // set stock exchange
      await tokenManager.connect(owner).setStockExchange(STOCK, STOCK_2, exchangeRate(-2));

      // check price after
      expect((await priceFeed.getPrice(STOCK)).price).to.be.equal(parseUnits('175'));
    });
  });
});
