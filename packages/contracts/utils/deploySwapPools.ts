import { ethers } from 'hardhat';
import deployTestBase from './deployTestBase';
import { MaxUint256, parseUnits, ZeroAddress } from 'ethers';
import { generatePriceUpdateData, generatePriceUpdateDataWithFee } from './pythHelper';

(async () => {
  const contracts = await deployTestBase();
  const STABLE = contracts.STABLE;
  const deployer = (await ethers.getSigners())[0];
  const priceUpdateData = await generatePriceUpdateDataWithFee(contracts);

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
    await contracts.tokenManager.setStakingAllocPoint(pair.target, 1);
    // mint staking rewards
    await contracts.GOV.unprotectedMint(contracts.stakingOperations.target, parseUnits('1000000'));

    await new Promise((resolve) => setTimeout(resolve, 1000));

    await contracts.tokenManager.setStakingRewardsPerSecond(parseUnits('0.001'));

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const blockTimestamp = (await ethers.provider.getBlock('latest'))?.timestamp ?? 0;
    await contracts.swapOperations.addLiquidity(
      token,
      STABLE,
      tokenAmount,
      stableAmount,
      0,
      0,
      {
        meta: { upperHint: ZeroAddress, lowerHint: ZeroAddress, maxFeePercentage: 0 },
        priceUpdateData: priceUpdateData.data,
      },
      blockTimestamp + 60 * 5,
      { value: priceUpdateData.fee }
    );

    console.log(
      `created pool ${await token.symbol()}: ${await contracts.swapOperations.getPair(STABLE.target, token.target)}`
    );
  }


  // printing
  for (const [key, c] of Object.entries(contracts)) console.log(`${key}: ${c.target}`);
})();
