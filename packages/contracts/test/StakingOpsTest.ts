import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers, network } from 'hardhat';
import {
  MockDebtToken,
  MockERC20,
  MockPyth,
  MockStakingOperations,
  StakingVestingOperations,
  StakingVestingOperations__factory,
  SwapOperations,
  SwapPair,
  TokenManager,
} from '../typechain';
import { expect } from 'chai';
import { createPoolPair, deployTesting, getLatestBlockTimestamp } from '../utils/testHelper';
import { parseUnits, ZeroAddress } from 'ethers';
import { OracleUpdateDataAndFee, generatePriceUpdateData, generatePriceUpdateDataWithFee } from '../utils/pythHelper';
import { Contracts } from '../utils/deployTestBase';
import { increaseTo } from '@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time';

describe('StakingOps', () => {
  let signers: SignerWithAddress[];
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;
  let carol: SignerWithAddress;

  let STABLE: MockDebtToken;
  let STOCK: MockDebtToken;
  let STOCK_2: MockDebtToken;
  let BTC: MockERC20;
  let GOV: MockERC20;

  let contracts: Contracts;
  let pyth: MockPyth;
  let tokenMgr: TokenManager;
  let stakingOps: MockStakingOperations;
  let swapOps: SwapOperations;
  let vestOps: StakingVestingOperations;
  let oracleData: OracleUpdateDataAndFee;

  before(async () => {
    signers = await ethers.getSigners();
    [owner, alice, bob, carol] = signers;
  });

  beforeEach(async () => {
    contracts = await deployTesting();

    pyth = contracts.pyth;

    stakingOps = contracts.stakingOperations;
    swapOps = contracts.swapOperations;
    tokenMgr = contracts.tokenManager;
    vestOps = StakingVestingOperations__factory.connect(await stakingOps.vesting(), owner);

    STABLE = contracts.STABLE;
    STOCK = contracts.STOCK;
    STOCK_2 = contracts.STOCK_2;
    BTC = contracts.BTC;
    GOV = contracts.GOV;

    oracleData = await generatePriceUpdateDataWithFee(contracts);
  });

  const deadline = async (): Promise<number> => {
    return (await getLatestBlockTimestamp()) + 100;
  };

  const add = async (
    user: SignerWithAddress,
    tokenB: MockDebtToken | MockERC20,
    amountA: bigint,
    amountB: bigint,
    mint: boolean = true,
    create: boolean = true
  ): Promise<SwapPair> => {
    //create pair
    if (create) await createPoolPair(contracts, STABLE, tokenB);

    //mint
    if (mint) {
      await STABLE.unprotectedMint(user, amountA);
      await tokenB.unprotectedMint(user, amountB);
    }

    //approve
    await STABLE.connect(user).approve(swapOps, amountA);
    await tokenB.connect(user).approve(swapOps, amountB);

    //add liquidty to pair
    await swapOps
      .connect(user)
      .addLiquidity(STABLE, tokenB, amountA, amountB, 0, 0, await priceUpdateAndMintMeta(), await deadline(), {
        value: oracleData.fee,
      });

    //get pair
    const pairAddress = await swapOps.getPair(STABLE, tokenB);
    return ethers.getContractAt('SwapPair', pairAddress);
  };

  const mintMeta = async (): IBase.MintMetaStruct => {
    return [
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      await swapOps.MAX_BORROWING_FEE(),
    ];
  };

  const priceUpdateAndMintMeta = async (): IBase.PriceUpdateAndMintMetaStruct => {
    return [await mintMeta(), await generatePriceUpdateData(pyth)];
  };

  const remove = async (signer: SignerWithAddress, tokenB: MockDebtToken | MockERC20, amount: bigint) => {
    //remove liquidity
    await swapOps
      .connect(signer)
      .removeLiquidity(
        STABLE,
        tokenB,
        amount,
        0,
        0,
        '0x0000000000000000000000000000000000000000',
        '0x0000000000000000000000000000000000000000',
        await deadline(),
        oracleData.data,
        { value: oracleData.fee }
      );
  };

  describe('Config', () => {
    describe('setEarlyClaimBurnAddress', () => {
      it('Only callable from token Manager', async () => {
        // fail
        await expect(stakingOps.connect(owner).setEarlyClaimBurnAddress(bob)).to.be.revertedWithCustomError(
          stakingOps,
          'CallerIsNotTokenManager'
        );

        // fail
        await expect(tokenMgr.connect(alice).setEarlyClaimBurnAddress(bob)).to.be.revertedWithCustomError(
          tokenMgr,
          'OwnableUnauthorizedAccount'
        );
      });

      it('Set', async () => {
        //success
        expect(await stakingOps.earlyClaimBurnAddress()).to.be.equal(ZeroAddress);
        await expect(tokenMgr.connect(owner).setEarlyClaimBurnAddress(bob)).to.not.be.reverted;
        expect(await stakingOps.earlyClaimBurnAddress()).to.be.equal(bob);
      });
    });

    describe('setRewardsPerSecond', () => {
      it('Only callable from token Manager', async () => {
        const pair = await add(bob, STOCK, parseUnits('150'), parseUnits('1'), true, true);

        // fail
        await expect(
          stakingOps.connect(owner).setRewardsPerSecond(pair, BTC, 100n, true)
        ).to.be.revertedWithCustomError(stakingOps, 'CallerIsNotTokenManager');

        // fail
        await expect(
          tokenMgr.connect(alice).setSwapPoolRewardsPerSecond(pair, BTC, 100n, true)
        ).to.be.revertedWithCustomError(tokenMgr, 'OwnableUnauthorizedAccount');
      });

      it('overflow check', async () => {
        const pair = await add(bob, STOCK, parseUnits('150'), parseUnits('1'), true, true);

        await expect(
          tokenMgr
            .connect(owner)
            .setSwapPoolRewardsPerSecond(pair, BTC, BigInt(2 ** 256 / 1000 / 365 / 24 / 60 / 60), true)
        ).to.be.revertedWithPanic();
      });

      it('Set', async () => {
        const pair = await add(bob, STOCK, parseUnits('150'), parseUnits('1'), true, true);

        //success
        expect((await stakingOps.getRewardInfo(pair, BTC)).rewardsPerSecond).to.be.equal(0n);
        await expect(tokenMgr.connect(owner).setSwapPoolRewardsPerSecond(pair, BTC, 100n, true)).to.not.be.reverted;
        expect((await stakingOps.getRewardInfo(pair, BTC)).rewardsPerSecond).to.be.equal(100n);
      });
    });

    describe('setPool', () => {
      it('Only callable from token Manager', async () => {
        const pair = await add(bob, STOCK, parseUnits('150'), parseUnits('1'), true, true);

        // fail
        await expect(stakingOps.connect(owner).setPool(pair)).to.be.revertedWithCustomError(
          stakingOps,
          'CallerIsNotTokenManagerOrSwapOperations'
        );
      });
    });
  });

  describe('User Functions', () => {
    let pair: SwapPair;

    beforeEach(async () => {
      pair = await add(owner, STOCK, parseUnits('150'), parseUnits('1'), true, true);
      await tokenMgr.connect(owner).setSwapPoolRewardsPerSecond(pair, BTC, 100n, true);
    });

    it('Deposit', async () => {
      expect(await stakingOps.balanceOf(pair, alice)).to.be.equals(0n);
      await add(alice, STOCK, parseUnits('150'), parseUnits('1'), true, false);
      expect(await stakingOps.balanceOf(pair, alice)).to.be.greaterThan(0n);
    });

    it('Withdraw', async () => {
      expect(await stakingOps.balanceOf(pair, bob)).to.be.equals(0n);
      await add(bob, STOCK, parseUnits('150'), parseUnits('1'), true, false);

      const bal = await stakingOps.balanceOf(pair, bob);
      expect(bal).to.be.greaterThan(0n);

      await remove(bob, STOCK, bal);
      expect(await stakingOps.balanceOf(pair, bob)).to.be.equal(0n);
    });
  });

  describe('Claim', () => {
    let pair: SwapPair;
    let rewardPerSecond: bigint;
    let passedTime: bigint;
    let govPending: any;
    let btcPending: any;

    beforeEach(async () => {
      rewardPerSecond = parseUnits('1');
      passedTime = 60n;

      await createPoolPair(contracts, STABLE, STOCK);
      const pairAddress = await swapOps.getPair(STABLE, STOCK);
      pair = await ethers.getContractAt('SwapPair', pairAddress);

      tokenMgr.connect(owner).setSwapPoolRewardsPerSecond(pairAddress, GOV, rewardPerSecond, true);
      tokenMgr.connect(owner).setSwapPoolRewardsPerSecond(pairAddress, BTC, rewardPerSecond, false);

      // fund staking
      const claimable = rewardPerSecond * passedTime * 2n;
      await GOV.unprotectedMint(stakingOps, claimable);
      await BTC.unprotectedMint(stakingOps, claimable);

      // deposit
      await add(bob, STOCK, parseUnits('150'), parseUnits('1'), true, false);
      const start = await stakingOps.poolInfo(pair);

      // increase time
      await increaseTo(start + passedTime);
      expect(await getLatestBlockTimestamp()).to.be.equal(start + passedTime);

      // check pending
      govPending = await stakingOps.pendingReward(pair, GOV, bob);
      btcPending = await stakingOps.pendingReward(pair, BTC, bob);
      const expectedPending = rewardPerSecond * passedTime;
      expect(govPending).to.be.approximately(expectedPending, 1n); // rounding diff
      expect(btcPending).to.be.approximately(expectedPending, 1n); // rounding diff

      // claim
      const t1 = await getLatestBlockTimestamp();
      await stakingOps.connect(bob).claim(false, false);
      const t2 = await getLatestBlockTimestamp();

      const rewardsSinceClaim = BigInt(t2 - t1) * rewardPerSecond; //because claim caused time change
      govPending += rewardsSinceClaim;
      btcPending += rewardsSinceClaim;
    });

    it('Claim', async () => {
      expect(await stakingOps.pendingReward(pair, GOV, bob)).to.be.equal(0n);
      expect(await GOV.balanceOf(bob)).to.be.equal(0n); // claimed rewards are waiting to be harvested
      expect(await stakingOps.pendingHarvest(bob, GOV)).to.be.equal(govPending);

      expect(await stakingOps.pendingReward(pair, BTC, bob)).to.be.equal(0n);
      expect(await BTC.balanceOf(bob)).to.be.equal(btcPending);
      expect(await stakingOps.pendingHarvest(bob, BTC)).to.be.equal(0n);
    });

    it('Claim and try claim again (fail)', async () => {
      // multi claim
      await network.provider.send('evm_setAutomine', [false]); // stop automine
      await stakingOps.connect(bob).claim(false, false);
      await stakingOps.connect(bob).claim(false, false);
      await stakingOps.connect(bob).claim(false, false);
      await network.provider.send('evm_mine'); // manually mine all at once
      await network.provider.send('evm_setAutomine', [true]); // start automine

      expect(await stakingOps.pendingHarvest(bob, GOV)).to.be.approximately(govPending + rewardPerSecond, 1n); // rounding diff
      expect(await BTC.balanceOf(bob)).to.be.approximately(btcPending + rewardPerSecond, 1n); // rounding diff
    });

    it('Deposit instant claim (fail)', async () => {
      // add, check if she instantly has big rewards
      await add(carol, STOCK, parseUnits('150'), parseUnits('1'), true, false);

      // check after deposit
      expect(await stakingOps.pendingReward(pair, BTC, carol)).to.be.eq(0n);

      // check after time increase
      const start = await stakingOps.poolInfo(pair);
      await increaseTo(start + 10n); //increase 10s
      expect(await getLatestBlockTimestamp()).to.be.equal(start + 10n);
      expect(await stakingOps.pendingReward(pair, BTC, carol)).to.be.approximately((rewardPerSecond / 2n) * 10n, 1000n); // rounding diff

      // second add
      await add(carol, STOCK, parseUnits('150'), parseUnits('1'), true, false);
      expect(await BTC.balanceOf(carol)).to.be.approximately((rewardPerSecond / 2n) * 15n, 1000n); // (+5s because of 5 writes in add to pool) + rounding diff
      expect(await stakingOps.pendingReward(pair, BTC, carol)).to.be.equal(0n);
    });

    it('Harvest (instant full)', async () => {
      expect(await GOV.balanceOf(bob)).to.be.equal(0n);
      expect(await BTC.balanceOf(bob)).to.be.equal(btcPending);

      await stakingOps.connect(bob).harvest(true);
      expect(await GOV.balanceOf(bob)).to.be.approximately(govPending / 2n, 1n); // 50% cut, because of instant claim
      expect(await BTC.balanceOf(bob)).to.be.equal(btcPending);
    });

    it('Harvest (vested full)', async () => {
      await stakingOps.connect(bob).harvest(false);
      expect(await GOV.balanceOf(bob)).to.be.equal(0n); // all into vesting
      expect(await BTC.balanceOf(bob)).to.be.equal(btcPending);
      expect((await vestOps.checkVesting(GOV, bob)).amount).to.be.equal(govPending);
      expect((await vestOps.checkVesting(BTC, bob)).amount).to.be.equal(0n);

      // increase time & claim
      await increaseTo(BigInt(await getLatestBlockTimestamp()) + (await vestOps.checkVesting(GOV, bob)).remainingTime);
      await vestOps.connect(bob).claim(GOV, false);
      expect(await GOV.balanceOf(bob)).to.be.equal(govPending);
    });

    it('Harvest (vested full early)', async () => {
      await stakingOps.connect(bob).harvest(false);
      await expect(vestOps.connect(bob).claim(GOV, false)).to.be.revertedWithCustomError(vestOps, 'StillVested');

      // increase time & claim
      const remain = (await vestOps.checkVesting(GOV, bob)).remainingTime;
      await increaseTo(BigInt(await getLatestBlockTimestamp()) + remain / 2n - 1n);
      await vestOps.connect(bob).claim(GOV, true);
      expect(await GOV.balanceOf(bob)).to.be.approximately(govPending - govPending / 4n, 1n);
    });
  });

  it('Complex Scenario (multi pool / multi user)', async () => {
    // prepare 2 pools
    await createPoolPair(contracts, STABLE, STOCK);
    const pair_1 = await ethers.getContractAt('SwapPair', await swapOps.getPair(STABLE, STOCK));
    await createPoolPair(contracts, STABLE, STOCK_2);
    const pair_2 = await ethers.getContractAt('SwapPair', await swapOps.getPair(STABLE, STOCK_2));

    // config
    const rewardPerSecondA = parseUnits('1');
    const rewardPerSecondB = parseUnits('5');
    await tokenMgr.connect(owner).setSwapPoolRewardsPerSecond(pair_1, GOV, rewardPerSecondA, true);
    await tokenMgr.connect(owner).setSwapPoolRewardsPerSecond(pair_2, GOV, rewardPerSecondB, true);
    await GOV.unprotectedMint(stakingOps, parseUnits('10000'));

    // functions
    const claim = async (_pair: SwapPair) => {
      await stakingOps.connect(alice).claim(false, false);
      await stakingOps.connect(alice).untrustedHarvestAll();
      await stakingOps.connect(bob).claim(false, false);
      await stakingOps.connect(bob).untrustedHarvestAll();
      await stakingOps.connect(carol).claim(false, false);
      await stakingOps.connect(carol).untrustedHarvestAll();
    };
    const compareShares = async (_pair: SwapPair, _alice: bigint, _bob: bigint, _carol: bigint) => {
      const s_a = await stakingOps.userInfo(_pair, alice);
      const s_b = await stakingOps.userInfo(_pair, bob);
      const s_c = await stakingOps.userInfo(_pair, alice);
      const sT = s_a + s_b + s_c;
      const vT = _alice + _bob + _carol;

      expect(_alice / vT).to.be.eq(s_a / sT);
      expect(_bob / vT).to.be.eq(s_b / sT);
      expect(_carol / vT).to.be.eq(s_c / sT);
    };
    const comparePending = async (_start: bigint, _offset: bigint) => {
      const p1_a = await stakingOps.pendingReward(pair_1, GOV, alice);
      const p1_b = await stakingOps.pendingReward(pair_1, GOV, bob);
      const p1_c = await stakingOps.pendingReward(pair_1, GOV, carol);
      const p2_a = await stakingOps.pendingReward(pair_2, GOV, alice);
      const p2_b = await stakingOps.pendingReward(pair_2, GOV, bob);
      const p2_c = await stakingOps.pendingReward(pair_2, GOV, carol);
      const end = BigInt(await getLatestBlockTimestamp());

      await compareShares(pair_1, p1_a, p1_b, p1_c);
      await compareShares(pair_2, p2_a, p2_b, p2_c);

      const p1T = p1_a + p1_b + p1_c;
      const p2T = p2_a + p2_b + p2_c;
      const pT = p1T + p2T;
      expect(pT).to.be.approximately(
        (end - _start) * rewardPerSecondA + (end - _start) * rewardPerSecondB - _offset,
        100n
      );
      return pT;
    };

    // deposit pool 1
    await network.provider.send('evm_setAutomine', [false]); // stop automine
    await add(alice, STOCK, parseUnits('150'), parseUnits('150'), true, false);
    await add(bob, STOCK, parseUnits('100'), parseUnits('100'), true, false);
    await add(carol, STOCK, parseUnits('50'), parseUnits('50'), true, false);

    // deposit pool 2
    await add(alice, STOCK_2, parseUnits('150'), parseUnits('150'), true, false);
    await add(bob, STOCK_2, parseUnits('100'), parseUnits('100'), true, false);
    await add(carol, STOCK_2, parseUnits('50'), parseUnits('50'), true, false);
    await network.provider.send('evm_mine'); // manually mine all at once
    await network.provider.send('evm_setAutomine', [true]); // start automine
    const start = BigInt(await getLatestBlockTimestamp());

    // increase time & check pending
    await increaseTo(start + 60n); // increase time 1 minute
    await comparePending(start, 0n);
    await increaseTo(start + 5n * 60n); // increase time 5 minute
    await comparePending(start, 0n);

    // claim
    await network.provider.send('evm_setAutomine', [false]); // stop automine
    await claim(pair_1);
    await claim(pair_2);
    await network.provider.send('evm_mine'); // manually mine all at once
    await network.provider.send('evm_setAutomine', [true]); // start automine
    await compareShares(pair_1, await GOV.balanceOf(alice), await GOV.balanceOf(bob), await GOV.balanceOf(carol));
  });
});
