import '@nomicfoundation/hardhat-toolbox';

task('deployCore', 'Deploy to remote server and change owner')
  .addOptionalParam('test')
  .addOptionalParam('pyth')
  .addOptionalParam('gov')
  .addOptionalParam('owner')
  .setAction(async (taskArgs: any) => {
    // deploy helper
    const DeployHelper = require('../utils/deployHelpers').DeployHelper;
    const deploy = new DeployHelper();
    await deploy.init();

    // deploy
    const deployCore = require('../deploy/modules/core').deployCore;
    await deployCore(deploy, taskArgs.test === 'true', taskArgs.pyth, taskArgs.gov, taskArgs.owner);
  });
