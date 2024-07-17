import { ethers } from 'hardhat';
import swapOpsAbi from '../abi/SwapOperations.json';

(async () => {
  const swapOpsAddress = '0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0';
  const stableCoinAddress = '0xc3e53F4d16Ae77Db1c982e75a937B9f60FE63690';
  const swapMap = {
    BTC: '0xc5a5C42992dECbae36851359345FE25997F5C42d',
    USDT: '0x67d269191c92Caf3cD7723F116c85e6E9bf55933',
    GOV: '0x67d269191c92Caf3cD7723F116c85e6E9bf55933',
    STOCK_1: '0x84eA74d481Ee0A5332c457a4d796187F6Ba67fEB',
    STOCK_2: '0x9E545E3C0baAB3E08CdfD552C960A1050f373042',
  };

  const swapOps = await ethers.getContractAt(swapOpsAbi, swapOpsAddress);
  for (const [symbol, address] of Object.entries(swapMap)) {
    const poolAddress = await swapOps.getPair(address, stableCoinAddress);
    console.log(symbol, poolAddress);
  }
})();
