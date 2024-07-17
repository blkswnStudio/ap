import { ethers } from 'hardhat';
import {
  MockDebtToken,
  MockERC20,
  MockTroveManager,
  LiquidationOperations,
  TokenManager,
  RedemptionOperations,
} from '../typechain';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { openTrove, deployTesting, whaleShrimpTroveInit, setPrice, redeem } from '../utils/testHelper';
import { expect } from 'chai';
import { parseUnits } from 'ethers';
import { Contracts } from '../utils/deployTestBase';
import { OracleUpdateDataAndFee, generatePriceUpdateDataWithFee } from '../utils/pythHelper';

describe('Freeze', () => {
  let signers: SignerWithAddress[];
  let owner: SignerWithAddress;
  let defaulter_1: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let STABLE: MockDebtToken;
  let BTC: MockERC20;

  let troveManager: MockTroveManager;
  let tokenManager: TokenManager;
  let liquidationOperations: LiquidationOperations;
  let redemptionOperations: RedemptionOperations;

  let contracts: Contracts;

  let oracleData: OracleUpdateDataAndFee;

  before(async () => {
    signers = await ethers.getSigners();
    [owner, defaulter_1, , , , alice, bob] = signers;
  });

  beforeEach(async () => {
    contracts = await deployTesting();

    troveManager = contracts.troveManager;
    liquidationOperations = contracts.liquidationOperations;
    tokenManager = contracts.tokenManager;
    redemptionOperations = contracts.redemptionOperations;
    STABLE = contracts.STABLE;
    BTC = contracts.BTC;

    oracleData = await generatePriceUpdateDataWithFee(contracts);
  });

  describe('Setter only callable by owner', () => {
    it('Minting', async () => {
      // fail
      await expect(tokenManager.connect(alice).setEnableMinting(false)).to.be.revertedWithCustomError(
        tokenManager,
        'OwnableUnauthorizedAccount'
      );

      // success
      await expect(tokenManager.connect(owner).setEnableMinting(false)).to.not.be.reverted;
    });

    it('Minting specific', async () => {
      // fail
      await expect(tokenManager.connect(alice).setDisableDebtMinting(STABLE, true)).to.be.revertedWithCustomError(
        tokenManager,
        'OwnableUnauthorizedAccount'
      );

      // success
      await expect(tokenManager.connect(owner).setDisableDebtMinting(STABLE, true)).to.not.be.reverted;
    });

    it('Redemption', async () => {
      // fail
      await expect(troveManager.connect(alice).setEnableRedeeming(false)).to.be.revertedWithCustomError(
        tokenManager,
        'OwnableUnauthorizedAccount'
      );

      // success
      await expect(troveManager.connect(owner).setEnableRedeeming(false)).to.not.be.reverted;
    });

    it('Liquidation', async () => {
      // fail
      await expect(troveManager.connect(alice).setEnableLiquidation(false)).to.be.revertedWithCustomError(
        tokenManager,
        'OwnableUnauthorizedAccount'
      );

      // success
      await expect(troveManager.connect(owner).setEnableLiquidation(false)).to.not.be.reverted;
    });
  });

  describe('Freeze Minting', () => {
    describe('Complete', () => {
      it('Mint before freeze (succeed)', async () => {
        // mint without freeze
        await openTrove({
          from: alice,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('8000') }],
        });
        expect(await STABLE.balanceOf(alice)).to.be.equal(parseUnits('8000'));

        // freeze
        await tokenManager.connect(owner).setEnableMinting(false);
      });

      it('Mint after freeze (fail)', async () => {
        // freeze
        await tokenManager.connect(owner).setEnableMinting(false);

        // mint after freeze
        expect(
          openTrove({
            from: alice,
            contracts,
            colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
            debts: [{ tokenAddress: STABLE, amount: parseUnits('8000') }],
          })
        ).to.be.revertedWithCustomError(STABLE, 'MintingDisabled');
      });
    });

    describe('Specific', () => {
      it('Mint before freeze (succeed)', async () => {
        // mint without freeze
        await openTrove({
          from: alice,
          contracts,
          colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
          debts: [{ tokenAddress: STABLE, amount: parseUnits('8000') }],
        });
        expect(await STABLE.balanceOf(alice)).to.be.equal(parseUnits('8000'));

        // freeze
        await tokenManager.connect(owner).setDisableDebtMinting(STABLE, true);
      });

      it('Mint after freeze (fail)', async () => {
        // freeze
        await tokenManager.connect(owner).setDisableDebtMinting(STABLE, true);

        // mint after freeze
        expect(
          openTrove({
            from: alice,
            contracts,
            colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
            debts: [{ tokenAddress: STABLE, amount: parseUnits('8000') }],
          })
        ).to.be.revertedWithCustomError(STABLE, 'MintingDisabledForToken');
      });
    });
  });

  describe('Freeze Liquidation', () => {
    it('Liquidate before freeze (succeed)', async () => {
      // init
      await whaleShrimpTroveInit(contracts, signers);
      await setPrice('BTC', '5000', contracts);

      // liquidate
      await expect(
        liquidationOperations.connect(alice).liquidate(defaulter_1, oracleData.data, { value: oracleData.fee })
      ).to.not.be.reverted;
    });

    it('Liquidate after freeze (fail)', async () => {
      // init
      await whaleShrimpTroveInit(contracts, signers);
      await setPrice('BTC', '5000', contracts);

      // freeze
      await troveManager.connect(owner).setEnableLiquidation(false);

      // liquidate
      await expect(
        liquidationOperations.liquidate(defaulter_1, oracleData.data, { value: oracleData.fee })
      ).to.be.revertedWithCustomError(liquidationOperations, 'LiquidationDisabled');
    });
  });

  describe('Freeze Redemption ', () => {
    it('Redemption before freeze (succeed)', async () => {
      // init
      await whaleShrimpTroveInit(contracts, signers);

      // redeem
      await expect(redeem(bob, parseUnits('100.5'), contracts)).to.not.be.reverted;
    });

    it('Redemption after freeze (succeed)', async () => {
      // init
      await whaleShrimpTroveInit(contracts, signers);

      // freeze
      await troveManager.connect(owner).setEnableRedeeming(false);

      // redeem
      await expect(redeem(bob, parseUnits('100.5'), contracts)).to.be.revertedWithCustomError(
        redemptionOperations,
        'RedeptionDisabled'
      );
    });
  });
});
