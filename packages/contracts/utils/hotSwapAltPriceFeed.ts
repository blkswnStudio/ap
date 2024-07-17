import { ethers } from 'hardhat';
import borrowerOps from '../abi/BorrowerOperations.json';
import redemptionOps from '../abi/RedemptionOperations.json';
import liquidationOps from '../abi/LiquidationOperations.json';
import troveMng from '../abi/TroveManager.json';
import sortedTroves from '../abi/SortedTroves.json';
import hintHelpers from '../abi/HintHelpers.json';
import storagePool from '../abi/StoragePool.json';
import collSurplusPool from '../abi/CollSurplusPool.json';
import reservePool from '../abi/ReservePool.json';
import tokenMngAbi from '../abi/TokenManager.json';
import priceFeedAbi from '../abi/PriceFeed.json';
import altPriceFeedAbi from '../abi/AlternativePriceFeed.json';
import IBalancerV2Pool from '../abi/IBalancerV2Pool.json';
import IBalancerV2Vault from '../abi/IBalancerV2Vault.json';
import swapOps from '../abi/SwapOperations.json';
import stakingOps from '../abi/StakingOperations.json';
import { parseUnits } from 'ethers';
import { DeployHelper } from '@moonlabs/solidity-scripts/deployHelpers';

(async () => {
  // needs to be executed from a priceFeed owner
  const opt = {
    existingAlt: '0x4E384D108d5e7504A3bA3D3a4C0c4609bB4F84BA',
    priceFeed: '0x7720721AD41ceb1945a3F60F06E3cA787317c380',
    tokenManager: '0x4a4552726D3600bEaC63507214F6913853B26898',
  };

  // query existing configuration
  const priceFeed = await ethers.getContractAt(priceFeedAbi, opt.priceFeed);

  const tokenMng = await ethers.getContractAt(tokenMngAbi, opt.tokenManager);
  const debtTokenAddresses = await tokenMng.getDebtTokenAddresses();
  const collTokenAddresses = await tokenMng.getCollTokenAddresses();

  const existingAlt = await ethers.getContractAt(altPriceFeedAbi, opt.existingAlt);
  const existingFallbacks = []; // [address, timestamp];
  for (const addr of debtTokenAddresses) {
    const fallback = await existingAlt.fallbackPrices(addr);
    if (fallback && fallback[2]) existingFallbacks.push([addr, fallback[2]]);
  }
  const existingBalancers = []; // [address, tokenBalancerInfo, tokenIsBalancerLP];
  for (const addr of collTokenAddresses) {
    const balancer = await existingAlt.tokenBalancerInfo(addr);
    if (balancer && balancer[1]) existingBalancers.push([addr, false, balancer[1]]);
    else if (balancer && balancer[0] !== '0x0000000000000000000000000000000000000000')
      existingBalancers.push([addr, balancer[0], false]);
  }

  // deploy new alt price feed and configure it
  const deploy = new DeployHelper();
  await deploy.init();
  deploy.openCategory('Alt Price Feed Hot Swap');

  const newAlt = await deploy.deploy(`deployAltPriceFeed`, 'AlternativePriceFeed', async () =>
    (await ethers.getContractFactory('AlternativePriceFeed')).deploy()
  );

  if (existingFallbacks.length) {
    deploy.openCategory('set fallback timestamps');
    for (const [addr, timestamp] of existingFallbacks)
      await deploy.send(`fallback_${addr}`, `fallback (${addr})`, () =>
        newAlt.setFallbackTrustedTimespan(addr, timestamp)
      );
    deploy.closeCategory();
  }

  if (existingBalancers.length) {
    deploy.openCategory('set balancer info');
    for (const [addr, balancer, isLP] of existingBalancers)
      await deploy.send(`balancer_${addr}`, `balancer (${addr})`, () => {
        if (balancer) return newAlt.setBalancerPricePool(addr, balancer);
        else return newAlt.setTokenAsBalancerPool(addr, isLP);
      });
    deploy.closeCategory();
  }

  // connect the new altPriceFeed with the protocol
  await deploy.send(`initiate_alt`, `initiate alt`, () => newAlt.setAddresses(opt.priceFeed));
  await deploy.send('setAltPriceFeed', 'set altPriceFeed', () => priceFeed.setAlternativePriceFeed(newAlt.target));

  deploy.closeCategory();
  process.exit(0);
})();
