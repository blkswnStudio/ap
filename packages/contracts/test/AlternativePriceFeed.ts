import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import {
  MockDebtToken,
  MockERC20,
  MockPyth,
  PriceFeed,
  MockBalancerV2Vault,
  MockBalancerV2Pool,
  TokenManager,
  AlternativePriceFeed,
} from '../typechain';
import { expect } from 'chai';
import { deployTesting } from '../utils/testHelper';
import { AddressLike, parseUnits } from 'ethers';
import { Contracts } from '../utils/deployTestBase';

describe('AlternativePriceFeed', () => {
  let signers: SignerWithAddress[];
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  let STABLE: MockDebtToken;
  let STOCK: MockDebtToken;
  let BTC: MockERC20;

  let contracts: Contracts;
  let pyth: MockPyth;
  let priceFeed: PriceFeed;
  let tokenMgr: TokenManager;
  let altPriceFeed: AlternativePriceFeed;

  let balancerVault: MockBalancerV2Vault;
  let stockPool: MockBalancerV2Pool;
  let stockPool3: MockBalancerV2Pool;

  before(async () => {
    signers = await ethers.getSigners();
    [owner, alice] = signers;
  });

  beforeEach(async () => {
    contracts = await deployTesting();

    pyth = contracts.pyth;
    priceFeed = contracts.priceFeed;
    tokenMgr = contracts.tokenManager;
    altPriceFeed = contracts.alternativePriceFeed;

    STABLE = contracts.STABLE;
    STOCK = contracts.STOCK;
    BTC = contracts.BTC;

    const bVaultFactory = await ethers.getContractFactory('MockBalancerV2Vault');
    balancerVault = await bVaultFactory.deploy();

    const bPoolFactory = await ethers.getContractFactory('MockBalancerV2Pool');
    stockPool = await bPoolFactory.deploy(balancerVault, [STOCK, BTC], [parseUnits('0.5'), parseUnits('0.5')]);
    stockPool3 = await bPoolFactory.deploy(
      balancerVault,
      [STOCK, BTC, STABLE],
      [parseUnits('0.25'), parseUnits('0.5'), parseUnits('0.25')]
    );
  });

  const unsetOracleId = async (token: AddressLike) => {
    await tokenMgr.setOracleId(token, '0x' + BigInt(0).toString(8).padStart(64, '0'));
  };

  describe('Set Price', () => {
    it('check original price before alternative oracle', async () => {
      // check price with pyth
      expect((await priceFeed.getPrice(STOCK)).price).to.be.eq(parseUnits('150'));
    });

    it('via Fallback', async () => {
      await unsetOracleId(STOCK);
      await altPriceFeed.setFallbackPrices([{ tokenAddress: STOCK, amount: parseUnits('200') }]);
      expect((await priceFeed.getPrice(STOCK)).price).to.be.eq(parseUnits('200'));
    });

    it('via BalancerV2 (50 => 50)', async () => {
      await unsetOracleId(STOCK);
      await stockPool.mockBalances([parseUnits('10'), parseUnits('1', 8)]); // 10 STOCK vs 1 BTC
      await altPriceFeed.setBalancerPricePool(STOCK, stockPool);
      expect((await priceFeed.getPrice(STOCK)).price).to.be.eq(parseUnits('2100'));
    });

    it('via BalancerV2 (25 => 50/25)', async () => {
      await unsetOracleId(STOCK);
      await stockPool3.mockBalances([parseUnits('10'), parseUnits('2', 8), parseUnits('21000')]); // 10 STOCK vs 2 BTC / 21000 STABLE
      await altPriceFeed.setBalancerPricePool(STOCK, stockPool3);
      expect((await priceFeed.getPrice(STOCK)).price).to.be.eq(parseUnits('2100'));
    });
  });
});
