import '@nomicfoundation/hardhat-toolbox';

task('deployCore', 'Deploy to remote server and change owner')
  .addOptionalParam('test')
  .addOptionalParam('deploymockassets')
  .addOptionalParam('deployswappools')
  .addOptionalParam('pyth')
  .addOptionalParam('gov')
  .addOptionalParam('owner')
  .setAction(async (taskArgs: any) => {
    // deploy helper
    const { DeployHelper } = require('@moonlabs/solidity-scripts/deployHelpers');
    const deploy = new DeployHelper();
    await deploy.init();

    // deploy
    const { deployCore } = require('../deploy/modules/core');
    await deployCore(
      deploy,
      taskArgs.test === 'true',
      taskArgs.deploymockassets === 'true',
      taskArgs.deployswappools === 'true',
      taskArgs.pyth,
      taskArgs.gov,
      taskArgs.owner
    );
  });
