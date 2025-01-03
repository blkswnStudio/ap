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
    describe('setRedistributeAddress', () => {
      it('Only callable from token Manager', async () => {
        // fail
        await expect(stakingOps.connect(owner).setRedistributeAddress(bob)).to.be.revertedWithCustomError(
          stakingOps,
          'CallerIsNotTokenManager'
        );

        // fail
        await expect(tokenMgr.connect(alice).setBurnRedistributeAddress(bob)).to.be.revertedWithCustomError(
          tokenMgr,
          'OwnableUnauthorizedAccount'
        );
      });

      it('Set', async () => {
        //success
        expect(await stakingOps.redistributeAddress()).to.be.equal(ZeroAddress);
        await expect(tokenMgr.connect(owner).setBurnRedistributeAddress(bob)).to.not.be.reverted;
        expect(await stakingOps.redistributeAddress()).to.be.equal(bob);
      });
    });

    describe('setRewardsPerSecond', () => {
      it('Only callable from token Manager', async () => {
        // fail
        await expect(stakingOps.connect(owner).setRewardsPerSecond(100n)).to.be.revertedWithCustomError(
          stakingOps,
          'CallerIsNotTokenManager'
        );

        // fail
        await expect(tokenMgr.connect(alice).setStakingRewardsPerSecond(100n)).to.be.revertedWithCustomError(
          tokenMgr,
          'OwnableUnauthorizedAccount'
        );
      });

      it('Set', async () => {
        //success
        expect(await stakingOps.rewardsPerSecond()).to.be.equal(0n);
        await expect(tokenMgr.connect(owner).setStakingRewardsPerSecond(100n)).to.not.be.reverted;
        expect(await stakingOps.rewardsPerSecond()).to.be.equal(100n);
      });
    });

    describe('setPool', () => {
      it('Only callable from token Manager', async () => {
        // fail
        await expect(stakingOps.connect(owner).setPool(BTC, 100n)).to.be.revertedWithCustomError(
          stakingOps,
          'InvalidStakingToken'
        );

        // fail
        const pair = await add(bob, STOCK, parseUnits('150'), parseUnits('1'), true, true);
        await expect(stakingOps.connect(owner).setPool(pair, 100n)).to.be.revertedWithCustomError(
          stakingOps,
          'CallerIsNotTokenManagerOrSwapOperations'
        );

        // fail
        await expect(tokenMgr.connect(alice).setStakingAllocPoint(pair, 100n)).to.be.revertedWithCustomError(
          tokenMgr,
          'OwnableUnauthorizedAccount'
        );
      });

      it('Set', async () => {
        //success
        const pair = await add(bob, STOCK, parseUnits('150'), parseUnits('1'), true, true);
        expect(await stakingOps.totalAllocPoint()).to.be.equal(0n);
        expect((await stakingOps.poolInfo(pair)).allocPoint).to.be.equal(0n);
        await expect(tokenMgr.connect(owner).setStakingAllocPoint(pair, 100n)).to.not.be.reverted;
        expect((await stakingOps.poolInfo(pair)).allocPoint).to.be.equal(100n);
        expect(await stakingOps.totalAllocPoint()).to.be.equal(100n);
      });

      it('Change', async () => {
        // pair 1
        const pair = await add(bob, STOCK, parseUnits('150'), parseUnits('1'), true, true);
        await expect(tokenMgr.connect(owner).setStakingAllocPoint(pair, 100n)).to.not.be.reverted;
        expect(await stakingOps.totalAllocPoint()).to.be.equal(100n);

        // pair 2
        const pair2 = await add(bob, STOCK_2, parseUnits('150'), parseUnits('1'), true, true);
        await expect(tokenMgr.connect(owner).setStakingAllocPoint(pair2, 100n)).to.not.be.reverted;
        expect(await stakingOps.totalAllocPoint()).to.be.equal(200n);
        expect((await stakingOps.poolInfo(pair2)).allocPoint).to.be.equal(100n);

        // change pair 2
        await expect(tokenMgr.connect(owner).setStakingAllocPoint(pair2, 50n)).to.not.be.reverted;
        expect(await stakingOps.totalAllocPoint()).to.be.equal(150n);
        expect((await stakingOps.poolInfo(pair2)).allocPoint).to.be.equal(50n);
      });
    });
  });

  describe('User Functions', () => {
    let pair: SwapPair;

    beforeEach(async () => {
      pair = await add(owner, STOCK, parseUnits('150'), parseUnits('1'), true, true);
      tokenMgr.connect(owner).setStakingRewardsPerSecond(100n);
      tokenMgr.connect(owner).setStakingAllocPoint(pair, 100n);
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

    beforeEach(async () => {
      rewardPerSecond = parseUnits('1');
      passedTime = 60n;
      await createPoolPair(contracts, STABLE, STOCK);
      const pairAddress = await swapOps.getPair(STABLE, STOCK);
      pair = await ethers.getContractAt('SwapPair', pairAddress);
      tokenMgr.connect(owner).setStakingRewardsPerSecond(rewardPerSecond);
      tokenMgr.connect(owner).setStakingAllocPoint(pair, 100n);
    });

    const prepare = async () => {
      // deposit
      await add(bob, STOCK, parseUnits('150'), parseUnits('1'), true, false);
      const start = (await stakingOps.poolInfo(pair)).lastRewardTime;

      // increase time
      await increaseTo(start + passedTime);
      expect(await getLatestBlockTimestamp()).to.be.equal(start + passedTime);

      // check pending
      const pending = await stakingOps.pendingReward(pair, bob);
      expect(pending).to.be.approximately(rewardPerSecond * passedTime, 1n); // rounding diff

      // claim
      const t1 = await getLatestBlockTimestamp();
      await stakingOps.connect(bob).claim(pair, false, false);
      const t2 = await getLatestBlockTimestamp();

      return pending + BigInt(t2 - t1) * rewardPerSecond; //because claim caused time change
    };

    it('Claim (all unclaimable)', async () => {
      const pending = await prepare();
      await stakingOps.connect(bob).untrustedHarvestAll();
      expect(await stakingOps.unclaimedReward(bob)).to.be.equal(pending);
      expect(await GOV.balanceOf(bob)).to.be.equal(0n);
    });

    it('Claim (partial unclaimable)', async () => {
      const claimable = rewardPerSecond * (passedTime / 2n);
      await GOV.unprotectedMint(stakingOps, claimable);
      const pending = await prepare();
      await stakingOps.connect(bob).untrustedHarvestAll();
      expect(await stakingOps.unclaimedReward(bob)).to.be.equal(pending - claimable);
      expect(await GOV.balanceOf(bob)).to.be.equal(claimable);
    });

    it('Claim (full)', async () => {
      const claimable = rewardPerSecond * passedTime * 2n;
      await GOV.unprotectedMint(stakingOps, claimable);
      const pending = await prepare();
      await stakingOps.connect(bob).untrustedHarvestAll();
      expect(await stakingOps.unclaimedReward(bob)).to.be.equal(0n);
      expect(await GOV.balanceOf(bob)).to.be.equal(pending);
    });

    it('Claim (full) and try claim again (fail)', async () => {
      const claimable = rewardPerSecond * passedTime * 2n;
      await GOV.unprotectedMint(stakingOps, claimable);

      const pending = await prepare();
      expect(await stakingOps.unclaimedReward(bob)).to.be.equal(0n);
      expect(await stakingOps.pendingHarvest(bob)).to.be.equal(pending);

      // multi claim
      expect(await stakingOps.pendingReward(pair, bob)).to.be.eq(0n);
      await network.provider.send('evm_setAutomine', [false]); // stop automine
      await stakingOps.connect(bob).claim(pair, false, false);
      await stakingOps.connect(bob).claim(pair, false, false);
      await stakingOps.connect(bob).claim(pair, false, false);
      await network.provider.send('evm_mine'); // manually mine all at once
      await network.provider.send('evm_setAutomine', [true]); // start automine
      expect(await stakingOps.pendingHarvest(bob)).to.be.approximately(pending + rewardPerSecond, 1n); // rounding diff
    });

    it('Claim (partial, then unclaimed)', async () => {
      const claimable = rewardPerSecond * (passedTime / 2n);
      await GOV.unprotectedMint(stakingOps, claimable);
      const pending = await prepare();
      await stakingOps.connect(bob).untrustedHarvestAll();
      expect(await stakingOps.unclaimedReward(bob)).to.be.equal(pending - claimable);
      expect(await GOV.balanceOf(bob)).to.be.equal(claimable);

      // stock up and claim
      await GOV.unprotectedMint(stakingOps, pending * 2n);
      await stakingOps.connect(bob).claim(pair, false, false);
      await stakingOps.connect(bob).untrustedHarvestAll();
      expect(await stakingOps.unclaimedReward(bob)).to.be.equal(0n);
    });
  });

  describe('Harvest', () => {
    let pair: SwapPair;
    let rewardPerSecond: bigint;
    let passedTime: bigint;

    beforeEach(async () => {
      rewardPerSecond = parseUnits('1');
      passedTime = 60n;
      await createPoolPair(contracts, STABLE, STOCK);
      const pairAddress = await swapOps.getPair(STABLE, STOCK);
      pair = await ethers.getContractAt('SwapPair', pairAddress);
      tokenMgr.connect(owner).setStakingRewardsPerSecond(rewardPerSecond);
      tokenMgr.connect(owner).setStakingAllocPoint(pair, 100n);
    });

    const prepare = async () => {
      // deposit
      await add(bob, STOCK, parseUnits('150'), parseUnits('1'), true, false);
      const start = (await stakingOps.poolInfo(pair)).lastRewardTime;

      // increase time
      await increaseTo(start + passedTime);
      expect(await getLatestBlockTimestamp()).to.be.equal(start + passedTime);

      // check pending
      const pending = await stakingOps.pendingReward(pair, bob);
      expect(pending).to.be.approximately(rewardPerSecond * passedTime, 1n); // rounding diff

      // claim
      const t1 = await getLatestBlockTimestamp();
      await stakingOps.connect(bob).claim(pair, false, false);
      const t2 = await getLatestBlockTimestamp();

      return pending + BigInt(t2 - t1) * rewardPerSecond; //because claim caused time change
    };

    it('Harvest (instant full)', async () => {
      const claimable = rewardPerSecond * passedTime * 2n;
      await GOV.unprotectedMint(stakingOps, claimable);
      const pending = await prepare();
      await stakingOps.connect(bob).harvest(true);
      expect(await GOV.balanceOf(bob)).to.be.equal(pending - pending / 2n);
    });

    it('Harvest (instant partial unclaimable)', async () => {
      const claimable = rewardPerSecond * (passedTime / 2n);
      await GOV.unprotectedMint(stakingOps, claimable);
      const pending = await prepare();
      await stakingOps.connect(bob).harvest(true);
      const harvestable = claimable / 2n;
      expect(await stakingOps.unclaimedReward(bob)).to.be.equal(pending - claimable);
      expect(await GOV.balanceOf(bob)).to.be.equal(harvestable);
    });

    it('Harvest (vested full)', async () => {
      const claimable = rewardPerSecond * passedTime * 2n;
      await GOV.unprotectedMint(stakingOps, claimable);
      const pending = await prepare();
      await stakingOps.connect(bob).harvest(false);
      expect((await vestOps.checkVesting(GOV, bob)).amount).to.be.equal(pending);

      // increase time & claim
      await increaseTo(BigInt(await getLatestBlockTimestamp()) + (await vestOps.checkVesting(GOV, bob)).remainingTime);
      await vestOps.connect(bob).claim(GOV, false);
      expect(await GOV.balanceOf(bob)).to.be.equal(pending);
    });

    it('Harvest (vested full early)', async () => {
      const claimable = rewardPerSecond * passedTime * 2n;
      await GOV.unprotectedMint(stakingOps, claimable);
      const pending = await prepare();
      await stakingOps.connect(bob).harvest(false);
      expect((await vestOps.checkVesting(GOV, bob)).amount).to.be.equal(pending);

      // increase time & claim
      const remain = (await vestOps.checkVesting(GOV, bob)).remainingTime;
      await increaseTo(BigInt(await getLatestBlockTimestamp()) + remain / 2n - 1n);
      await vestOps.connect(bob).claim(GOV, true);
      expect(await GOV.balanceOf(bob)).to.be.approximately(pending - pending / 4n, 1n);
    });

    it('Harvest (vested partial unclaimable)', async () => {
      const claimable = rewardPerSecond * (passedTime / 2n);
      await GOV.unprotectedMint(stakingOps, claimable);
      const pending = await prepare();
      await stakingOps.connect(bob).harvest(false);
      expect(await stakingOps.unclaimedReward(bob)).to.be.equal(pending - claimable);
      expect((await vestOps.checkVesting(GOV, bob)).amount).to.be.equal(claimable);
    });
  });

  it('Complex Scenario (multi pool / multi user)', async () => {
    // config
    const rewardPerSecond = parseUnits('1');
    tokenMgr.connect(owner).setStakingRewardsPerSecond(rewardPerSecond);

    // prepare 2 pools
    await createPoolPair(contracts, STABLE, STOCK);
    const pair_1 = await ethers.getContractAt('SwapPair', await swapOps.getPair(STABLE, STOCK));
    tokenMgr.connect(owner).setStakingAllocPoint(pair_1, 90n);
    await createPoolPair(contracts, STABLE, STOCK_2);
    const pair_2 = await ethers.getContractAt('SwapPair', await swapOps.getPair(STABLE, STOCK_2));
    tokenMgr.connect(owner).setStakingAllocPoint(pair_2, 10n);

    // functions
    const claim = async (_pair: SwapPair) => {
      await stakingOps.connect(alice).claim(_pair, false, false);
      await stakingOps.connect(alice).untrustedHarvestAll();
      await stakingOps.connect(bob).claim(_pair, false, false);
      await stakingOps.connect(bob).untrustedHarvestAll();
      await stakingOps.connect(carol).claim(_pair, false, false);
      await stakingOps.connect(carol).untrustedHarvestAll();
    };
    const compareShares = async (_pair: SwapPair, _alice: bigint, _bob: bigint, _carol: bigint) => {
      const s_a = (await stakingOps.userInfo(_pair, alice)).amount;
      const s_b = (await stakingOps.userInfo(_pair, bob)).amount;
      const s_c = (await stakingOps.userInfo(_pair, alice)).amount;
      const sT = s_a + s_b + s_c;
      const vT = _alice + _bob + _carol;

      expect(_alice / vT).to.be.eq(s_a / sT);
      expect(_bob / vT).to.be.eq(s_b / sT);
      expect(_carol / vT).to.be.eq(s_c / sT);
    };
    const comparePending = async (_start: bigint, _offset: bigint) => {
      const p1_a = await stakingOps.pendingReward(pair_1, alice);
      const p1_b = await stakingOps.pendingReward(pair_1, bob);
      const p1_c = await stakingOps.pendingReward(pair_1, carol);
      const p2_a = await stakingOps.pendingReward(pair_2, alice);
      const p2_b = await stakingOps.pendingReward(pair_2, bob);
      const p2_c = await stakingOps.pendingReward(pair_2, carol);
      const end = BigInt(await getLatestBlockTimestamp());

      await compareShares(pair_1, p1_a, p1_b, p1_c);
      await compareShares(pair_2, p2_a, p2_b, p2_c);

      const p1T = p1_a + p1_b + p1_c;
      const p2T = p2_a + p2_b + p2_c;
      const pT = p1T + p2T;
      expect(pT).to.be.approximately((end - _start) * rewardPerSecond - _offset, 100n);
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

    // claim (unclaimable)
    await network.provider.send('evm_setAutomine', [false]); // stop automine
    await claim(pair_1);
    await claim(pair_2);
    await network.provider.send('evm_mine'); // manually mine all at once
    await network.provider.send('evm_setAutomine', [true]); // start automine
    const end_claim1 = BigInt(await getLatestBlockTimestamp());
    await compareShares(
      pair_1,
      await stakingOps.unclaimedReward(alice),
      await stakingOps.unclaimedReward(bob),
      await stakingOps.unclaimedReward(carol)
    );

    // fill up & claim
    await GOV.unprotectedMint(stakingOps, parseUnits('10000'));
    await network.provider.send('evm_setAutomine', [false]); // stop automine
    await claim(pair_1);
    await claim(pair_2);
    await network.provider.send('evm_mine'); // manually mine all at once
    await network.provider.send('evm_setAutomine', [true]); // start automine
    await compareShares(pair_1, await GOV.balanceOf(alice), await GOV.balanceOf(bob), await GOV.balanceOf(carol));
    expect(await stakingOps.unclaimedReward(alice)).to.be.eq(0n);
    expect(await stakingOps.unclaimedReward(bob)).to.be.eq(0n);
    expect(await stakingOps.unclaimedReward(carol)).to.be.eq(0n);
  });
});
