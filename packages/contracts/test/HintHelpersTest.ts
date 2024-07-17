import { ethers } from 'hardhat';
import { MockTroveManager, HintHelpers, SortedTroves } from '../typechain';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { whaleShrimpTroveInit, deployTesting } from '../utils/testHelper';
import { assert } from 'chai';
import { parseUnits } from 'ethers';

describe('HintHelpers', () => {
  let signers: SignerWithAddress[];

  let troveManager: MockTroveManager;
  let hintHelpers: HintHelpers;
  let sortedTrove: SortedTroves;

  let contracts: any;
  let latestRandomSeed = 30000;

  before(async () => {
    signers = await ethers.getSigners();
  });

  beforeEach(async () => {
    // @ts-ignore
    contracts = await deployTesting();

    troveManager = contracts.troveManager;
    hintHelpers = contracts.hintHelpers;
    sortedTrove = contracts.sortedTroves;
  });

  describe('getApproxHint():', () => {
    it('returns the address of a Trove within sqrt(length) positions of the correct insert position', async () => {
      await whaleShrimpTroveInit(contracts, signers);

      const sqrtLength = Math.ceil(Math.sqrt(7));
      const CR_250 = parseUnits('6.5', 18);
      const CR_Percentage = CR_250 / parseUnits('1', 16);

      let hintAddress;
      [hintAddress] = await hintHelpers.getApproxHint(CR_250, sqrtLength, latestRandomSeed);
      const [getICR] = await hintHelpers.getCurrentICR(hintAddress);
      const ICRPercent_hintAddress_250 = getICR / parseUnits('1', 16);
      let ICR_Difference_250 = ICRPercent_hintAddress_250 - CR_Percentage;
      assert.isBelow(Number(ICR_Difference_250), sqrtLength);
    });

    it('returns the head of the list if the CR is the max uint256 value', async () => {
      await whaleShrimpTroveInit(contracts, signers);

      const sqrtLength = Math.ceil(Math.sqrt(7));

      const CR_Max = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

      let hintAddress;
      [hintAddress] = await hintHelpers.getApproxHint(CR_Max, sqrtLength, latestRandomSeed);

      const [ICR_hintAddress_Max] = await hintHelpers.getCurrentICR(hintAddress);
      const ICRPercent_hintAddress_Max = ICR_hintAddress_Max / parseUnits('1', 16);

      const getFirstTrove = await sortedTrove.getFirst();
      const [ICR_FirstTrove] = await hintHelpers.getCurrentICR(getFirstTrove);
      const ICRPercent_FirstTrove = ICR_FirstTrove / parseUnits('1', 16);
      const ICR_Difference_Max = ICRPercent_hintAddress_Max - ICRPercent_FirstTrove;

      assert.isBelow(Number(ICR_Difference_Max), sqrtLength);
    });

    it('returns the tail of the list if the CR is lower than ICR of any Trove', async () => {
      await whaleShrimpTroveInit(contracts, signers);

      const sqrtLength = Math.ceil(Math.sqrt(7));

      const CR_Min = parseUnits('110', 16);

      let hintAddress;
      [hintAddress] = await hintHelpers.getApproxHint(CR_Min, sqrtLength, latestRandomSeed);

      const [ICR_hintAddress_Min] = await hintHelpers.getCurrentICR(hintAddress);
      const ICRPercent_hintAddress_Min = ICR_hintAddress_Min / parseUnits('1', 16);

      const getLastTrove = await sortedTrove.getLast();
      const [ICR_LastTrove] = await hintHelpers.getCurrentICR(getLastTrove);
      const ICRPercent_LastTrove = ICR_LastTrove / parseUnits('1', 16);

      const ICR_Difference_Min = ICRPercent_hintAddress_Min - ICRPercent_LastTrove;

      assert.isBelow(Number(ICR_Difference_Min), sqrtLength);
    });
  });
});
