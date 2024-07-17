import { ethers } from 'hardhat';
import priceFeedAbi from '../abi/PriceFeed.json';
import altPriceFeedAbi from '../abi/AlternativePriceFeed.json';
import { DeployHelper } from '@moonlabs/solidity-scripts/deployHelpers';

(async () => {
  // needs to be executed from a priceFeed owner
  const opt = {
    altPriceFeed: '0xd8172cde73AfbA83925175AFA73c1C1a13f8F13A',
    priceFeed: '0x156BbDBACbF45cDC1E50e8F3FB04335d55Aca2a4',
    tokens: [
      '0xd9e265dbda4b178bc3a44066d70146486b1c275c',
      '0xb816a3eb948a85b006e1156958c5112f7b709271',
      '0x611663965b7a9fc2c19327a22067f2e56dc6d9f6',
      '0x75cd195cad4fd0eb08636e2b6d313b061a510f92',
      '0xdd2564522e95e8cce1bde57144a5647aaaa0ca54',
      '0xb218459c01f94974aaa1c5b25d11e7758a02b0a1',
    ],
  };

  const priceFeed = await ethers.getContractAt(priceFeedAbi, opt.priceFeed);
  const altPriceFeed = await ethers.getContractAt(altPriceFeedAbi, opt.altPriceFeed);

  // deploy new alt price feed and configure it
  const deploy = new DeployHelper();
  await deploy.init();
  deploy.openCategory('offramp pyth oracles');

  const noOracleID = '0x' + BigInt(0).toString(8).padStart(64, '0');
  for (const token of opt.tokens) {
    await deploy.send(`clearPyth_${token}`, `clearPyth_${token}`, () =>
      priceFeed.initiateNewOracleId(token, noOracleID)
    );
    await deploy.send(`setFallback_${token}`, `setFallback_${token}`, () =>
      altPriceFeed.setFallbackTrustedTimespan(token, 180)
    );
  }

  deploy.closeCategory();
  process.exit(0);
})();
