import { ethers } from 'hardhat';
import { MockLiquityMath } from '../typechain';
import { expect } from 'chai';

describe('LiquityMath', () => {
  let liquityMathTester: MockLiquityMath;
  beforeEach(async () => {
    const factory = await ethers.getContractFactory('MockLiquityMath');
    liquityMathTester = await factory.deploy();
  });

  it('max works if a > b', async () => {
    const max = await liquityMathTester.callMax(2, 1);
    expect(max).to.be.equal(Math.max(2, 1));
  });

  it('max works if a = b', async () => {
    const max = await liquityMathTester.callMax(2, 2);
    expect(max).to.be.equal(Math.max(2, 2));
  });

  it('max works if a < b', async () => {
    const max = await liquityMathTester.callMax(1, 2);
    expect(max).to.be.equal(Math.max(1, 2));
  });
});
