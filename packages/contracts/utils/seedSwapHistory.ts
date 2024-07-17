import { ethers } from 'hardhat';
import { getLatestBlockTimestamp } from './testHelper';
import { mine } from '@nomicfoundation/hardhat-network-helpers';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import { parseUnits } from 'ethers';
import swapOpsAbi from '../abi/SwapOperations.json';
import swapPairAbi from '../abi/SwapPair.json';

(async () => {
  console.log('Seeding swaps...');

  const deployer = (await ethers.getSigners())[0];
  const swapOpsAddress = '0xa51c1fc2f0d1a1b8494ed1fe312d7c3a78ed91c0';
  const stableCoinAddress = '0xc3e53F4d16Ae77Db1c982e75a937B9f60FE63690';
  const swapMap = {
    BTC: {
      contract: '0xc5a5C42992dECbae36851359345FE25997F5C42d',
      pool: null,
      file: 'BTC.csv',
      swaps: [],
      positionMultiplier: 0.00001,
      digits: 9,
    },
    USDT: {
      contract: '0x67d269191c92Caf3cD7723F116c85e6E9bf55933',
      pool: null,
      file: 'USDT.csv',
      swaps: [],
      positionMultiplier: 0.001,
      digits: 18,
    },
    AAPL: {
      contract: '0x84eA74d481Ee0A5332c457a4d796187F6Ba67fEB',
      pool: null,
      file: 'AAPL.csv',
      swaps: [],
      positionMultiplier: 0.00001,
      digits: 18,
    },
  };
  const dirPath = path.join(__dirname, 'swaps');

  await Promise.all(
    Object.values(swapMap).map(({ file, swaps }) => {
      return new Promise(resolve => {
        fs.createReadStream(path.join(dirPath, file))
          .pipe(csv())
          .on('data', data => swaps.push(data))
          .on('end', resolve);
      });
    })
  );

  const swapRows = []; // {BTC: openPrice, USDT: openPrice, ...}
  const swapLength = swapMap.BTC.swaps.length;
  for (let i = 0; i < swapLength; i++) {
    const row = {};
    for (const [symbol, { swaps }] of Object.entries(swapMap)) {
      if (swaps[i]?.open) row[symbol] = swaps[i].open;
    }
    swapRows.push(row);
  }

  const swapOps = await ethers.getContractAt(swapOpsAbi, swapOpsAddress);
  for (const entry of Object.values(swapMap)) {
    const poolAddress = await swapOps.getPair(entry.contract, stableCoinAddress);
    entry.pool = await ethers.getContractAt(swapPairAbi, poolAddress);
  }

  const deadline = (await getLatestBlockTimestamp()) + 300000;
  let errors = 0;
  for (let i = 0; i < swapRows.length; i++) {
    const swapRow = swapRows[i];

    await Promise.all(
      Object.entries(swapMap).map(async ([symbol, { contract, positionMultiplier, digits, pool }]) => {
        let targetPrice = swapRow[symbol];
        if (!targetPrice) {
          errors++;
          return;
        }
        targetPrice = parseFloat(targetPrice);

        const [_stableReserve, _otherReserve] = await pool.getReserves();
        const stableReserve = Number(_stableReserve) / 1e18;
        const otherReserve = Number(_otherReserve) / 10 ** digits;

        const currentPrice = stableReserve / otherReserve;
        const amountIn = Math.sqrt(stableReserve * otherReserve * targetPrice) - stableReserve;
        if (Math.abs(amountIn) < 0.0005) return;
        const isBuy = amountIn > 0;

        try {
          if (isBuy)
            await swapOps.swapExactTokensForTokens(
              parseUnits(amountIn.toFixed(6), 18),
              0,
              [stableCoinAddress, contract],
              deployer,
              deadline
            );
          else
            await swapOps.swapTokensForExactTokens(
              parseUnits((-1 * amountIn).toFixed(6), digits),
              parseUnits('999999', digits),
              [contract, stableCoinAddress],
              deployer,
              deadline
            );
        } catch (e) {
          console.log(e);
          errors++;
        }
      })
    );

    await mine(1);
    if (i % 20 === 0) console.log(`${(i / swapRows.length) * 100} %, ${i} blocks/i, ${errors} errors`);
  }

  console.log('Swaps seeded.', swapRows.length);
})();
