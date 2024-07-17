import { ethers } from 'hardhat';
import deployTestBase from './deployTestBase';
import { MaxUint256, parseUnits, ZeroAddress } from 'ethers';
import { generatePriceUpdateData } from './pythHelper';

(async () => {
  const contracts = await deployTestBase();
  const STABLE = contracts.STABLE;

  const blockTimestamp = (await ethers.provider.getBlock('latest'))?.timestamp ?? 0;
  const deadline = blockTimestamp + 60 * 5;
  const deployer = (await ethers.getSigners())[0];

  // seed some pools
  const priceUpdateData = await generatePriceUpdateData(contracts.pyth);
  // Log byte data to mock in the client
  // console.log("priceUpdateData: ", priceUpdateData);
  for (const [token, tokenAmount, stableAmount] of [
    [contracts.BTC, parseUnits('1', 8), parseUnits('20000')],
    [contracts.USDT, parseUnits('10000'), parseUnits('10000')],
    [contracts.GOV, parseUnits('2000'), parseUnits('10000')],
    [contracts.STOCK, parseUnits('65'), parseUnits('10000')],
    [contracts.STOCK_2, parseUnits('12'), parseUnits('10000')],
  ]) {
    await token.unprotectedMint(deployer, tokenAmount);
    await STABLE.unprotectedMint(deployer, stableAmount);

    await token.approve(contracts.swapOperations.target, MaxUint256);
    await STABLE.approve(contracts.swapOperations.target, MaxUint256);

    const pairFactory = await ethers.getContractFactory('SwapPair');
    const pair = await pairFactory.deploy(contracts.swapOperations.target);
    await pair.waitForDeployment();

    await contracts.swapOperations.createPair(pair.target, token, STABLE);
    await contracts.swapOperations.addLiquidity(
      token,
      STABLE,
      tokenAmount,
      stableAmount,
      0,
      0,
      {
        meta: { upperHint: ZeroAddress, lowerHint: ZeroAddress, maxFeePercentage: 0 },
        priceUpdateData,
      },
      deadline
    );

    console.log(
      `created pool ${await token.symbol()}: ${await contracts.swapOperations.getPair(STABLE.target, token.target)}`
    );
  }

  // mint test user assets
  for (const [token, amount] of [
    [contracts.BTC, parseUnits('1', 8)],
    [contracts.USDT, parseUnits('20000')],
    [contracts.GOV, parseUnits('15000')],
    [contracts.STABLE, parseUnits('200000')],
    [contracts.STOCK, parseUnits('65')],
  ])
    await token.unprotectedMint(deployer, amount);

  for (const [key, c] of Object.entries(contracts)) console.log(`${key}: ${c.target}`);
})();
