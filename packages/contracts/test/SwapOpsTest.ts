import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { ethers } from 'hardhat';
import {
  MockBorrowerOperations,
  MockDebtToken,
  MockERC20,
  SwapPair,
  SwapOperations,
  TokenManager,
  MockPyth,
  StakingOperations,
  MockTroveManager,
} from '../typechain';
import { expect } from 'chai';
import { openTrove, getLatestBlockTimestamp, setPrice, deployTesting, createPoolPair } from '../utils/testHelper';
import { parseUnits } from 'ethers';
import { Contracts } from '../utils/deployTestBase';
import { OracleUpdateDataAndFee, generatePriceUpdateData, generatePriceUpdateDataWithFee } from '../utils/pythHelper';

describe('SwapOperations', () => {
  let signers: SignerWithAddress[];
  let alice: SignerWithAddress;
  let bob: SignerWithAddress;

  let STABLE: MockDebtToken;
  let STOCK: MockDebtToken;
  let BTC: MockERC20;
  let ETH: MockERC20;

  let contracts: Contracts;
  let troveManager: MockTroveManager;
  let borrowerOperations: MockBorrowerOperations;
  let swapOperations: SwapOperations;
  let tokenManager: TokenManager;
  let stakingOperations: StakingOperations;
  let pyth: MockPyth;

  let oracleData: OracleUpdateDataAndFee;

  const open = async (user: SignerWithAddress, collAmount: bigint, debtAmount: bigint) => {
    return await openTrove({
      from: user,
      contracts,
      colls: [{ tokenAddress: BTC, amount: collAmount }],
      debts: debtAmount === parseUnits('0') ? [] : [{ tokenAddress: STABLE, amount: debtAmount }],
    });
  };

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
    await STABLE.connect(user).approve(swapOperations, amountA);
    await tokenB.connect(user).approve(swapOperations, amountB);

    //add liquidty to pair
    await swapOperations
      .connect(user)
      .addLiquidity(STABLE, tokenB, amountA, amountB, 0, 0, await priceUpdateAndMintMeta(), await deadline(), {
        value: oracleData.fee,
      });

    //get pair
    const pairAddress = await swapOperations.getPair(STABLE, tokenB);
    return ethers.getContractAt('SwapPair', pairAddress);
  };

  const mintMeta = async (): IBase.MintMetaStruct => {
    return [
      '0x0000000000000000000000000000000000000000',
      '0x0000000000000000000000000000000000000000',
      await swapOperations.MAX_BORROWING_FEE(),
    ];
  };

  const priceUpdateAndMintMeta = async (): IBase.PriceUpdateAndMintMetaStruct => {
    return [await mintMeta(), await generatePriceUpdateData(pyth)];
  };

  const remove = async (signer: SignerWithAddress, tokenB: MockDebtToken | MockERC20, amount: bigint) => {
    //remove liquidity
    await swapOperations
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

  const tokenAmount = (token: MockDebtToken, amount: bigint) => {
    return {
      tokenAddress: token.getAddress(),
      amount,
    };
  };

  before(async () => {
    signers = await ethers.getSigners();
    [, alice, bob] = signers;
  });

  beforeEach(async () => {
    contracts = await deployTesting();

    troveManager = contracts.troveManager;
    borrowerOperations = contracts.borrowerOperations;
    swapOperations = contracts.swapOperations;
    tokenManager = contracts.tokenManager;
    stakingOperations = contracts.stakingOperations;
    pyth = contracts.pyth;

    STABLE = contracts.STABLE;
    STOCK = contracts.STOCK;
    BTC = contracts.BTC;
    ETH = contracts.ETH;

    oracleData = await generatePriceUpdateDataWithFee(contracts);
  });

  it('mint on addLiquidity', async () => {
    await openTrove({
      from: alice,
      contracts,
      colls: [{ tokenAddress: BTC, amount: parseUnits('1', 8) }],
      debts: [{ tokenAddress: STABLE, amount: parseUnits('1000') }],
    });
    await createPoolPair(contracts, STABLE, STOCK);
    await STABLE.connect(alice).approve(swapOperations, parseUnits('1000'));
    await swapOperations
      .connect(alice)
      .addLiquidity(
        STABLE,
        STOCK,
        parseUnits('1500'),
        parseUnits('1'),
        0,
        0,
        await priceUpdateAndMintMeta(),
        await deadline(),
        { value: oracleData.fee }
      );
  });

  it('should not be possible to mint directly from the borrowerOps', async () => {
    //increase debt
    await expect(
      borrowerOperations
        .connect(alice)
        .increaseDebt(
          alice.getAddress(),
          alice.getAddress(),
          [tokenAmount(STABLE, parseUnits('100'))],
          await mintMeta(),
          { value: oracleData.fee }
        )
    ).to.be.revertedWithCustomError(borrowerOperations, 'NotFromSwapOps');
  });

  it('SwapPair mint/burn should be only callable from the SwapOps', async () => {
    const amount = parseUnits('1000');

    //open trove
    await open(alice, parseUnits('1', 8), parseUnits('150'));

    //create pair & add liquidity
    const pair = await add(alice, STOCK, amount, amount, true);

    //mint
    await expect(pair.connect(alice).mint(alice)).to.be.revertedWithCustomError(pair, 'NotFromSwapOperations');

    //burn
    const balance = await pair.balanceOf(alice);
    await expect(pair.connect(alice).burn(alice, balance, 0, 0)).to.be.revertedWithCustomError(
      pair,
      'NotFromSwapOperations'
    );
  });

  it('liquidity token should not be transferable', async () => {
    const amount = parseUnits('1000');

    //open trove
    await open(alice, parseUnits('1', 8), parseUnits('150'));

    //create pair & add liquidity
    const pair = await add(alice, STOCK, amount, amount, true);

    //check if transfer function doesn't exist
    expect((pair as any).transfer).to.be.eql(undefined, 'Transfer function defined');

    //check if transferFrom function doesn't exist
    expect((pair as any).transferFrom).to.be.eql(undefined, 'TransferFrom function defined');
  });

  describe('remove liquidity', () => {
    it('default uniswap tests STABLE/STOCK', async () => {
      const amount = parseUnits('1000');

      //create pair & add liquidity (alice)
      const pair = await add(alice, STOCK, amount, amount, true);

      //remove liquidity
      await remove(alice, STOCK, await stakingOperations.balanceOf(pair, alice));
      expect(await stakingOperations.balanceOf(pair, alice)).to.be.equal(0);
      expect(await STABLE.balanceOf(alice)).to.be.greaterThan(0);
      expect(await STOCK.balanceOf(alice)).to.be.greaterThan(0);
    });

    it('default uniswap tests STABLE/BTC', async () => {
      const amount = parseUnits('1000');

      //create pair & add liquidity STABLE/BTC
      const pair2 = await add(alice, BTC, amount, amount, true);

      //remove liquidity
      await remove(alice, BTC, await stakingOperations.balanceOf(pair2, alice));
      expect(await stakingOperations.balanceOf(pair2, alice)).to.be.equal(0);
      expect(await STABLE.balanceOf(alice)).to.be.greaterThan(0);
      expect(await BTC.balanceOf(alice)).to.be.greaterThan(0);
    });

    it('zero borrower debts (no active trove), default uniswap behavior', async () => {
      const amount = parseUnits('1000');

      //create pair & add liquidity (alice)
      const pair = await add(alice, STOCK, amount, amount, true);

      //remove liquidity
      await remove(alice, STOCK, await stakingOperations.balanceOf(pair, alice));
      expect(await stakingOperations.balanceOf(pair, alice)).to.be.equal(0);
    });

    it('empty trove (only stable gas comp debt), pool should not repay that', async () => {
      //open trove
      await open(alice, parseUnits('1', 8), parseUnits('0'));

      //create pair & add liquidity (alice)
      const amount = parseUnits('1000');
      const pair = await add(alice, STOCK, amount, amount, true);

      //remove liquidity
      await remove(alice, STOCK, await stakingOperations.balanceOf(pair, alice));
      expect(await stakingOperations.balanceOf(pair, alice)).to.be.equal(0);
    });

    it('smaller debts, complete repay expected', async () => {
      const amount = parseUnits('1000');

      //open trove
      await open(alice, parseUnits('1', 8), parseUnits('150'));

      //create pair & add liquidity (alice)
      const pair = await add(alice, STOCK, amount, amount, true);

      //remove liquidity
      await remove(alice, STOCK, await stakingOperations.balanceOf(pair, alice));
      expect(await stakingOperations.balanceOf(pair, alice)).to.be.equal(0);
      expect(
        (await troveManager.getTroveRepayableDebts(alice)).find(({ tokenAddress }) => tokenAddress === STABLE.target)
          ?.amount ?? 0n
      ).to.be.equal(0);
    });

    it('huge debts, partial repay expected', async () => {
      const amount = parseUnits('1000');

      //open trove
      await open(bob, parseUnits('1', 8), parseUnits('150'));
      await open(alice, parseUnits('1', 8), parseUnits('15000'));

      //create pair & add liquidity (alice)
      const pair = await add(alice, STOCK, amount, amount, true);

      //remove liquidity
      await remove(alice, STOCK, await stakingOperations.balanceOf(pair, alice));
      expect(await stakingOperations.balanceOf(pair, alice)).to.be.equal(0);
      expect(
        (await troveManager.getTroveRepayableDebts(alice)).find(({ tokenAddress }) => tokenAddress === STABLE.target)
          ?.amount ?? 0n
      ).to.be.greaterThan(0);
    });
  });

  describe('add liquidity', () => {
    it('default uniswap tests STABLE/STOCK', async () => {
      const amount = parseUnits('1000');

      //add liquidity
      const pair = await add(alice, STOCK, amount, amount, true);
      expect(await stakingOperations.balanceOf(pair, alice)).to.not.be.equal(0);
    });

    it('default uniswap tests STABLE/BTC', async () => {
      const amount = parseUnits('1000');

      //add liquidity STABLE/BTC
      const pair2 = await add(alice, BTC, amount, amount, true);
      expect(await stakingOperations.balanceOf(pair2, alice)).to.not.be.equal(0);
    });

    it('create Pair without STABLE (should fail)', async () => {
      //create pair
      await expect(createPoolPair(contracts, BTC, STOCK)).to.be.revertedWithCustomError(
        swapOperations,
        'PairRequiresStable'
      );
    });

    it('borrower has enough funds for the op, no trove needed', async () => {
      const amount = parseUnits('1000');

      //create pair & add liquidity (bob)
      await add(bob, STOCK, amount, amount, true);

      //add liquidty (alice)
      const pair = await add(alice, STOCK, amount, amount, true, false);
      expect(await stakingOperations.balanceOf(pair, alice)).to.be.greaterThan(0);
    });

    it('low collateral trove, minting should fail because of bad trove CR', async () => {
      const amount = parseUnits('1000');

      //create pair & add liquidity (bob)
      await add(bob, STOCK, amount, amount, true);

      //open troves
      await open(alice, parseUnits('1', 8), parseUnits('150'));

      //add liquidity (alice)
      await expect(add(alice, STOCK, amount, amount, false, false)).to.be.revertedWithCustomError(
        borrowerOperations,
        'ICR_lt_MCR'
      );
    });

    it('high collateral trove, missing token should be minted from senders trove', async () => {
      const amount = parseUnits('1000');

      //create pair & add liquidity (bob)
      await add(bob, STOCK, amount, amount, true);

      //open trove (alice)
      await open(alice, parseUnits('1000', 8), parseUnits('150'));

      //add liquidity without tokens (alice)
      const pair = await add(alice, STOCK, amount, amount, false, false);
      expect(await stakingOperations.balanceOf(pair, alice)).to.be.greaterThan(0);
    });
  });

  describe('swaps', () => {
    it('swap STABLE/STOCK', async () => {
      //create pair & add liquidity
      await add(alice, STOCK, parseUnits('100'), parseUnits('1'), true);

      //mint
      STABLE.unprotectedMint(alice, parseUnits('1'));

      //swap
      STABLE.connect(alice).approve(swapOperations, parseUnits('1'));
      await swapOperations
        .connect(alice)
        .swapExactTokensForTokens(parseUnits('1'), 0, [STABLE, STOCK], alice, await deadline(), oracleData.data, {
          value: oracleData.fee,
        });
      expect(await STOCK.balanceOf(alice)).to.be.greaterThan(0);
    });

    it('swap STABLE/BTC', async () => {
      //create pair & add liquidity
      await add(alice, BTC, parseUnits('100'), parseUnits('1', 8), true);

      //mint
      STABLE.unprotectedMint(alice, parseUnits('1'));

      //swap
      STABLE.connect(alice).approve(swapOperations, parseUnits('1'));
      await swapOperations
        .connect(alice)
        .swapExactTokensForTokens(parseUnits('1'), 0, [STABLE, BTC], alice, await deadline(), oracleData.data, {
          value: oracleData.fee,
        });
      expect(await BTC.balanceOf(alice)).to.be.greaterThan(0);
    });

    it('swap multihop BTC/STABLE/STOCK', async () => {
      //create pair & add liquidity (STABLE/BTC)
      await add(alice, BTC, parseUnits('100'), parseUnits('1', 8), true);

      //create pair & add liquidity (STABLE/STOCK)
      await add(alice, STOCK, parseUnits('100'), parseUnits('100'), true);

      //mint
      BTC.unprotectedMint(alice, parseUnits('0.01', 8));

      //swap
      BTC.connect(alice).approve(swapOperations, parseUnits('0.01', 8));
      await swapOperations
        .connect(alice)
        .swapExactTokensForTokens(
          parseUnits('0.01', 8),
          0,
          [BTC, STABLE, STOCK],
          alice,
          await deadline(),
          oracleData.data,
          {
            value: oracleData.fee,
          }
        );
      expect(await STOCK.balanceOf(alice)).to.be.greaterThan(0);
    });

    it('test dynamic swap fee based on oracle/dex price diff', async () => {
      //create pair & add liquidity
      const pair = await add(
        alice,
        STOCK,
        parseUnits('15000'), //100 Stocks at price of 150$
        parseUnits('100'),
        true,
        true
      );

      //check initial fee
      const baseFee = await swapOperations.getSwapBaseFee();
      const reserves = await pair.getReserves();
      expect((await pair.getSwapFee(reserves[0], reserves[1]))[0]).to.be.eq(baseFee);

      //check dex price > oracle price
      await setPrice('STOCK', '140', contracts);
      expect((await pair.getSwapFee(reserves[0], reserves[1] + parseUnits('1')))[0]).to.be.eq(baseFee);

      //check dex price < oracle price
      await setPrice('STOCK', '160', contracts);
      expect((await pair.getSwapFee(reserves[0], reserves[1] + parseUnits('1')))[0]).to.not.be.eq(baseFee);
    });
  });

  describe('positions', () => {
    describe('long', () => {
      it('open without trove, should fail', async () => {
        const amount = parseUnits('1000');

        //open trove (bob)
        await open(bob, parseUnits('1', 8), parseUnits('150'));

        //create pair & add liquidity (bob)
        await add(bob, STOCK, amount, amount, true);

        //open STOCK long (alice)
        await expect(
          swapOperations
            .connect(alice)
            .openLongPosition(parseUnits('100'), 0, STOCK, alice, await mintMeta(), await deadline(), oracleData.data, {
              value: oracleData.fee,
            })
        ).to.be.revertedWithCustomError(borrowerOperations, 'TroveClosedOrNotExist');
      });

      it('open with unknown debt token', async () => {
        const amount = parseUnits('1000');

        //open troves
        await open(alice, parseUnits('1', 8), parseUnits('150'));
        await open(bob, parseUnits('1'), parseUnits('150'));

        //open BTC long (check balance before and after)
        expect(await BTC.balanceOf(alice)).to.eq(parseUnits('0'));
        await add(bob, BTC, amount, amount, true);
        await swapOperations
          .connect(alice)
          .openLongPosition(parseUnits('1'), 0, BTC, alice, await mintMeta(), await deadline(), oracleData.data, {
            value: oracleData.fee,
          });
        expect(await BTC.balanceOf(alice)).to.greaterThan(parseUnits('0'));

        //open ETH long
        expect(
          swapOperations
            .connect(alice)
            .openLongPosition(parseUnits('1'), 0, ETH, alice, await mintMeta(), await deadline(), oracleData.data, {
              value: oracleData.fee,
            })
        ).to.be.revertedWithCustomError(swapOperations, 'PairDoesNotExist');
      });

      it('open with no enough collateral, should fail', async () => {
        const amount = parseUnits('1000');

        //open troves
        await open(alice, parseUnits('1', 8), parseUnits('150'));
        await open(bob, parseUnits('1'), parseUnits('150'));

        //create pair & add liquidity
        await add(alice, STOCK, amount, amount, true);

        //open STOCK long
        await expect(
          swapOperations
            .connect(alice)
            .openLongPosition(
              parseUnits('1000000'),
              0,
              STOCK,
              alice,
              await mintMeta(),
              await deadline(),
              oracleData.data,
              {
                value: oracleData.fee,
              }
            )
        ).to.be.revertedWithCustomError(borrowerOperations, 'ICR_lt_MCR');
      });

      it('open', async () => {
        //open troves
        await open(alice, parseUnits('1', 8), parseUnits('150'));
        await open(bob, parseUnits('1'), parseUnits('150'));

        const amount = parseUnits('1000');
        await add(bob, STOCK, amount, amount, true);

        //open STOCK long (check balance before and after)
        expect(await STOCK.balanceOf(alice)).to.eq(parseUnits('0'));
        await swapOperations
          .connect(alice)
          .openLongPosition(parseUnits('1'), 0, STOCK, alice, await mintMeta(), await deadline(), oracleData.data, {
            value: oracleData.fee,
          });
        expect(await STOCK.balanceOf(alice)).to.greaterThan(parseUnits('0'));
      });
    });

    describe('short', () => {
      it('open without trove, should fail', async () => {
        const amount = parseUnits('1000');

        //open trove (bob)
        await open(bob, parseUnits('1', 8), parseUnits('150'));

        //create pair & add liquidity (bob)
        await add(bob, STOCK, amount, amount, true);

        //open STOCK short (alice)
        await expect(
          swapOperations
            .connect(alice)
            .openShortPosition(
              parseUnits('100'),
              0,
              STOCK,
              alice,
              await mintMeta(),
              await deadline(),
              oracleData.data,
              {
                value: oracleData.fee,
              }
            )
        ).to.be.revertedWithCustomError(borrowerOperations, 'TroveClosedOrNotExist');
      });

      it('open with unknown debt token (should fail)', async () => {
        const amount = parseUnits('1000');

        //open troves
        await open(alice, parseUnits('1', 8), parseUnits('150'));
        await open(bob, parseUnits('1'), parseUnits('150'));

        //create pair & add liquidity
        await add(alice, BTC, amount, amount, true);

        //open BTC short
        expect(
          swapOperations
            .connect(alice)
            .openShortPosition(parseUnits('1'), 0, BTC, alice, await mintMeta(), await deadline(), oracleData.data, {
              value: oracleData.fee,
            })
        ).to.be.revertedWithCustomError(tokenManager, 'InvalidDebtToken');
      });

      it('open with no enough collateral, should fail', async () => {
        const amount = parseUnits('1000');

        //open troves
        await open(alice, parseUnits('1', 8), parseUnits('150'));
        await open(bob, parseUnits('1'), parseUnits('150'));

        //create pair & add liquidity
        await add(alice, STOCK, amount, amount, true);

        //open STOCK short
        await expect(
          swapOperations
            .connect(alice)
            .openShortPosition(
              parseUnits('1000000'),
              0,
              STOCK,
              alice,
              await mintMeta(),
              await deadline(),
              oracleData.data,
              {
                value: oracleData.fee,
              }
            )
        ).to.be.revertedWithCustomError(borrowerOperations, 'ICR_lt_MCR');
      });

      it('open', async () => {
        const amount = parseUnits('1000');

        //open troves
        await open(alice, parseUnits('1', 8), parseUnits('150'));
        await open(bob, parseUnits('1'), parseUnits('150'));

        //create pair & add liquidity
        await add(alice, STOCK, amount, amount, true);

        //open short (check balance before and after)
        expect(await STABLE.balanceOf(alice)).to.eq(parseUnits('150')); //initial debts
        await swapOperations
          .connect(alice)
          .openShortPosition(parseUnits('1'), 0, STOCK, alice, await mintMeta(), await deadline(), oracleData.data, {
            value: oracleData.fee,
          });
        expect(await STABLE.balanceOf(alice)).to.greaterThan(parseUnits('150')); //initial debts
      });
    });
  });

  describe('dynamic fee', () => {
    it('getAmountsOut, STABLE-STOCK', async () => {
      await add(alice, STOCK, parseUnits('150'), parseUnits('1'), true, true);
      const swapAmounts = (await contracts.swapOperations.getAmountsOut(parseUnits('1'), [STABLE, STOCK]))[0];
      expect(swapAmounts[0][0]).to.be.equal(parseUnits('1'));
      expect(swapAmounts[0][1]).to.be.equal(3200000000000000n);
      expect(swapAmounts[1][0]).to.be.equal(6601464401894609);
      expect(swapAmounts[1][1]).to.be.equal(0);
    });

    it('getAmountsOut, STOCK-STABLE', async () => {
      await add(alice, STOCK, parseUnits('150'), parseUnits('1'), true, true);
      const swapAmounts = (await contracts.swapOperations.getAmountsOut(parseUnits('0.01'), [STOCK, STABLE]))[0];
      expect(swapAmounts[0][0]).to.be.equal(parseUnits('0.01'));
      expect(swapAmounts[0][1]).to.be.equal(32000000000000n);
      expect(swapAmounts[1][0]).to.be.equal(1480442944726961646n);
      expect(swapAmounts[1][1]).to.be.equal(0);
    });

    it('getAmountsIn, STABLE-STOCK', async () => {
      await add(alice, STOCK, parseUnits('150'), parseUnits('1'), true, true);
      const swapAmounts = (await contracts.swapOperations.getAmountsIn(parseUnits('0.01'), [STABLE, STOCK]))[0];
      expect(swapAmounts[0][0]).to.be.equal(1520000000000000000n);
      expect(swapAmounts[0][1]).to.be.equal(4848484848484848n);
      expect(swapAmounts[1][0]).to.be.equal(parseUnits('0.01'));
      expect(swapAmounts[1][1]).to.be.equal(0);
    });

    it('getAmountsIn, STOCK-STABLE', async () => {
      await add(alice, STOCK, parseUnits('150'), parseUnits('1'), true, true);
      const swapAmounts = (await contracts.swapOperations.getAmountsIn(parseUnits('1'), [STOCK, STABLE]))[0];
      expect(swapAmounts[0][0]).to.be.equal(6732885906040269);
      expect(swapAmounts[0][1]).to.be.equal(21476510067114n);
      expect(swapAmounts[1][0]).to.be.equal(parseUnits('1'));
      expect(swapAmounts[1][1]).to.be.equal(0);
    });
  });
});
