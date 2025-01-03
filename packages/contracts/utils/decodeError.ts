import { ethers } from 'hardhat';
import borrowerOps from '../abi/BorrowerOperations.json';
import redemptionOps from '../abi/RedemptionOperations.json';
import liquidationOps from '../abi/LiquidationOperations.json';
import troveMng from '../abi/TroveManager.json';
import sortedTroves from '../abi/SortedTroves.json';
import hintHelpers from '../abi/HintHelpers.json';
import stabilityPoolMng from '../abi/StabilityPoolManager.json';
import storagePool from '../abi/StoragePool.json';
import collSurplusPool from '../abi/CollSurplusPool.json';
import reservePool from '../abi/ReservePool.json';
import tokenMng from '../abi/TokenManager.json';
import priceFeed from '../abi/PriceFeed.json';
import altPriceFeed from '../abi/AlternativePriceFeed.json';
import swapOps from '../abi/SwapOperations.json';
import stakingOps from '../abi/StakingOperations.json';

(async () => {
  for (const abi of [
    borrowerOps,
    redemptionOps,
    liquidationOps,
    troveMng,
    sortedTroves,
    hintHelpers,
    stabilityPoolMng,
    storagePool,
    collSurplusPool,
    reservePool,
    tokenMng,
    priceFeed,
    altPriceFeed,
    swapOps,
    stakingOps,
  ]) {
    const contract = await ethers.getContractAt(abi, '0x09eD013540e4A1074ac4bBd6e6e955f917cb5f67');
    console.log(contract.interface.parseError('0xa34588e6'));
  }
})();
